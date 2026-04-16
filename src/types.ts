export type CaptionSource = 'youtube' | 'invidious'

export interface CaptionSegment {
  start: number
  text: string
}

export interface CaptionPayload {
  title: string
  language: string
  source: CaptionSource
  segments: CaptionSegment[]
}

export interface GenerateRequestBody {
  url?: string
  apiKey?: string
}

