# 创作工作台开发指引

本项目使用 Next.js App Router、React、TypeScript、Tailwind CSS 和 Supabase。优先沿用现有目录、技术栈与代码风格。面向本项目的文档和代码注释使用中文。

## 从任务找到资料

| 任务 | 入口 |
| --- | --- |
| 找到业务入口、服务边界与数据流 | [架构地图](./ARCHITECTURE.md) |
| 核对已确认需求 | [产品规格索引](./docs/product-specs/index.md) · [PRD](./docs/prd.md) |
| 查设计决策与技术约束 | [设计文档索引](./docs/design-docs/index.md) · [核心原则](./docs/design-docs/core-beliefs.md) |
| 设计界面、验证交互和排版 | [设计约定](./docs/DESIGN.md) · [前端约定](./docs/FRONTEND.md) |
| 制订计划或接续已有任务 | [执行计划](./docs/PLANS.md) · [进行中](./docs/exec-plans/active/index.md) |
| 核对上线证据和技术债 | [质量状态](./docs/QUALITY_SCORE.md) · [技术债清单](./docs/exec-plans/tech-debt-tracker.md) |
| 处理失败、权限或数据库变更 | [可靠性](./docs/RELIABILITY.md) · [安全](./docs/SECURITY.md) · [数据库结构索引](./docs/generated/db-schema.md) |
| 查截图、接口和第三方服务资料 | [参考资料](./docs/references/index.md) · [界面参考图](./docs/images/) |

## 变更与验证

- 产品、交互和业务规则确认后更新 [PRD](./docs/prd.md)。未决事项记为「待确认」，实现进度和验收证据记入执行计划。
- 修改前查看对应模块和迁移，优先复用鉴权、存储及渲染逻辑。跨路由或涉及数据、支付、第三方服务的变更按 [执行计划](./docs/PLANS.md) 记录。
- Supabase 表结构、SQL、RLS 和存储桶操作优先使用 Supabase MCP。迁移存放在 `supabase/migrations/`。数据库结构索引以仓库迁移为依据，环境状态通过目标项目核对。
- 密钥、连接串和访问令牌仅在服务端管理。客户端配置使用 `NEXT_PUBLIC_` 且只包含允许公开的值。访问用户资源时应用当前会话、资源归属校验、RLS 和最小权限。
- 通用验证使用 `npm run lint`、`npm run build`。按改动范围补充浏览器、外部服务或隔离环境验证，并把未实测的部分和静态检查分开记录。

## 生图接口

- [项目生图接入设计](./docs/api/image-generation.md)
- [GPT Image 2 文生图](./docs/api/gpt-image-2-text-to-image.md) · [GPT Image 2 图生图](./docs/api/gpt-image-2-image-to-image.md)
- [Nano Banana 2 生图](./docs/api/nanobanana2.md)
- [Seedream 5.5 文生图](./docs/api/seedream-5-5-text-to-image.md) · [Seedream 5.5 图生图](./docs/api/seedream-5-5-image-to-image.md)
