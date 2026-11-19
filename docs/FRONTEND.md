# 前端约定

| 工作内容 | 代码入口 |
| --- | --- |
| 官网、登录、个人中心 | `app/page.tsx`、`app/auth`、`app/profile` |
| 项目列表、画布、输入面板 | `components/studio`，画布入口为 `app/canvas` |
| 公众号模板、局部样式、稿件精修 | `components/typography` 和 `lib/typography` |
| 通用表单、按钮、菜单 | `components/ui` 与项目 Tailwind 配置 |

- 服务端组件负责读取会话和页面数据。编辑、剪贴板、拖拽、键盘和其他浏览器交互留在客户端组件。
- 编辑体验检查至少覆盖小屏、键盘焦点和状态反馈。画布回归时检查中文输入法、粘贴图片、连线和面板调宽。
- 排版预览与剪贴板导出复用格式渲染规则。调整段落、颜色、标题或插图时，同时用当前浏览器核对预览与导出。微信后台支持情况按 [公众号实测计划](./exec-plans/active/wechat-paste-verification.md) 留存证据。
