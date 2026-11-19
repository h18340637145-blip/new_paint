# 创作工作台架构

创作工作台是一个 Next.js App Router 应用。Supabase 提供会话、Postgres 和文件存储，Next.js 服务端连接模型与业务 API，ZPAY 的云端下单和回调可由 Supabase Edge Functions 处理。

| 领域 | 页面及服务边界 | 持久化 |
| --- | --- | --- |
| 账号与项目 | `/auth/*`、`/protected`、`/projects`，会话和项目归属从服务端核对 | Supabase Auth、成员与项目表 |
| 画布与生图 | `/canvas`、`/api/studio`、`lib/studio`。React Flow 负责画布交互，服务端提交和同步 KIE 任务 | 素材、提交、图片任务、画布节点表及私有桶 |
| Agent 与 Skill | `/api/studio/agent`、`/api/studio/skills`。Pi Agent 使用 DeepSeek Flash 规划，生图沿用 KIE 任务链路 | Agent 对话及项目级 Skill 表 |
| 文章与排版 | `/api/studio/article` 保存文章编排与暂存版本。`/typography`、`/api/typography/*` 负责 Qwen 排版、稿件精修与复制 | 文章图、快照、任务、排版稿、发布图片映射。普通 Markdown 编辑偏好保存在本地 |
| 订阅与额度 | `/profile`、`/api/checkout/providers/zpay/*`、`supabase/functions`。验签后的回调通过数据库事务入账 | ZPAY 订单、月度图片额度与服务端 Vault 配置 |

## 依赖与数据边界

- `app/` 持有路由和 HTTP 边界，`components/` 持有页面交互。纯模板配置、连线排序和格式渲染可被 UI 复用。持密钥的模型、数据库管理与存储操作留在服务端。
- 每次访问项目资源，先从当前 Supabase 会话确认用户，再以用户和项目范围核对记录。使用管理客户端写入时仍须保留归属检查。
- 画布文章快照固定文字、引用素材和顺序。生成任务读取指定快照与模板，Qwen 的结构化输出经校验后写成稿件。公开副本只供导出，画布原件走私有桶。
- 支付回调校验商户、签名及金额后调用入账 RPC。同步返回页面展示业务状态，订阅期限由后端账本计算。

服务接入与迁移分别查 [参考资料](./docs/references/index.md) 和 [数据库结构索引](./docs/generated/db-schema.md)。
