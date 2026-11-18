import { Bot, Layers, LayoutPanelLeft, Sparkles } from "lucide-react";

const benefits = [
  {
    icon: Layers,
    title: "空间化画布管理",
    description: "所有上传素材与生成结果都以真实比例节点落在画布上，可以拖动、缩放和选作参考图，刷新自动恢复。",
  },
  {
    icon: Bot,
    title: "Agent 全程协同",
    description: "无需反复切换提示词。Agent 可直接查看素材与画布上下文，规划任务、调用生图工具并自动摆入画布。",
  },
  {
    icon: Sparkles,
    title: "Skill 工作流沉淀",
    description: "上传一份 SKILL.md 即可复用固定出图规范与风格约束，按用户与项目隔离。",
  },
  {
    icon: LayoutPanelLeft,
    title: "图文排版一体衔接",
    description: "左编辑右预览的公众号排版工作台与可编辑预置模板，让微信文章的手机预览随编辑更新。",
  },
];

export function LandingBenefits() {
  return (
    <section id="benefits" className="landing-section">
      <div className="landing-wrap wrap">
        <div className="max-w-2xl space-y-3">
          <h2 className="text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl">
            把创作素材留在同一个项目
          </h2>
          <p className="text-base text-neutral-600">
            参考图、生成结果和出图规则都能在项目里找回。
          </p>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {benefits.map((item) => {
            const Icon = item.icon;
            return (
              <article
                key={item.title}
                className="flex flex-col gap-3 rounded-2xl border border-neutral-200/90 bg-white p-6 shadow-sm transition-transform duration-200 hover:-translate-y-0.5"
              >
                <span className="grid size-10 place-items-center rounded-xl bg-neutral-950 text-white">
                  <Icon size={18} aria-hidden="true" />
                </span>
                <h3 className="text-base font-semibold text-neutral-950">{item.title}</h3>
                <p className="text-sm leading-relaxed text-neutral-600">{item.description}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
