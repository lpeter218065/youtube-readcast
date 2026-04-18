export type CaptionSource = 'youtube' | 'transcript' | 'invidious' | 'client'

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
  captions?: CaptionPayload
  captionError?: string
  transcript?: string
  title?: string
  model?: string
}
