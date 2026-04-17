# YouTube Readcast Design

## Overview

YouTube Readcast is a Cloudflare Worker app that turns a YouTube video with captions into a Chinese reading-style article. The browser streams the final article preview, while the Worker handles subtitle discovery, multi-stage fallbacks, and Gemini generation.

The current design borrows subtitle ideas from `/Users/xu/projects/kiss-translator`, and also adopts a `youtube-transcript`-style fallback inspired by `/Users/xu/projects/youtube-article-generator`, while adapting both to a standalone web app rather than a browser extension.

## Why We Did Not Copy `kiss-translator` Directly

`kiss-translator` runs inside `youtube.com` as an extension. That gives it two important advantages:

1. It can read the YouTube page directly and fetch `/watch` without cross-origin restrictions.
2. It can inject code into the page and intercept the site's own `timedtext` XHR traffic.

This project does not run inside YouTube. It runs on its own origin (`workers.dev` / custom domain), so a "pure frontend" YouTube strategy is not reliable here because:

1. The browser is cross-origin to `youtube.com`.
2. Direct page fetches and request interception are not available.
3. Subtitle access still needs a proxy/fallback layer to survive CORS and anti-bot failures.

So the right adaptation is:

1. Keep the browser as the orchestrator when possible.
2. Keep subtitle fetching/proxying in the Worker.
3. Reuse the better subtitle-track discovery and event parsing ideas from `kiss-translator`.

## What We Borrowed From `kiss-translator`

The current implementation reuses the spirit of its YouTube flow:

1. Discover subtitle tracks from YouTube player metadata instead of relying only on a single legacy endpoint.
2. Prefer `captionTracks[].baseUrl` and request `fmt=json3`.
3. Convert `json3 events` into cleaner sentence-like segments before prompting Gemini.
4. Keep fallback logic for weaker/older subtitle endpoints.
5. Add a `youtube-transcript`-style fallback when the direct `captionTracks/json3` path is blocked.

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
   a. YouTube player metadata / captionTracks
   b. captionTrack.baseUrl + fmt=json3
   c. legacy timedtext list + srv3 XML
   d. `youtube-transcript` fallback
   e. Invidious instances
5. Browser sends structured CaptionPayload to POST /api/generate
6. Worker builds Gemini prompt from that payload
7. Worker streams generated HTML back over SSE
8. Browser renders the article incrementally in the preview iframe
```

## Caption Strategy

### Primary path: YouTube caption tracks

Implemented in [src/services/youtube.ts](/Users/xu/projects/youtube-readcast/src/services/youtube.ts).

The Worker first tries to discover `captionTracks` using:

1. `youtubei/v1/player` (Innertube)
2. `ytInitialPlayerResponse` extracted from the watch page

Once it has tracks, it:

1. Scores them to prefer manual English, then ASR English, then other useful languages.
2. Fetches `baseUrl` with `fmt=json3`.
3. Flattens timed-text events into ordered segments.
4. Groups short fragments into sentence-like lines.

This is the main place where `kiss-translator` influenced the design.

### Secondary path: legacy timedtext

If `captionTracks + json3` fails, the Worker falls back to:

1. `https://www.youtube.com/api/timedtext?v=...&type=list`
2. best available track from the XML list
3. `fmt=srv3` XML body

This keeps compatibility with videos where player metadata is incomplete but timedtext still works.

### Tertiary path: `youtube-transcript` fallback

If the direct YouTube extraction chain still fails, the Worker tries a `youtube-transcript`-style fallback:

1. request transcript data with preferred languages (`zh-CN`, `zh-Hans`, `zh`, `en`, then auto)
2. reuse a custom Worker-side `fetch` so the library's InnerTube request also carries the API key and Worker-friendly headers
3. merge short transcript fragments into larger prompt-friendly blocks

This path is simpler than the main `json3` parser, but it gives us one more YouTube-native strategy before falling all the way back to public Invidious instances.

### Final path: Invidious

If YouTube direct access fails, the Worker tries multiple Invidious instances:

1. list available caption tracks
2. select the best track
3. fetch VTT/body
4. parse into normalized segments

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

1. `source` is `youtube`, `transcript`, or `invidious`.
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
2. track discovery
3. `json3` event parsing
4. sentence-style grouping
5. timedtext fallback
6. `youtube-transcript` fallback
7. Invidious fallback

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
| Reuse `captionTracks + json3` ideas | More aligned with how YouTube exposes subtitles today |
| Add `youtube-transcript` as a fallback | Gives us a simpler YouTube-native path before depending on third-party mirrors |
| Keep Worker proxy layer | Standalone web app cannot reliably copy extension-only same-page interception |
| Let browser request `/api/captions` first | Better UX and avoids duplicate fetches in the common case |
| Keep timedtext and Invidious fallbacks | YouTube behavior changes often; single-path designs are brittle |
| Keep Gemini fallback | Some videos still fail all caption strategies |

## Risks And Mitigations

| Risk | Mitigation |
|---|---|
| YouTube changes player metadata format | Fall back from Innertube to watch-page extraction, then timedtext |
| `json3` returns fragmented events | Group events into larger prompt-friendly segments |
| Cross-origin browser strategy is unreliable | Do not depend on direct browser fetches to YouTube |
| Invidious instances go down | Use an ordered instance list |
| Long transcripts overload the prompt | Prompt builder truncates by character budget |

## Future Options

If we ever want a truly `kiss-translator`-style frontend path, it would need a different product shape:

1. a browser extension that runs on `youtube.com`, or
2. an embedded experience hosted inside a YouTube page context

For the current standalone Worker app, the present hybrid architecture is the more stable choice.
