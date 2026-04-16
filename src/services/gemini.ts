const GEMINI_BASE =
  'https://generativelanguage.googleapis.com/v1beta/models/'

const DEFAULT_MODEL = 'gemini-2.0-flash'

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

