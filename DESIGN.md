# YouTube Readcast Design

## Overview

YouTube Readcast is a Cloudflare Worker app that turns a YouTube video with captions into a Chinese reading-style article. The browser streams both the raw captions and the final article preview, while the Worker handles subtitle fetching and AI generation.

## Current Architecture

```text
Browser (SPA)
  ├── GET /                  -> inline app shell
  ├── POST /api/captions     -> fetch structured captions (optional)
  └── POST /api/generate     -> SSE stream (status → captions → article chunks)
                                ├── fetch captions with prioritized strategy
                                ├── stream caption segments to frontend
                                ├── generate article with AI (Gemini/Claude/OpenAI)
                                └── fall back to Gemini video prompt if captions fail
```

## Caption Fetching Strategy

Implemented in [src/services/youtube.ts](/Users/xu/projects/youtube-readcast/src/services/youtube.ts).

### Three-tier fallback system:

1. **inv.nadeko.net** (priority, retry 3 times)
   - Known reliable Invidious instance
   - Each failure reports specific error reason
   
2. **YouTube direct via youtube-transcript**
   - Try languages in order: `zh-CN`, `zh-Hans`, `zh`, `en`, auto-detect
   - 5-second timeout per language attempt
   - Normalize and merge fragments into reading-friendly blocks
   
3. **Other mirror sources** (parallel race)
   - Remaining Invidious instances (yewtu.be, invidious.nerdvpn.de, etc.)
   - Piped API instances (api.piped.yt, pipedapi.reallyaweso.me, etc.)
   - Use `Promise.any()` to return first successful result

### Caption streaming to frontend

Once captions are fetched, they're streamed to the browser in batches:

```javascript
// Server sends caption events
for (let i = 0; i < segments.length; i += 8) {
  send('captions', { segments: segments.slice(i, i + 8) })
}
```

Frontend displays the raw transcript text before AI generation starts, providing immediate feedback.

## Multi-Provider AI Support

Implemented in [src/services/gemini.ts](/Users/xu/projects/youtube-readcast/src/services/gemini.ts).

The system auto-detects AI provider by API key prefix:

| Prefix | Provider | Endpoint |
|--------|----------|----------|
| `cr_` | Claude (custom) | `https://cursor.scihub.edu.kg/api/v1/chat/completions` |
| `sk-` | OpenAI-compatible | `https://api.hanbbq.top/v1/chat/completions` |
| default | Gemini | `https://generativelanguage.googleapis.com/v1beta/models/` |

All providers use streaming responses for real-time article generation.

## Request Flow

```text
1. User submits YouTube URL + API key
2. Worker extracts videoId
3. Worker attempts caption fetching (with status updates):
   a. Try inv.nadeko.net (3 attempts)
   b. Try YouTube direct (5 languages)
   c. Try other mirrors (parallel)
4. Stream caption segments to frontend (SSE captions events)
5. Build AI prompt from captions
6. Stream generated HTML back (SSE chunk events)
7. Browser renders article incrementally
```

## API Contracts

### `POST /api/generate`

Request:

```json
{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "apiKey": "AIza..." // or "cr_..." or "sk-..."
}
```

SSE Response events:

```text
event: status
data: {"message": "尝试 inv.nadeko.net 获取字幕（第 1 次）…"}

event: meta
data: {"title": "Video Title", "language": "en", "source": "transcript"}

event: captions
data: {"segments": [{"start": 1.36, "text": "..."}]}

event: chunk
data: {"html": "<article>..."}

event: done
data: {"ok": true}

event: error
data: {"message": "error details"}
```

### `POST /api/captions` (optional standalone endpoint)

Request:

```json
{
  "videoId": "dQw4w9WgXcQ"
}
```

Response:

```json
{
  "title": "Video title",
  "language": "en",
  "source": "transcript",
  "segments": [
    { "start": 0, "text": "..." }
  ]
}
```

## Key Files

### [src/index.ts](/Users/xu/projects/youtube-readcast/src/index.ts)

Worker router and request lifecycle:
- Serves the page
- Handles `/api/generate` SSE streaming
- Handles `/api/captions` standalone endpoint
- Manages caption streaming to frontend

### [src/services/youtube.ts](/Users/xu/projects/youtube-readcast/src/services/youtube.ts)

Caption extraction with prioritized fallback:
- videoId parsing
- inv.nadeko.net with retry logic
- youtube-transcript with language fallback
- Invidious/Piped mirror racing
- VTT parsing
- Caption normalization and block merging
- In-memory caching (12-hour TTL)

### [src/services/gemini.ts](/Users/xu/projects/youtube-readcast/src/services/gemini.ts)

Multi-provider AI generation:
- Auto-detect provider by API key prefix
- Gemini streaming (SSE format)
- Claude streaming (OpenAI-compatible format)
- OpenAI streaming (chat completions format)
- Unified streaming interface

### [src/page.ts](/Users/xu/projects/youtube-readcast/src/page.ts)

Browser app with streaming UI:
- Input handling and API key storage (localStorage)
- SSE event parsing and handling
- Caption preview rendering (before AI generation)
- Article streaming and live rendering
- Progress bar updates

### [src/prompt.ts](/Users/xu/projects/youtube-readcast/src/prompt.ts)

Converts structured `CaptionPayload` into AI prompts for Chinese editorial HTML output.

## Design Decisions

| Decision | Why |
|---|---|
| Stream captions to frontend first | Immediate user feedback, shows progress |
| Three-tier caption fallback | Maximize success rate across different network conditions |
| Retry inv.nadeko.net 3 times | Known reliable source, worth retrying |
| Multi-provider AI support | Flexibility for users with different API access |
| Auto-detect provider by key prefix | Zero configuration, seamless switching |
| Batch caption segments (8 per event) | Balance between streaming feel and event overhead |
| 5% progress increments | Smoother progress bar, doesn't saturate before generation |

## Risks And Mitigations

| Risk | Mitigation |
|---|---|
| All caption sources fail | Fall back to Gemini video prompt (direct analysis) |
| Invidious instances return empty VTT | Defensive parsing, skip to next source |
| youtube-transcript rate limited | Multiple fallback sources in parallel |
| Long transcripts overload prompt | Prompt builder truncates by character budget |
| Custom proxy endpoints unstable | Graceful error handling, clear error messages |

## Future Options

1. **Add more mirror sources** — Expand Invidious/Piped instance list
2. **Client-side caption extraction** — Browser extension or userscript
3. **Caching layer** — Redis/KV for caption results
4. **Webhook support** — Async processing for long videos
5. **Multi-language output** — Support languages beyond Chinese

## Performance Characteristics

- **Caption fetch**: 2-15 seconds (depends on source availability)
- **Caption streaming**: ~100ms per batch (8 segments)
- **AI generation**: 10-60 seconds (depends on video length and provider)
- **Total time**: 15-75 seconds for typical 10-minute video

