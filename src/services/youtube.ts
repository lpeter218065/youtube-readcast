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

const INVIDIOUS_INSTANCES = [
  'https://yewtu.be',
  'https://invidious.nerdvpn.de',
  'https://yt.artemislena.eu',
  'https://invidious.flokinet.to'
] as const

const PIPED_APIS = [
  'https://api.piped.yt',
  'https://pipedapi.reallyaweso.me',
  'https://pipedapi.kavin.rocks'
] as const

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

  const errors: string[] = []

  // Step 1: inv.nadeko.net (known reliable), retry up to 3 times
  for (let attempt = 1; attempt <= 3; attempt++) {
    throwIfAborted(options.signal)
    options.onStatus?.(`尝试 inv.nadeko.net 获取字幕（第 ${attempt} 次）…`)
    try {
      const payload = await fetchCaptionsFromInvidiousSingle(videoId, 'https://inv.nadeko.net', options)
      setCachedCaptions(videoId, payload)
      return payload
    } catch (e) {
      const msg = e instanceof Error ? e.message : '未知错误'
      errors.push(msg)
      options.onStatus?.(`inv.nadeko.net 第 ${attempt} 次失败：${msg}`)
    }
  }

  // Step 2: YouTube direct via youtube-transcript
  options.onStatus?.('inv.nadeko.net 多次失败，尝试 YouTube 直连…')
  const languages = [...PREFERRED_LANGUAGES, null] as Array<string | null>
  for (let i = 0; i < languages.length; i++) {
    const language = languages[i]
    throwIfAborted(options.signal)

    try {
      const langLabel = language ?? '自动检测'
      options.onStatus?.(`尝试字幕语言 ${langLabel}（${i + 1}/${languages.length}）…`)

      const transcript = (await withTimeout(
        fetchTranscript(videoId, language ? { lang: language } : {}),
        5000
      )) as TranscriptLine[]

      throwIfAborted(options.signal)

      if (!transcript.length) {
        continue
      }

      options.onStatus?.(`找到 ${langLabel} 字幕，正在处理…`)

      const normalized = transcript.map(normalizeTranscriptLine)
      const segments = mergeCaptionBlocks(normalized).map((item) => ({
        start: item.offset / 1000,
        text: item.text
      }))

      if (!segments.length) {
        continue
      }

      options.onStatus?.('正在获取视频标题…')
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

      const msg = mapTranscriptError(videoId, error)
      errors.push(msg)
      options.onStatus?.(`YouTube 直连失败：${msg}`)
    }
  }

  // Step 3: parallel race of remaining Invidious instances + Piped
  options.onStatus?.('尝试其他备用字幕镜像源…')
  try {
    const payload = await Promise.any([
      fetchCaptionsFromInvidious(videoId, options),
      fetchCaptionsFromPiped(videoId, options)
    ])
    setCachedCaptions(videoId, payload)
    return payload
  } catch {
    errors.push('所有备用字幕源均失败')
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

interface InvidiousCaption {
  label: string
  language_code: string
  url: string
}

async function fetchCaptionsFromInvidiousSingle(
  videoId: string,
  instance: string,
  options: FetchCaptionsOptions
): Promise<CaptionPayload> {
  const host = new URL(instance).hostname

  const listResp = await withTimeout(
    fetch(`${instance}/api/v1/captions/${videoId}`, { signal: options.signal }),
    6000
  )
  if (!listResp.ok) throw new Error(`${host} returned ${listResp.status}`)

  const { captions = [] } = (await listResp.json()) as { captions?: InvidiousCaption[] }
  if (!captions.length) throw new Error(`${host} 无字幕`)

  const chosen =
    captions.find((c) => c.language_code?.startsWith('zh')) ??
    captions.find((c) => c.language_code?.startsWith('en')) ??
    captions.find((c) => c.language_code)

  if (!chosen) throw new Error(`${host} 无可用字幕轨道`)

  const vttResp = await withTimeout(
    fetch(`${instance}/api/v1/captions/${videoId}?label=${encodeURIComponent(chosen.label)}`, {
      signal: options.signal
    }),
    6000
  )
  if (!vttResp.ok) throw new Error(`${host} VTT 下载失败`)

  const segments = parseVtt(await vttResp.text())
  if (!segments.length) throw new Error(`${host} VTT 解析为空`)

  const title = (await fetchOEmbedTitle(videoId, options.signal)) ?? `YouTube Video ${videoId}`
  return { title, language: chosen.language_code, source: 'invidious', segments }
}

async function fetchCaptionsFromInvidious(
  videoId: string,
  options: FetchCaptionsOptions
): Promise<CaptionPayload> {
  for (const instance of INVIDIOUS_INSTANCES) {
    throwIfAborted(options.signal)
    const host = new URL(instance).hostname
    options.onStatus?.(`尝试通过 Invidious (${host}) 获取字幕…`)

    try {
      return await fetchCaptionsFromInvidiousSingle(videoId, instance, options)
    } catch (e) {
      console.log(`[invidious] ${host} error: ${e instanceof Error ? e.message : e}`)
      continue
    }
  }

  throw new Error('所有 Invidious 实例均无法获取字幕')
}

function parseVtt(vtt: string): Array<{ start: number; text: string }> {
  const segments: Array<{ start: number; text: string }> = []

  for (const block of vtt.split(/\n\n+/)) {
    const lines = block.trim().split('\n')
    const tsIdx = lines.findIndex((l) => l.includes('-->'))
    if (tsIdx === -1) continue

    const match = lines[tsIdx].match(/^(\d{2}):(\d{2}):(\d{2})[.,](\d{3})/)
    if (!match) continue

    const start =
      parseInt(match[1]) * 3600 +
      parseInt(match[2]) * 60 +
      parseInt(match[3]) +
      parseInt(match[4]) / 1000

    const text = lines
      .slice(tsIdx + 1)
      .join(' ')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim()

    if (text) segments.push({ start, text })
  }

  return segments
}

interface PipedSubtitle {
  url: string
  mimeType: string
  name: string
  code: string
  autoGenerated: boolean
}

async function fetchCaptionsFromPiped(
  videoId: string,
  options: FetchCaptionsOptions
): Promise<CaptionPayload> {
  for (const api of PIPED_APIS) {
    throwIfAborted(options.signal)
    const host = new URL(api).hostname
    options.onStatus?.(`尝试通过 Piped (${host}) 获取字幕…`)

    try {
      const url = `${api}/streams/${videoId}`
      console.log(`[piped] GET ${url}`)
      const resp = await withTimeout(
        fetch(url, { signal: options.signal }),
        8000
      )
      console.log(`[piped] ${api} status=${resp.status}`)
      if (!resp.ok) continue

      const data = (await resp.json()) as { subtitles?: PipedSubtitle[]; title?: string }
      const subtitles = data.subtitles ?? []
      console.log(`[piped] ${api} subtitles=${subtitles.length}`)
      if (!subtitles.length) continue

      const chosen =
        subtitles.find((s) => !s.autoGenerated && s.code.startsWith('zh')) ??
        subtitles.find((s) => s.code.startsWith('zh')) ??
        subtitles.find((s) => !s.autoGenerated && s.code.startsWith('en')) ??
        subtitles.find((s) => s.code.startsWith('en')) ??
        subtitles[0]

      if (!chosen) continue

      const vttResp = await withTimeout(
        fetch(chosen.url, { signal: options.signal }),
        8000
      )
      if (!vttResp.ok) continue

      const segments = parseVtt(await vttResp.text())
      if (!segments.length) continue

      const title =
        data.title?.trim() ||
        (await fetchOEmbedTitle(videoId, options.signal)) ||
        `YouTube Video ${videoId}`

      return { title, language: chosen.code, source: 'invidious', segments }
    } catch (e) {
      console.log(`[piped] ${api} error: ${e instanceof Error ? e.message : e}`)
      continue
    }
  }

  throw new Error('所有 Piped 实例均失败')
}
