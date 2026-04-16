import { getPageHtml } from './page'
import { buildPrompt } from './prompt'
import { streamGenerate } from './services/gemini'
import { extractVideoId, fetchCaptions } from './services/youtube'
import type { GenerateRequestBody } from './types'
import { sseEvent } from './utils/sse'

interface Env {}

const HTML_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'no-store',
  'content-security-policy':
    "default-src 'self'; connect-src 'self'; frame-src 'self'; img-src 'self' data: https:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'self'"
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

        const prompt = buildPrompt(captions)

        for await (const chunk of streamGenerate(apiKey, prompt, abortController.signal)) {
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
