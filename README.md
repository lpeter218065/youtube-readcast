# YouTube Dialogue Article Generator

一个基于 Node.js 开发、部署到 Cloudflare Workers 的单页应用：

- 输入带字幕的 YouTube 视频链接
- Worker 抓取字幕
- 调用 Gemini AI Studio API
- 将视频对话整理为中文 HTML 文章
- 以流式方式边生成边展示

## 特点

- 无框架 Worker 架构，依赖极少
- 双字幕策略：YouTube 直连 + Invidious 备用回退
- Gemini 流式转发，前端实时渲染
- 编辑感较强的中文对话排版，适合长文阅读
- API Key 由用户输入，仅保存在浏览器本地

## 本地开发

```bash
npm install
npm run dev
```

打开 Wrangler 输出的本地地址即可。

## 部署

```bash
npm run deploy
```

部署前请确认你已经通过 Wrangler 登录 Cloudflare 账号。

## 使用说明

1. 打开页面
2. 输入带字幕的 YouTube 视频链接
3. 输入 Gemini AI Studio API Key
4. 点击生成
5. 页面会实时显示整理中的中文文章

## 技术结构

```text
src/
├── index.ts
├── page.ts
├── prompt.ts
├── types.ts
├── services/
│   ├── gemini.ts
│   └── youtube.ts
└── utils/
    ├── sse.ts
    └── text.ts
```

## 说明

- 默认使用 `gemini-2.5-flash`
- `gemini-2.0-flash` 已在 Google 官方定价页标记为将于 2026-06-01 下线，因此这里直接使用更新的稳定模型
- Worker 端不保存任何 Gemini 密钥

