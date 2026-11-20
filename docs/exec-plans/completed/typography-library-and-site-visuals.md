# 公众号模板与素材库、团队协作及全站视觉优化实施记录

- **状态**：代码已交付并通过隔离环境全链路验证（生产发布前请在 Supabase SQL Editor 执行增量迁移 `20261119213000_add_typography_libraries_and_teams.sql`，并在真实微信公众号后台完成粘贴终验）
- **交付范围**：
  1. **第一阶段 · 导入与可视化拆装编辑**：
     - 模板选择器新增「导入模板」、左侧素材库抽屉新增「导入素材」，均支持粘贴富文本、上传 `.html` 与导入版本化 `.json`（`new-paint-library-v1`）。
     - 服务端白名单安全解析器 `lib/typography/import-parser.ts` 与受控组件树 `lib/typography/custom-tree.ts`：支持 `container`（横纵分栏与列宽权重）、`heading`、`text`、`image`、`divider`；拦截并在预览报告中列出 `<script>`、`on*` 事件属性、`javascript:`/`data:text/html` 链接、`<iframe>`/表单、外部样式表及导入的 SVG 动画；外链图列为「待补素材」供上传替换，粘贴位图存为私有文件；`.json` 导出内嵌便携媒体，跨账号导入自动生成接收方独立私有副本。
     - 导入预览与层级编辑共用 `components/typography/component-tree-editor.tsx`（拖拽手柄排序 + 上下箭头按钮等价操作、列宽/间距/边框/圆角/字体/配色调节、复用 `TextRun` 局部选区样式、编辑器内更换图片）。
     - 应用模板默认仅改样式（示例显式确认加载）；卡片与分割线可插入，标题边框与图片边框套用时保留原文字与原图；普通 Markdown 与画布排版稿共用渲染与公开图片确认流程，快照随刷新恢复并在库更新后支持手动「重新应用」。
  2. **第二阶段 · 个人库与团队库**：
     - 增量迁移 `supabase/migrations/20261119213000_add_typography_libraries_and_teams.sql` 及 `docs/generated/db-schema.md`。
     - `lib/typography/library-store.ts` 与 `/api/library/*`、`/api/teams`：实现个人库与团队库 CRUD、`expectedVersion` 乐观锁（`409` 并发冲突提示刷新或另存为新项）、归档/恢复、匿名本地预览与登录后恢复云端保存、已注册邮箱站内邀请、四角色权限控制（所有者/编辑者/使用者/非成员）及快照图片物化（确保退团或归档后历史稿件正常预览和导出）。
  3. **第三阶段 · 全站视觉优化**：
     - 统一色彩、字阶、`:focus-visible` 焦点环与 `prefers-reduced-motion` 规则。
     - 升级官网 `/`（首屏真实画布 + 公众号排版联动界面、功能区实际图文效果对比、清晰价格与额度）、认证与验证结果页 `/auth/*` & `/invite-required`（共用 `AuthStatusCard` 与桌面视觉区/窄屏表单优先布局）、统一顶部导航 `StudioTopNav`（串联 `/protected`、`/projects`、`/typography`、`/profile`）、画布 `/canvas` 对比度增强、公众号排版 `/typography` 桌面三栏与窄屏三标签切换、个人中心 `/profile` 分区整合。

## 已完成实测证据

- **静态与构建检查**：`npm run lint`（0 错误）、`npx tsc --noEmit`（0 错误）、`npm run build`（Next.js 16.4.6 全量 35 路由生产构建通过）、`copy-lint.mjs`（官网组件 0 FAIL）。
- **第 1 步实测（导入、安全边界、拆装、乐观锁与便携 JSON）**：通过真实服务端与 Supabase Auth/Storage 联调，验证 `<script>`、`onclick`/`onerror`、`javascript:`、`<iframe>`、`<link>`/`<style>`、`<svg><animate>` 全部被拦截并列入报告，外链图列为待补素材，粘贴 PNG 存为私有文件且跨账号直接读取返回 `403`，便携 `.json` 跨账号导入生成独立私有副本，过期版本保存返回 `409`。
- **第 2 步实测（四角色 RBAC、站内邀请、退团与归档后旧稿存活）**：实测 `owner`、`editor`、`member`、`outsider` 四个真实会话账号的邀请、接受、越权拦截（`403`）、复制到个人库、物化应用到画布排版稿，并在原素材归档且成员被移出团队后确认历史稿件打开（`200`）、图片预览（`200`）与公开图片导出（`200`）均不受影响。
- **第 3 步实测（Chrome 多视口响应式与交互）**：使用无头 Chrome CDP 在 `1440`、`1024`、`820`、`768`、`390`、`320` px 下逐一核验 `/`、`/auth/login`、`/auth/error`、`/protected`、`/projects`、`/canvas`、`/typography`、`/profile` 零横向溢出，窄屏认证页隐藏装饰图优先展示表单与错误提示，`/typography` 桌面三栏与窄屏切换及导入弹窗正常运作。

## 秀米类组合模板逐元素编辑增量

- 导入层保留带底色或边框的内联节点、空装饰形状、尺寸、相对/绝对定位、旋转和非对称圆角。带链接的背景图片进入独立图片节点及待补清单。预览选中后展开对应层级，属性面板可修改尺寸、位置及叠放顺序。
- 模板库新增「插入完整模板」。插入后复用同一组件树编辑器更新当前稿件快照。画布排版稿中的替换图片沿用项目素材上传，Markdown 稿使用现有个人库或本地图片。
- 本地 Chrome 以原创组合 HTML 验证富文本粘贴、脚本拦截、标题改字、叠放装饰图位置调整、独立形状与非对称圆角保留、整组插入、稿件内重新编辑和刷新恢复。另以 390 px 视口验证编辑弹窗和 Esc 退出，以解析接口验证外链背景图片的待补节点和 SVG 动画提示。
- 本次增量通过 `npm run lint`、TypeScript 和 `npm run build`。验收使用本地匿名导入与预览路径，真实秀米账号复制、登录态云库整组插入和微信公众号粘贴效果待对照原始模板实测。

### 秀米在用模板现场验证

- 在 Chrome 打开秀米推荐模板，将「天气转凉 预防感冒」插入临时编辑区。秀米的预览入口提示需登录。本次将公开显示的组件 HTML 送入本地富文本导入入口。
- 真实模板使用 `flex-flow`、`flex: 0 0 auto` 和左右负外距定位。导入新增这些布局样式的处理，补图占位按节点尺寸紧凑显示。
- 模板解析得到 12 个节点，分别补齐两张装饰图与一张背景图，标题修改为「秋日保暖小贴士」。应用到本地稿件后刷新，标题和图片保留，点选预览可再次打开逐元素编辑器。秀米登录态的系统富文本复制与微信公众号发布仍需另行实测。

### 登录态素材保存修复

- 已连接的 Supabase 原生表使用 `size_bytes`、`uploaded_by` 登记媒体，使用 `description`、`updated_by`、`media_ids` 保存库条目。应用端已按实际表结构写入和回读，数据库明确拒绝图片登记时回收本次上传文件。
- 使用临时登录账号和当前 Supabase 项目，实测本地服务的图片替换上传、内嵌图片导入、个人库保存、私有图片预览、匿名读取拦截、编辑保存与重新打开。测试图片与账号已清理。

## 待生产与外部人工确认项

- 在目标生产 Supabase SQL Editor 执行 `supabase/migrations/20261119213000_add_typography_libraries_and_teams.sql`（未执行前服务端自动使用同权限规则的隔离账本 + `project-images` 私有存储桶兜底，执行后无缝切换至原生数据表与 RLS）。
- 在真实微信公众号后台（`mp.weixin.qq.com`）执行富文本粘贴、保存草稿重开与手机预览核对。
