# 智谱驱动的画布创意共创与自动图文连线 Agent

- **状态**：已完成
- **涉及模块**：`lib/studio/agent-model.ts`、`lib/studio/agent-tools.ts`、`lib/studio/agent-events.ts`、`lib/studio/article-graph.ts`、`app/api/studio/agent/route.ts`、`app/api/studio/route.ts`、`components/studio/agent-message.tsx`、`components/studio/canvas.tsx`、`components/studio/article-staging-dialog.tsx`

## 已确认规则与实现摘要

1. **智谱双模协同**：画布 Agent 推理与工具编排统一使用服务端 `ZIPU_API_KEY` + `ZIPU_MODEL=glm-5.3`（`reasoning: "low"`，`thinkingFormat: "zai"`），调用 `view_image` 查看参考图时内部使用 `glm-5.3-flash` 提取画面主体、构图、色彩与文字描述。
2. **两阶段共创约束**：
   - 聊创意阶段仅读取画布与素材并调用 `propose_creative_plan` 输出图文分镜提案卡，不写入画布节点、不消耗月度生图额度；
   - 用户点击提案卡「认同方案，自动生成到画布」按钮或在对话框自然语言确认后，调用 `compose_canvas_flow`（或 `upsert_text_node` / `connect_canvas_nodes`）一次性创建文案节点、提交配图任务（默认 `seedream-5-5`，支持对话指定 `nano-banana-2` / `gpt-image-2`）并自动写入单向有向连线。
3. **生成中配图连线体验**：`ImageNode` 在生成中（`pending`）状态同步挂载左右锚点与 `#1..#N` 顺序徽章，`analyzeArticleGraph` 返回 `generating_in_chain` 保持徽章与连线立即可见，并在图片全部落盘前温和拦截暂存提交。

## 验收记录

- `npx tsc --noEmit`、`npm run lint`、`npm run build`：0 错误通过。
- 真实智谱 `glm-5.3` 联调测试（`verify_zhipu_agent_unit_and_llm.ts`）：第一轮仅输出 `propose_creative_plan`（0 写库），第二轮确认后调用 `compose_canvas_flow` 创建文案节点、提交 `seedream-5-5` 配图任务并生成无环无分叉的单向主链。
- 无头 Chrome UI 端到端测试（`verify_zhipu_agent_e2e.mjs`）：提案卡渲染、一键认同按钮点击、画布自动切入「文章编排」视图及节点徽章与有向连线渲染全部验证通过。
