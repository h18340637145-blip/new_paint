# 画布文章工作流

| 阶段 | 当前实现和核对点 |
| --- | --- |
| 编排 | [文章接口](../../app/api/studio/article/route.ts) 保存文本和边。[图校验](../../lib/studio/article-graph.ts) 推导文章主链，快照固定选择的节点和顺序。 |
| 生成 | [任务接口](../../app/api/typography/tasks/route.ts) 保存快照和模板样式，通过后台任务调用 [Qwen](../../lib/typography/qwen-article.ts)。服务端读取并缩小私有图片，校验模型结果，保留标为原文的内容。 |
| 编辑 | [稿件接口](../../app/api/typography/drafts/%5Bid%5D/route.ts) 保存结构化稿件与版本。编辑器更新正文和局部样式后，用模板渲染预览。 |
| 导出 | [发布图片接口](../../app/api/typography/drafts/%5Bid%5D/publish-images/route.ts) 为所需素材准备长期可访问副本，导出 HTML 引用发布地址。 |

模型与素材读取在服务端完成。保留每次确认的快照和模板，便于追查稿件来源。人工修改保存在稿件版本中，重新生成另建稿件。用户确认公开后才准备图片副本。

验收需跨过实际公众号后台的编辑器和草稿存储。观察项见 [公众号实测计划](../exec-plans/active/wechat-paste-verification.md)。
