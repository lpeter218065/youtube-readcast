import { getPageHtml } from './page'
import { buildPrompt, buildVideoPrompt } from './prompt'
import { streamGenerate } from './services/gemini'
import { extractVideoId, fetchCaptions } from './services/youtube'
import type { CaptionPayload, GenerateRequestBody } from './types'
import { sseEvent } from './utils/sse'

interface Env {}

const HTML_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'no-store',
  'content-security-policy':
    "default-src 'self'; connect-src 'self' https://www.youtube.com https://noembed.com; frame-src 'self'; img-src 'self' data: https:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'self'"
}

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type',
  'access-control-allow-methods': 'GET,POST,OPTIONS'
}

const STREAM_HEADERS = {
  'content-type': 'text/event-stream; charset=utf-8',
  'cache-control': 'no-cache, no-store, must-revalidate',
  connection: 'keep-alive',
  'x-accel-buffering': 'no',
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type',
  'access-control-allow-methods': 'GET,POST,OPTIONS'
}

export default {
  async fetch(request: Request, _env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: JSON_HEADERS })
    }

    if (request.method === 'GET' && url.pathname === '/') {
      return new Response(getPageHtml(), { headers: HTML_HEADERS })
    }

    if (request.method === 'POST' && url.pathname === '/api/generate') {
      return handleGenerate(request)
    }

    if (request.method === 'POST' && url.pathname === '/api/captions') {
      return handleCaptions(request)
    }

    return jsonResponse({ error: 'Not Found' }, 404)
  }
}

async function handleGenerate(request: Request): Promise<Response> {
  const body = (await safeJson(request)) as GenerateRequestBody | null
  const inputUrl = body?.url?.trim() ?? ''
  const apiKey = body?.apiKey?.trim() ?? ''

  if (!inputUrl) {
    return jsonResponse({ error: 'YouTube 链接不能为空' }, 400)
  }

  if (!apiKey) {
    return jsonResponse({ error: 'Gemini API Key 不能为空' }, 400)
  }

  const videoId = extractVideoId(inputUrl)

  if (!videoId) {
    return jsonResponse({ error: '无法识别的 YouTube 链接' }, 400)
  }

  const abortController = new AbortController()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => controller.enqueue(sseEvent(event, data))

      try {
        send('status', { message: '正在解析视频链接…' })

        let prompt: string

        const clientCaptions = getClientCaptions(body?.captions)
        const clientTranscript = body?.transcript?.trim()

        // If the browser already prepared structured captions, use them directly.
        if (clientCaptions) {
          send('meta', {
            title: clientCaptions.title,
            language: clientCaptions.language,
            source: clientCaptions.source
          })
          send('status', { message: '字幕已准备，开始生成中文排版稿…' })
          prompt = buildPrompt(clientCaptions)
        } else if (clientTranscript) {
          const title = body?.title?.trim() || `YouTube Video ${videoId}`
          send('meta', { title, language: 'unknown', source: 'client' })
          send('status', { message: '字幕已准备，开始生成中文排版稿…' })
          prompt = buildPrompt({
            title,
            language: 'unknown',
            source: 'client',
            segments: [{ start: 0, text: clientTranscript }]
          })
        } else {
          try {
            const captions = await fetchCaptions(videoId, {
              signal: abortController.signal,
              onStatus: (message) => send('status', { message })
            })

            send('meta', {
              title: captions.title,
              language: captions.language,
              source: captions.source
            })
            send('status', { message: '字幕已准备，开始生成中文排版稿…' })
            prompt = buildPrompt(captions)
          } catch (error) {
            send('status', {
              message: `服务端字幕抓取失败：${toErrorMessage(error)}；改用 Gemini 直接解析…`
            })
            prompt = buildVideoPrompt(videoId)
          }
        }

        for await (const chunk of streamGenerate({ apiKey, prompt, model: body?.model, signal: abortController.signal })) {
          send('chunk', { html: chunk })
        }

        send('done', { ok: true })
      } catch (error) {
        send('error', { message: toErrorMessage(error) })
      } finally {
        controller.close()
      }
    },
    cancel() {
      abortController.abort()
    }
  })

  return new Response(stream, { headers: STREAM_HEADERS })
}

async function handleCaptions(request: Request): Promise<Response> {
  const body = (await safeJson(request)) as { videoId?: string } | null
  const videoId = body?.videoId?.trim()

  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return jsonResponse({ error: 'Invalid video ID' }, 400)
  }

  try {
    const captions = await fetchCaptions(videoId, { signal: request.signal })
    return jsonResponse(captions)
  } catch (err) {
    return jsonResponse({ error: toErrorMessage(err) }, 500)
  }
}

function getClientCaptions(input: unknown): CaptionPayload | null {
  if (!input || typeof input !== 'object') {
    return null
  }

  const data = input as Partial<CaptionPayload>
  const title = typeof data.title === 'string' ? data.title.trim() : ''
  const language = typeof data.language === 'string' ? data.language.trim() : ''
  const source =
    data.source === 'youtube' || data.source === 'invidious' || data.source === 'client'
      ? data.source
      : null
  const segments = Array.isArray(data.segments)
    ? data.segments
        .map((segment) => {
          if (!segment || typeof segment !== 'object') {
            return null
          }

          const start =
            typeof segment.start === 'number' && Number.isFinite(segment.start)
              ? segment.start
              : null
          const text = typeof segment.text === 'string' ? segment.text.trim() : ''

          if (start === null || !text) {
            return null
          }

          return { start, text }
        })
        .filter((segment): segment is CaptionPayload['segments'][number] => Boolean(segment))
    : []

  if (!title || !language || !source || !segments.length) {
    return null
  }

  return {
    title,
    language,
    source,
    segments
  }
}

async function safeJson(request: Request): Promise<unknown | null> {
  try {
    return await request.json()
  } catch {
    return null
  }
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: JSON_HEADERS
  })
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '发生未知错误'
}
