import type { CaptionPayload, CaptionSegment } from '../types'
import { normalizeCaptionText } from '../utils/text'

const WATCH_HEADERS = {
  'accept-language': 'en-US,en;q=0.9',
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  cookie: 'CONSENT=PENDING+987; SOCS=CAESEwgDEgk2NjI1NTY1MjQaAmVuIAEaBgiA_t-2Bg'
}

const WATCH_TIMEOUT_MS = 15000
const CAPTION_TIMEOUT_MS = 6000
const INVIDIOUS_TIMEOUT_MS = 5000

const INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
  'https://yt.chocolatemoo53.com',
  'https://vid.puffyan.us',
  'https://inv.thepixora.com'
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
  url?: string
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
  // Try the timedtext list API to discover available tracks
  const listUrl = new URL('https://www.youtube.com/api/timedtext')
  listUrl.searchParams.set('v', videoId)
  listUrl.searchParams.set('type', 'list')

  const listXml = await fetchText(listUrl, WATCH_HEADERS, CAPTION_TIMEOUT_MS, options.signal)

  // Parse track list from XML like <track ... lang_code="en" kind="asr" ... />
  const trackMatches = [...listXml.matchAll(/<track\s+([^>]+)>/g)]
  if (!trackMatches.length) {
    throw new Error('视频没有可用字幕')
  }

  // Find best track: prefer non-asr en, then asr en, then any
  let bestLang = 'en'
  let bestKind = ''
  for (const m of trackMatches) {
    const attrs = m[1]
    const lang = attrs.match(/lang_code="([^"]+)"/)?.[1] ?? ''
    const kind = attrs.match(/kind="([^"]+)"/)?.[1] ?? ''
    if (lang === 'en' && kind !== 'asr') {
      bestLang = lang
      bestKind = kind
      break
    }
    if (lang === 'en') {
      bestLang = lang
      bestKind = kind
    }
  }

  // Fetch the actual caption content
  const captionUrl = new URL('https://www.youtube.com/api/timedtext')
  captionUrl.searchParams.set('v', videoId)
  captionUrl.searchParams.set('lang', bestLang)
  if (bestKind) captionUrl.searchParams.set('kind', bestKind)
  captionUrl.searchParams.set('fmt', 'srv3')

  const xml = await fetchText(captionUrl, WATCH_HEADERS, CAPTION_TIMEOUT_MS, options.signal)
  const segments = compactSegments(parseXmlCaptions(xml))

  if (!segments.length) {
    throw new Error('字幕内容为空')
  }

  const title =
    (await fetchOEmbedTitle(videoId, options.signal)) ?? `YouTube Video ${videoId}`

  return {
    title,
    language: bestLang,
    source: 'youtube',
    segments
  }
}

interface InnertubePlayerResponse {
  captions?: {
    playerCaptionsTracklistRenderer?: {
      captionTracks?: YouTubeTrack[]
    }
  }
  videoDetails?: {
    title?: string
  }
}

async function fetchInnertubePlayer(
  videoId: string,
  parentSignal?: AbortSignal
): Promise<InnertubePlayerResponse> {
  const requestState = createTimedSignal(parentSignal, WATCH_TIMEOUT_MS)

  try {
    const response = await fetch(
      'https://www.youtube.com/youtubei/v1/player?prettyPrint=false',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'user-agent': WATCH_HEADERS['user-agent']
        },
        body: JSON.stringify({
          videoId,
          context: {
            client: {
              hl: 'en',
              gl: 'US',
              clientName: 'WEB_EMBEDDED_PLAYER',
              clientVersion: '1.20241126.01.00'
            },
            thirdParty: {
              embedUrl: 'https://www.youtube.com/'
            }
          },
          contentCheckOk: true,
          racyCheckOk: true
        }),
        signal: requestState.signal
      }
    )

    if (!response.ok) {
      throw new Error(`Innertube API 返回 ${response.status}`)
    }

    return (await response.json()) as InnertubePlayerResponse
  } finally {
    requestState.cleanup()
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
      const captionsData = (await fetchJson(
        `${instance}/api/v1/captions/${videoId}`,
        INVIDIOUS_TIMEOUT_MS,
        options.signal
      )) as InvidiousCaptionsResponse
      const track = captionsData.captions?.length
        ? selectCaptionTrack(captionsData.captions)
        : null

      if (!track?.label) {
        throw new Error('没有找到可用字幕')
      }

      const segments = await fetchInvidiousTrackBody(
        instance,
        videoId,
        track,
        options.signal
      )

      if (!segments.length) {
        throw new Error('字幕内容为空')
      }

      const videoData = (await fetchJson(
        `${instance}/api/v1/videos/${videoId}`,
        INVIDIOUS_TIMEOUT_MS,
        options.signal
      ).catch(() => null)) as InvidiousVideoResponse | null
      const title =
        videoData?.title ??
        (await fetchOEmbedTitle(videoId, options.signal)) ??
        `YouTube Video ${videoId}`

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

async function fetchPlayerResponsePage(
  url: URL,
  timeoutMs: number,
  parentSignal?: AbortSignal
): Promise<{ html: string; playerResponse: unknown }> {
  const requestState = createTimedSignal(parentSignal, timeoutMs)

  try {
    const response = await fetch(url, {
      headers: WATCH_HEADERS,
      signal: requestState.signal
    })

    if (!response.ok || !response.body) {
      throw new Error(`YouTube 页面返回 ${response.status}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let html = ''

    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        break
      }

      html += decoder.decode(value, { stream: true })
      const playerResponse = extractEmbeddedJson(html, 'ytInitialPlayerResponse')

      if (playerResponse) {
        await reader.cancel()
        return { html, playerResponse }
      }
    }

    html += decoder.decode()
    const playerResponse = extractEmbeddedJson(html, 'ytInitialPlayerResponse')

    if (!playerResponse) {
      throw new Error('页面中没有找到字幕元数据')
    }

    return { html, playerResponse }
  } finally {
    requestState.cleanup()
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

async function fetchInvidiousTrackBody(
  instance: string,
  videoId: string,
  track: InvidiousTrack,
  parentSignal?: AbortSignal
): Promise<CaptionSegment[]> {
  for (const candidate of buildInvidiousTrackUrls(instance, videoId, track)) {
    try {
      const vtt = await fetchText(candidate, undefined, INVIDIOUS_TIMEOUT_MS, parentSignal)
      const segments = compactSegments(parseVttCaptions(vtt))

      if (segments.length) {
        return segments
      }
    } catch {
      continue
    }
  }

  return []
}

function buildInvidiousTrackUrls(
  instance: string,
  videoId: string,
  track: InvidiousTrack
): URL[] {
  const urls: URL[] = []

  if ('url' in track && typeof track.url === 'string' && track.url) {
    urls.push(new URL(track.url, instance))
  }

  if (track.label) {
    const labelUrl = new URL(`${instance}/api/v1/captions/${videoId}`)
    labelUrl.searchParams.set('label', track.label)
    labelUrl.searchParams.set('region', 'US')
    urls.push(labelUrl)
  }

  if (track.languageCode) {
    const langUrl = new URL(`${instance}/api/v1/captions/${videoId}`)
    langUrl.searchParams.set('lang', track.languageCode)
    urls.push(langUrl)
  }

  return dedupeUrls(urls)
}

function dedupeUrls(urls: URL[]): URL[] {
  const seen = new Set<string>()
  const unique: URL[] = []

  for (const url of urls) {
    const serialized = url.toString()

    if (seen.has(serialized)) {
      continue
    }

    seen.add(serialized)
    unique.push(url)
  }

  return unique
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

async function fetchOEmbedTitle(
  videoId: string,
  parentSignal?: AbortSignal
): Promise<string | null> {
  const url = new URL('https://www.youtube.com/oembed')
  url.searchParams.set('url', `https://www.youtube.com/watch?v=${videoId}`)
  url.searchParams.set('format', 'json')

  try {
    const data = (await fetchJson(url, 4000, parentSignal)) as { title?: string }
    return data.title ?? null
  } catch {
    return null
  }
}

async function fetchJson(
  url: string | URL,
  timeoutMs: number,
  parentSignal?: AbortSignal
): Promise<unknown> {
  const requestState = createTimedSignal(parentSignal, timeoutMs)

  try {
    const response = await fetch(url, { signal: requestState.signal })

    if (!response.ok) {
      throw new Error(`请求失败 (${response.status})`)
    }

    return await response.json()
  } finally {
    requestState.cleanup()
  }
}

async function fetchText(
  url: string | URL,
  headers: HeadersInit | undefined,
  timeoutMs: number,
  parentSignal?: AbortSignal
): Promise<string> {
  const requestState = createTimedSignal(parentSignal, timeoutMs)

  try {
    const response = await fetch(url, {
      headers,
      signal: requestState.signal
    })

    if (!response.ok) {
      throw new Error(`请求失败 (${response.status})`)
    }

    return await response.text()
  } finally {
    requestState.cleanup()
  }
}

function createTimedSignal(parentSignal: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    controller.abort(new Error(`请求超时（${timeoutMs}ms）`))
  }, timeoutMs)

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

  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timeoutId)
      parentSignal?.removeEventListener('abort', abortFromParent)
    }
  }
}
