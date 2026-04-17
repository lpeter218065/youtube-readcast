# YouTube Readcast Design

## Overview

YouTube Readcast is a Cloudflare Worker app that turns a YouTube video with captions into a Chinese reading-style article. The browser streams the final article preview, while the Worker handles subtitle fetching and Gemini generation.

The current subtitle implementation now follows `/Users/xu/projects/youtube-article-generator` directly: use `youtube-transcript`, try preferred languages in order, normalize fragments, merge them into larger reading-friendly blocks, then prompt Gemini.

## Why We Simplified The Subtitle Path

Earlier iterations tried multiple YouTube-specific extraction paths such as:

1. `youtubei/v1/player`
2. watch-page metadata parsing
3. legacy `timedtext`
4. public Invidious fallbacks

That made the code much harder to reason about, while the project `/Users/xu/projects/youtube-article-generator` already demonstrated that a much simpler `youtube-transcript`-based approach can work end-to-end for this product.

The design is intentionally simpler now:

1. Keep the browser-first request flow.
2. Let the Worker fetch subtitles through `youtube-transcript`.
3. If subtitles still cannot be fetched, fall back to the Gemini video prompt.

## Current Architecture

```text
Browser (SPA)
  ├── GET /                  -> inline app shell
  ├── POST /api/captions     -> fetch structured captions first
  └── POST /api/generate     -> SSE article stream
                                ├── use browser-prepared captions when available
                                ├── otherwise fetch captions in Worker
                                └── fall back to Gemini video prompt if captions fail
```

More detailed flow:

```text
1. User submits YouTube URL + Gemini API key
2. Browser extracts videoId locally
3. Browser calls POST /api/captions
4. Worker fetches captions with this order:
   a. `youtube-transcript` with preferred languages
   b. merge transcript fragments into larger text blocks
5. Browser sends structured CaptionPayload to POST /api/generate
6. Worker builds Gemini prompt from that payload
7. Worker streams generated HTML back over SSE
8. Browser renders the article incrementally in the preview iframe
```

## Caption Strategy

### Single path: `youtube-transcript`

Implemented in [src/services/youtube.ts](/Users/xu/projects/youtube-readcast/src/services/youtube.ts).

The Worker now follows the same core method as `/Users/xu/projects/youtube-article-generator`:

1. call `fetchTranscript(videoId, { lang })` from `youtube-transcript`
2. try languages in this order: `zh-CN`, `zh-Hans`, `zh`, `en`, then auto
3. normalize subtitle fragments
4. merge nearby fragments into longer reading-friendly blocks
5. convert them into our `CaptionPayload`

There are no additional Worker-side YouTube fallbacks anymore. If this method fails, generation falls back to Gemini's direct video understanding.

## Browser-First, But Not Browser-Only

The browser now prepares captions first by calling `/api/captions`, then sends the returned `CaptionPayload` into `/api/generate`.

That gives us the benefits of a "frontend-first" flow:

1. one subtitle fetch before generation
2. better user feedback earlier in the request
3. generate endpoint can skip re-fetching when the browser already has captions

But it is still not "browser-only", because the Worker remains the stable proxy and fallback layer.

## API Contracts

### `POST /api/captions`

Request:

```json
{
  "videoId": "xRh2sVcNXQ8"
}
```

Response:

```json
{
  "title": "Video title",
  "language": "en",
  "source": "youtube",
  "segments": [
    { "start": 0, "text": "..." }
  ]
}
```

Notes:

1. `source` is typically `transcript`.
2. `segments` are already normalized and suitable for prompt building.

### `POST /api/generate`

Request:

```json
{
  "url": "https://www.youtube.com/watch?v=xRh2sVcNXQ8",
  "apiKey": "AIza...",
  "captions": {
    "title": "Video title",
    "language": "en",
    "source": "youtube",
    "segments": [
      { "start": 0, "text": "..." }
    ]
  }
}
```

Fallback request shape still supported:

```json
{
  "url": "https://www.youtube.com/watch?v=xRh2sVcNXQ8",
  "apiKey": "AIza..."
}
```

Behavior:

1. If `captions` is present and valid, the Worker uses it directly.
2. Otherwise the Worker tries `fetchCaptions(videoId)`.
3. If subtitle extraction fails completely, the Worker falls back to the Gemini video prompt.

## Key Files

### [src/index.ts](/Users/xu/projects/youtube-readcast/src/index.ts)

Worker router and request lifecycle:

1. serves the page
2. returns structured captions
3. streams generation output over SSE

### [src/services/youtube.ts](/Users/xu/projects/youtube-readcast/src/services/youtube.ts)

Owns YouTube caption extraction:

1. videoId parsing
2. `youtube-transcript` fetching
3. caption normalization
4. block merging
5. simple in-memory caching

### [src/page.ts](/Users/xu/projects/youtube-readcast/src/page.ts)

Owns the browser app:

1. input handling
2. client-side videoId extraction
3. browser-first `/api/captions` request
4. `/api/generate` SSE consumption
5. live preview rendering

### [src/prompt.ts](/Users/xu/projects/youtube-readcast/src/prompt.ts)

Converts the structured `CaptionPayload` into a Gemini prompt that asks for Chinese editorial HTML output.

## Design Decisions

| Decision | Why |
|---|---|
| Follow `youtube-article-generator` directly | That code path is already known to work for this product shape |
| Use `youtube-transcript` as the only subtitle strategy | Simpler code is easier to reason about and debug |
| Let browser request `/api/captions` first | Better UX and avoids duplicate fetches in the common case |
| Keep Gemini fallback | Some videos still fail all caption strategies |

## Risks And Mitigations

| Risk | Mitigation |
|---|---|
| `youtube-transcript` fails for a given video or IP | Fall back to Gemini video prompt |
| Transcript fragments are too碎 | Merge nearby fragments into larger prompt-friendly blocks |
| Long transcripts overload the prompt | Prompt builder truncates by character budget |

## Future Options

If `youtube-transcript` stops being reliable enough in production, the next realistic step would be a different product shape such as:

1. a browser extension running on `youtube.com`, or
2. a dedicated subtitle proxy service with stronger anti-blocking support

For the current standalone Worker app, the simplified `youtube-transcript` path is the chosen tradeoff.
