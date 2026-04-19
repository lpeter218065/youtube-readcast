# Readcast

将 YouTube 视频转换为中文阅读稿的 Web 应用。

https://github.com/user-attachments/assets/cbb4b7fb-9a05-4c31-a389-638d1e381696

## 功能特点

- 🎬 **自动提取字幕** — 支持 YouTube 官方字幕和多个镜像源
- 📝 **AI 生成文章** — 将字幕转换为结构化的中文阅读稿
- 🌊 **流式显示** — 字幕和生成内容实时流式推送到前端
- 🔄 **多 AI 提供商** — 支持 Gemini、Claude、OpenAI（根据 API key 自动识别）
- 🎨 **优雅界面** — 简洁的琥珀色调设计，适合长文阅读

## 在线使用

访问：https://yt-dialogue-generator.lpeter82218065.workers.dev

1. 粘贴 YouTube 视频链接
2. 输入 AI API Key（首次使用时）
3. 点击"生成"，等待字幕提取和文章生成

## API Key 支持

根据 API key 前缀自动识别提供商：

- **Gemini**（默认）：`AIza...` 或其他格式
- **Claude**：`cr_...` 开头
- **OpenAI**：`sk-...` 开头

## 本地开发

```bash
# 安装依赖
npm install

# 本地开发（需要代理访问外网）
HTTPS_PROXY=http://127.0.0.1:7897 npx wrangler dev

# 部署到 Cloudflare Workers
npx wrangler deploy
```

## 技术栈

- **运行时**：Cloudflare Workers
- **字幕获取**：youtube-transcript + Invidious/Piped 镜像
- **AI 生成**：Gemini / Claude / OpenAI API
- **前端**：原生 HTML/CSS/JS，无框架依赖

## 字幕获取策略

1. **inv.nadeko.net**（优先，重试 3 次）
2. **YouTube 直连**（尝试多种语言：zh-CN, zh-Hans, zh, en, 自动检测）
3. **其他镜像源**（Invidious 和 Piped 实例并行竞速）

## 工作流程

```
用户输入 URL
    ↓
提取字幕（流式状态更新）
    ↓
字幕分批流式推送到前端（每批 8 段）
    ↓
AI 生成中文排版稿（流式输出）
    ↓
前端实时渲染文章
```

## 技术结构

```text
src/
├── index.ts          # Worker 入口，路由处理
├── page.ts           # 前端 HTML/CSS/JS
├── prompt.ts         # AI prompt 模板
├── types.ts          # TypeScript 类型定义
├── services/
│   ├── gemini.ts     # AI 生成服务（支持 Gemini/Claude/OpenAI）
│   └── youtube.ts    # 字幕获取服务
└── utils/
    ├── sse.ts        # Server-Sent Events 工具
    └── text.ts       # 文本处理工具
```

## 配置

编辑 `wrangler.toml` 修改 Worker 配置：

```toml
name = "yt-dialogue-generator"
main = "src/index.ts"
compatibility_date = "2024-12-01"
```

## 许可证

MIT
