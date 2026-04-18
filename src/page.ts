const PAGE_STYLE = `
* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  min-height: 100vh;
  font-family: 'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #111009;
  color: #e8e0d0;
  padding: 32px 16px 72px;
}

.shell { max-width: 780px; margin: 0 auto; }

.hero {
  display: flex;
  align-items: baseline;
  gap: 16px;
  margin-bottom: 32px;
  padding-top: 16px;
  border-bottom: 1px solid rgba(255,255,255,0.07);
  padding-bottom: 20px;
}

.hero h1 {
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: #f5ead8;
}

.hero p {
  color: rgba(232, 224, 208, 0.4);
  font-size: 13px;
}

.input-row {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}

input {
  flex: 1;
  border: 1px solid rgba(255, 255, 255, 0.09);
  background: rgba(255, 255, 255, 0.05);
  color: #f0e8d6;
  border-radius: 10px;
  padding: 13px 16px;
  font-size: 14px;
  font-family: inherit;
  transition: border-color .18s, background .18s;
}

input::placeholder { color: rgba(232, 224, 208, 0.3); }

input:focus {
  outline: none;
  border-color: rgba(245, 176, 65, 0.5);
  background: rgba(255, 255, 255, 0.07);
}

button {
  border: none;
  border-radius: 10px;
  padding: 0 20px;
  height: 46px;
  font-weight: 600;
  font-size: 13px;
  font-family: inherit;
  color: #1a1200;
  background: #f5b041;
  cursor: pointer;
  white-space: nowrap;
  transition: background .15s, transform .12s;
  letter-spacing: 0.01em;
}

button:hover:not(:disabled) {
  background: #f8c564;
  transform: translateY(-1px);
}

button:active:not(:disabled) { transform: translateY(0); }
button:disabled { opacity: 0.38; cursor: not-allowed; }

.status {
  display: none;
  padding: 9px 14px;
  border-radius: 8px;
  font-size: 12.5px;
  line-height: 1.6;
  margin-bottom: 14px;
}

.status.show { display: block; }
.status.error { background: rgba(239, 68, 68, 0.1); color: #fca5a5; border: 1px solid rgba(239,68,68,0.2); }
.status.success { background: rgba(52, 211, 153, 0.08); color: #6ee7b7; border: 1px solid rgba(52,211,153,0.18); }
.status.loading { color: rgba(245, 176, 65, 0.85); }

.progress {
  display: none;
  height: 2px;
  background: rgba(255,255,255,0.06);
  border-radius: 999px;
  overflow: hidden;
  margin-bottom: 20px;
}

.progress.show { display: block; }

.progress > span {
  display: block;
  height: 100%;
  width: 0%;
  background: linear-gradient(90deg, #f5b041, #f8e07a);
  transition: width .4s ease;
}

.article {
  background: #faf7f2;
  border-radius: 16px;
  padding: 52px 56px;
  color: #1c1a16;
  font-size: 16px;
  line-height: 1.85;
  font-family: 'Georgia', 'Songti SC', 'Noto Serif SC', serif;
  min-height: 160px;
}

.article h1 {
  font-size: 24px;
  font-weight: 700;
  line-height: 1.3;
  color: #0e0c08;
  margin-bottom: 18px;
  padding-bottom: 18px;
  border-bottom: 1px solid #e8e0d0;
  font-family: 'SF Pro Display', -apple-system, sans-serif;
  letter-spacing: -0.02em;
}

.article h2 {
  font-size: 15px;
  font-weight: 700;
  color: #2c2820;
  margin: 40px 0 12px;
  font-family: 'SF Pro Text', -apple-system, sans-serif;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  opacity: 0.6;
}

.article h3 {
  font-size: 16px;
  font-weight: 600;
  color: #2c2820;
  margin: 28px 0 10px;
  font-family: 'SF Pro Text', -apple-system, sans-serif;
}

.article p {
  margin-bottom: 14px;
  color: #2e2a22;
}

.article .turn {
  display: grid;
  grid-template-columns: 110px minmax(0, 1fr);
  gap: 20px;
  padding: 16px 0;
  border-top: 1px solid rgba(28,26,22,0.07);
}

.article .turn:first-of-type { border-top: 0; padding-top: 0; }

.article .speaker {
  font-family: 'SF Pro Text', -apple-system, sans-serif;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #c9893a;
  padding-top: 5px;
}

.article .turn p { margin: 0; color: #2e2a22; }

.article blockquote {
  margin: 28px 0;
  padding: 18px 22px;
  background: #fff8ee;
  border-left: 3px solid #f5b041;
  border-radius: 0 10px 10px 0;
  color: #5c4a1e;
  font-size: 15.5px;
  line-height: 1.8;
}

.article strong { color: #b5721e; font-weight: 700; }

.article em { color: #5c4a1e; }

.placeholder-text {
  color: rgba(28,26,22,0.28);
  font-family: 'SF Pro Text', -apple-system, sans-serif;
  font-size: 15px;
  font-style: normal;
}

.cursor {
  display: inline-block;
  width: 2px;
  height: 1em;
  background: #c9893a;
  animation: blink 1s step-end infinite;
  vertical-align: text-bottom;
  margin-left: 2px;
}

@keyframes blink { 50% { opacity: 0; } }

@media (max-width: 640px) {
  .hero { flex-direction: column; gap: 4px; }
  .input-row { flex-direction: column; }
  button { height: 48px; }
  .article { padding: 28px 20px; }
  .article h1 { font-size: 20px; }
  .article .turn { grid-template-columns: 1fr; gap: 6px; }
}
`.trim()

const PLACEHOLDER_HTML = `
<p class="placeholder-text">粘贴一个 YouTube 链接，生成的中文阅读稿会出现在这里。</p>
`.trim()

export function getPageHtml(): string {
  const placeholderHtml = JSON.stringify(PLACEHOLDER_HTML)

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Readcast</title>
    <style>${PAGE_STYLE}</style>
  </head>
  <body>
    <div class="shell">
      <header class="hero">
        <h1>Readcast</h1>
        <p>YouTube 视频 → 中文阅读稿</p>
      </header>

      <div class="input-row">
        <input id="videoUrl" type="text" placeholder="粘贴 YouTube 链接，按 Enter 或点击生成" />
        <button id="generateBtn">生成</button>
      </div>
      <div id="status" class="status"></div>
      <div id="progress" class="progress"><span id="progressFill"></span></div>

      <article id="article" class="article"></article>
    </div>

    <script>
      const STORAGE_KEY = 'yt-readcast:gemini-key'
      const PLACEHOLDER_HTML = ${placeholderHtml}

      const videoUrlInput = document.getElementById('videoUrl')
      const generateBtn = document.getElementById('generateBtn')
      const statusEl = document.getElementById('status')
      const articleEl = document.getElementById('article')
      const progressEl = document.getElementById('progress')
      const progressFillEl = document.getElementById('progressFill')
      let generating = false
      let activeController = null

      articleEl.innerHTML = PLACEHOLDER_HTML

      generateBtn.addEventListener('click', generateArticle)
      videoUrlInput.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !generating) generateArticle()
      })

      async function generateArticle() {
        const url = videoUrlInput.value.trim()
        if (!url) return showStatus('请输入 YouTube 视频链接。', 'error')

        const apiKey = localStorage.getItem(STORAGE_KEY) || prompt('请输入 Gemini API Key:')
        if (!apiKey) return showStatus('需要 API Key 才能生成。', 'error')

        localStorage.setItem(STORAGE_KEY, apiKey)

        activeController?.abort()
        activeController = new AbortController()
        generating = true
        generateBtn.disabled = true
        articleEl.innerHTML = ''
        showStatus('正在提取字幕并请求 Gemini…', 'loading')
        showProgress(12)

        try {
          const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, apiKey }),
            signal: activeController.signal
          })

          if (!response.ok) throw new Error(await response.text())

          let rawHtml = ''
          let progress = 20
          articleEl.innerHTML = '<span class="cursor"></span>'

          for await (const data of parseSseStream(response.body)) {
            if (data.error) throw new Error(data.error)
            if (data.event === 'status') {
              showStatus(data.payload.message, 'loading')
              progress = Math.min(progress + 8, 88)
              showProgress(progress)
            } else if (data.event === 'meta') {
              showStatus('正在生成：' + data.payload.title, 'loading')
            } else if (data.event === 'chunk') {
              rawHtml += data.payload.html || ''
              articleEl.innerHTML = rawHtml + '<span class="cursor"></span>'
            } else if (data.event === 'done') {
              articleEl.innerHTML = rawHtml
              showProgress(100)
              showStatus('文章生成完成。', 'success')
            }
          }
        } catch (error) {
          if (error?.name === 'AbortError') {
            showStatus('生成已停止。', 'error')
          } else {
            articleEl.innerHTML = '<p>生成失败，请换一个带公开字幕的视频再试。</p>'
            showStatus(error.message, 'error')
          }
        } finally {
          generating = false
          generateBtn.disabled = false
          activeController = null
        }
      }

      async function* parseSseStream(body) {
        const reader = body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const events = buffer.split(String.fromCharCode(10,10))
            buffer = events.pop() || ''

            for (const rawEvent of events) {
              const parsed = parseEvent(rawEvent)
              if (parsed) yield parsed
            }
          }
        } finally {
          reader.releaseLock()
        }
      }

      function parseEvent(rawEvent) {
        const lines = rawEvent.split(String.fromCharCode(10)).filter(Boolean)
        let event = 'message'
        const data = []

        for (const line of lines) {
          if (line.startsWith('event:')) {
            event = line.slice(6).trim()
          } else if (line.startsWith('data:')) {
            data.push(line.slice(5).trim())
          }
        }

        if (!data.length) return null

        try {
          return { event, payload: JSON.parse(data.join(String.fromCharCode(10))) }
        } catch {
          return null
        }
      }

      function showStatus(message, type) {
        statusEl.className = 'status show ' + type
        statusEl.textContent = message
      }

      function showProgress(value) {
        progressEl.classList.add('show')
        progressFillEl.style.width = value + '%'
      }
    </script>
  </body>
</html>`
}
