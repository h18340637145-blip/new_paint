import type { TemplateStyleConfig } from "./types";

export type XiumiCategory = "heading" | "card" | "image" | "layout" | "svg" | "widget";

export const XIUMI_CATEGORIES: { id: XiumiCategory; label: string }[] = [
  { id: "heading", label: "标题" },
  { id: "card", label: "卡片" },
  { id: "image", label: "图片" },
  { id: "layout", label: "布局" },
  { id: "svg", label: "SVG" },
  { id: "widget", label: "组件" },
];

export interface XiumiPreset {
  id: string;
  category: XiumiCategory;
  name: string;
  summary: string;
  sampleText: string;
}

export const XIUMI_PRESETS: XiumiPreset[] = [
  // 1. 标题
  {
    id: "heading-dual-badge",
    category: "heading",
    name: "双色序号框标题",
    summary: "左侧实心主色标签 + 右侧描边主标题框",
    sampleText: "重点章节标题",
  },
  {
    id: "heading-gradient-ribbon",
    category: "heading",
    name: "渐变彩带标题",
    summary: "主色至透明柔和渐变底条，层次鲜明",
    sampleText: "核心观点拆解",
  },
  {
    id: "heading-double-line",
    category: "heading",
    name: "居中双线标题",
    summary: "上下对称细线包裹，适合杂志风章节头",
    sampleText: "第一部分 · 视觉重构",
  },
  {
    id: "heading-magazine-box",
    category: "heading",
    name: "杂志折角框标题",
    summary: "双层错位边框立体标题块",
    sampleText: "本周精选专题",
  },
  {
    id: "heading-capsule-tag",
    category: "heading",
    name: "圆点胶囊导读标",
    summary: "带前置圆点的轻巧胶囊小标题",
    sampleText: "关键方法论",
  },

  // 2. 卡片
  {
    id: "card-shadow-summary",
    category: "card",
    name: "圆角柔影摘要卡",
    summary: "白底微投影卡片，突出段落核心摘要",
    sampleText: "在这里填写本节核心摘要，帮助读者在三秒内抓住文章主旨。",
  },
  {
    id: "card-top-ribbon",
    category: "card",
    name: "顶部色条重点卡",
    summary: "上方 4px 主色横梁 + 浅底重点框",
    sampleText: "重点提示：切换组件样式时，当前区域已有的文字内容会自动完整保留。",
  },
  {
    id: "card-dashed-note",
    category: "card",
    name: "虚线手账笔记卡",
    summary: "四周细虚线边框，适合补充说明与批注",
    sampleText: "手记批注：好的排版不是堆砌装饰，而是为重点信息建立清晰的视觉锚点。",
  },
  {
    id: "card-dark-quote",
    category: "card",
    name: "深色高光金句卡",
    summary: "深炭黑底色搭配引号装饰，强化金句记忆点",
    sampleText: "真正高效的创作流，是让灵感从画布到排版一气呵成。",
  },

  // 3. 图片
  {
    id: "image-polaroid",
    category: "image",
    name: "拍立得签注相框",
    summary: "四周宽白边投影相框 + 底部居中手记图注",
    sampleText: "![拍立得配图](/images/cover-example.jpg)",
  },
  {
    id: "image-gallery-frame",
    category: "image",
    name: "画廊双层细线框",
    summary: "外框细线留白包裹，凸显画报仪式感",
    sampleText: "![画廊配图](/images/cover-example.jpg)",
  },
  {
    id: "image-soft-shadow",
    category: "image",
    name: "大圆角悬浮投影",
    summary: "16px 圆角配柔和弥散阴影",
    sampleText: "![圆角悬浮图](/images/cover-example.jpg)",
  },
  {
    id: "image-tape-card",
    category: "image",
    name: "胶带装饰图框",
    summary: "顶部居中半透明主题色胶带贴纸效果",
    sampleText: "![胶带装饰配图](/images/cover-example.jpg)",
  },

  // 4. 布局
  {
    id: "layout-two-col",
    category: "layout",
    name: "左右双栏对照卡",
    summary: "用 || 或换行分隔左右两栏对比内容",
    sampleText: "传统排版流程：多软件来回复制，样式容易丢失 || 工作台一体化流程：左编右览实时对齐，一键复制直达微信",
  },
  {
    id: "layout-metric-pair",
    category: "layout",
    name: "双列数据指标卡",
    summary: "并排展示两组核心数据或亮点结论",
    sampleText: "50 张/月：Pro 会员生图额度 || 10 套+：可追溯公众号排版子模板",
  },
  {
    id: "layout-step-timeline",
    category: "layout",
    name: "时间轴步骤布局",
    summary: "每行自动渲染为左侧圆点连线步骤条",
    sampleText: "第一步：在画布中整理素材并连线暂存\n第二步：选择模板由 Qwen 读图扩写\n第三步：局部套用秀米式组件并一键复制",
  },

  // 5. SVG
  {
    id: "svg-pulse-header",
    category: "svg",
    name: "SVG 呼吸灯导读条",
    summary: "内联 SVG SMIL 动态脉冲圆点 + 导读标题",
    sampleText: "前沿观察 · 动态导读",
  },
  {
    id: "svg-wave-divider",
    category: "svg",
    name: "SVG 双层波浪分割",
    summary: "微信原生兼容的流线波浪图形分隔条",
    sampleText: "章节过渡",
  },
  {
    id: "svg-corner-frame",
    category: "svg",
    name: "SVG 几何折角线框",
    summary: "四角精准 SVG 矢量折线包裹重点段落",
    sampleText: "使用矢量 SVG 折角装饰的重点段落，在高清视网膜屏幕上依然保持锐利边缘。",
  },
  {
    id: "svg-scroll-hint",
    category: "svg",
    name: "SVG 下滑提示动效",
    summary: "带上下浮动箭头的阅读引导微动效组件",
    sampleText: "向下滑动查看完整解析",
  },

  // 6. 组件
  {
    id: "widget-lead-intro",
    category: "widget",
    name: "文首核心导读框",
    summary: "带「导读」角标徽章的开篇提要组件",
    sampleText: "本文约 3 分钟读完，核心拆解如何用画布节点与排版组件快速完成一篇高质量公众号推文。",
  },
  {
    id: "widget-follow-card",
    category: "widget",
    name: "公众号关注引导卡",
    summary: "文首/文末品牌名片与星标提醒组件",
    sampleText: "创作工作台 ｜ 点击上方蓝字关注并设为星标，不错过每周 AI 视觉与创作流实践分享。",
  },
  {
    id: "widget-copyright",
    category: "widget",
    name: "文末版权声明框",
    summary: "紧凑灰底原创与转载说明卡片",
    sampleText: "原创声明：本文图文由创作工作台生成与排版，欢迎转发分享；如需转载请在后台留言获取授权。",
  },
  {
    id: "widget-related-links",
    category: "widget",
    name: "往期精选推荐栏",
    summary: "每行一条往期文章标题展示框",
    sampleText: "映月湖创新沙龙回顾：从生成到理解世界\nAI 视觉创作工作坊完美收官\n未来文化力实验室成立纪实",
  },
];

const PRESET_MAP = new Map<string, XiumiPreset>(XIUMI_PRESETS.map((p) => [p.id, p]));

export function getXiumiPreset(presetId: string | undefined): XiumiPreset | undefined {
  return presetId ? PRESET_MAP.get(presetId) : undefined;
}

export interface PresetRenderInput {
  innerHtml: string;
  rawText: string;
  imageSrc?: string;
  imageAlt?: string;
  imageCaption?: string;
  badgeIndex?: number;
}

export function renderXiumiPresetHtml(
  presetId: string,
  input: PresetRenderInput,
  style: TemplateStyleConfig,
  escapeFn: (raw: string) => string,
  safeUrlFn: (raw: string) => string,
): string | null {
  const preset = PRESET_MAP.get(presetId);
  if (!preset) return null;

  const { colors, paragraph, heading } = style;
  const mb = paragraph.marginBottom;
  const mt = paragraph.marginTop;
  const textHtml = input.innerHtml || escapeFn(input.rawText || preset.sampleText);

  switch (presetId) {
    // ── Headings ──
    case "heading-dual-badge": {
      const idx = String(input.badgeIndex ?? 1).padStart(2, "0");
      return `<section style="margin:${heading.marginTop}px 0 ${heading.marginBottom}px 0;display:flex;align-items:stretch;text-align:left;">
        <span style="display:inline-flex;align-items:center;justify-content:center;padding:6px 12px;background:${colors.primaryColor};color:#ffffff;font-size:${Math.max(13, heading.fontSize - 3)}px;font-weight:700;border-radius:6px 0 0 6px;">${idx}</span>
        <span style="display:inline-flex;align-items:center;padding:6px 16px;border:1.5px solid ${colors.primaryColor};border-left:none;border-radius:0 6px 6px 0;color:${colors.primaryColor};font-size:${heading.fontSize}px;font-weight:700;line-height:1.4;">${textHtml}</span>
      </section>`;
    }
    case "heading-gradient-ribbon":
      return `<section style="margin:${heading.marginTop}px 0 ${heading.marginBottom}px 0;">
        <h2 style="margin:0;padding:8px 16px;border-left:4px solid ${colors.primaryColor};background:linear-gradient(90deg, ${colors.quoteBgColor} 0%, rgba(255,255,255,0) 95%);font-size:${heading.fontSize}px;font-weight:700;color:${colors.textColor};line-height:1.45;">${textHtml}</h2>
      </section>`;
    case "heading-double-line":
      return `<section style="margin:${heading.marginTop}px 0 ${heading.marginBottom}px 0;text-align:center;">
        <span style="display:inline-block;padding:6px 22px;border-top:1.5px solid ${colors.primaryColor};border-bottom:1.5px solid ${colors.primaryColor};color:${colors.primaryColor};font-size:${heading.fontSize}px;font-weight:700;letter-spacing:1.5px;">${textHtml}</span>
      </section>`;
    case "heading-magazine-box":
      return `<section style="margin:${heading.marginTop}px 0 ${heading.marginBottom}px 0;text-align:${heading.align};">
        <span style="display:inline-block;position:relative;padding:7px 18px;border:1.5px solid ${colors.primaryColor};box-shadow:4px 4px 0 ${colors.quoteBgColor};background:${colors.bgColor};color:${colors.primaryColor};font-size:${heading.fontSize}px;font-weight:700;">${textHtml}</span>
      </section>`;
    case "heading-capsule-tag":
      return `<section style="margin:${heading.marginTop}px 0 ${heading.marginBottom}px 0;text-align:${heading.align};">
        <span style="display:inline-flex;align-items:center;gap:8px;padding:5px 16px;border-radius:999px;background:${colors.quoteBgColor};border:1px solid ${colors.borderColor};color:${colors.primaryColor};font-size:${Math.max(15, heading.fontSize - 1)}px;font-weight:700;">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${colors.primaryColor};"></span>
          <span>${textHtml}</span>
        </span>
      </section>`;

    // ── Cards ──
    case "card-shadow-summary":
      return `<section style="margin:${mt}px 0 ${mb}px 0;padding:18px 20px;border-radius:14px;background:${colors.bgColor};border:1px solid ${colors.borderColor};box-shadow:0 6px 20px rgba(0,0,0,0.06);color:${colors.textColor};font-size:${paragraph.fontSize}px;line-height:${paragraph.lineHeight};letter-spacing:${paragraph.letterSpacing}px;text-align:${paragraph.textAlign};">${textHtml}</section>`;
    case "card-top-ribbon":
      return `<section style="margin:${mt}px 0 ${mb}px 0;border-radius:10px;overflow:hidden;background:${colors.quoteBgColor};border:1px solid ${colors.borderColor};">
        <div style="height:4px;background:${colors.primaryColor};"></div>
        <div style="padding:16px 18px;color:${colors.textColor};font-size:${paragraph.fontSize}px;line-height:${paragraph.lineHeight};letter-spacing:${paragraph.letterSpacing}px;text-align:${paragraph.textAlign};">${textHtml}</div>
      </section>`;
    case "card-dashed-note":
      return `<section style="margin:${mt}px 0 ${mb}px 0;padding:16px 18px;border-radius:12px;border:1.5px dashed ${colors.primaryColor};background:${colors.quoteBgColor};color:${colors.textColor};font-size:${Math.max(14, paragraph.fontSize - 1)}px;line-height:${paragraph.lineHeight};letter-spacing:${paragraph.letterSpacing}px;">${textHtml}</section>`;
    case "card-dark-quote":
      return `<section style="margin:${mt}px 0 ${mb}px 0;padding:20px 22px;border-radius:14px;background:#18181b;color:#f4f4f5;font-size:${paragraph.fontSize}px;line-height:${paragraph.lineHeight};letter-spacing:${paragraph.letterSpacing}px;">
        <div style="font-size:24px;line-height:1;color:${colors.primaryColor};font-weight:700;margin-bottom:6px;">“</div>
        <div>${textHtml}</div>
      </section>`;

    // ── Images ──
    case "image-polaroid": {
      const src = safeUrlFn(input.imageSrc || "/images/cover-example.jpg");
      const alt = escapeFn(input.imageAlt || "配图");
      const cap = escapeFn(input.imageCaption || input.imageAlt || "影像记录");
      return `<section style="margin:${style.image.spacing}px 0;text-align:center;">
        <span style="display:inline-block;width:${style.image.maxWidth}%;max-width:100%;padding:10px 10px 14px 10px;background:#ffffff;border:1px solid #e5e5e5;box-shadow:0 8px 24px rgba(0,0,0,0.08);border-radius:4px;box-sizing:border-box;">
          <img src="${src}" alt="${alt}" style="display:block;width:100%;max-width:100%;height:auto;border-radius:2px;" />
          <span style="display:block;margin-top:10px;font-size:12px;color:#737373;letter-spacing:1px;">${cap}</span>
        </span>
      </section>`;
    }
    case "image-gallery-frame": {
      const src = safeUrlFn(input.imageSrc || "/images/cover-example.jpg");
      const alt = escapeFn(input.imageAlt || "配图");
      const cap = input.imageCaption ? `<p style="margin:8px 0 0 0;font-size:12px;color:#8c8c8c;">${escapeFn(input.imageCaption)}</p>` : "";
      return `<section style="margin:${style.image.spacing}px 0;text-align:center;">
        <span style="display:inline-block;width:${style.image.maxWidth}%;max-width:100%;padding:8px;border:1px solid ${colors.primaryColor};background:${colors.bgColor};box-sizing:border-box;">
          <span style="display:block;padding:4px;border:1px solid ${colors.borderColor};">
            <img src="${src}" alt="${alt}" style="display:block;width:100%;max-width:100%;height:auto;" />
          </span>
        </span>
        ${cap}
      </section>`;
    }
    case "image-soft-shadow": {
      const src = safeUrlFn(input.imageSrc || "/images/cover-example.jpg");
      const alt = escapeFn(input.imageAlt || "配图");
      const cap = input.imageCaption ? `<p style="margin:8px 0 0 0;font-size:12px;color:#8c8c8c;">${escapeFn(input.imageCaption)}</p>` : "";
      return `<section style="margin:${style.image.spacing}px 0;text-align:center;">
        <img src="${src}" alt="${alt}" style="display:inline-block;width:${style.image.maxWidth}%;max-width:100%;height:auto;border-radius:16px;box-shadow:0 12px 28px rgba(0,0,0,0.12);vertical-align:middle;" />
        ${cap}
      </section>`;
    }
    case "image-tape-card": {
      const src = safeUrlFn(input.imageSrc || "/images/cover-example.jpg");
      const alt = escapeFn(input.imageAlt || "配图");
      const cap = input.imageCaption ? `<p style="margin:8px 0 0 0;font-size:12px;color:#737373;">${escapeFn(input.imageCaption)}</p>` : "";
      return `<section style="margin:${style.image.spacing + 6}px 0 ${style.image.spacing}px 0;text-align:center;">
        <span style="display:inline-block;width:68px;height:14px;background:${colors.primaryColor};opacity:0.35;border-radius:2px;margin-bottom:-7px;position:relative;z-index:1;"></span>
        <span style="display:block;max-width:${style.image.maxWidth}%;margin:0 auto;padding:8px;background:${colors.quoteBgColor};border:1px solid ${colors.borderColor};border-radius:8px;box-sizing:border-box;">
          <img src="${src}" alt="${alt}" style="display:block;width:100%;max-width:100%;height:auto;border-radius:4px;" />
        </span>
        ${cap}
      </section>`;
    }

    // ── Layouts ──
    case "layout-two-col": {
      const parts = (input.rawText || preset.sampleText)
        .split(/\|\||\n/)
        .map((s) => s.trim())
        .filter(Boolean);
      const left = escapeFn(parts[0] ?? "左栏内容");
      const right = escapeFn(parts[1] ?? "右栏内容");
      return `<section style="margin:${mt}px 0 ${mb}px 0;display:flex;gap:10px;align-items:stretch;">
        <div style="flex:1;padding:14px;border-radius:10px;background:${colors.quoteBgColor};border:1px solid ${colors.borderColor};font-size:${Math.max(13, paragraph.fontSize - 1)}px;line-height:1.7;color:${colors.textColor};">${left}</div>
        <div style="flex:1;padding:14px;border-radius:10px;background:${colors.bgColor};border:1.5px solid ${colors.primaryColor};font-size:${Math.max(13, paragraph.fontSize - 1)}px;line-height:1.7;color:${colors.textColor};">${right}</div>
      </section>`;
    }
    case "layout-metric-pair": {
      const parts = (input.rawText || preset.sampleText)
        .split(/\|\||\n/)
        .map((s) => s.trim())
        .filter(Boolean);
      const renderCard = (raw: string) => {
        const [num, desc] = raw.includes("：") ? raw.split("：", 2) : raw.split(":", 2);
        return `<div style="flex:1;padding:14px 12px;border-radius:12px;background:${colors.quoteBgColor};text-align:center;">
          <div style="font-size:${heading.fontSize + 2}px;font-weight:700;color:${colors.primaryColor};line-height:1.3;">${escapeFn(num || raw)}</div>
          ${desc ? `<div style="margin-top:4px;font-size:12px;color:${colors.textColor};opacity:0.8;">${escapeFn(desc)}</div>` : ""}
        </div>`;
      };
      return `<section style="margin:${mt}px 0 ${mb}px 0;display:flex;gap:10px;">
        ${renderCard(parts[0] ?? "50 张/月：Pro 生图额度")}
        ${renderCard(parts[1] ?? "10 套+：可编辑子模板")}
      </section>`;
    }
    case "layout-step-timeline": {
      const steps = (input.rawText || preset.sampleText)
        .split(/\n/)
        .map((s) => s.trim())
        .filter(Boolean);
      const itemsHtml = steps
        .map(
          (step, idx) => `<div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:${idx === steps.length - 1 ? 0 : 12}px;">
            <span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:${colors.primaryColor};color:#ffffff;font-size:11px;font-weight:700;flex-shrink:0;margin-top:2px;">${idx + 1}</span>
            <div style="flex:1;font-size:${paragraph.fontSize}px;line-height:${paragraph.lineHeight};color:${colors.textColor};">${escapeFn(step)}</div>
          </div>`,
        )
        .join("");
      return `<section style="margin:${mt}px 0 ${mb}px 0;padding:16px;border-radius:12px;background:${colors.quoteBgColor};">${itemsHtml}</section>`;
    }

    // ── SVG ──
    case "svg-pulse-header":
      return `<section style="margin:${heading.marginTop}px 0 ${heading.marginBottom}px 0;display:flex;align-items:center;gap:8px;">
        <svg width="22" height="22" viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;">
          <circle cx="11" cy="11" r="8" fill="${colors.primaryColor}" opacity="0.25">
            <animate attributeName="r" values="5;10;5" dur="2.2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.45;0.1;0.45" dur="2.2s" repeatCount="indefinite" />
          </circle>
          <circle cx="11" cy="11" r="4.5" fill="${colors.primaryColor}" />
        </svg>
        <span style="font-size:${heading.fontSize}px;font-weight:700;color:${colors.primaryColor};letter-spacing:1px;">${textHtml}</span>
      </section>`;
    case "svg-wave-divider":
      return `<section style="margin:${style.divider.spacing}px 0;text-align:center;line-height:0;">
        <svg viewBox="0 0 360 22" width="100%" height="22" xmlns="http://www.w3.org/2000/svg" style="max-width:360px;display:inline-block;">
          <path d="M0 11 Q 45 2, 90 11 T 180 11 T 270 11 T 360 11" fill="none" stroke="${colors.primaryColor}" stroke-width="2" stroke-linecap="round" />
          <path d="M0 16 Q 45 7, 90 16 T 180 16 T 270 16 T 360 16" fill="none" stroke="${colors.borderColor}" stroke-width="1" stroke-linecap="round" opacity="0.7" />
        </svg>
      </section>`;
    case "svg-corner-frame":
      return `<section style="margin:${mt}px 0 ${mb}px 0;position:relative;padding:18px 20px;background:${colors.quoteBgColor};border-radius:6px;">
        <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" style="display:block;margin-bottom:6px;">
          <path d="M1 17 V1 H17" fill="none" stroke="${colors.primaryColor}" stroke-width="2.5" />
        </svg>
        <div style="font-size:${paragraph.fontSize}px;line-height:${paragraph.lineHeight};color:${colors.textColor};text-align:${paragraph.textAlign};">${textHtml}</div>
        <div style="text-align:right;margin-top:6px;line-height:0;">
          <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;">
            <path d="M17 1 V17 H1" fill="none" stroke="${colors.primaryColor}" stroke-width="2.5" />
          </svg>
        </div>
      </section>`;
    case "svg-scroll-hint":
      return `<section style="margin:${mt}px 0 ${mb}px 0;text-align:center;">
        <div style="font-size:12px;color:${colors.primaryColor};letter-spacing:1.5px;margin-bottom:4px;">${textHtml}</div>
        <svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;">
          <path d="M5 7 L10 12 L15 7" fill="none" stroke="${colors.primaryColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <animateTransform attributeName="transform" type="translate" values="0 0; 0 4; 0 0" dur="1.6s" repeatCount="indefinite" />
          </path>
        </svg>
      </section>`;

    // ── Widgets ──
    case "widget-lead-intro":
      return `<section style="margin:${mt}px 0 ${mb + 4}px 0;padding:14px 16px;border-radius:10px;background:${colors.quoteBgColor};border:1px solid ${colors.borderColor};">
        <span style="display:inline-block;margin-bottom:8px;padding:2px 8px;border-radius:4px;background:${colors.primaryColor};color:#ffffff;font-size:11px;font-weight:700;letter-spacing:1px;">导读</span>
        <div style="font-size:${Math.max(14, paragraph.fontSize - 1)}px;line-height:1.8;color:${colors.textColor};text-align:${paragraph.textAlign};">${textHtml}</div>
      </section>`;
    case "widget-follow-card":
      return `<section style="margin:${mt + 4}px 0 ${mb + 4}px 0;padding:14px 16px;border-radius:12px;background:${colors.quoteBgColor};border:1px solid ${colors.primaryColor};display:flex;align-items:center;gap:12px;">
        <span style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;background:${colors.primaryColor};color:#ffffff;font-size:14px;font-weight:700;flex-shrink:0;">★</span>
        <div style="font-size:13px;line-height:1.65;color:${colors.textColor};">${textHtml}</div>
      </section>`;
    case "widget-copyright":
      return `<section style="margin:${mt + 8}px 0 ${mb}px 0;padding:12px 14px;border-radius:8px;background:#f5f5f5;color:#737373;font-size:12px;line-height:1.7;">${textHtml}</section>`;
    case "widget-related-links": {
      const links = (input.rawText || preset.sampleText)
        .split(/\n/)
        .map((s) => s.trim())
        .filter(Boolean);
      const rows = links
        .map(
          (item, idx) =>
            `<div style="padding:7px 0;${idx < links.length - 1 ? `border-bottom:1px dashed ${colors.borderColor};` : ""}font-size:13px;color:${colors.textColor};"><span style="color:${colors.primaryColor};font-weight:700;margin-right:6px;">▸</span>${escapeFn(item)}</div>`,
        )
        .join("");
      return `<section style="margin:${mt + 6}px 0 ${mb}px 0;padding:14px 16px;border-radius:10px;border:1px solid ${colors.borderColor};background:${colors.bgColor};">
        <div style="font-size:12px;font-weight:700;color:${colors.primaryColor};letter-spacing:1px;margin-bottom:6px;">往期精选</div>
        ${rows}
      </section>`;
    }
    default:
      return null;
  }
}

/**
 * Applies or inserts a Xiumi preset onto the target paragraph/selection in Markdown mode.
 */
export function applyPresetToMarkdown(
  markdown: string,
  selStart: number,
  selEnd: number,
  preset: XiumiPreset,
  mode: "replace-region" | "insert-below",
): { nextMarkdown: string; focusOffset: number } {
  if (mode === "insert-below" || !markdown.trim()) {
    const pos = Math.min(markdown.length, Math.max(0, selEnd));
    const lineBreakAfter = markdown.indexOf("\n", pos);
    const insertAt = lineBreakAfter === -1 ? markdown.length : lineBreakAfter;
    const block = `\n\n:::preset[${preset.id}]\n${preset.sampleText}\n:::\n`;
    const next = markdown.slice(0, insertAt) + block + markdown.slice(insertAt);
    return { nextMarkdown: next, focusOffset: insertAt + block.length };
  }

  // Locate either the selected substring or the paragraph around cursor `selStart`
  let rangeStart = selStart;
  let rangeEnd = selEnd;

  if (rangeEnd <= rangeStart) {
    const prevBlank = markdown.lastIndexOf("\n\n", Math.max(0, rangeStart - 1));
    rangeStart = prevBlank === -1 ? 0 : prevBlank + 2;
    const nextBlank = markdown.indexOf("\n\n", rangeStart);
    rangeEnd = nextBlank === -1 ? markdown.length : nextBlank;
  }

  let targetSlice = markdown.slice(rangeStart, rangeEnd).trim();
  // Unwrap existing :::preset[...] wrapper if already wrapped so re-clicking switches preset cleanly!
  const existingWrap = /^:::preset\[[a-z0-9-]+\]\r?\n([\s\S]*?)\r?\n:::$/i.exec(targetSlice);
  if (existingWrap) {
    targetSlice = existingWrap[1].trim();
  }
  // Strip leading markdown heading `# ` or `> ` when wrapping into a heading/card preset
  if (preset.category === "heading") {
    targetSlice = targetSlice.replace(/^#{1,4}\s+/, "");
  } else if (preset.category === "card") {
    targetSlice = targetSlice.replace(/^>\s*/, "");
  }

  const innerContent = targetSlice || preset.sampleText;
  const wrapped = `:::preset[${preset.id}]\n${innerContent}\n:::`;
  const nextMarkdown = markdown.slice(0, rangeStart) + wrapped + markdown.slice(rangeEnd);
  return { nextMarkdown, focusOffset: rangeStart + wrapped.length };
}
