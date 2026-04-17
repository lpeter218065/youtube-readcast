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
  color-scheme: light;
  --bg: #f3efe7;
  --bg-soft: #e6ddd0;
  --paper: rgba(255, 252, 247, 0.82);
  --paper-strong: rgba(255, 251, 246, 0.94);
  --ink: #181614;
  --ink-soft: #61584d;
  --panel: rgba(25, 27, 29, 0.94);
  --panel-soft: rgba(35, 39, 41, 0.86);
  --line: rgba(24, 22, 20, 0.12);
  --line-soft: rgba(255, 255, 255, 0.09);
  --text-on-dark: #f4efe6;
  --muted-on-dark: rgba(244, 239, 230, 0.66);
  --accent: #b85c38;
  --accent-strong: #8e4428;
  --accent-soft: rgba(184, 92, 56, 0.12);
  --success: #7aa382;
  --shadow: 0 28px 70px rgba(41, 31, 18, 0.12);
  --shadow-strong: 0 42px 120px rgba(16, 17, 18, 0.22);
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  min-height: 100%;
  background:
    radial-gradient(circle at top left, rgba(184, 92, 56, 0.14), transparent 28%),
    radial-gradient(circle at 88% 16%, rgba(34, 55, 76, 0.08), transparent 24%),
    linear-gradient(180deg, #f6f2ea 0%, #efe7db 100%);
  color: var(--ink);
}

body {
  font-family:
    "IBM Plex Sans",
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
  opacity: 0.32;
  background-image:
    linear-gradient(rgba(24, 22, 20, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(24, 22, 20, 0.03) 1px, transparent 1px);
  background-size: 28px 28px;
  mask-image: radial-gradient(circle at center, black 44%, transparent 100%);
}

.shell {
  width: min(1380px, calc(100% - 40px));
  margin: 28px auto 44px;
  display: grid;
  grid-template-columns: minmax(340px, 440px) minmax(0, 1fr);
  gap: 24px;
}

.panel {
  position: relative;
  border-radius: 32px;
  box-shadow: var(--shadow);
}

.control-panel {
  padding: 30px;
  overflow: hidden;
  border: 1px solid rgba(24, 22, 20, 0.08);
  background:
    linear-gradient(160deg, rgba(255, 255, 255, 0.6), rgba(255, 252, 247, 0.88)),
    var(--paper);
}

.control-panel::after {
  content: "";
  position: absolute;
  width: 320px;
  height: 320px;
  border-radius: 999px;
  right: -120px;
  top: -150px;
  background: radial-gradient(circle, rgba(184, 92, 56, 0.16), transparent 70%);
  pointer-events: none;
}

.preview-panel {
  padding: 18px;
  min-height: min(88vh, 980px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  background:
    radial-gradient(circle at top right, rgba(184, 92, 56, 0.12), transparent 28%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.04), transparent 24%),
    var(--panel);
  box-shadow: var(--shadow-strong);
}

.topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 28px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 14px;
}

.brand-mark {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, #1f2427 0%, #40484d 100%);
  color: #fff7ee;
  font-family:
    "Iowan Old Style",
    "Palatino Linotype",
    "Noto Serif SC",
    "Songti SC",
    serif;
  font-size: 19px;
  font-weight: 700;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.16);
}

.brand-copy strong,
.brand-copy span {
  display: block;
}

.brand-copy strong {
  font-size: 14px;
  letter-spacing: 0.02em;
}

.brand-copy span {
  margin-top: 3px;
  color: var(--ink-soft);
  font-size: 12px;
}

.topline-badge {
  border-radius: 999px;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.56);
  border: 1px solid rgba(24, 22, 20, 0.08);
  color: var(--ink-soft);
  font-size: 12px;
  white-space: nowrap;
}

.kicker {
  margin: 0 0 14px;
  color: var(--accent-strong);
  letter-spacing: 0.24em;
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
  font-size: clamp(42px, 4vw, 72px);
  line-height: 0.94;
  letter-spacing: -0.04em;
  text-wrap: balance;
  max-width: 10.5ch;
}

.hero p {
  margin: 18px 0 0;
  color: var(--ink-soft);
  font-size: 16px;
  line-height: 1.9;
  max-width: 36rem;
}

.capsules {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 24px 0 30px;
}

.capsules span {
  border: 1px solid rgba(24, 22, 20, 0.08);
  border-radius: 999px;
  padding: 10px 13px;
  font-size: 12px;
  color: #473e34;
  background: rgba(255, 255, 255, 0.54);
}

.insight-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 28px;
}

.insight-card {
  padding: 16px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.58);
  border: 1px solid rgba(24, 22, 20, 0.07);
}

.insight-card strong,
.insight-card span {
  display: block;
}

.insight-card strong {
  font-family:
    "Iowan Old Style",
    "Palatino Linotype",
    "Noto Serif SC",
    "Songti SC",
    serif;
  font-size: 26px;
  line-height: 1;
}

.insight-card span {
  margin-top: 8px;
  color: var(--ink-soft);
  font-size: 12px;
  line-height: 1.6;
}

.composer {
  display: grid;
  gap: 18px;
  padding: 22px;
  border-radius: 28px;
  background: rgba(253, 249, 243, 0.9);
  border: 1px solid rgba(24, 22, 20, 0.08);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
}

.section-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 2px;
}

.section-label strong {
  font-size: 15px;
}

.section-label span {
  color: var(--ink-soft);
  font-size: 12px;
}

.field {
  display: grid;
  gap: 10px;
}

.field label {
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #655b4f;
}

.field input {
  width: 100%;
  border: 1px solid rgba(24, 22, 20, 0.12);
  border-radius: 18px;
  padding: 16px 18px;
  color: var(--ink);
  background: rgba(255, 255, 255, 0.82);
  outline: none;
  font-size: 15px;
  transition:
    border-color 160ms ease,
    transform 160ms ease,
    background 160ms ease,
    box-shadow 160ms ease;
}

.field input:focus {
  border-color: rgba(184, 92, 56, 0.52);
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 0 0 4px rgba(184, 92, 56, 0.1);
  transform: translateY(-1px);
}

.field small {
  color: var(--ink-soft);
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
  min-width: 160px;
  border-radius: 999px;
  padding: 14px 20px;
  background: linear-gradient(135deg, #d16f47 0%, #ab4e2d 100%);
  color: #fff7ef;
  font-weight: 800;
  letter-spacing: 0.03em;
  box-shadow: 0 14px 30px rgba(171, 78, 45, 0.24);
}

.ghost {
  border-radius: 999px;
  padding: 14px 18px;
  background: rgba(255, 255, 255, 0.72);
  color: var(--ink);
  border: 1px solid rgba(24, 22, 20, 0.1);
}

.meta-note {
  margin: 10px 0 0;
  color: var(--ink-soft);
  font-size: 13px;
  line-height: 1.75;
}

.status-card {
  margin-top: 18px;
  padding: 22px;
  border-radius: 28px;
  border: 1px solid rgba(24, 22, 20, 0.08);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.52), transparent 100%),
    var(--paper-strong);
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
  color: #63584d;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 11px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(24, 22, 20, 0.08);
  font-size: 12px;
  color: #554c42;
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
  color: var(--ink);
  line-height: 1.8;
}

.status-meta {
  margin: 10px 0 0;
  color: var(--ink-soft);
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
  color: #3d352c;
  line-height: 1.65;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid rgba(24, 22, 20, 0.08);
  background: rgba(255, 255, 255, 0.62);
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
  min-height: calc(min(88vh, 980px) - 36px);
  border-radius: 26px;
  overflow: hidden;
  border: 1px solid var(--line-soft);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.05), transparent 30%),
    var(--panel-soft);
}

.preview-topbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 14px;
  padding: 16px 18px;
  border-bottom: 1px solid var(--line-soft);
  background: rgba(255, 255, 255, 0.03);
}

.preview-heading {
  display: grid;
  gap: 6px;
}

.preview-label {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(244, 239, 230, 0.72);
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
  color: var(--muted-on-dark);
  font-size: 13px;
}

.preview-subnote {
  color: rgba(244, 239, 230, 0.88);
  font-size: 14px;
  line-height: 1.7;
}

.preview-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  align-self: start;
}

.preview-chip {
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 12px;
  color: rgba(244, 239, 230, 0.9);
  border: 1px solid var(--line-soft);
  background: rgba(255, 255, 255, 0.04);
}

.preview-frame {
  width: 100%;
  height: calc(100% - 86px);
  min-height: 700px;
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

  .insight-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .preview-panel {
    min-height: 760px;
  }
}

@media (max-width: 720px) {
  .shell {
    width: min(100% - 16px, 1380px);
    margin-top: 12px;
    gap: 14px;
  }

  .control-panel {
    padding: 20px;
  }

  .topline {
    align-items: flex-start;
    flex-direction: column;
  }

  .hero h1 {
    font-size: clamp(34px, 10vw, 52px);
  }

  .insight-grid {
    grid-template-columns: 1fr;
  }

  .composer {
    padding: 18px;
  }

  .preview-panel {
    padding: 10px;
    min-height: 680px;
  }

  .preview-topbar {
    grid-template-columns: 1fr;
  }

  .preview-frame {
    min-height: 620px;
  }
}
`.trim()

const PLACEHOLDER_HTML = `
<article class="dialogue-article placeholder">
  <header class="article-head">
    <p class="eyebrow">Editorial Preview</p>
    <h1>输入 YouTube 链接，右侧实时生成中文整理稿。</h1>
    <p class="dek">字幕会被整理成更适合阅读的文章版式，并持续刷新在这里。</p>
  </header>
  <section class="chapter">
    <h2>你会得到什么</h2>
    <p class="summary">不是字幕列表，而是一篇结构清晰的中文阅读稿。</p>
    <div class="turn">
      <span class="speaker">结构</span>
      <p>自动整理标题、章节和重点内容。</p>
    </div>
    <div class="turn">
      <span class="speaker">流程</span>
      <p>左侧提交后，右侧会实时更新排版结果。</p>
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
        <div class="topline">
          <div class="brand">
            <div class="brand-mark">YR</div>
            <div class="brand-copy">
              <strong>YouTube Readcast</strong>
              <span>Video to readable Chinese article</span>
            </div>
          </div>
          <div class="topline-badge">Reading Layout</div>
        </div>

        <div class="hero">
          <p class="kicker">Readcast</p>
          <h1>把视频对话整理成一篇清晰的中文阅读稿</h1>
          <p>输入视频链接，系统会抓取字幕并实时生成文章版 HTML。</p>
          <div class="capsules">
            <span>Cloudflare Worker</span>
            <span>Gemini 2.5 Flash</span>
            <span>HTML 流式输出</span>
            <span>编辑级排版预览</span>
          </div>
        </div>

        <div class="insight-grid" aria-hidden="true">
          <div class="insight-card">
            <strong>01</strong>
            <span>提取字幕</span>
          </div>
          <div class="insight-card">
            <strong>02</strong>
            <span>整理成文</span>
          </div>
          <div class="insight-card">
            <strong>03</strong>
            <span>实时预览</span>
          </div>
        </div>

        <form id="composer" class="composer">
          <div class="section-label">
            <strong>New Conversion</strong>
            <span>填写后开始</span>
          </div>

          <div class="field">
            <label for="videoUrl">YouTube 链接</label>
            <input
              id="videoUrl"
              name="videoUrl"
              type="url"
              placeholder="https://www.youtube.com/watch?v=xRh2sVcNXQ8"
              required
            />
            <small>支持常见 YouTube 链接格式。</small>
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
            <small>仅保存在当前浏览器。</small>
          </div>

          <div class="actions">
            <button id="generateButton" class="primary" type="submit">开始生成</button>
            <button id="stopButton" class="ghost" type="button" hidden>停止</button>
            <button id="demoButton" class="ghost" type="button">填入示例视频</button>
          </div>

          <p class="meta-note">可先用示例视频快速体验。</p>
        </form>

        <section class="status-card" aria-live="polite">
          <div class="status-head">
            <div class="status-title">Generation Status</div>
            <div id="statusPill" class="status-pill">待命</div>
          </div>
          <p id="statusCopy" class="status-copy">等待开始。</p>
          <p id="statusMeta" class="status-meta">生成过程中会实时刷新预览。</p>
          <ul id="statusLog" class="status-log"></ul>
        </section>
      </section>

      <section class="panel preview-panel">
        <div class="preview-shell">
          <div class="preview-topbar">
            <div class="preview-heading">
              <div class="preview-label">Live Reading Layout</div>
              <div class="preview-subnote">实时预览当前结果。</div>
            </div>
            <div class="preview-meta">
              <div class="preview-chip">Preview</div>
              <div id="previewNote" class="preview-note">等待开始</div>
            </div>
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

      function extractVideoIdFromUrl(input) {
        const trimmed = input.trim()

        if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
          return trimmed
        }

        let url

        try {
          url = new URL(trimmed)
        } catch {
          return null
        }

        const hostname = url.hostname.replace(/^www\\./, '')

        if (hostname === 'youtu.be') {
          const candidate = url.pathname.split('/').filter(Boolean)[0]
          return candidate && /^[a-zA-Z0-9_-]{11}$/.test(candidate) ? candidate : null
        }

        if (hostname === 'youtube.com' || hostname === 'm.youtube.com') {
          if (url.pathname === '/watch') {
            const candidate = url.searchParams.get('v')
            return candidate && /^[a-zA-Z0-9_-]{11}$/.test(candidate) ? candidate : null
          }

          const candidate = url.pathname.split('/').filter(Boolean)[1]
          if (
            (url.pathname.startsWith('/embed/') ||
              url.pathname.startsWith('/shorts/') ||
              url.pathname.startsWith('/live/')) &&
            candidate &&
            /^[a-zA-Z0-9_-]{11}$/.test(candidate)
          ) {
            return candidate
          }
        }

        return null
      }

      async function fetchCaptionsClientSide(videoUrl, signal) {
        const videoId = extractVideoIdFromUrl(videoUrl)
        if (!videoId) throw new Error('Invalid URL')

        const resp = await fetch('/api/captions', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ videoId }),
          signal
        })

        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}))
          throw new Error(err.error || 'Caption proxy failed')
        }

        const data = await resp.json()

        if (!Array.isArray(data.segments) || !data.segments.length) {
          throw new Error('Empty captions')
        }

        return data
      }
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

        // Try to extract captions client-side first
        let captions = null
        try {
          logStatus('尝试从浏览器端获取字幕…')
          captions = await fetchCaptionsClientSide(url, activeController.signal)
          logStatus('浏览器端字幕预取成功。', 'success')
        } catch (e) {
          const message = e instanceof Error ? e.message : '未知错误'
          logStatus('浏览器端字幕提取失败：' + message + '，将由服务端处理。')
        }

        try {
          const payload = { url, apiKey, captions: captions || undefined }
          const response = await fetch('/api/generate', {
            method: 'POST',
            headers: {
              'content-type': 'application/json'
            },
            body: JSON.stringify(payload),
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
          const sourceLabel =
            payload.source === 'youtube'
              ? 'YouTube 直连'
              : payload.source === 'invidious'
                ? '备用字幕源'
                : '浏览器预取'
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
