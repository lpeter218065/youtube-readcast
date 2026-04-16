import type { CaptionPayload, CaptionSegment } from '../types'
import { normalizeCaptionText } from '../utils/text'

const WATCH_HEADERS = {
  'accept-language': 'en-US,en;q=0.9',
  'user-agent': 'Mozilla/5.0 (compatible; yt-dialogue-generator/1.0)'
}

const INVIDIOUS_INSTANCES = [
  'https://yewtu.be',
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
  'https://invidious.private.coffee',
  'https://vid.puffyan.us'
]

interface FetchCaptionsOptions {
  signal?: AbortSignal
  onStatus?: (message: string) => void
}

interface YouTubeTrack {
  baseUrl: string
  kind?: string
  languageCode?: string
  name?: {
    simpleText?: string
    runs?: Array<{ text: string }>
  }
  vssId?: string
}

interface InvidiousTrack {
  label?: string
  languageCode?: string
}

interface InvidiousVideoResponse {
  title?: string
}

interface InvidiousCaptionsResponse {
  captions?: InvidiousTrack[]
}

export function extractVideoId(input: string): string | null {
  const trimmed = input.trim()

  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed
  }

  let url: URL

  try {
    url = new URL(trimmed)
  } catch {
    return null
  }

  const hostname = url.hostname.replace(/^www\./, '')

  if (hostname === 'youtu.be') {
    const candidate = url.pathname.split('/').filter(Boolean)[0]
    return candidate && /^[a-zA-Z0-9_-]{11}$/.test(candidate) ? candidate : null
  }

  if (hostname === 'youtube.com' || hostname === 'm.youtube.com') {
    if (url.pathname === '/watch') {
      const candidate = url.searchParams.get('v')
      return candidate && /^[a-zA-Z0-9_-]{11}$/.test(candidate) ? candidate : null
    }

    const candidate = url.pathname.split('/').filter(Boolean)[1]
    if (
      (url.pathname.startsWith('/embed/') ||
        url.pathname.startsWith('/shorts/') ||
        url.pathname.startsWith('/live/')) &&
      candidate &&
      /^[a-zA-Z0-9_-]{11}$/.test(candidate)
    ) {
      return candidate
    }
  }

  return null
}

export async function fetchCaptions(
  videoId: string,
  options: FetchCaptionsOptions = {}
): Promise<CaptionPayload> {
  options.onStatus?.('尝试直接从 YouTube 抓取字幕…')

  try {
    return await fetchDirectCaptions(videoId, options)
  } catch (directError) {
    options.onStatus?.('YouTube 直连失败，切换到备用字幕源…')
    return fetchInvidiousCaptions(videoId, options, directError)
  }
}

async function fetchDirectCaptions(
  videoId: string,
  options: FetchCaptionsOptions
): Promise<CaptionPayload> {
  const watchUrl = new URL('https://www.youtube.com/watch')
  watchUrl.searchParams.set('v', videoId)
  watchUrl.searchParams.set('hl', 'en')
  watchUrl.searchParams.set('bpctr', '9999999999')
  watchUrl.searchParams.set('has_verified', '1')

  const response = await fetch(watchUrl, {
    headers: WATCH_HEADERS,
    signal: options.signal
  })

  if (!response.ok) {
    throw new Error(`YouTube 页面返回 ${response.status}`)
  }

  const html = await response.text()
  const playerResponse = extractEmbeddedJson(html, 'ytInitialPlayerResponse') as {
    captions?: {
      playerCaptionsTracklistRenderer?: {
        captionTracks?: YouTubeTrack[]
      }
    }
    videoDetails?: {
      title?: string
    }
  } | null

  const tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks

  if (!tracks?.length) {
    throw new Error('视频没有可用字幕')
  }

  const track = selectCaptionTrack(tracks)
  const captionUrl = new URL(track.baseUrl)

  if (!captionUrl.searchParams.has('fmt')) {
    captionUrl.searchParams.set('fmt', 'srv3')
  }

  const captionResponse = await fetch(captionUrl, {
    headers: WATCH_HEADERS,
    signal: options.signal
  })

  if (!captionResponse.ok) {
    throw new Error(`字幕文件下载失败 (${captionResponse.status})`)
  }

  const xml = await captionResponse.text()
  const segments = compactSegments(parseXmlCaptions(xml))

  if (!segments.length) {
    throw new Error('字幕内容为空')
  }

  return {
    title:
      playerResponse?.videoDetails?.title ??
      extractHtmlTitle(html) ??
      `YouTube Video ${videoId}`,
    language: track.languageCode ?? 'unknown',
    source: 'youtube',
    segments
  }
}

async function fetchInvidiousCaptions(
  videoId: string,
  options: FetchCaptionsOptions,
  directError: unknown
): Promise<CaptionPayload> {
  let lastError = directError

  for (const instance of INVIDIOUS_INSTANCES) {
    options.onStatus?.(`尝试备用实例 ${new URL(instance).hostname}…`)

    try {
      const captionsResponse = await fetch(`${instance}/api/v1/captions/${videoId}`, {
        signal: options.signal
      })

      if (!captionsResponse.ok) {
        throw new Error(`字幕列表返回 ${captionsResponse.status}`)
      }

      const captionsData = (await captionsResponse.json()) as InvidiousCaptionsResponse
      const track = captionsData.captions?.length
        ? selectCaptionTrack(captionsData.captions)
        : null

      if (!track?.label) {
        throw new Error('没有找到可用字幕')
      }

      const trackUrl = new URL(`${instance}/api/v1/captions/${videoId}`)
      trackUrl.searchParams.set('label', track.label)
      trackUrl.searchParams.set('region', 'US')

      const [captionTextResponse, videoResponse] = await Promise.all([
        fetch(trackUrl, { signal: options.signal }),
        fetch(`${instance}/api/v1/videos/${videoId}`, { signal: options.signal })
      ])

      if (!captionTextResponse.ok) {
        throw new Error(`字幕文件返回 ${captionTextResponse.status}`)
      }

      const vtt = await captionTextResponse.text()
      const segments = compactSegments(parseVttCaptions(vtt))

      if (!segments.length) {
        throw new Error('字幕内容为空')
      }

      let title = `YouTube Video ${videoId}`

      if (videoResponse.ok) {
        const videoData = (await videoResponse.json()) as InvidiousVideoResponse
        title = videoData.title ?? title
      }

      return {
        title,
        language: track.languageCode ?? 'unknown',
        source: 'invidious',
        segments
      }
    } catch (error) {
      lastError = error
    }
  }

  throw new Error(
    `字幕抓取失败。直连错误：${toErrorMessage(directError)}；备用源错误：${toErrorMessage(lastError)}`
  )
}

function extractEmbeddedJson(source: string, anchor: string): unknown | null {
  const anchorIndex = source.indexOf(anchor)

  if (anchorIndex === -1) {
    return null
  }

  const startIndex = source.indexOf('{', anchorIndex)

  if (startIndex === -1) {
    return null
  }

  const block = readBalancedBlock(source, startIndex)

  if (!block) {
    return null
  }

  try {
    return JSON.parse(block)
  } catch {
    return null
  }
}

function readBalancedBlock(source: string, startIndex: number): string | null {
  let depth = 0
  let inString = false
  let escaped = false

  for (let index = startIndex; index < source.length; index += 1) {
    const char = source[index]

    if (escaped) {
      escaped = false
      continue
    }

    if (char === '\\') {
      escaped = true
      continue
    }

    if (char === '"') {
      inString = !inString
      continue
    }

    if (inString) {
      continue
    }

    if (char === '{') {
      depth += 1
    }

    if (char === '}') {
      depth -= 1

      if (depth === 0) {
        return source.slice(startIndex, index + 1)
      }
    }
  }

  return null
}

function selectCaptionTrack<T extends YouTubeTrack | InvidiousTrack>(tracks: T[]): T {
  return [...tracks].sort((left, right) => scoreTrack(right) - scoreTrack(left))[0]
}

function scoreTrack(track: YouTubeTrack | InvidiousTrack): number {
  const languageCode = (track.languageCode ?? '').toLowerCase()
  const label = getTrackLabel(track).toLowerCase()
  const isAutoGenerated =
    ('kind' in track && track.kind === 'asr') ||
    ('vssId' in track && track.vssId?.startsWith('a.') === true) ||
    label.includes('auto')

  let score = 0

  if (languageCode === 'en') {
    score += 120
  } else if (languageCode.startsWith('en-')) {
    score += 110
  } else if (languageCode.startsWith('zh')) {
    score += 95
  } else if (languageCode) {
    score += 80
  }

  score += isAutoGenerated ? 15 : 40

  if (label.includes('english')) {
    score += 12
  }

  if (label.includes('manual')) {
    score += 6
  }

  return score
}

function getTrackLabel(track: YouTubeTrack | InvidiousTrack): string {
  if ('label' in track && track.label) {
    return track.label
  }

  if ('name' in track && track.name) {
    return (
      track.name.simpleText ??
      track.name.runs?.map((run) => run.text).join('') ??
      ''
    )
  }

  return ''
}

function extractHtmlTitle(html: string): string | null {
  const match = html.match(/<title>([\s\S]*?)<\/title>/i)
  return match ? normalizeCaptionText(match[1].replace(/ - YouTube$/i, '')) : null
}

function parseXmlCaptions(xml: string): CaptionSegment[] {
  const matches = xml.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)
  const segments: CaptionSegment[] = []

  for (const match of matches) {
    const attrs = match[1]
    const text = normalizeCaptionText(match[2] ?? '')
    const start = Number.parseFloat(getAttribute(attrs, 'start') ?? '0')

    if (!text) {
      continue
    }

    segments.push({
      start: Number.isFinite(start) ? start : 0,
      text
    })
  }

  return segments
}

function parseVttCaptions(vtt: string): CaptionSegment[] {
  const blocks = vtt.replace(/\r\n/g, '\n').split(/\n{2,}/)
  const segments: CaptionSegment[] = []

  for (const block of blocks) {
    const lines = block
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)

    if (!lines.length || lines[0] === 'WEBVTT' || lines[0].startsWith('NOTE')) {
      continue
    }

    let cursor = 0

    if (/^\d+$/.test(lines[cursor])) {
      cursor += 1
    }

    const timingLine = lines[cursor]

    if (!timingLine || !timingLine.includes('-->')) {
      continue
    }

    const [rawStart] = timingLine.split('-->')
    const start = parseVttTime(rawStart)
    const text = normalizeCaptionText(lines.slice(cursor + 1).join(' '))

    if (!text) {
      continue
    }

    segments.push({ start, text })
  }

  return segments
}

function compactSegments(segments: CaptionSegment[]): CaptionSegment[] {
  const compacted: CaptionSegment[] = []

  for (const segment of segments) {
    const previous = compacted[compacted.length - 1]

    if (!previous) {
      compacted.push(segment)
      continue
    }

    if (segment.text === previous.text) {
      continue
    }

    if (segment.text.endsWith(previous.text)) {
      previous.text = segment.text
      continue
    }

    if (previous.text.endsWith(segment.text)) {
      continue
    }

    compacted.push(segment)
  }

  return compacted
}

function parseVttTime(input: string): number {
  const cleaned = input.trim().split(' ')[0].replace(',', '.')
  const parts = cleaned.split(':').map((part) => Number.parseFloat(part))

  if (parts.some((part) => Number.isNaN(part))) {
    return 0
  }

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  }

  if (parts.length === 2) {
    return parts[0] * 60 + parts[1]
  }

  return parts[0] ?? 0
}

function getAttribute(input: string, attributeName: string): string | null {
  const match = input.match(new RegExp(`${attributeName}="([^"]+)"`))
  return match?.[1] ?? null
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '未知错误'
}

