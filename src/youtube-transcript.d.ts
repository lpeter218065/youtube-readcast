declare module 'youtube-transcript/dist/youtube-transcript.esm.js' {
  export class YoutubeTranscriptError extends Error {
    constructor(message: string)
  }

  export class YoutubeTranscriptTooManyRequestError extends YoutubeTranscriptError {
    constructor()
  }

  export class YoutubeTranscriptVideoUnavailableError extends YoutubeTranscriptError {
    constructor(videoId: string)
  }

  export class YoutubeTranscriptDisabledError extends YoutubeTranscriptError {
    constructor(videoId: string)
  }

  export class YoutubeTranscriptNotAvailableError extends YoutubeTranscriptError {
    constructor(videoId: string)
  }

  export class YoutubeTranscriptNotAvailableLanguageError extends YoutubeTranscriptError {
    constructor(lang: string, availableLangs: string[], videoId: string)
  }

  export interface TranscriptConfig {
    lang?: string
    fetch?: typeof globalThis.fetch
  }

  export interface TranscriptResponse {
    text: string
    duration: number
    offset: number
    lang?: string
  }

  export function fetchTranscript(
    videoId: string,
    config?: TranscriptConfig
  ): Promise<TranscriptResponse[]>
}
