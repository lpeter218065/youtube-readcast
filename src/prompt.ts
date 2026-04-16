import type { CaptionPayload } from './types'
import { buildTranscript } from './utils/text'

export function buildPrompt(captions: CaptionPayload): string {
  const { transcript, truncated, segmentCount } = buildTranscript(captions.segments)

  return `
请把下面这个 YouTube 视频字幕，整理成一篇适合网页阅读的中文“对话文章”。

目标效果：
- 读起来像一篇被专业编辑精修过的中文对谈稿，而不是字幕翻译
- 保留核心观点、追问关系、冲突感、情绪张力和论证推进
- 标题风格可以参考“对话安德森：AI革命的万亿美金之问”这种有主题张力、带编辑判断的中文表达

写作要求：
1. 全文使用中文。
2. 不要逐句机械翻译，重复口头禅、寒暄和冗余重复可以压缩。
3. 要识别对话中的不同说话人；如果无法确认真实姓名，用“主持人”“嘉宾”“讲者”等清晰称呼。
4. 文章应该有清晰的章节结构，建议 4 到 8 个章节。
5. 每个章节先用一句 summary 总结该段讨论焦点，再进入 turn 对话块。
6. 可以在关键处加入 1 段 pullquote，提炼最有张力的一句话或一个判断。
7. 严守原意，不要编造字幕中不存在的事实；如果字幕存在自动转写错误，可按上下文做合理修复。
8. 如果视频本质上不是多人对谈，也要整理成适合阅读的“对话式整理稿”，用单一讲者或主持人/讲者结构承接。

输出结构建议：
<article class="dialogue-article">
  <header class="article-head">
    <p class="eyebrow">对话重构</p>
    <h1>...</h1>
    <p class="dek">用 1 到 2 句话交代这场对话真正讨论了什么，为什么值得读。</p>
  </header>
  <section class="chapter">
    <h2>...</h2>
    <p class="summary">...</p>
    <div class="turn">
      <span class="speaker">主持人</span>
      <p>...</p>
    </div>
  </section>
</article>

视频标题：${captions.title}
字幕语言：${captions.language}
字幕来源：${captions.source}
已纳入片段数：${segmentCount}${truncated ? '（原视频较长，已截取前半段核心字幕）' : ''}

字幕正文：
${transcript}
`.trim()
}

