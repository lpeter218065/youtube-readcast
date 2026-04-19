const GEMINI_BASE =
  'https://once.novai.su/v1beta/models/'
const CLAUDE_BASE = 'https://cursor.scihub.edu.kg/api'
const OPENAI_BASE = 'https://us.novaiapi.com/v1'

const DEFAULT_MODEL = 'gemini-2.5-pro'
const CLAUDE_MODEL = 'claude-3-5-sonnet-20241022'
const OPENAI_MODEL = 'gemini-3-pro-preview'

const SYSTEM_INSTRUCTION = `
你是一位顶级中文商业与科技媒体编辑，擅长把播客、访谈、圆桌和长视频字幕，重写成高度可读的中文对话文章。

必须严格遵守：
1. 只输出 HTML 片段，不要输出 Markdown、代码围栏、解释文字。
2. 不要输出 <html>、<head>、<body>、<style>、<script>、<iframe>。
3. 仅使用这些标签和类名：
   - <article class="dialogue-article">
   - <header class="article-head">
   - <p class="eyebrow">
   - <h1>
   - <p class="dek">
   - <section class="chapter">
   - <h2>
   - <p class="summary">
   - <div class="turn">
   - <span class="speaker">
   - <p>
   - <blockquote class="pullquote">
   - <strong> <em>
4. 输出必须是可直接渲染的整洁 HTML，标签闭合完整。
5. 中文表达要自然、凝练、有编辑感，不要逐字直译。
`.trim()

export interface GeminiOptions {
  apiKey: string
  prompt: string
  model?: string
  signal?: AbortSignal
}

export async function* streamGenerate(options: GeminiOptions): AsyncGenerator<string> {
  const { apiKey, prompt, signal, model } = options

  // Use Claude if apiKey starts with 'cr_'
  if (apiKey.startsWith('cr_')) {
    yield* streamGenerateClaude({ apiKey, prompt, signal })
    return
  }

  // Use OpenAI-compatible if apiKey starts with 'sk-'
  if (apiKey.startsWith('sk-')) {
    yield* streamGenerateOpenAI({ apiKey, prompt, signal })
    return
  }

  const endpoint = `${GEMINI_BASE}${model || DEFAULT_MODEL}:streamGenerateContent?alt=sse`

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: SYSTEM_INSTRUCTION }]
      },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 65536
      }
    }),
    signal
  })

  if (!response.ok || !response.body) {
    throw new Error(await readGeminiError(response))
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()

    if (done) {
      break
    }

    buffer += decoder.decode(value, { stream: true })
    const events = buffer.split('\n\n')
    buffer = events.pop() ?? ''

    for (const event of events) {
      const text = extractTextFromSseEvent(event)

      if (text) {
        yield text
      }
    }
  }

  buffer += decoder.decode()

  if (buffer.trim()) {
    const text = extractTextFromSseEvent(buffer)

    if (text) {
      yield text
    }
  }
}

async function readGeminiError(response: Response): Promise<string> {
  const body = await response.text()

  try {
    const parsed = JSON.parse(body) as {
      error?: {
        message?: string
      }
    }
    return parsed.error?.message ?? `Gemini 请求失败 (${response.status})`
  } catch {
    return body || `Gemini 请求失败 (${response.status})`
  }
}

function extractTextFromSseEvent(rawEvent: string): string {
  const lines = rawEvent
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const payloads = lines
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .filter((line) => line && line !== '[DONE]')

  let output = ''

  for (const payload of payloads) {
    try {
      const parsed = JSON.parse(payload) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{ text?: string }>
          }
        }>
      }

      const text =
        parsed.candidates?.[0]?.content?.parts
          ?.map((part) => part.text ?? '')
          .join('') ?? ''

      output += text
    } catch {
      continue
    }
  }

  return output
}

async function* streamGenerateOpenAI(options: {
  apiKey: string
  prompt: string
  signal?: AbortSignal
}): AsyncGenerator<string> {
  const { apiKey, prompt, signal } = options

  const response = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_INSTRUCTION },
        { role: 'user', content: prompt }
      ],
      stream: true,
      temperature: 0.8
    }),
    signal
  })

  if (!response.ok || !response.body) {
    const errorText = await response.text()
    throw new Error(`OpenAI API 请求失败 (${response.status}): ${errorText}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (!data || data === '[DONE]') continue

      try {
        const parsed = JSON.parse(data) as {
          choices?: Array<{
            delta?: { content?: string }
          }>
        }

        const content = parsed.choices?.[0]?.delta?.content
        if (content) {
          yield content
        }
      } catch {
        continue
      }
    }
  }
}

async function* streamGenerateClaude(options: {
  apiKey: string
  prompt: string
  signal?: AbortSignal
}): AsyncGenerator<string> {
  const { apiKey, prompt, signal } = options

  const response = await fetch(`${CLAUDE_BASE}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 8192,
      temperature: 0.8,
      messages: [
        { role: 'system', content: SYSTEM_INSTRUCTION },
        { role: 'user', content: prompt }
      ],
      stream: true
    }),
    signal
  })

  if (!response.ok || !response.body) {
    const errorText = await response.text()
    throw new Error(`Claude API 请求失败 (${response.status}): ${errorText}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (!data || data === '[DONE]') continue

      try {
        const parsed = JSON.parse(data) as {
          choices?: Array<{
            delta?: { content?: string }
          }>
        }

        const content = parsed.choices?.[0]?.delta?.content
        if (content) {
          yield content
        }
      } catch {
        continue
      }
    }
  }
}

