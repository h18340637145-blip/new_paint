import type {
  ColorPalette,
  TemplateStyleConfig,
  ThemeId,
  TypographySubTemplate,
  TypographyTheme,
} from "./types";

function makeColors(palette: ColorPalette): TemplateStyleConfig["colors"] {
  return {
    primaryColor: palette.primaryColor,
    accentColor: palette.accentColor,
    textColor: palette.textColor,
    bgColor: palette.bgColor,
    borderColor: palette.borderColor,
    quoteBgColor: palette.quoteBgColor,
  };
}

export const TYPOGRAPHY_THEMES: TypographyTheme[] = [
  {
    id: "minimal-reading",
    name: "极简阅读",
    summary: "克制留白与高可读性正文，适合随笔、双城观察与深度长文。",
    palettes: [
      {
        id: "mr-ink",
        name: "极简墨黑",
        primaryColor: "#171717",
        accentColor: "#525252",
        textColor: "#262626",
        bgColor: "#ffffff",
        borderColor: "#d4d4d4",
        quoteBgColor: "#f5f5f5",
      },
      {
        id: "mr-klein",
        name: "克莱因紫",
        primaryColor: "#021eaa",
        accentColor: "#7a4fd6",
        textColor: "#3e3e3e",
        bgColor: "#ffffff",
        borderColor: "#7d74d7",
        quoteBgColor: "#f5f6ff",
      },
      {
        id: "mr-warm",
        name: "暖纸灰褐",
        primaryColor: "#57534e",
        accentColor: "#b45309",
        textColor: "#3f3a34",
        bgColor: "#fffdf9",
        borderColor: "#e7e5e4",
        quoteBgColor: "#f7f3eb",
      },
      {
        id: "mr-slate",
        name: "石板青灰",
        primaryColor: "#0f172a",
        accentColor: "#0284c7",
        textColor: "#334155",
        bgColor: "#ffffff",
        borderColor: "#cbd5e1",
        quoteBgColor: "#f1f5f9",
      },
    ],
  },
  {
    id: "deep-column",
    name: "深度专栏",
    summary: "编号标题、左竖线引用与层次卡片，适合沙龙回顾与圆桌纪要。",
    palettes: [
      {
        id: "dc-salon",
        name: "深海蓝黄",
        primaryColor: "#0057ff",
        accentColor: "#ffca00",
        textColor: "#3e3e3e",
        bgColor: "#ffffff",
        borderColor: "#ffca00",
        quoteBgColor: "#f0edfc",
      },
      {
        id: "dc-plum",
        name: "暮紫蓝调",
        primaryColor: "#5b21b6",
        accentColor: "#0d92f5",
        textColor: "#3e3e3e",
        bgColor: "#ffffff",
        borderColor: "#c4b5fd",
        quoteBgColor: "#f5f3ff",
      },
      {
        id: "dc-forest",
        name: "松柏墨绿",
        primaryColor: "#14532d",
        accentColor: "#16a34a",
        textColor: "#374151",
        bgColor: "#ffffff",
        borderColor: "#86efac",
        quoteBgColor: "#f0fdf4",
      },
      {
        id: "dc-burgundy",
        name: "酒红金砂",
        primaryColor: "#881337",
        accentColor: "#d97706",
        textColor: "#3e3e3e",
        bgColor: "#ffffff",
        borderColor: "#fda4af",
        quoteBgColor: "#fff1f2",
      },
    ],
  },
  {
    id: "tech-product",
    name: "科技产品",
    summary: "高辨识度科技色与高亮金句，适合实验室发布、AI 产品报道与技术拆解。",
    palettes: [
      {
        id: "tp-mint",
        name: "薄荷荧光",
        primaryColor: "#17d3a5",
        accentColor: "#10b981",
        textColor: "#3e3e3e",
        bgColor: "#ffffff",
        borderColor: "#17d3a5",
        quoteBgColor: "#defcff",
      },
      {
        id: "tp-sky",
        name: "天际冰蓝",
        primaryColor: "#3fb9fc",
        accentColor: "#0284c7",
        textColor: "#3e3e3e",
        bgColor: "#ffffff",
        borderColor: "#86d0f9",
        quoteBgColor: "#eefdff",
      },
      {
        id: "tp-cyber",
        name: "极光紫青",
        primaryColor: "#6366f1",
        accentColor: "#06b6d4",
        textColor: "#334155",
        bgColor: "#ffffff",
        borderColor: "#a5b4fc",
        quoteBgColor: "#eef2ff",
      },
      {
        id: "tp-graphite",
        name: "石墨青橙",
        primaryColor: "#18181b",
        accentColor: "#ea580c",
        textColor: "#3f3f46",
        bgColor: "#ffffff",
        borderColor: "#d4d4d8",
        quoteBgColor: "#fff7ed",
      },
    ],
  },
  {
    id: "visual-story",
    name: "图文故事",
    summary: "留白画报感与卡片式列表，适合视觉工作坊、课程实操与创作手记。",
    palettes: [
      {
        id: "vs-indigo",
        name: "电光靛蓝",
        primaryColor: "#4b6af7",
        accentColor: "#7088f4",
        textColor: "#3e3e3e",
        bgColor: "#ffffff",
        borderColor: "#7088f4",
        quoteBgColor: "#f4f4f4",
      },
      {
        id: "vs-amber",
        name: "琥珀暖阳",
        primaryColor: "#b45309",
        accentColor: "#d97706",
        textColor: "#3f3a34",
        bgColor: "#fffdf9",
        borderColor: "#fcd34d",
        quoteBgColor: "#fef3c7",
      },
      {
        id: "vs-coral",
        name: "珊瑚玫瑰",
        primaryColor: "#e11d48",
        accentColor: "#fb7185",
        textColor: "#3e3e3e",
        bgColor: "#ffffff",
        borderColor: "#fda4af",
        quoteBgColor: "#fff1f2",
      },
      {
        id: "vs-sage",
        name: "鼠尾草灰",
        primaryColor: "#3f6212",
        accentColor: "#65a30d",
        textColor: "#374151",
        bgColor: "#fafaf8",
        borderColor: "#bef264",
        quoteBgColor: "#f7fee7",
      },
    ],
  },
  {
    id: "brand-release",
    name: "品牌发布",
    summary: "强视觉锚点与清晰行动项，适合专家招募、官方公告与产品周报。",
    palettes: [
      {
        id: "br-navy",
        name: "海军红徽",
        primaryColor: "#064370",
        accentColor: "#d80f30",
        textColor: "#3e3e3e",
        bgColor: "#ffffff",
        borderColor: "#064370",
        quoteBgColor: "#f4f4f4",
      },
      {
        id: "br-teal",
        name: "青瓷品牌",
        primaryColor: "#0f766e",
        accentColor: "#14b8a6",
        textColor: "#1f2937",
        bgColor: "#ffffff",
        borderColor: "#5eead4",
        quoteBgColor: "#f0fdfa",
      },
      {
        id: "br-crimson",
        name: "朱红曜石",
        primaryColor: "#be123c",
        accentColor: "#171717",
        textColor: "#262626",
        bgColor: "#ffffff",
        borderColor: "#fda4af",
        quoteBgColor: "#fff1f2",
      },
      {
        id: "br-cobalt",
        name: "钴蓝金属",
        primaryColor: "#1d4ed8",
        accentColor: "#0ea5e9",
        textColor: "#1e293b",
        bgColor: "#ffffff",
        borderColor: "#93c5fd",
        quoteBgColor: "#eff6ff",
      },
    ],
  },
];

function paletteOf(themeId: ThemeId, paletteId: string): ColorPalette {
  const theme = TYPOGRAPHY_THEMES.find((item) => item.id === themeId) ?? TYPOGRAPHY_THEMES[0];
  return theme.palettes.find((p) => p.id === paletteId) ?? theme.palettes[0];
}

export const TYPOGRAPHY_SUBTEMPLATES: TypographySubTemplate[] = [
  // 1. 极简阅读
  {
    id: "minimal-editorial",
    themeId: "minimal-reading",
    name: "极简黑白",
    description: "纯文字居中或左竖线层级，留白呼吸感强，适合深度随笔与产品思考。",
    defaultStyle: {
      paletteId: "mr-ink",
      colors: makeColors(paletteOf("minimal-reading", "mr-ink")),
      heading: { style: "plain", fontSize: 19, fontWeight: 700, align: "left", marginTop: 28, marginBottom: 14 },
      paragraph: { fontSize: 15, lineHeight: 1.9, letterSpacing: 0.6, marginTop: 0, marginBottom: 18, textAlign: "justify" },
      list: { unorderedStyle: "dash", orderedStyle: "decimal", indent: 20, itemSpacing: 8 },
      image: { style: "padded", align: "center", maxWidth: 96, borderRadius: 6, spacing: 20 },
      divider: { style: "short", widthPercent: 28, color: "#d4d4d4", spacing: 28 },
    },
    sampleMarkdown: `# 写给创作者的极简工作流笔记

信息过载的时代，真正拉开创作效率差距的，往往不是工具的数量，而是流程是否足够干净。

## 保持单一焦点的三个习惯

在开始一篇图文之前，不妨先做减法，让文字与画面回到最清晰的秩序里：

- 先确定文章唯一想讲清楚的核心判断
- 用一张克制的头图建立视觉第一印象
- 保持稳定的行高与段落留白，降低长文阅读疲劳

### 实践中的小技巧

1. 在画布中只保留当前章节真正用到的参考图
2. 每次排版前先统一标题与分割线节奏
3. 输出微信前在手机端通读一遍断行

![极简创作工作台封面示例](/images/cover-example.jpg)

> 「少即是多，留白本身就是内容的一部分。」

---

你可以点击上方「样式设置」切换不同的主题与配色，文章正文不会被覆盖。`,
  },
  {
    id: "meet-paris-exchange",
    themeId: "minimal-reading",
    name: "遇见巴黎 · 克莱因蓝",
    description: "复刻《遇见巴黎交流会》样本：克莱因蓝加粗标题、紫罗兰句内强调与紧凑留白。",
    sourceArticleTitle: "创新怎样跨越地域？“遇见巴黎”锡山欧洲创新伙伴交流会圆满举办！",
    sourceArticleUrl: "https://mp.weixin.qq.com/s/j5Ct27THBUQI8tPKdKYLgw",
    defaultStyle: {
      paletteId: "mr-klein",
      colors: makeColors(paletteOf("minimal-reading", "mr-klein")),
      heading: { style: "underline", fontSize: 18, fontWeight: 700, align: "left", marginTop: 24, marginBottom: 12 },
      paragraph: { fontSize: 15, lineHeight: 2, letterSpacing: 1, marginTop: 0, marginBottom: 14, textAlign: "justify" },
      list: { unorderedStyle: "disc", orderedStyle: "decimal", indent: 20, itemSpacing: 6 },
      image: { style: "full", align: "center", maxWidth: 100, borderRadius: 0, spacing: 14 },
      divider: { style: "blank", widthPercent: 100, color: "#7d74d7", spacing: 24 },
    },
    sampleMarkdown: `# 创新怎样跨越地域？双城伙伴交流纪要

当来自不同产业背景的创业者与研究团队坐在同一张圆桌前，技术语言开始转化为彼此可感知的合作机会。

## 跨区域协同的三个落点

整场交流围绕研发对接、场景验证与人才共创展开，**海外前沿技术与本地制造供应链的双向奔赴**成为最受关注的话题。

- 连接欧洲硬科技团队与长三角产业园区
- 聚焦新能源、智能制造与数字创意联合孵化
- 建立季度回访与项目路演常态机制

### 现场观察记录

1. 团队展示真实产线验证案例与核心数据
2. 双方明确下一阶段联合测试的时间窗口

![双城交流现场示例图](/images/cover-example.jpg)

> 地理距离从来不是创新的边界，共同的问题意识才是。

---

本子模板还原了《遇见巴黎》一文的双倍行高、1px 字间距与克莱因蓝重点强调特征。`,
  },

  // 2. 深度专栏
  {
    id: "yingyue-salon",
    themeId: "deep-column",
    name: "映月湖沙龙纪要",
    description: "复刻《映月湖创新沙龙006》样本：明黄左竖线标题、浅紫蓝引用卡与 2.0 行高。",
    sourceArticleTitle: "映月湖创新沙龙006回顾｜从生成到理解世界，AI视觉正走向哪里？",
    sourceArticleUrl: "https://mp.weixin.qq.com/s/ikeI-ThicsF_cans2Ula4g",
    defaultStyle: {
      paletteId: "dc-salon",
      colors: makeColors(paletteOf("deep-column", "dc-salon")),
      heading: { style: "bar", fontSize: 18, fontWeight: 700, align: "left", marginTop: 28, marginBottom: 14 },
      paragraph: { fontSize: 15, lineHeight: 2, letterSpacing: 1, marginTop: 0, marginBottom: 16, textAlign: "justify" },
      list: { unorderedStyle: "square", orderedStyle: "leading-zero", indent: 22, itemSpacing: 8 },
      image: { style: "rounded", align: "center", maxWidth: 100, borderRadius: 8, spacing: 16 },
      divider: { style: "solid", widthPercent: 100, color: "#d4d4d8", spacing: 24 },
    },
    sampleMarkdown: `# 沙龙回顾｜从生成到理解世界，AI 视觉正走向哪里？

本期沙龙聚集了多位一线算法负责人与视觉设计师，我们从「单点生图」聊到了「多模态工作流编排」。

## 嘉宾分享的三大共识

在**可控制性**与**上下文连续性**成为行业核心命题后，单纯追求单张画面的惊艳已不再足够：

- 节点式画布让多图参考关系透明可控
- 用 \`SKILL.md\` 沉淀风格与构图决策，告别反复重写提示词
- 从生成到图文排版，全链路都在同一处完成

### 现场问答精选

1. 如何避免团队成员出图风格不一致？
2. 怎样把沙龙金句快速沉淀成公众号深度长文？

![沙龙分享现场示例](/images/cover-example.jpg)

> 「真正好用的工具，应该让创作者把注意力留在判断与审美上，而不是反复搬运文件。」

---

本模板映射自《映月湖创新沙龙006回顾》，保留深海蓝主色、明黄竖线与浅紫蓝引用卡片。`,
  },
  {
    id: "column-numbered",
    themeId: "deep-column",
    name: "编号长文专栏",
    description: "自动生成 01/02 序号标题与虚线分段，适合系列连载、深度评测与行业洞察。",
    defaultStyle: {
      paletteId: "dc-plum",
      colors: makeColors(paletteOf("deep-column", "dc-plum")),
      heading: { style: "numbered", fontSize: 18, fontWeight: 700, align: "left", marginTop: 30, marginBottom: 14 },
      paragraph: { fontSize: 16, lineHeight: 1.9, letterSpacing: 0.8, marginTop: 0, marginBottom: 16, textAlign: "justify" },
      list: { unorderedStyle: "disc", orderedStyle: "leading-zero", indent: 24, itemSpacing: 8 },
      image: { style: "bordered", align: "center", maxWidth: 94, borderRadius: 8, spacing: 20 },
      divider: { style: "dashed", widthPercent: 85, color: "#c4b5fd", spacing: 28 },
    },
    sampleMarkdown: `# 深度观察：下一代内容工作台的三个结构变化

过去三年，AI 创作工具经历了从对话式问答到专业工作台的演进，排版与视觉资产开始深度融合。

## 从零散指令到结构化工作流

当提示词和风格要求被结构化保存下来，内容团队就能以更稳定的节奏持续输出：

- 每次生成都带着明确的上下文与参考素材
- 所有历史版本与修改记录可回溯、可复用
- 图文产出直接衔接公众号规范

## 把排版标准内建进写作过程

1. 预先定义好标题编号、引用底色与图片边距
2. 写作时专注于事实与观点本身
3. 成稿后在手机端预览确认即刻发布

### 专栏小结

![专栏插图示例](/images/cover-example.jpg)

> 结构稳定的专栏，能帮读者在三秒内建立起对内容的信任感。

---

切换至「编号」标题样式时，系统会自动为每个二级标题按顺序加上 01、02 编号徽章。`,
  },

  // 3. 科技产品
  {
    id: "future-culture-lab",
    themeId: "tech-product",
    name: "未来文化力实验室",
    description: "复刻《未来文化力实验室》样本：薄荷青底色条标题、浅青引文与 16px 双倍行距。",
    sourceArticleTitle: "长三角（无锡）国际人才港成立「未来文化力实验室」，文化 × 科技会创造怎样的可能？",
    sourceArticleUrl: "https://mp.weixin.qq.com/s/rtbDbiHizlNrk-tjT9meJg",
    defaultStyle: {
      paletteId: "tp-mint",
      colors: makeColors(paletteOf("tech-product", "tp-mint")),
      heading: { style: "band", fontSize: 18, fontWeight: 700, align: "left", marginTop: 26, marginBottom: 14 },
      paragraph: { fontSize: 16, lineHeight: 2, letterSpacing: 1, marginTop: 0, marginBottom: 16, textAlign: "justify" },
      list: { unorderedStyle: "check", orderedStyle: "leading-zero", indent: 20, itemSpacing: 8 },
      image: { style: "full", align: "center", maxWidth: 100, borderRadius: 4, spacing: 14 },
      divider: { style: "solid", widthPercent: 90, color: "#17d3a5", spacing: 24 },
    },
    sampleMarkdown: `# 当文化遇见科技，会创造怎样的未来可能？

当艺术表达不再局限于传统画布，当算法与审美开始双向奔赴，一场关于**「未来文化力」**的实验正在发生。

## 为什么设立跨界实验室

在技术快速演进的当下，真正稀缺的不是工具本身，而是把技术转化为人文表达的能力：

- 以视觉语言连接产业场景与青年创作者
- 让 AI 工具成为灵感延展的画笔，而非模板流水线
- 沉淀可复用的创作方法论与开源 Skill

### 实验室首期计划

1. 开放青年数字艺术驻留与实验工作坊
2. 联合产业机构发布文化科技共创课题

![未来文化力视觉示例](/images/cover-example.jpg)

> 文化与科技的交汇处，往往诞生最具生命力的新叙事。

---

本子模板还原了《未来文化力实验室》的薄荷青底色条、16px 正文与 2.0 行高规范。`,
  },
  {
    id: "lingxi-ai-report",
    themeId: "tech-product",
    name: "翎析 AI 科技报道",
    description: "复刻《翎析AI》样本：天际蓝胶囊标题、冰蓝金句引用块与圆角配图。",
    sourceArticleTitle: "央视点赞曦跃科技“翎析AI”！能“看懂”羽毛球的AI教练",
    sourceArticleUrl: "https://mp.weixin.qq.com/s/mR9BRBiX1WARaXA5OuyUIA",
    defaultStyle: {
      paletteId: "tp-sky",
      colors: makeColors(paletteOf("tech-product", "tp-sky")),
      heading: { style: "pill", fontSize: 17, fontWeight: 700, align: "left", marginTop: 26, marginBottom: 14 },
      paragraph: { fontSize: 16, lineHeight: 2, letterSpacing: 1, marginTop: 0, marginBottom: 16, textAlign: "justify" },
      list: { unorderedStyle: "disc", orderedStyle: "decimal", indent: 20, itemSpacing: 8 },
      image: { style: "rounded", align: "center", maxWidth: 100, borderRadius: 14, spacing: 16 },
      divider: { style: "dots", widthPercent: 60, color: "#3fb9fc", spacing: 26 },
    },
    sampleMarkdown: `# 能「看懂」真实场景的 AI 助手，是如何炼成的？

最近，一款专注于运动动作理解的视觉 AI 应用引发了不少关注——它不仅能看清高速动作，还能给出可执行的改进建议。

## 技术背后的关键突破

围绕真实场景的视觉理解，团队在**模型精度**与**交互反馈**上做了大量工程打磨：

- 精准捕捉关键帧与空间姿态变化
- 将专业建议拆解为普通人也能看懂的提示
- 让前沿 AI 能力真正走进日常训练场景

### 产品体验亮点

1. 拍摄上传后即可获得结构化动作解析
2. 自动标注核心发力点与改进动作示范

![AI 技术报道配图示例](/images/cover-example.jpg)

> 「AI 不会替代教练，但会彻底改变训练与复盘的方式。」

---

本子模板还原了《翎析AI》报道的天际蓝胶囊标题与冰蓝金句卡片样式。`,
  },

  // 4. 图文故事
  {
    id: "ai-vision-workshop",
    themeId: "visual-story",
    name: "AI 视觉工作坊",
    description: "复刻《AI视觉工作坊》样本：靛蓝左上直角边框、浅灰引用块与原生圆点列表。",
    sourceArticleTitle: "AI视觉创作工作坊完美收官！从新手村出发，搭建属于自己的世界",
    sourceArticleUrl: "https://mp.weixin.qq.com/s/T3y7hpVOyx8XEjevqrondg",
    defaultStyle: {
      paletteId: "vs-indigo",
      colors: makeColors(paletteOf("visual-story", "vs-indigo")),
      heading: { style: "corner-tl", fontSize: 18, fontWeight: 700, align: "left", marginTop: 26, marginBottom: 14 },
      paragraph: { fontSize: 15, lineHeight: 2, letterSpacing: 1, marginTop: 0, marginBottom: 16, textAlign: "justify" },
      list: { unorderedStyle: "disc", orderedStyle: "decimal", indent: 20, itemSpacing: 8 },
      image: { style: "full", align: "center", maxWidth: 100, borderRadius: 6, spacing: 14 },
      divider: { style: "solid", widthPercent: 100, color: "#7088f4", spacing: 22 },
    },
    sampleMarkdown: `# AI 视觉创作工作坊收官！搭建属于自己的世界

历时数小时的沉浸式共创，大家从第一张参考图开始，在无限画布上完成了属于自己的视觉故事。

## 工作坊三步通关路线

无论是否接触过设计软件，都可以沿着这条清晰路径完成第一次完整创作：

- 上传参考素材，在画布中建立视觉锚点
- 挂载专属 \`SKILL.md\`，由 Agent 自动规划多构图封面
- 切换至公众号排版视图，一键复制带样式富文本

### 学员作品亮点回顾

1. 从单张概念草图延展为整套角色设定
2. 结合图生图参考保持全篇配图色调统一

![视觉工作坊作品示例](/images/cover-example.jpg)

> 从零到一最难的不是参数设置，而是勇敢迈出第一次共创。

---

本子模板映射自《AI视觉创作工作坊完美收官》，采用电光靛蓝直角标题与原生列表缩进。`,
  },
  {
    id: "warm-gallery",
    themeId: "visual-story",
    name: "暖调图文画报",
    description: "居中标题与留白细边框配图，搭配点阵分割线，适合摄影手记、人物专访与生活故事。",
    defaultStyle: {
      paletteId: "vs-amber",
      colors: makeColors(paletteOf("visual-story", "vs-amber")),
      heading: { style: "plain", fontSize: 19, fontWeight: 600, align: "center", marginTop: 30, marginBottom: 14 },
      paragraph: { fontSize: 16, lineHeight: 1.9, letterSpacing: 0.8, marginTop: 0, marginBottom: 18, textAlign: "justify" },
      list: { unorderedStyle: "dash", orderedStyle: "decimal", indent: 22, itemSpacing: 8 },
      image: { style: "bordered", align: "center", maxWidth: 92, borderRadius: 12, spacing: 22 },
      divider: { style: "dots", widthPercent: 50, color: "#d97706", spacing: 28 },
    },
    sampleMarkdown: `# 秋日手记：把慢下来的画面留给生活

午后的光线穿过窗棂，刚好落在桌面的咖啡杯沿上，也照亮了手边刚打印出来的样张。

## 为什么值得认真排版每一张图

图片不只是段落之间的点缀，**合适的留白与边框比例**能让读者放慢滑动手指的速度：

- 给每一张横幅配图留出舒适的上下呼吸空间
- 用暖杏底色弱化屏幕纯白的刺眼感
- 以简洁的文字说明交代画面背后的故事

### 一组随拍记录

1. 清晨八点的街角光影与建筑立面
2. 下午工作台前整理参考素材的桌面

![秋日暖调配图示例](/images/cover-example.jpg)

> 愿你每次打开工作台，都能轻松写出想分享给朋友的话。

---

在顶部「图片」样式面板中，可以继续调节最大宽度、圆角与对齐方式。`,
  },

  // 5. 品牌发布
  {
    id: "industrial-recruit",
    themeId: "brand-release",
    name: "海军蓝招募海报",
    description: "复刻《法国工业专家到访招募》样本：左下直角框标题、海军蓝与朱红强视觉对比。",
    sourceArticleTitle: "交流招募｜走进欧洲产业决策，法国工业战略专家Boris Lombard到访无锡",
    sourceArticleUrl: "https://mp.weixin.qq.com/s/hWwzV1-HwjleIiuKo0hUpg",
    defaultStyle: {
      paletteId: "br-navy",
      colors: makeColors(paletteOf("brand-release", "br-navy")),
      heading: { style: "corner-bl", fontSize: 19, fontWeight: 700, align: "left", marginTop: 26, marginBottom: 14 },
      paragraph: { fontSize: 16, lineHeight: 2, letterSpacing: 1, marginTop: 0, marginBottom: 16, textAlign: "justify" },
      list: { unorderedStyle: "square", orderedStyle: "leading-zero", indent: 22, itemSpacing: 8 },
      image: { style: "full", align: "center", maxWidth: 100, borderRadius: 4, spacing: 16 },
      divider: { style: "short", widthPercent: 35, color: "#d80f30", spacing: 24 },
    },
    sampleMarkdown: `# 交流招募｜走进欧洲产业决策一线，闭门对话开启报名

为帮助团队更深入理解全球制造业升级与智能决策趋势，本周特别安排了一场面向产业负责人与研发骨干的闭门交流。

## 活动核心议程

本次沙龙重点拆解跨境技术合作与工业 AI 质检的**真实落地方法论**：

- 欧洲工业数字化转型与供应链协同案例拆解
- 视觉大模型在产线质检中的精度与成本平衡
- 一对一需求对接与联合试点探讨

### 报名须知

1. 面向制造业技术负责人、产品总监与投资机构开放
2. 审核通过后将通过邮件或微信发送具体议程地址

![工业专家招募主视觉示例](/images/cover-example.jpg)

> 席位有限，欢迎关注产业一线动态的伙伴提前报名锁定名额。

---

本子模板还原了《法国工业专家招募》一文的海军蓝左下直角框与朱红强调色体系。`,
  },
  {
    id: "brand-digest",
    themeId: "brand-release",
    name: "品牌更新快讯",
    description: "底色条标题搭配勾选清单与通栏视觉图，适合产品发布、版本日志与品牌月报。",
    defaultStyle: {
      paletteId: "br-teal",
      colors: makeColors(paletteOf("brand-release", "br-teal")),
      heading: { style: "band", fontSize: 18, fontWeight: 700, align: "left", marginTop: 26, marginBottom: 14 },
      paragraph: { fontSize: 15, lineHeight: 1.85, letterSpacing: 0.6, marginTop: 0, marginBottom: 15, textAlign: "justify" },
      list: { unorderedStyle: "check", orderedStyle: "decimal", indent: 20, itemSpacing: 8 },
      image: { style: "padded", align: "center", maxWidth: 96, borderRadius: 10, spacing: 18 },
      divider: { style: "dashed", widthPercent: 100, color: "#5eead4", spacing: 24 },
    },
    sampleMarkdown: `# 本周更新｜公众号排版两级模板库与局部微调正式上线

很高兴向你介绍本周工作台的全新升级，现在从画布出图到公众号发布变得更加顺畅。

## 本次版本更新清单

所有能力均已在工作台上线，打开 \`/typography\` 即可体验：

- 新增「主题 → 子模板」两级分类与实时微缩预览
- 每套主题内置 4 套以上预设配色，支持 5 项颜色自由定制
- 标题、列表、图片与分割线支持独立参数调节

### 快速上手步骤

1. 在上方选择任意主题与子模板（切换不覆盖现有正文）
2. 按需微调配色与局部排版参数
3. 点击「一键复制到公众号」直接粘贴进微信后台

![品牌更新快讯插图示例](/images/cover-example.jpg)

> 我们持续打磨每一个排版细节，让内容创作更专注。

---

点击「恢复模板默认」可随时将当前子模板样式还原至出厂配置。`,
  },
];

export const LEGACY_TEMPLATE_ID_MAP: Record<string, string> = {
  "tech-brief": "yingyue-salon",
  "warm-story": "warm-gallery",
};

export function resolveSubTemplateId(rawId: string | undefined): string {
  if (!rawId) return TYPOGRAPHY_SUBTEMPLATES[0].id;
  const mapped = LEGACY_TEMPLATE_ID_MAP[rawId] ?? rawId;
  return TYPOGRAPHY_SUBTEMPLATES.some((item) => item.id === mapped)
    ? mapped
    : TYPOGRAPHY_SUBTEMPLATES[0].id;
}

export function getSubTemplate(id: string): TypographySubTemplate {
  const resolvedId = resolveSubTemplateId(id);
  return TYPOGRAPHY_SUBTEMPLATES.find((item) => item.id === resolvedId) ?? TYPOGRAPHY_SUBTEMPLATES[0];
}

export function getThemeById(themeId: ThemeId): TypographyTheme {
  return TYPOGRAPHY_THEMES.find((t) => t.id === themeId) ?? TYPOGRAPHY_THEMES[0];
}

export function getSubTemplatesForTheme(themeId: ThemeId): TypographySubTemplate[] {
  return TYPOGRAPHY_SUBTEMPLATES.filter((sub) => sub.themeId === themeId);
}

export function cloneStyleConfig(style: TemplateStyleConfig): TemplateStyleConfig {
  return {
    paletteId: style.paletteId,
    colors: { ...style.colors },
    heading: { ...style.heading },
    paragraph: { ...style.paragraph },
    list: { ...style.list },
    image: { ...style.image },
    divider: { ...style.divider },
  };
}
