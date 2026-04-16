const PREVIEW_STYLE = `
:root {
  color-scheme: light;
  --paper: #f4ecde;
  --paper-edge: #e6dac6;
  --ink: #161413;
  --muted: #6b6258;
  --accent: #b54a2f;
  --accent-soft: rgba(181, 74, 47, 0.14);
  --line: rgba(22, 20, 19, 0.12);
  --shadow: 0 30px 80px rgba(53, 42, 27, 0.16);
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  min-height: 100%;
  background:
    radial-gradient(circle at top left, rgba(181, 74, 47, 0.08), transparent 34%),
    linear-gradient(180deg, #fbf7ef 0%, #f5ecdf 100%);
  color: var(--ink);
}

body {
  font-family:
    "Avenir Next",
    "Noto Sans SC",
    "PingFang SC",
    "Microsoft YaHei",
    sans-serif;
  padding: 36px 20px 48px;
}

#article-root {
  width: min(820px, 100%);
  margin: 0 auto;
}

.dialogue-article {
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.35), transparent 32%),
    var(--paper);
  border: 1px solid var(--paper-edge);
  box-shadow: var(--shadow);
  padding: 60px clamp(24px, 5vw, 60px) 72px;
  position: relative;
  overflow: hidden;
}

.dialogue-article::before {
  content: "";
  position: absolute;
  inset: 0;
  background:
    linear-gradient(90deg, rgba(255, 255, 255, 0.22), transparent 18%, transparent 82%, rgba(255, 255, 255, 0.16)),
    radial-gradient(circle at 20% 20%, rgba(255, 255, 255, 0.36), transparent 30%);
  pointer-events: none;
}

.article-head,
.chapter,
.pullquote {
  position: relative;
  z-index: 1;
}

.article-head {
  margin-bottom: 44px;
}

.eyebrow {
  margin: 0 0 16px;
  color: var(--accent);
  letter-spacing: 0.18em;
  text-transform: uppercase;
  font-size: 12px;
  font-weight: 700;
}

h1,
h2 {
  font-family:
    "Iowan Old Style",
    "Palatino Linotype",
    "Noto Serif SC",
    "Songti SC",
    serif;
  font-weight: 600;
  letter-spacing: -0.03em;
  margin: 0;
}

h1 {
  font-size: clamp(32px, 5vw, 56px);
  line-height: 1.02;
  text-wrap: balance;
}

.dek {
  margin: 18px 0 0;
  max-width: 56ch;
  color: var(--muted);
  font-size: 17px;
  line-height: 1.8;
}

.chapter {
  border-top: 1px solid var(--line);
  padding-top: 28px;
  margin-top: 28px;
}

h2 {
  font-size: clamp(24px, 3vw, 34px);
  line-height: 1.18;
  margin-bottom: 14px;
}

.summary {
  margin: 0 0 22px;
  color: var(--muted);
  font-size: 15px;
  line-height: 1.8;
}

.turn {
  display: grid;
  grid-template-columns: 132px minmax(0, 1fr);
  gap: 16px;
  padding: 18px 0;
  border-top: 1px dashed rgba(22, 20, 19, 0.09);
}

.turn:first-of-type {
  border-top: 0;
  padding-top: 0;
}

.speaker {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--accent);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  padding-top: 4px;
}

.speaker::before {
  content: "";
  width: 22px;
  height: 1px;
  background: currentColor;
  opacity: 0.65;
}

.turn p {
  margin: 0;
  font-family:
    "Iowan Old Style",
    "Palatino Linotype",
    "Noto Serif SC",
    "Songti SC",
    serif;
  font-size: 19px;
  line-height: 1.95;
}

.pullquote {
  margin: 28px 0;
  padding: 18px 0 18px 24px;
  border-left: 3px solid var(--accent);
  color: #2f2821;
  font-family:
    "Iowan Old Style",
    "Palatino Linotype",
    "Noto Serif SC",
    "Songti SC",
    serif;
  font-size: clamp(22px, 3vw, 30px);
  line-height: 1.55;
}

strong {
  font-weight: 700;
}

em {
  font-style: italic;
}

.placeholder .dek,
.placeholder .summary,
.placeholder .turn p {
  color: #746b61;
}

@media (max-width: 720px) {
  body {
    padding: 18px 12px 28px;
  }

  .dialogue-article {
    padding: 32px 18px 38px;
  }

  .turn {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .turn p {
    font-size: 17px;
  }
}
`.trim()

const APP_STYLE = `
:root {
  color-scheme: dark;
  --bg: #0f1112;
  --bg-soft: #161a1c;
  --panel: rgba(19, 23, 24, 0.82);
  --panel-strong: rgba(22, 27, 28, 0.96);
  --line: rgba(255, 255, 255, 0.1);
  --line-soft: rgba(255, 255, 255, 0.06);
  --text: #f2eee6;
  --muted: rgba(242, 238, 230, 0.68);
  --accent: #e36b43;
  --accent-soft: rgba(227, 107, 67, 0.16);
  --success: #8fbf92;
  --shadow: 0 30px 90px rgba(0, 0, 0, 0.34);
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  min-height: 100%;
  background:
    radial-gradient(circle at top left, rgba(227, 107, 67, 0.22), transparent 26%),
    radial-gradient(circle at 80% 20%, rgba(138, 176, 255, 0.12), transparent 24%),
    linear-gradient(180deg, #101314 0%, #0b0d0e 100%);
  color: var(--text);
}

body {
  font-family:
    "Avenir Next",
    "Noto Sans SC",
    "PingFang SC",
    "Microsoft YaHei",
    sans-serif;
}

body::before {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  opacity: 0.18;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px);
  background-size: 30px 30px;
  mask-image: radial-gradient(circle at center, black 46%, transparent 100%);
}

.shell {
  width: min(1320px, calc(100% - 32px));
  margin: 24px auto 40px;
  display: grid;
  grid-template-columns: minmax(320px, 420px) minmax(0, 1fr);
  gap: 22px;
}

.panel {
  position: relative;
  border: 1px solid var(--line);
  border-radius: 28px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.05), transparent 40%),
    var(--panel);
  backdrop-filter: blur(18px);
  box-shadow: var(--shadow);
}

.control-panel {
  padding: 28px;
  overflow: hidden;
}

.control-panel::after {
  content: "";
  position: absolute;
  width: 280px;
  height: 280px;
  border-radius: 999px;
  right: -110px;
  top: -120px;
  background: radial-gradient(circle, rgba(227, 107, 67, 0.22), transparent 70%);
  pointer-events: none;
}

.preview-panel {
  padding: 14px;
  min-height: min(86vh, 960px);
}

.kicker {
  margin: 0 0 18px;
  color: var(--accent);
  letter-spacing: 0.22em;
  text-transform: uppercase;
  font-size: 12px;
  font-weight: 700;
}

.hero {
  position: relative;
  z-index: 1;
}

.hero h1 {
  margin: 0;
  font-family:
    "Iowan Old Style",
    "Palatino Linotype",
    "Noto Serif SC",
    "Songti SC",
    serif;
  font-size: clamp(40px, 4vw, 68px);
  line-height: 0.98;
  letter-spacing: -0.04em;
  text-wrap: balance;
}

.hero p {
  margin: 18px 0 0;
  color: var(--muted);
  font-size: 16px;
  line-height: 1.85;
  max-width: 34rem;
}

.capsules {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 22px 0 28px;
}

.capsules span {
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 9px 12px;
  font-size: 12px;
  color: rgba(242, 238, 230, 0.8);
  background: rgba(255, 255, 255, 0.03);
}

.composer {
  display: grid;
  gap: 16px;
}

.field {
  display: grid;
  gap: 10px;
}

.field label {
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(242, 238, 230, 0.72);
}

.field input {
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 18px;
  padding: 16px 18px;
  color: var(--text);
  background: rgba(255, 255, 255, 0.04);
  outline: none;
  font-size: 15px;
  transition:
    border-color 160ms ease,
    transform 160ms ease,
    background 160ms ease;
}

.field input:focus {
  border-color: rgba(227, 107, 67, 0.64);
  background: rgba(255, 255, 255, 0.06);
  transform: translateY(-1px);
}

.field small {
  color: var(--muted);
  line-height: 1.7;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 6px;
}

button {
  appearance: none;
  border: 0;
  cursor: pointer;
  transition:
    transform 160ms ease,
    opacity 160ms ease,
    background 160ms ease;
}

button:hover {
  transform: translateY(-1px);
}

button:disabled {
  opacity: 0.58;
  cursor: not-allowed;
  transform: none;
}

.primary {
  min-width: 144px;
  border-radius: 999px;
  padding: 14px 18px;
  background: linear-gradient(135deg, #f19873 0%, #d65d39 100%);
  color: #20140f;
  font-weight: 800;
  letter-spacing: 0.03em;
}

.ghost {
  border-radius: 999px;
  padding: 14px 18px;
  background: rgba(255, 255, 255, 0.05);
  color: var(--text);
  border: 1px solid var(--line);
}

.meta-note {
  margin: 14px 0 0;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.7;
}

.status-card {
  margin-top: 24px;
  padding: 18px;
  border-radius: 22px;
  border: 1px solid var(--line);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.03), transparent 100%),
    var(--panel-strong);
}

.status-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.status-title {
  font-size: 13px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(242, 238, 230, 0.76);
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 11px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--line-soft);
  font-size: 12px;
  color: rgba(242, 238, 230, 0.78);
}

.status-pill::before {
  content: "";
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--success);
  box-shadow: 0 0 0 0 rgba(143, 191, 146, 0.5);
}

body[data-state="running"] .status-pill::before {
  background: var(--accent);
  animation: pulse 1.6s infinite;
}

.status-copy {
  margin: 14px 0 0;
  color: var(--text);
  line-height: 1.8;
}

.status-meta {
  margin: 10px 0 0;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.7;
}

.status-log {
  list-style: none;
  margin: 18px 0 0;
  padding: 0;
  display: grid;
  gap: 10px;
}

.status-log li {
  font-family:
    "SFMono-Regular",
    "SF Mono",
    "Menlo",
    "Monaco",
    monospace;
  font-size: 12px;
  color: rgba(242, 238, 230, 0.82);
  line-height: 1.65;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid var(--line-soft);
  background: rgba(255, 255, 255, 0.03);
}

.status-log li.error {
  color: #ffd7cc;
  border-color: rgba(227, 107, 67, 0.28);
  background: rgba(227, 107, 67, 0.09);
}

.status-log li.success {
  color: #d7f1db;
  border-color: rgba(143, 191, 146, 0.28);
  background: rgba(143, 191, 146, 0.09);
}

.preview-shell {
  height: 100%;
  min-height: calc(min(86vh, 960px) - 28px);
  border-radius: 22px;
  overflow: hidden;
  border: 1px solid var(--line);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.04), transparent 34%),
    rgba(6, 8, 9, 0.76);
}

.preview-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--line-soft);
  background: rgba(255, 255, 255, 0.03);
}

.preview-label {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(242, 238, 230, 0.74);
}

.preview-label::before {
  content: "";
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: var(--accent);
  box-shadow: 0 0 18px rgba(227, 107, 67, 0.5);
}

.preview-note {
  color: var(--muted);
  font-size: 12px;
}

.preview-frame {
  width: 100%;
  height: calc(100% - 56px);
  min-height: 680px;
  border: 0;
  background: transparent;
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(227, 107, 67, 0.42);
  }
  70% {
    box-shadow: 0 0 0 12px rgba(227, 107, 67, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(227, 107, 67, 0);
  }
}

@media (max-width: 1080px) {
  .shell {
    grid-template-columns: 1fr;
  }

  .preview-panel {
    min-height: 760px;
  }
}

@media (max-width: 720px) {
  .shell {
    width: min(100% - 16px, 1320px);
    margin-top: 12px;
    gap: 14px;
  }

  .control-panel {
    padding: 20px;
  }

  .hero h1 {
    font-size: clamp(34px, 10vw, 52px);
  }

  .preview-panel {
    padding: 10px;
    min-height: 680px;
  }

  .preview-frame {
    min-height: 620px;
  }
}
`.trim()

const PLACEHOLDER_HTML = `
<article class="dialogue-article placeholder">
  <header class="article-head">
    <p class="eyebrow">对话重构</p>
    <h1>输入一个带字幕的 YouTube 链接，右侧会实时长出一篇中文文章。</h1>
    <p class="dek">Worker 会先抓取字幕，再把文本送入 Gemini 生成 HTML。生成中的每一段内容，都会持续流到这个阅读稿纸里。</p>
  </header>
  <section class="chapter">
    <h2>你会得到什么</h2>
    <p class="summary">不是字幕列表，也不是生硬翻译，而是一篇按主题重组后的对谈整理稿。</p>
    <div class="turn">
      <span class="speaker">系统</span>
      <p>章节、标题、人物称谓、重点引语和段落节奏，都会由模型根据字幕语义自动整理。</p>
    </div>
    <div class="turn">
      <span class="speaker">建议</span>
      <p>可以先试用示例视频链接，再替换成你自己的视频。只要字幕可获取，就能开始流式生成。</p>
    </div>
  </section>
</article>
`.trim()

export function getPageHtml(): string {
  const previewStyle = JSON.stringify(PREVIEW_STYLE)
  const placeholderHtml = JSON.stringify(PLACEHOLDER_HTML)

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>YouTube Dialogue Article Generator</title>
    <style>${APP_STYLE}</style>
  </head>
  <body data-state="idle">
    <main class="shell">
      <section class="panel control-panel">
        <div class="hero">
          <p class="kicker">字幕重构实验室</p>
          <h1>把 YouTube 对话<br />整理成一篇能读的中文文章</h1>
          <p>输入一个有字幕的视频链接，Worker 会抓取字幕，调用 Gemini AI Studio 免费 API，并把中文 HTML 排版以流的方式一段段渲染出来。</p>
          <div class="capsules">
            <span>Cloudflare Worker</span>
            <span>Gemini 2.5 Flash</span>
            <span>HTML 流式输出</span>
            <span>对话稿重构</span>
          </div>
        </div>

        <form id="composer" class="composer">
          <div class="field">
            <label for="videoUrl">YouTube 链接</label>
            <input
              id="videoUrl"
              name="videoUrl"
              type="url"
              placeholder="https://www.youtube.com/watch?v=xRh2sVcNXQ8"
              required
            />
            <small>支持 <code>youtube.com/watch?v=</code>、<code>youtu.be/</code>、<code>/shorts/</code>、<code>/embed/</code> 等常见格式。</small>
          </div>

          <div class="field">
            <label for="apiKey">Gemini API Key</label>
            <input
              id="apiKey"
              name="apiKey"
              type="password"
              placeholder="AIza..."
              autocomplete="off"
              required
            />
            <small>密钥只会保存在当前浏览器本地，并通过本应用转发到 Gemini API，不写入 Worker 环境变量。</small>
          </div>

          <div class="actions">
            <button id="generateButton" class="primary" type="submit">开始生成</button>
            <button id="stopButton" class="ghost" type="button" hidden>停止</button>
            <button id="demoButton" class="ghost" type="button">填入示例视频</button>
          </div>

          <p class="meta-note">推荐先使用示例视频体验整体效果，再替换成你自己的链接。长视频会自动截取前部核心字幕，避免上下文过长。</p>
        </form>

        <section class="status-card" aria-live="polite">
          <div class="status-head">
            <div class="status-title">Generation Status</div>
            <div id="statusPill" class="status-pill">待命</div>
          </div>
          <p id="statusCopy" class="status-copy">等待输入视频链接和 Gemini API Key。</p>
          <p id="statusMeta" class="status-meta">页面会在右侧实时生成排版稿，越早开始就越早看到内容长出来。</p>
          <ul id="statusLog" class="status-log"></ul>
        </section>
      </section>

      <section class="panel preview-panel">
        <div class="preview-shell">
          <div class="preview-topbar">
            <div class="preview-label">Live Reading Layout</div>
            <div id="previewNote" class="preview-note">等待开始</div>
          </div>
          <iframe
            id="previewFrame"
            class="preview-frame"
            title="Generated article preview"
            sandbox="allow-same-origin"
          ></iframe>
        </div>
      </section>
    </main>

    <script>
      const STORAGE_KEY = 'yt-dialogue-generator:gemini-key'
      const DEMO_URL = 'https://www.youtube.com/watch?v=xRh2sVcNXQ8'
      const PREVIEW_STYLE = ${previewStyle}
      const PLACEHOLDER_HTML = ${placeholderHtml}

      const form = document.getElementById('composer')
      const videoUrlInput = document.getElementById('videoUrl')
      const apiKeyInput = document.getElementById('apiKey')
      const generateButton = document.getElementById('generateButton')
      const stopButton = document.getElementById('stopButton')
      const demoButton = document.getElementById('demoButton')
      const statusPill = document.getElementById('statusPill')
      const statusCopy = document.getElementById('statusCopy')
      const statusMeta = document.getElementById('statusMeta')
      const statusLog = document.getElementById('statusLog')
      const previewFrame = document.getElementById('previewFrame')
      const previewNote = document.getElementById('previewNote')

      let activeController = null
      let previewReady = null
      let renderScheduled = false
      let pendingHtml = PLACEHOLDER_HTML
      let articleHtml = ''

      apiKeyInput.value = localStorage.getItem(STORAGE_KEY) || ''
      videoUrlInput.value = DEMO_URL

      initializePreview(PLACEHOLDER_HTML)

      form.addEventListener('submit', handleSubmit)
      stopButton.addEventListener('click', stopGeneration)
      demoButton.addEventListener('click', () => {
        videoUrlInput.value = DEMO_URL
        videoUrlInput.focus()
        logStatus('示例视频链接已填入。')
      })

      async function handleSubmit(event) {
        event.preventDefault()

        const url = videoUrlInput.value.trim()
        const apiKey = apiKeyInput.value.trim()

        if (!url || !apiKey) {
          setStatus('请先输入视频链接和 API Key。', '缺少必要输入', 'error')
          return
        }

        localStorage.setItem(STORAGE_KEY, apiKey)
        activeController?.abort()
        activeController = new AbortController()
        articleHtml = ''

        setRunning(true)
        setStatus('正在建立流式连接…', '准备中', 'info')
        setMeta('先抓字幕，再组织中文对谈稿。字幕准备完成后，右侧会边生成边刷新。')
        previewNote.textContent = '正在生成'
        clearLog()
        logStatus('请求已发出，等待 Worker 响应。')
        scheduleRender(PLACEHOLDER_HTML)

        try {
          const response = await fetch('/api/generate', {
            method: 'POST',
            headers: {
              'content-type': 'application/json'
            },
            body: JSON.stringify({ url, apiKey }),
            signal: activeController.signal
          })

          if (!response.ok) {
            const errorText = await response.text()
            let message = errorText

            try {
              const parsed = JSON.parse(errorText)
              message = parsed.error || errorText
            } catch {}

            throw new Error(message || '请求失败')
          }

          await consumeSse(response)
          setRunning(false)
          setStatus('生成完成，可以继续阅读或替换链接重新生成。', '已完成', 'success')
          previewNote.textContent = '生成完成'
          logStatus('流式输出结束。', 'success')
        } catch (error) {
          if (error?.name === 'AbortError') {
            setStatus('生成已停止。', '已停止', 'info')
            previewNote.textContent = '已停止'
            logStatus('用户中止了当前生成。')
          } else {
            const message = error instanceof Error ? error.message : '发生未知错误'
            setStatus(message, '生成失败', 'error')
            previewNote.textContent = '生成失败'
            logStatus(message, 'error')
          }
        } finally {
          setRunning(false)
          activeController = null
        }
      }

      function stopGeneration() {
        activeController?.abort()
      }

      async function consumeSse(response) {
        if (!response.body) {
          throw new Error('响应流不可用')
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
          const events = buffer.split('\\n\\n')
          buffer = events.pop() || ''

          for (const event of events) {
            handleEvent(parseEvent(event))
          }
        }

        buffer += decoder.decode()

        if (buffer.trim()) {
          handleEvent(parseEvent(buffer))
        }
      }

      function parseEvent(rawEvent) {
        const lines = rawEvent.split('\\n').filter(Boolean)
        let event = 'message'
        const data = []

        for (const line of lines) {
          if (line.startsWith('event:')) {
            event = line.slice(6).trim()
          } else if (line.startsWith('data:')) {
            data.push(line.slice(5).trim())
          }
        }

        if (!data.length) {
          return null
        }

        try {
          return {
            event,
            payload: JSON.parse(data.join('\\n'))
          }
        } catch {
          return null
        }
      }

      function handleEvent(message) {
        if (!message) {
          return
        }

        const { event, payload } = message

        if (event === 'status') {
          setStatus(payload.message, statusPill.textContent || '处理中', 'info')
          logStatus(payload.message)
          return
        }

        if (event === 'meta') {
          const sourceLabel = payload.source === 'youtube' ? 'YouTube 直连' : '备用字幕源'
          setMeta('《' + payload.title + '》 · ' + payload.language + ' 字幕 · ' + sourceLabel)
          previewNote.textContent = payload.title
          logStatus('字幕就绪：' + payload.title)
          return
        }

        if (event === 'chunk') {
          articleHtml += payload.html || ''
          scheduleRender(articleHtml)
          return
        }

        if (event === 'error') {
          throw new Error(payload.message || '生成失败')
        }

        if (event === 'done') {
          if (!articleHtml.trim()) {
            throw new Error('模型没有返回可渲染内容')
          }
        }
      }

      function initializePreview(initialHtml) {
        previewReady = new Promise((resolve) => {
          previewFrame.addEventListener(
            'load',
            () => {
              mountPreview(initialHtml).then(resolve)
            },
            { once: true }
          )
        })

        previewFrame.srcdoc = buildPreviewDocument('')
      }

      async function mountPreview(html) {
        const doc = previewFrame.contentDocument
        if (!doc) return

        const root = doc.getElementById('article-root')
        if (!root) return

        root.innerHTML = sanitizeHtml(html)
      }

      function scheduleRender(html) {
        pendingHtml = html

        if (renderScheduled) {
          return
        }

        renderScheduled = true
        requestAnimationFrame(async () => {
          await previewReady
          await mountPreview(pendingHtml)
          renderScheduled = false
        })
      }

      function buildPreviewDocument(bodyHtml) {
        return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><style>' + PREVIEW_STYLE + '</style></head><body><main id="article-root">' + bodyHtml + '</main></body></html>'
      }

      function sanitizeHtml(html) {
        return html
          .replace(/<script\\b[^<]*(?:(?!<\\/script>)<[^<]*)*<\\/script>/gi, '')
          .replace(/<style\\b[^<]*(?:(?!<\\/style>)<[^<]*)*<\\/style>/gi, '')
          .replace(/<iframe\\b[^<]*(?:(?!<\\/iframe>)<[^<]*)*<\\/iframe>/gi, '')
          .replace(/<link\\b[^>]*>/gi, '')
          .replace(/<meta\\b[^>]*>/gi, '')
          .replace(/\\son[a-z]+=(["']).*?\\1/gi, '')
          .replace(/\\s(href|src)=(["'])javascript:.*?\\2/gi, '')
      }

      function setRunning(running) {
        document.body.dataset.state = running ? 'running' : 'idle'
        generateButton.disabled = running
        stopButton.hidden = !running
      }

      function setStatus(copy, pill, tone) {
        statusCopy.textContent = copy
        statusPill.textContent = pill

        if (tone === 'error') {
          statusPill.style.color = '#ffd7cc'
        } else if (tone === 'success') {
          statusPill.style.color = '#d7f1db'
        } else {
          statusPill.style.color = 'rgba(242, 238, 230, 0.78)'
        }
      }

      function setMeta(copy) {
        statusMeta.textContent = copy
      }

      function clearLog() {
        statusLog.innerHTML = ''
      }

      function logStatus(message, tone = 'info') {
        const item = document.createElement('li')
        item.className = tone === 'error' ? 'error' : tone === 'success' ? 'success' : ''
        item.textContent = '[' + new Date().toLocaleTimeString('zh-CN', { hour12: false }) + '] ' + message
        statusLog.prepend(item)

        while (statusLog.children.length > 6) {
          statusLog.removeChild(statusLog.lastChild)
        }
      }
    </script>
  </body>
</html>`
}
