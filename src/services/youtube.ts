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

interface YouTubeTimedTextSegment {
  utf8?: string
  tOffsetMs?: number
}

interface YouTubeTimedTextEvent {
  segs?: YouTubeTimedTextSegment[]
  tStartMs?: number
  dDurationMs?: number
}

interface YouTubeTimedTextResponse {
  events?: YouTubeTimedTextEvent[]
}

interface FlattenedCaptionEvent {
  text: string
  start: number
  end: number
}

interface YouTubeTranscriptResponse {
  actions?: Array<{
    updateEngagementPanelAction?: {
      content?: {
        transcriptRenderer?: {
          content?: {
            transcriptSearchPanelRenderer?: {
              body?: {
                transcriptSegmentListRenderer?: {
                  initialSegments?: Array<{
                    transcriptSegmentRenderer?: {
                      startMs?: string
                      endMs?: string
                      snippet?: {
                        runs?: Array<{ text?: string }>
                        simpleText?: string
                      }
                    }
                  }>
                }
              }
            }
          }
        }
      }
    }
  }>
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
  let title: string | null = null
  let language = 'unknown'
  let segments: CaptionSegment[] = []
  let discoveryError: unknown = null

  try {
    options.onStatus?.('尝试解析 YouTube 字幕轨…')
    const discovered = await discoverYouTubeCaptionState(videoId, options.signal)
    title = discovered.title

    if (discovered.tracks.length) {
      const track = selectCaptionTrack(discovered.tracks)
      language = track.languageCode ?? language
      options.onStatus?.('已定位字幕轨，尝试拉取字幕事件…')
      segments = await fetchYouTubeTrackSegments(track, language, options.signal)
    }
  } catch (error) {
    discoveryError = error
  }

  if (!segments.length) {
    options.onStatus?.('字幕轨拉取失败，尝试 transcript 接口…')

    try {
      const transcriptResult = await fetchTranscriptApiCaptions(videoId, options.signal)
      language = transcriptResult.language
      segments = transcriptResult.segments
    } catch (transcriptError) {
      discoveryError = new Error(
        `${toErrorMessage(discoveryError)}；transcript 接口失败：${toErrorMessage(transcriptError)}`
      )
    }
  }

  if (!segments.length) {
    options.onStatus?.('transcript 接口失败，回退到 timedtext 列表接口…')

    try {
      const legacyResult = await fetchLegacyTimedTextCaptions(videoId, options.signal)
      language = legacyResult.language
      segments = legacyResult.segments
    } catch (legacyError) {
      throw new Error(
        `YouTube 直连字幕抓取失败：${toErrorMessage(discoveryError ?? legacyError)}；timedtext 回退失败：${toErrorMessage(legacyError)}`
      )
    }
  }

  if (!segments.length) {
    throw new Error('字幕内容为空')
  }

  return {
    title:
      title ??
      (await fetchOEmbedTitle(videoId, options.signal)) ??
      `YouTube Video ${videoId}`,
    language,
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

interface InnertubeClientConfig {
  clientName: 'WEB' | 'WEB_EMBEDDED_PLAYER'
  clientVersion: string
  thirdParty?: {
    embedUrl: string
  }
}

async function fetchInnertubePlayer(
  videoId: string,
  client: InnertubeClientConfig,
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
              clientName: client.clientName,
              clientVersion: client.clientVersion
            },
            ...(client.thirdParty ? { thirdParty: client.thirdParty } : {})
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
  const instanceErrors: string[] = []

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

      if (!track || (!track.label && !track.languageCode && !track.url)) {
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
      instanceErrors.push(`${new URL(instance).hostname}: ${toErrorMessage(error)}`)
    }
  }

  throw new Error(
    `字幕抓取失败。直连错误：${toErrorMessage(directError)}；备用源错误：${instanceErrors.length ? instanceErrors.join('；') : toErrorMessage(lastError)}`
  )
}

async function discoverYouTubeCaptionState(
  videoId: string,
  parentSignal?: AbortSignal
): Promise<{ title: string | null; tracks: YouTubeTrack[] }> {
  let lastError: unknown = null

  const clients: InnertubeClientConfig[] = [
    {
      clientName: 'WEB',
      clientVersion: '2.20241126.01.00'
    },
    {
      clientName: 'WEB_EMBEDDED_PLAYER',
      clientVersion: '1.20241126.01.00',
      thirdParty: {
        embedUrl: 'https://www.youtube.com/'
      }
    }
  ]

  for (const client of clients) {
    try {
      const player = await fetchInnertubePlayer(videoId, client, parentSignal)
      const tracks = extractCaptionTracks(player)

      if (tracks.length) {
        return {
          title: player.videoDetails?.title ?? null,
          tracks
        }
      }

      lastError = new Error(`Innertube ${client.clientName} 没有返回字幕轨`)
    } catch (error) {
      lastError = error
    }
  }

  try {
    const watchUrl = new URL(`https://www.youtube.com/watch?v=${videoId}`)
    const { html, playerResponse } = await fetchPlayerResponsePage(
      watchUrl,
      WATCH_TIMEOUT_MS,
      parentSignal
    )
    const data = playerResponse as InnertubePlayerResponse
    const tracks = extractCaptionTracks(data)

    if (tracks.length) {
      return {
        title: data.videoDetails?.title ?? extractHtmlTitle(html),
        tracks
      }
    }

    lastError = new Error('页面中没有可用字幕轨')
  } catch (error) {
    lastError = error
  }

  throw new Error(`没有找到可用字幕轨：${toErrorMessage(lastError)}`)
}

function extractCaptionTracks(playerResponse: InnertubePlayerResponse): YouTubeTrack[] {
  return (
    playerResponse.captions?.playerCaptionsTracklistRenderer?.captionTracks?.filter(
      (track) => Boolean(track?.baseUrl)
    ) ?? []
  )
}

async function fetchYouTubeTrackSegments(
  track: YouTubeTrack,
  languageCode: string,
  parentSignal?: AbortSignal
): Promise<CaptionSegment[]> {
  const jsonUrl = new URL(track.baseUrl)
  jsonUrl.searchParams.set('fmt', 'json3')

  try {
    const data = (await fetchJson(
      jsonUrl,
      CAPTION_TIMEOUT_MS,
      parentSignal,
      WATCH_HEADERS
    )) as YouTubeTimedTextResponse
    const jsonSegments = parseJson3Captions(data.events ?? [], languageCode)

    if (jsonSegments.length) {
      return compactSegments(jsonSegments)
    }
  } catch {
    // Fall through to XML fallback.
  }

  const xmlUrl = new URL(track.baseUrl)
  xmlUrl.searchParams.set('fmt', 'srv3')
  const xml = await fetchText(xmlUrl, undefined, CAPTION_TIMEOUT_MS, parentSignal)
  return compactSegments(parseXmlCaptions(xml))
}

async function fetchLegacyTimedTextCaptions(
  videoId: string,
  parentSignal?: AbortSignal
): Promise<{ language: string; segments: CaptionSegment[] }> {
  const listUrl = new URL('https://www.youtube.com/api/timedtext')
  listUrl.searchParams.set('v', videoId)
  listUrl.searchParams.set('type', 'list')

  const listXml = await fetchText(listUrl, WATCH_HEADERS, CAPTION_TIMEOUT_MS, parentSignal)
  const trackMatches = [...listXml.matchAll(/<track\s+([^>]+)>/g)]

  if (!trackMatches.length) {
    throw new Error('视频没有可用字幕')
  }

  let bestLang = 'en'
  let bestKind = ''

  for (const match of trackMatches) {
    const attrs = match[1]
    const language = attrs.match(/lang_code="([^"]+)"/)?.[1] ?? ''
    const kind = attrs.match(/kind="([^"]+)"/)?.[1] ?? ''

    if (language === 'en' && kind !== 'asr') {
      bestLang = language
      bestKind = kind
      break
    }

    if (language === 'en') {
      bestLang = language
      bestKind = kind
    }
  }

  const captionUrl = new URL('https://www.youtube.com/api/timedtext')
  captionUrl.searchParams.set('v', videoId)
  captionUrl.searchParams.set('lang', bestLang)

  if (bestKind) {
    captionUrl.searchParams.set('kind', bestKind)
  }

  captionUrl.searchParams.set('fmt', 'srv3')

  const xml = await fetchText(captionUrl, WATCH_HEADERS, CAPTION_TIMEOUT_MS, parentSignal)
  const segments = compactSegments(parseXmlCaptions(xml))

  if (!segments.length) {
    throw new Error('timedtext 返回了空字幕')
  }

  return {
    language: bestLang,
    segments
  }
}

async function fetchTranscriptApiCaptions(
  videoId: string,
  parentSignal?: AbortSignal
): Promise<{ language: string; segments: CaptionSegment[] }> {
  const candidates = [
    { language: 'en', automatic: false },
    { language: 'en', automatic: true },
    { language: 'zh', automatic: false },
    { language: 'zh', automatic: true }
  ]

  let lastError: unknown = null

  for (const candidate of candidates) {
    try {
      const params = buildTranscriptParams(
        videoId,
        candidate.language,
        candidate.automatic
      )

      const data = (await fetchJson(
        'https://www.youtube.com/youtubei/v1/get_transcript?prettyPrint=false',
        CAPTION_TIMEOUT_MS,
        parentSignal,
        {
          'content-type': 'application/json',
          'user-agent': WATCH_HEADERS['user-agent']
        },
        JSON.stringify({
          context: {
            client: {
              hl: 'en',
              gl: 'US',
              clientName: 'WEB',
              clientVersion: '2.20241126.01.00'
            }
          },
          params
        }),
        'POST'
      )) as YouTubeTranscriptResponse

      const segments = parseTranscriptApiResponse(data)

      if (segments.length) {
        return {
          language: candidate.language,
          segments: compactSegments(segments)
        }
      }

      lastError = new Error(
        `transcript ${candidate.language}${candidate.automatic ? ' asr' : ''} 返回空数据`
      )
    } catch (error) {
      lastError = error
    }
  }

  throw new Error(toErrorMessage(lastError))
}

function parseTranscriptApiResponse(data: YouTubeTranscriptResponse): CaptionSegment[] {
  const entries =
    data.actions
      ?.flatMap((action) =>
        action.updateEngagementPanelAction?.content?.transcriptRenderer?.content?.transcriptSearchPanelRenderer?.body?.transcriptSegmentListRenderer?.initialSegments ??
        []
      ) ?? []

  const segments: CaptionSegment[] = []

  for (const entry of entries) {
    const renderer = entry.transcriptSegmentRenderer

    if (!renderer) {
      continue
    }

    const text = normalizeCaptionText(
      renderer.snippet?.simpleText ??
      renderer.snippet?.runs?.map((run) => run.text ?? '').join(' ') ??
      ''
    )
    const startMs = Number.parseInt(renderer.startMs ?? '', 10)

    if (!text || Number.isNaN(startMs)) {
      continue
    }

    segments.push({
      start: startMs / 1000,
      text
    })
  }

  return segments
}

function buildTranscriptParams(
  videoId: string,
  language: string,
  automatic: boolean
): string {
  const inner: number[] = []

  if (automatic) {
    inner.push(...encodeProtoString(1, 'asr'))
  }

  inner.push(...encodeProtoString(2, language))

  const outer = [
    ...encodeProtoString(1, videoId),
    ...encodeProtoString(2, bytesToBase64(new Uint8Array(inner)))
  ]

  return bytesToBase64(new Uint8Array(outer))
}

function encodeProtoString(fieldNumber: number, value: string): number[] {
  const encoded = new TextEncoder().encode(value)
  return [((fieldNumber << 3) | 2), ...encodeVarint(encoded.length), ...encoded]
}

function encodeVarint(value: number): number[] {
  const bytes: number[] = []
  let current = value >>> 0

  while (current >= 0x80) {
    bytes.push((current & 0x7f) | 0x80)
    current >>>= 7
  }

  bytes.push(current)
  return bytes
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
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

function parseJson3Captions(
  events: YouTubeTimedTextEvent[],
  languageCode: string
): CaptionSegment[] {
  const flattened = flattenTimedTextEvents(events)

  if (!flattened.length) {
    return []
  }

  if (isNoSpaceLanguage(languageCode)) {
    return compactSegments(groupNoSpaceEvents(flattened))
  }

  const defaultSegments = groupWordEvents(flattened)

  if (isQualityPoor(defaultSegments)) {
    return compactSegments(groupWordEvents(flattened, true))
  }

  return compactSegments(defaultSegments)
}

function flattenTimedTextEvents(events: YouTubeTimedTextEvent[]): FlattenedCaptionEvent[] {
  const flattened: FlattenedCaptionEvent[] = []
  let buffer: FlattenedCaptionEvent | null = null

  for (const event of events) {
    const segments = event.segs ?? []
    const baseStart = event.tStartMs ?? 0
    const duration = event.dDurationMs ?? 0

    for (let index = 0; index < segments.length; index += 1) {
      const part = segments[index]
      const text = normalizeCaptionText(part.utf8 ?? '')
      const start = baseStart + (part.tOffsetMs ?? 0)

      if (buffer) {
        buffer.end = !buffer.end || buffer.end > start ? start : buffer.end

        if (buffer.text) {
          flattened.push(buffer)
        }

        buffer = null
      }

      buffer = {
        text,
        start,
        end: index === segments.length - 1 ? baseStart + duration : 0
      }
    }
  }

  if (buffer?.text) {
    flattened.push(buffer)
  }

  return flattened.filter((segment) => segment.text)
}

function isNoSpaceLanguage(languageCode: string): boolean {
  return ['zh', 'ja', 'ko', 'th', 'lo', 'km', 'my'].some((code) =>
    languageCode.toLowerCase().startsWith(code)
  )
}

function groupNoSpaceEvents(events: FlattenedCaptionEvent[]): CaptionSegment[] {
  const grouped: CaptionSegment[] = []
  let current: FlattenedCaptionEvent | null = null
  const maxLength = 30

  const flush = () => {
    if (!current?.text) {
      return
    }

    grouped.push({
      start: current.start / 1000,
      text: current.text
    })
    current = null
  }

  for (const event of events) {
    if (!current) {
      current = { ...event }
      continue
    }

    const previous: FlattenedCaptionEvent = current
    const hasPause = event.start - previous.end > 1000
    current = {
      start: previous.start,
      end: event.end,
      text: `${previous.text}${event.text}`
    }

    if (/[。！？?!…]$/.test(current.text) || current.text.length >= maxLength || hasPause) {
      flush()
    }
  }

  flush()
  return grouped
}

function groupWordEvents(
  events: FlattenedCaptionEvent[],
  usePauseWords = false
): CaptionSegment[] {
  const grouped: CaptionSegment[] = []
  const pauseWords = new Set([
    'actually',
    'also',
    'and',
    'because',
    'but',
    'however',
    'if',
    'maybe',
    'now',
    'or',
    'right',
    'so',
    'then',
    'well'
  ])

  let buffer: FlattenedCaptionEvent[] = []
  let wordCount = 0

  const flush = () => {
    if (!buffer.length) {
      return
    }

    grouped.push({
      start: buffer[0].start / 1000,
      text: normalizeCaptionText(buffer.map((segment) => segment.text).join(' '))
    })
    buffer = []
    wordCount = 0
  }

  for (const event of events) {
    if (!event.text) {
      continue
    }

    const last = buffer[buffer.length - 1]

    if (last) {
      const isEndOfSentence = /[.?!…)\]]$/.test(last.text)
      const isPause = event.start - last.end > 1000
      const isCommaStop = /[,]$/.test(last.text) && wordCount >= 18
      const startsWithCue = /^[[(♪]/.test(event.text)
      const startsWithPauseWord =
        usePauseWords &&
        buffer.length > 1 &&
        pauseWords.has(event.text.toLowerCase().split(' ')[0])

      if (isEndOfSentence || isPause || isCommaStop || startsWithCue || startsWithPauseWord) {
        flush()
      }
    }

    buffer.push(event)
    wordCount += event.text.split(/\s+/).length
  }

  flush()
  return grouped
}

function isQualityPoor(
  segments: CaptionSegment[],
  lengthThreshold = 220,
  percentageThreshold = 0.2
): boolean {
  if (!segments.length) {
    return false
  }

  const longLines = segments.filter((segment) => segment.text.length > lengthThreshold).length
  return longLines / segments.length > percentageThreshold
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
  parentSignal?: AbortSignal,
  headers?: HeadersInit,
  body?: BodyInit,
  method = body ? 'POST' : 'GET'
): Promise<unknown> {
  const requestState = createTimedSignal(parentSignal, timeoutMs)

  try {
    const response = await fetch(url, {
      headers,
      method,
      body,
      signal: requestState.signal
    })

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
