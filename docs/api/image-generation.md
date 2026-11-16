# 项目生图接入设计

本设计对应 [产品需求文档](../prd.md)，采用 Next.js 服务端、Supabase Auth / Postgres / Storage 与 Kie.ai。本文中的接口和数据结构用于后续实现。

## 路由与项目状态

- 使用 Supabase Auth 登录。仅产品所有者和受邀用户可访问创作路由、项目数据和生图接口。页面和服务端均检查访问权限，数据库与存储继续按项目所有者隔离数据。
- `/protected` 发送时创建项目并提交首条任务。创建项目、记录首条任务和返回项目 ID 使用同一提交标识，重试时复用已有项目。点击「新建项目」时只创建空项目。
- `/projects` 按 `updated_at` 倒序分页，使用项目 ID 作为同时间戳的稳定排序条件。
- `/canvas` 用项目 ID 恢复任务历史、生成图片及节点位置。首版每个项目使用一条连续历史，每次发送独立提交当前提示词、参考图和模型配置。右侧面板默认 `420px` 并在浏览器按设备记住宽度，范围为 `320–620px`。

## 模型参数与任务接口

| 使用方式 | Kie.ai 模型标识 | 业务输入映射 |
| --- | --- | --- |
| GPT Image 2 文生图 | `gpt-image-2-text-to-image` | `prompt`、`aspect_ratio`、`resolution` |
| GPT Image 2 图生图 | `gpt-image-2-image-to-image` | 上述字段加 `input_urls: [参考图地址]` |
| Nano Banana 2 | `nano-banana-2` | `prompt`、`aspect_ratio`、`resolution`，有参考图时传 `image_input: [参考图地址]` |

默认模型为 Nano Banana 2，两个模型默认使用 `1K · 1:1`。客户端和服务端共用参数校验。提示词去除首尾空白后必填，上限 20,000 字符。GPT Image 2 的 2K 排除 `5:4`、`4:5`、`3:1`、`1:3`、`9:21`，4K 排除 `3:1`、`1:3`、`9:21`。各模型支持的选项以 [GPT Image 2 文生图](./gpt-image-2-text-to-image.md)、[GPT Image 2 图生图](./gpt-image-2-image-to-image.md)、[Nano Banana 2](./nanobanana2.md) 为准。

1. 服务端校验登录、项目归属、参考图归属、参数及提交标识，先记录本地任务，再调用 `POST /api/v1/jobs/createTask` 并保存返回的 Kie.ai 任务 ID。检查 HTTP 状态与响应体 `code`。
2. 首版由页面向应用服务端查询状态，服务端按任务节流查询 `GET /api/v1/jobs/recordInfo`。上游的 `waiting`、`queuing` 和 `generating` 均显示为生成中。刷新或重新进入项目后，从已保存的任务恢复查询。[Kie.ai 任务查询文档](https://docs.kie.ai/market/common/get-task-detail)
3. 成功时解析 `resultJson.resultUrls`，将图片转存至项目存储桶并幂等关联结果资产，完成后更新两个界面占位。转存失败时重试转存。创建请求结果未知时保留待核对状态，避免盲目再次创建付费任务。
4. 已确认失败的任务可由用户发起重试，保留原任务记录。轮询超时提示用户稍后查看，任务仍可继续查询。

### GPT Image 2 多张生成

应用服务端校验生成张数为 1–5 的整数，默认 1 张。按张数创建独立的 Kie.ai 任务，共用本次提交的模型、参数和参考图。每张图使用提交 ID 和序号定位到对应的对话结果与画布占位，重复提交复用已有任务记录。部分失败时保留已成功的结果，只为用户选定重试的失败项创建新任务。

## 数据与图片存储

- 项目记录保存所属用户、名称、更新时间和封面资产。首张成功生成的图片作为初始封面。
- 任务记录保存项目 ID、提交标识、模型参数快照、参考图资产 ID、上游任务 ID 和状态。资产记录保存项目归属、存储对象路径、生成任务 ID（如有）和画布位置（如有）。RLS 按项目所有者限制项目、任务和资产访问。
- 使用预定名称 `project-images` 的 Supabase 私有存储桶。对象路径按用户和项目隔离。上传时校验实际文件类型和大小。数据库保存对象路径，查看图片或提交给 Kie.ai 时由服务端依据授权生成短期签名 URL。画布选图复用同一资产及对象路径。[Supabase 私有存储桶与签名 URL](https://supabase.com/docs/guides/storage/serving/downloads)
- 首页选图可先在本地预览，发送时创建项目后再上传到项目路径，上传完成后提交生图任务。重试发送时复用本次提交已创建的项目和已上传的资产。

## 环境变量

| 名称 | 用途 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目 URL。 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase 可发布密钥。受登录会话与 RLS 约束。 |
| `KIE_API_KEY` | Kie.ai Bearer 密钥。仅 Next.js 服务端读取。 |

首版使用登录用户的 Supabase 会话和轮询。上述三项覆盖此方案的应用环境变量。实际密钥放入本地 `.env.local` 和部署环境的变量配置，仓库仅保留 [.env.example](../../.env.example)。

## 实现时补齐的交付文档

- **数据库与存储迁移**记录表结构、外键、唯一约束、索引、私有存储桶和 RLS 策略，并验证用户之间的数据隔离。
- **应用接口契约**记录项目列表、首条任务提交、参考图上传、任务查询与重试的请求和响应，以及权限、参数校验和错误响应。
