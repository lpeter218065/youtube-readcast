import {
  fetchTranscript,
  YoutubeTranscriptDisabledError,
  YoutubeTranscriptNotAvailableError,
  YoutubeTranscriptNotAvailableLanguageError,
  YoutubeTranscriptTooManyRequestError,
  YoutubeTranscriptVideoUnavailableError
} from 'youtube-transcript/dist/youtube-transcript.esm.js'
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
const INNERTUBE_API_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8'
const TRANSCRIPT_LANGUAGES = ['zh-CN', 'zh-Hans', 'zh', 'en'] as const

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

interface YoutubeTranscriptLine {
  text: string
  duration: number
  offset: number
  lang?: string
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
    options.onStatus?.('YouTube 直连失败，尝试 youtube-transcript 回退…')

    try {
      return await fetchTranscriptCaptions(videoId, options)
    } catch (transcriptError) {
      options.onStatus?.('youtube-transcript 回退失败，切换到备用字幕源…')
      return fetchInvidiousCaptions(
        videoId,
        options,
        new Error(
          `YouTube 直连字幕抓取失败：${toErrorMessage(directError)}；youtube-transcript 回退失败：${toErrorMessage(transcriptError)}`
        )
      )
    }
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
    options.onStatus?.('字幕轨拉取失败，回退到 timedtext 列表接口…')

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

async function fetchTranscriptCaptions(
  videoId: string,
  options: FetchCaptionsOptions
): Promise<CaptionPayload> {
  const errors: string[] = []
  const transcriptFetch = createTranscriptFetch(options.signal)

  for (const language of [...TRANSCRIPT_LANGUAGES, null] as Array<string | null>) {
    try {
      const transcript = (await fetchTranscript(videoId, {
        ...(language ? { lang: language } : {}),
        fetch: transcriptFetch
      })) as YoutubeTranscriptLine[]

      const segments = mergeTranscriptSegments(transcript)

      if (!segments.length) {
        continue
      }

      return {
        title:
          (await fetchOEmbedTitle(videoId, options.signal)) ?? `YouTube Video ${videoId}`,
        language: transcript.find((item) => item.lang)?.lang ?? language ?? 'unknown',
        source: 'transcript',
        segments
      }
    } catch (error) {
      if (error instanceof YoutubeTranscriptNotAvailableLanguageError) {
        continue
      }

      errors.push(mapTranscriptError(videoId, error))
    }
  }

  throw new Error(
    errors[errors.length - 1] ?? 'youtube-transcript 没有返回可用字幕'
  )
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
  clientName: 'ANDROID' | 'WEB' | 'WEB_EMBEDDED_PLAYER'
  clientVersion: string
  userAgent?: string
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
      `https://www.youtube.com/youtubei/v1/player?key=${INNERTUBE_API_KEY}&prettyPrint=false`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'user-agent': client.userAgent ?? WATCH_HEADERS['user-agent']
        },
        body: JSON.stringify({
          videoId,
          context: {
            client: {
              hl: 'en',
              gl: 'US',
              clientName: client.clientName,
              clientVersion: client.clientVersion,
              ...(client.clientName === 'ANDROID'
                ? {
                    androidSdkVersion: 30,
                    userAgent:
                      client.userAgent ??
                      'com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip'
                  }
                : {})
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
      clientName: 'ANDROID',
      clientVersion: '20.10.38',
      userAgent:
        'com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip'
    },
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
    (
      playerResponse.captions?.playerCaptionsTracklistRenderer?.captionTracks ??
      (playerResponse as unknown as {
        playerCaptionsTracklistRenderer?: { captionTracks?: YouTubeTrack[] }
      }).playerCaptionsTracklistRenderer?.captionTracks ??
      []
    ).filter((track) => Boolean(track?.baseUrl))
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

function mergeTranscriptSegments(lines: YoutubeTranscriptLine[]): CaptionSegment[] {
  const normalized = lines
    .map((line) => ({
      text: normalizeTranscriptLineText(line.text),
      offset: normalizeTranscriptTimeValue(line.offset),
      duration: normalizeTranscriptTimeValue(line.duration),
      lang: line.lang
    }))
    .filter((line) => line.text)

  const merged: Array<(typeof normalized)[number]> = []

  for (const line of normalized) {
    const current = merged[merged.length - 1]

    if (!current) {
      merged.push({ ...line })
      continue
    }

    const gap = line.offset - (current.offset + current.duration)
    const mergedText = joinTranscriptText(current.text, line.text)
    const shouldStartNewBlock =
      mergedText.length > 220 ||
      (gap > 3500 && looksCompleteSentence(current.text)) ||
      (looksCompleteSentence(current.text) && current.text.length > 80)

    if (shouldStartNewBlock) {
      merged.push({ ...line })
      continue
    }

    current.text = mergedText
    current.duration = Math.max(
      line.offset + line.duration - current.offset,
      current.duration
    )
    current.lang = current.lang ?? line.lang
  }

  return compactSegments(
    merged.map((line) => ({
      start: line.offset / 1000,
      text: line.text
    }))
  )
}

function normalizeTranscriptLineText(text: string): string {
  return normalizeCaptionText(text)
    .replace(/([\u4e00-\u9fff])\s+([\u4e00-\u9fff])/g, '$1$2')
    .replace(/([\u4e00-\u9fff])\s+([，。！？；：、“”‘’（）])/g, '$1$2')
    .replace(/([（“‘])\s+([\u4e00-\u9fffA-Za-z0-9])/g, '$1$2')
    .trim()
}

function joinTranscriptText(left: string, right: string): string {
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

function normalizeTranscriptTimeValue(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }

  if (!Number.isInteger(value) || value < 100) {
    return Math.round(value * 1000)
  }

  return value
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

function createTranscriptFetch(parentSignal?: AbortSignal): typeof fetch {
  return async (input, init) => {
    const url = toUrl(input)
    const headers = new Headers(url.hostname.endsWith('youtube.com') ? WATCH_HEADERS : undefined)
    const initHeaders = new Headers(init?.headers)
    let timeoutMs = CAPTION_TIMEOUT_MS

    initHeaders.forEach((value, key) => {
      headers.set(key, value)
    })

    if (url.hostname.endsWith('youtube.com') && url.pathname === '/youtubei/v1/player') {
      url.searchParams.set('key', INNERTUBE_API_KEY)
      timeoutMs = WATCH_TIMEOUT_MS
    } else if (url.hostname.endsWith('youtube.com') && url.pathname === '/watch') {
      timeoutMs = WATCH_TIMEOUT_MS
    }

    const requestState = createTimedSignal(parentSignal, timeoutMs)

    try {
      return await fetch(url, {
        ...init,
        headers,
        signal: requestState.signal
      })
    } finally {
      requestState.cleanup()
    }
  }
}

function toUrl(input: RequestInfo | URL): URL {
  if (input instanceof URL) {
    return new URL(input.toString())
  }

  if (typeof input === 'string') {
    return new URL(input)
  }

  return new URL(input.url)
}

function mapTranscriptError(videoId: string, error: unknown): string {
  if (error instanceof YoutubeTranscriptTooManyRequestError) {
    return 'YouTube 当前限制过多请求，暂时无法通过 youtube-transcript 抓取字幕'
  }

  if (error instanceof YoutubeTranscriptVideoUnavailableError) {
    return `视频不可用：${videoId}`
  }

  if (
    error instanceof YoutubeTranscriptDisabledError ||
    error instanceof YoutubeTranscriptNotAvailableError
  ) {
    return '该视频没有公开字幕'
  }

  return toErrorMessage(error).replace(/^\[YoutubeTranscript\]\s*🚨\s*/u, '')
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
