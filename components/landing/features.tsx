import Link from "next/link";
import { ArrowUpRight, ArrowRight, ImagePlus, Images, Sparkles } from "lucide-react";

const features = [
  {
    tag: "核心能力 · 画布",
    title: "无限节点画布与图生图引用",
    description: "基于节点画布管理每次生图任务。点击画布图片即可按顺序加入参考素材，支持多图参考、等比缩放、复制粘贴与失败重试不重复扣额度。",
    points: ["支持文生图与多参考图生图", "节点按图片真实比例呈现", "刷新自动恢复位置与删除状态"],
    href: "/protected",
    cta: "打开画布工作台",
    preview: (
      <div className="landing-flow" aria-label="从参考图到生成结果">
        <span><ImagePlus size={18} aria-hidden />参考图</span>
        <ArrowRight size={16} aria-hidden />
        <span><Sparkles size={18} aria-hidden />生成</span>
        <ArrowRight size={16} aria-hidden />
        <span><Images size={18} aria-hidden />画布结果</span>
      </div>
    ),
  },
  {
    tag: "核心能力 · Agent & Skill",
    title: "Agent 协同与可复用 SKILL.md",
    description: "在工作台上传 SKILL.md，让 Agent 先询问你的风格偏好，再自动规划并调用生图工具。比如内置的公众号封面技能，一次产出四张同风格不同构图的宽幅封面。",
    points: ["实时流式输出思考与工具调用卡片", "Skill 按用户与项目隔离保存", "支持重试沿用原模型与参考素材"],
    href: "/protected",
    cta: "体验 Agent 与 Skill",
    preview: (
      <div className="space-y-2.5 rounded-xl border border-neutral-200 bg-neutral-50 p-3.5 text-xs">
        <div className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-3 py-2">
          <span className="font-mono font-medium text-neutral-900">SKILL.md · wechat-cover</span>
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-700">已启用</span>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-3 text-neutral-700">
          <p className="font-medium text-neutral-950">Agent 提问：请选择封面视觉风格</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-md bg-neutral-950 px-2 py-1 text-[11px] text-white">极简大字报</span>
            <span className="rounded-md border border-neutral-200 px-2 py-1 text-[11px]">科技</span>
            <span className="rounded-md border border-neutral-200 px-2 py-1 text-[11px]">插画</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    tag: "扩展功能 · 公众号排版",
    title: "左右分栏实时预览 + 可编辑预置模板",
    description: "左侧编写 Markdown 并自由微调模板主色、字号、行高与标题样式，右侧以微信公众号手机视口实时预览，支持一键复制带内联样式的富文本直贴公众号后台。",
    points: ["左右分栏：左侧编辑，右侧微信视口预览", "4 套预置模板可直接修改并本地保存", "一键复制兼容微信公众号内联样式"],
    href: "/typography",
    cta: "立即试用公众号排版",
    preview: (
      <div className="grid grid-cols-2 gap-2.5 rounded-xl border border-neutral-200 bg-neutral-50 p-3.5 text-xs">
        <div className="space-y-2 rounded-lg border border-neutral-200 bg-white p-3">
          <p className="font-medium text-neutral-500">左侧 · 编辑与模板</p>
          <div className="space-y-1 font-mono text-[11px] text-neutral-700">
            <p># 春日创作手记</p>
            <p className="text-neutral-600">主色：#171717 · 15px</p>
            <p>&gt; 用画布记录灵感…</p>
          </div>
        </div>
        <div className="space-y-2 rounded-lg border border-neutral-200 bg-white p-3">
          <p className="font-medium text-neutral-500">右侧 · 公众号预览</p>
          <div className="border-l-2 border-neutral-950 pl-2">
            <p className="font-semibold text-neutral-950">春日创作手记</p>
            <p className="mt-1 text-[11px] text-neutral-600">用画布记录灵感…</p>
          </div>
        </div>
      </div>
    ),
  },
];

export function LandingFeatures() {
  return (
    <section id="features" className="landing-section">
      <div className="landing-wrap wrap">
        <div className="max-w-2xl space-y-3">
          <h2 className="text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl">
            画布、Agent 和公众号排版
          </h2>
          <p className="text-base text-neutral-600">
            从参考图开始，也可以直接打开编辑器排一篇文章。
          </p>
        </div>

        <div className="mt-12 space-y-8">
          {features.map((feature, index) => (
            <article
              key={feature.title}
              className="landing-feature grid gap-8 lg:grid-cols-12 lg:items-center"
            >
              <div className={`space-y-4 lg:col-span-6 ${index % 2 === 1 ? "lg:order-2" : ""}`}>
                <span className="inline-flex items-center rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700">
                  {feature.tag}
                </span>
                <h3 className="text-2xl font-semibold tracking-tight text-neutral-950">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-neutral-600 sm:text-base">{feature.description}</p>
                <ul className="space-y-1.5 text-sm text-neutral-700">
                  {feature.points.map((point) => (
                    <li key={point} className="flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-neutral-950" aria-hidden="true" />
                      {point}
                    </li>
                  ))}
                </ul>
                <div className="pt-1">
                  <Link
                    href={feature.href}
                    className="inline-flex min-h-9 items-center gap-1.5 text-sm font-medium text-neutral-950 underline underline-offset-4 transition hover:opacity-75"
                  >
                    {feature.cta}
                    <ArrowUpRight size={15} aria-hidden="true" />
                  </Link>
                </div>
              </div>
              <div className={`landing-feature-visual lg:col-span-6 ${index % 2 === 1 ? "lg:order-1" : ""}`}>
                {feature.preview}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
