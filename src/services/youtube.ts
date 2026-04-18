import {
  fetchTranscript,
  YoutubeTranscriptDisabledError,
  YoutubeTranscriptNotAvailableError,
  YoutubeTranscriptNotAvailableLanguageError,
  YoutubeTranscriptTooManyRequestError,
  YoutubeTranscriptVideoUnavailableError
} from 'youtube-transcript/dist/youtube-transcript.esm.js'
import type { CaptionPayload } from '../types'
import { normalizeCaptionText } from '../utils/text'

const VIDEO_ID_PATTERN =
  /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/i
const PREFERRED_LANGUAGES = ['zh-CN', 'zh-Hans', 'zh', 'en'] as const
const BLOCK_MAX_CHARS = 220
const CAPTION_CACHE_TTL_MS = 12 * 60 * 60 * 1000

const captionCache = new Map<
  string,
  {
    expiresAt: number
    payload: CaptionPayload
  }
>()

interface FetchCaptionsOptions {
  signal?: AbortSignal
  onStatus?: (message: string) => void
}

interface TranscriptLine {
  text: string
  duration: number
  offset: number
  lang?: string
}

interface NormalizedTranscriptLine extends TranscriptLine {
  text: string
  duration: number
  offset: number
}

export function extractVideoId(input: string): string | null {
  const trimmed = input.trim()

  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed) && !trimmed.includes('http')) {
    return trimmed
  }

  const directMatch = trimmed.match(VIDEO_ID_PATTERN)
  if (directMatch?.[1]) {
    return directMatch[1]
  }

  const shortsMatch = trimmed.match(/youtube\.com\/shorts\/([^&?/\s]{11})/i)
  return shortsMatch?.[1] ?? null
}

export async function fetchCaptions(
  videoId: string,
  options: FetchCaptionsOptions = {}
): Promise<CaptionPayload> {
  throwIfAborted(options.signal)

  const cachedPayload = getCachedCaptions(videoId)
  if (cachedPayload) {
    options.onStatus?.('命中字幕缓存。')
    return cachedPayload
  }

  options.onStatus?.('尝试通过 youtube-transcript 获取字幕…')

  const errors: string[] = []

  for (const language of [...PREFERRED_LANGUAGES, null] as Array<string | null>) {
    throwIfAborted(options.signal)

    try {
      if (language) {
        options.onStatus?.(`尝试字幕语言 ${language}…`)
      }

      const transcript = (await withTimeout(
        fetchTranscript(videoId, language ? { lang: language } : {}),
        5000
      )) as TranscriptLine[]

      throwIfAborted(options.signal)

      if (!transcript.length) {
        continue
      }

      const normalized = transcript.map(normalizeTranscriptLine)
      const segments = mergeCaptionBlocks(normalized).map((item) => ({
        start: item.offset / 1000,
        text: item.text
      }))

      if (!segments.length) {
        continue
      }

      const payload: CaptionPayload = {
        title:
          (await fetchOEmbedTitle(videoId, options.signal)) ?? `YouTube Video ${videoId}`,
        language: transcript.find((item) => item.lang)?.lang ?? language ?? 'unknown',
        source: 'transcript',
        segments
      }

      setCachedCaptions(videoId, payload)
      return payload
    } catch (error) {
      if (error instanceof YoutubeTranscriptNotAvailableLanguageError) {
        continue
      }

      errors.push(mapTranscriptError(videoId, error))
    }
  }

  throw new Error(errors[errors.length - 1] ?? '字幕获取失败')
}

function getCachedCaptions(videoId: string): CaptionPayload | null {
  const entry = captionCache.get(videoId)

  if (!entry) {
    return null
  }

  if (entry.expiresAt <= Date.now()) {
    captionCache.delete(videoId)
    return null
  }

  return entry.payload
}

function setCachedCaptions(videoId: string, payload: CaptionPayload): void {
  captionCache.set(videoId, {
    expiresAt: Date.now() + CAPTION_CACHE_TTL_MS,
    payload
  })
}

function normalizeTranscriptLine(line: TranscriptLine): NormalizedTranscriptLine {
  return {
    ...line,
    duration: normalizeTimeValue(line.duration),
    offset: normalizeTimeValue(line.offset),
    text: normalizeMergedCaptionText(line.text)
  }
}

function mergeCaptionBlocks(
  captions: NormalizedTranscriptLine[]
): NormalizedTranscriptLine[] {
  const cleaned = captions.filter((item) => item.text)
  const blocks: NormalizedTranscriptLine[] = []

  for (const item of cleaned) {
    const current = blocks[blocks.length - 1]

    if (!current) {
      blocks.push({ ...item })
      continue
    }

    const gap = item.offset - (current.offset + current.duration)
    const mergedText = joinCaptionText(current.text, item.text)
    const shouldStartNewBlock =
      mergedText.length > BLOCK_MAX_CHARS ||
      (gap > 3500 && looksCompleteSentence(current.text)) ||
      (looksCompleteSentence(current.text) && current.text.length > 80)

    if (shouldStartNewBlock) {
      blocks.push({ ...item })
      continue
    }

    current.text = mergedText
    current.duration = Math.max(
      item.offset + item.duration - current.offset,
      current.duration
    )
  }

  return blocks
}

function normalizeMergedCaptionText(text = ''): string {
  return normalizeCaptionText(text)
    .replace(/([\u4e00-\u9fff])\s+([\u4e00-\u9fff])/g, '$1$2')
    .replace(/([\u4e00-\u9fff])\s+([，。！？；：、“”‘’（）])/g, '$1$2')
    .replace(/([（“‘])\s+([\u4e00-\u9fffA-Za-z0-9])/g, '$1$2')
    .trim()
}

function joinCaptionText(left: string, right: string): string {
  if (!left) {
    return right
  }

  if (!right) {
    return left
  }

  if (/[A-Za-z0-9]$/.test(left) && /^[A-Za-z0-9]/.test(right)) {
    return `${left} ${right}`
  }

  if (/[-/()]$/.test(left) || /^[,.;:!?%)]/.test(right)) {
    return `${left}${right}`
  }

  if (
    /[\u4e00-\u9fff”’）】》]$/.test(left) ||
    /^[\u4e00-\u9fff，。！？；：、）】》]/.test(right)
  ) {
    return `${left}${right}`
  }

  return `${left} ${right}`
}

function looksCompleteSentence(text: string): boolean {
  return /[。！？.!?…]$/.test(text.trim())
}

function normalizeTimeValue(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }

  if (!Number.isInteger(value) || value < 100) {
    return Math.round(value * 1000)
  }

  return value
}

function mapTranscriptError(videoId: string, error: unknown): string {
  if (error instanceof YoutubeTranscriptTooManyRequestError) {
    return 'YouTube 当前要求验证码或限制过多请求，暂时无法抓取字幕'
  }

  if (error instanceof YoutubeTranscriptVideoUnavailableError) {
    return `视频不可用: ${videoId}`
  }

  if (
    error instanceof YoutubeTranscriptDisabledError ||
    error instanceof YoutubeTranscriptNotAvailableError
  ) {
    return '该视频没有公开字幕，当前版本仅支持可直接访问字幕的公开视频'
  }

  return error instanceof Error ? error.message : '字幕获取失败'
}

async function fetchOEmbedTitle(
  videoId: string,
  parentSignal?: AbortSignal
): Promise<string | null> {
  throwIfAborted(parentSignal)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    controller.abort(new Error('oEmbed 请求超时'))
  }, 4000)

  const abortFromParent = () => {
    controller.abort(parentSignal?.reason)
  }

  if (parentSignal) {
    if (parentSignal.aborted) {
      abortFromParent()
    } else {
      parentSignal.addEventListener('abort', abortFromParent, { once: true })
    }
  }

  try {
    const url = new URL('https://www.youtube.com/oembed')
    url.searchParams.set('url', `https://www.youtube.com/watch?v=${videoId}`)
    url.searchParams.set('format', 'json')

    const response = await fetch(url, {
      signal: controller.signal
    })

    if (!response.ok) {
      return null
    }

    const data = (await response.json()) as { title?: string }
    return data.title ?? null
  } catch {
    return null
  } finally {
    clearTimeout(timeoutId)
    parentSignal?.removeEventListener('abort', abortFromParent)
  }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw signal.reason instanceof Error
      ? signal.reason
      : new Error('请求已取消')
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error(`超时 (${ms}ms)`)), ms)
    promise.then(
      (v) => { clearTimeout(id); resolve(v) },
      (e) => { clearTimeout(id); reject(e) }
    )
  })
}
