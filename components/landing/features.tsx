import Link from "next/link";
import { ArrowRight, ArrowUpRight, CheckCircle2, Layers } from "lucide-react";

const features = [
  {
    tag: "画布生图与顺序暂存",
    title: "把参考图、生成图和段落连成一条文章主链",
    description:
      "在画布里粘贴外部图片、调用多模型生图或手动添加文本块。文字可标为「创作素材」「写作要求」或「原文保留」，连线确认顺序后保存为不可变暂存版本。",
    points: [
      "支持多参考图生图、等比缩放与粘贴外部图片入库",
      "自动检测分叉与环路，保留多次历史暂存记录",
      "「原文保留」节点一字不改写入最终排版稿",
    ],
    href: "/protected",
    cta: "打开画布工作台",
    preview: (
      <div data-ui className="space-y-3 rounded-xl border border-[#c8d7ca] bg-white p-4 text-xs">
        <div className="flex items-center justify-between text-neutral-700">
          <span className="font-semibold text-neutral-950">主链暂存预览 · 版本 v3</span>
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 font-semibold text-emerald-950">
            顺序校验通过
          </span>
        </div>
        <div className="grid items-stretch gap-2.5 sm:grid-cols-11">
          <div className="flex flex-col justify-between rounded-lg bg-[#fbf6ec] p-3 sm:col-span-5">
            <span className="w-fit rounded bg-amber-900 px-2 py-0.5 text-[11px] font-semibold text-white">
              #1 原文保留
            </span>
            <p className="mt-2 text-xs leading-relaxed text-neutral-800">
              「好建筑不是占据风景，而是替山林留住光线。」
            </p>
          </div>
          <div className="hidden items-center justify-center text-[#164b3e] sm:col-span-1 sm:flex" aria-hidden>
            <ArrowRight size={16} />
          </div>
          <div className="flex flex-col justify-between rounded-lg bg-[#eef4f0] p-3 sm:col-span-5">
            <span className="w-fit rounded bg-[#164b3e] px-2 py-0.5 text-[11px] font-semibold text-white">
              #2 生成图节点 · 16:9
            </span>
            <p className="mt-2 text-xs leading-relaxed text-neutral-800">
              山谷木构长廊实景图（已关联项目私有素材库，导出时按需生成公开副本）
            </p>
          </div>
        </div>
      </div>
    ),
  },
  {
    tag: "AI 图文共创",
    title: "先聊好文章分镜，满意后自动铺好文案与配图",
    description:
      "不用对着空白文档发愁。和画布助手聊一聊选题方向或参考风格，它会先给出章节脉络与画面建议；你点确认后，才在画布里生成文案和配图并按阅读顺序连好。",
    points: [
      "两步确认：先看分镜建议，满意后再消耗生图额度",
      "可保存常用写作与视觉风格预设，随时复用",
      "配图失败可一键原样重试，不重复扣额度",
    ],
    href: "/protected",
    cta: "体验 AI 图文共创",
    preview: (
      <div data-ui className="space-y-3 rounded-xl border border-[#c7d5e4] bg-white p-4 text-xs">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-2.5">
          <span className="font-mono font-semibold text-neutral-950">
            创意分镜提案 · 秋季空间特辑
          </span>
          <span className="rounded-full bg-[#164b3e] px-2.5 py-0.5 text-[11px] font-semibold text-white">
            Seedream 5.5
          </span>
        </div>
        <p className="font-semibold text-neutral-950">
          1. 开篇导语 + 2. 晨雾木构主视觉（16:9）+ 3. 空间细节结语
        </p>
        <p className="leading-relaxed text-neutral-700">
          确认后自动在画布创建 2 个文案节点、1 张宽幅配图并完成有向连线。
        </p>
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-1.5 text-[11px] font-semibold text-white">
            <CheckCircle2 size={12} aria-hidden />
            认同创意，自动排入画布
          </span>
        </div>
      </div>
    ),
  },
  {
    tag: "模板导入 · 个人库与团队库",
    title: "从公众号或秀米导入组件，拆装编辑并团队共享",
    description:
      "支持粘贴富文本、上传 .html 或导入版本化 .json。自动过滤脚本与危险属性，把标题边框、图文卡片、图片边框和双栏布局变成可调列宽、圆角与配色的组件。",
    points: [
      "可视化层级树：支持拖拽或按钮排序、换图与局部字号染色",
      "套用标题边框与图片边框时完整保留原文字和配图",
      "支持个人库与团队角色协作，归档或退团不影响旧稿导出",
    ],
    href: "/typography",
    cta: "打开公众号排版台",
    preview: (
      <div data-ui className="grid items-stretch gap-3 rounded-xl border border-[#dfd3c1] bg-white p-4 text-xs sm:grid-cols-2">
        <div className="space-y-2 rounded-lg bg-[#f7f5f0] p-3">
          <div className="flex items-center gap-1 font-semibold text-neutral-900">
            <Layers size={13} aria-hidden />
            受控组件层级拆装
          </div>
          <p className="rounded bg-neutral-900 px-2.5 py-1 font-medium text-white">
            ▾ 横向分栏容器 (间距 10px)
          </p>
          <p className="pl-3 text-neutral-700">• 标题边框 · 列宽 5/12</p>
          <p className="pl-3 text-neutral-700">• 正文插槽 · 列宽 7/12</p>
        </div>

        <div className="flex flex-col justify-between rounded-lg bg-[#f3f7f4] p-3">
          <span className="w-fit rounded-full bg-[#164b3e] px-2.5 py-0.5 text-[11px] font-semibold text-white">
            空间观察 · 套用后效果
          </span>
          <p className="mt-2 leading-relaxed text-neutral-800">
            保留原段文字，一键换上团队共享卡片与圆角边框，直接复制进公众号后台。
          </p>
        </div>
      </div>
    ),
  },
];

export function LandingFeatures() {
  return (
    <section id="features" className="landing-section">
      <div className="landing-wrap wrap">
        <div className="max-w-2xl space-y-2.5">
          <h2 className="text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl">
            从画布分镜到公众号成稿的每一步
          </h2>
          <p className="text-base text-neutral-700">
            你可以从参考图开始生图编排，也可以直接打开排版台导入现有公众号样式。
          </p>
        </div>

        <div className="mt-10 space-y-8">
          {features.map((feature) => (
            <article
              key={feature.title}
              className="landing-feature grid gap-8 lg:grid-cols-12 lg:items-center"
            >
              <div className="space-y-3.5 lg:col-span-6">
                <span className="inline-flex items-center rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-800">
                  {feature.tag}
                </span>
                <h3 className="text-2xl font-semibold tracking-tight text-neutral-950">
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed text-neutral-700 sm:text-base">
                  {feature.description}
                </p>
                <ul className="list-disc space-y-1.5 pl-5 text-sm text-neutral-800">
                  {feature.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
                <div>
                  <Link
                    href={feature.href}
                    className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-[#164b3e] underline underline-offset-4 transition hover:opacity-80"
                  >
                    {feature.cta}
                    <ArrowUpRight size={15} aria-hidden="true" />
                  </Link>
                </div>
              </div>
              <div className="landing-feature-visual lg:col-span-6">
                {feature.preview}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
