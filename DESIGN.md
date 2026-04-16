# YouTube Dialogue Article Generator

## Overview

A Cloudflare Worker that takes a YouTube video URL, extracts its subtitles, and uses Gemini AI to generate a beautifully formatted Chinese dialogue article, streamed in real-time to the browser.

## Architecture

```
Browser (SPA)
    │
    ├── GET /           → Serve inline HTML page
    └── POST /api/generate  → SSE stream
            │
            ├── 1. Extract video ID from URL
            ├── 2. Fetch captions (YouTube direct → Invidious fallback)
            ├── 3. Stream to Gemini 2.0 Flash with dialogue prompt
            └── 4. Pipe SSE chunks back to client
```

## File Structure

```
yt-dialogue-generator/
├── src/
│   ├── index.ts                 # Worker entry, router (GET / + POST /api/generate)
│   ├── services/
│   │   ├── youtube.ts           # extractVideoId(), fetchCaptions()
│   │   └── gemini.ts            # streamGenerate() → ReadableStream
│   ├── prompt.ts                # buildPrompt(title, captions) → string
│   └── page.ts                  # getPageHTML() → inline SPA string
├── wrangler.toml
├── package.json
└── tsconfig.json
```

## Module Specifications

### `src/index.ts` — Router (~30 lines)

```ts
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (request.method === 'GET' && url.pathname === '/') return servePage()
    if (request.method === 'POST' && url.pathname === '/api/generate') return handleGenerate(request)
    return new Response('Not Found', { status: 404 })
  }
}
```

- No framework needed — two routes only
- CORS headers for local dev

### `src/services/youtube.ts` — Subtitle Extraction (~80 lines)

**`extractVideoId(url: string): string | null`**
- Regex handles: `youtube.com/watch?v=`, `youtu.be/`, `youtube.com/embed/`, `youtube.com/shorts/`

**`fetchCaptions(videoId: string): Promise<{ title: string; text: string }>`**
- **Strategy 1 (direct)**: Fetch `youtube.com/watch?v=ID`, extract `captionTracks` from embedded JSON, download caption XML, parse `<text>` nodes
- **Strategy 2 (fallback)**: Call `https://inv.nadeko.net/api/v1/captions/ID`, pick English track, fetch its URL
- Caption XML parsing: strip tags, decode HTML entities, join with timestamps
- Prefer `en` manual captions > `en` auto-generated
- Also extract video title from page

### `src/services/gemini.ts` — Streaming AI Call (~40 lines)

**`streamGenerate(apiKey: string, prompt: string): ReadableStream`**

```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=KEY

Body: { contents: [{ parts: [{ text: prompt }] }] }
```

- Read response as SSE, extract `candidates[0].content.parts[0].text` from each `data:` line
- Return a `ReadableStream` that emits decoded text chunks
- Handle errors gracefully (invalid key, rate limit, etc.)

### `src/prompt.ts` — Prompt Template (~30 lines)

**`buildPrompt(title: string, captions: string): string`**

Core instructions to Gemini:

```
You are a professional editor. Given the following YouTube video subtitles,
generate a well-structured Chinese dialogue article in HTML format.

Rules:
1. Identify speakers from context. Assign readable Chinese names/titles.
2. Translate all content to natural, fluent Chinese.
3. Output structure:
   - <h1> article title (creative, captures the theme)
   - <p class="meta"> brief intro (1-2 sentences about the conversation)
   - Multiple topic sections, each with:
     - <h2> topic heading
     - Dialogue blocks: <div class="turn"><span class="speaker">Name</span><p>content</p></div>
4. Summarize/condense repetitive parts. Keep it engaging.
5. Output ONLY the HTML body content, no <html>/<head>/<body> wrappers.

Video title: {title}
Subtitles:
{captions}
```

### `src/page.ts` — Frontend SPA (~120 lines)

Single inline HTML string with embedded CSS and JS.

**UI Layout:**
```
┌─────────────────────────────────────┐
│  YouTube Dialogue Article Generator │
│                                     │
│  [YouTube URL input              ]  │
│  [Gemini API Key input           ]  │
│  [Generate]                         │
│                                     │
│  ┌─ Article Output ──────────────┐  │
│  │ <h1>Title</h1>               │  │
│  │ <p class="meta">intro</p>    │  │
│  │ <h2>Topic 1</h2>             │  │
│  │ Speaker A: content...        │  │
│  │ Speaker B: content...        │  │
│  │ <h2>Topic 2</h2>             │  │
│  │ ...streamed incrementally... │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

**CSS Design:**
- Max-width `720px`, centered
- System font stack with serif for article body
- `.speaker` — bold, `color: #1a73e8`, margin-right
- `.turn` — left border accent, padding, margin-bottom
- `h2` — topic divider with subtle top border
- `.meta` — gray italic intro text
- Responsive, clean whitespace

**JS Logic (~40 lines):**
```js
async function generate() {
  const res = await fetch('/api/generate', {
    method: 'POST',
    body: JSON.stringify({ url, apiKey })
  })
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    output.innerHTML += decoder.decode(value)
  }
}
```
- API key saved to `localStorage` for convenience
- Loading state with disabled button + spinner
- Error display for invalid URL / API failures

## API Contract

### `POST /api/generate`

**Request:**
```json
{
  "url": "https://www.youtube.com/watch?v=xRh2sVcNXQ8",
  "apiKey": "AIza..."
}
```

**Response:** `Content-Type: text/event-stream`

Each SSE chunk is raw HTML text that the client appends to the output container.

**Error responses:**
| Status | Body | Condition |
|--------|------|-----------|
| 400 | `{"error": "Invalid YouTube URL"}` | Bad URL format |
| 400 | `{"error": "API key required"}` | Missing Gemini key |
| 502 | `{"error": "Failed to fetch captions"}` | Both strategies failed |

## Deployment

```bash
# Install
npm install

# Local dev
npx wrangler dev

# Deploy
npx wrangler deploy
```

`wrangler.toml`:
```toml
name = "yt-dialogue-generator"
main = "src/index.ts"
compatibility_date = "2024-12-01"
```

No secrets needed — API key comes from the client.

## Key Design Decisions

| Decision | Why |
|---|---|
| No framework (Hono, itty-router) | 2 routes; raw handler is simpler and zero-dependency |
| Inline SPA, no static assets | Avoids KV/R2 for a single HTML page; simpler deploy |
| User-provided API key | No server secrets to manage; user controls their own quota |
| Dual caption strategy | Direct scrape may fail from Workers; Invidious is reliable fallback |
| SSE raw HTML stream | Simplest approach — no markdown parsing client-side, Gemini outputs HTML directly |
| Gemini 2.0 Flash | Free tier, fast, good at structured output and translation |

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| YouTube blocks CF Worker IPs | Invidious fallback; clear error message if both fail |
| Invidious instance goes down | Use multiple instances as fallback chain |
| Gemini outputs malformed HTML | Wrap in a sanitized container; CSS handles graceful degradation |
| Long videos exceed token limit | Truncate captions to ~8000 words with note in prompt |
| CORS issues in dev | Add `Access-Control-Allow-Origin` headers |

## Implementation Order

1. Scaffold: `wrangler init`, `tsconfig.json`, `package.json`
2. `youtube.ts` — subtitle extraction with both strategies
3. `gemini.ts` — streaming wrapper
4. `prompt.ts` — prompt template
5. `page.ts` — frontend HTML/CSS/JS
6. `index.ts` — wire everything together
7. Local test with `wrangler dev`
8. Deploy with `wrangler deploy`
