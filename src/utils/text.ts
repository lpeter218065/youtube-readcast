import type { CaptionSegment } from '../types'

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' '
}

export function collapseWhitespace(input: string): string {
  return input
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function stripTags(input: string): string {
  return input.replace(/<[^>]+>/g, ' ')
}

export function decodeEntities(input: string): string {
  let current = input

  for (let pass = 0; pass < 2; pass += 1) {
    current = current.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, entity: string) => {
      const normalized = entity.toLowerCase()

      if (normalized.startsWith('#x')) {
        const codePoint = Number.parseInt(normalized.slice(2), 16)
        return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : _
      }

      if (normalized.startsWith('#')) {
        const codePoint = Number.parseInt(normalized.slice(1), 10)
        return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : _
      }

      return NAMED_ENTITIES[normalized] ?? _
    })
  }

  return current
}

export function normalizeCaptionText(input: string): string {
  return collapseWhitespace(
    decodeEntities(stripTags(input.replace(/<br\s*\/?>/gi, ' ')))
  )
}

export function formatTimestamp(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainder = seconds % 60

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
  }

  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}

export function buildTranscript(
  segments: CaptionSegment[],
  maxChars = 22000
): { transcript: string; truncated: boolean; segmentCount: number } {
  let transcript = ''
  let segmentCount = 0

  for (const segment of segments) {
    const line = `[${formatTimestamp(segment.start)}] ${segment.text}\n`

    if (transcript.length + line.length > maxChars) {
      break
    }

    transcript += line
    segmentCount += 1
  }

  return {
    transcript: transcript.trim(),
    truncated: segmentCount < segments.length,
    segmentCount
  }
}

