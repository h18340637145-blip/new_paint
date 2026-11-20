import Link from "next/link";
import { ArrowRight, HelpCircle } from "lucide-react";

const faqs = [
  {
    q: "生图额度是如何计算和重置的？",
    a: "免费用户每个北京时间自然月拥有 3 张生图额度，Pro 会员生效期间每月上限为 50 张。普通画布生图与 Agent 生图共用额度，单次生成多张图按实际张数计数；同一失败任务点击重试不会重复扣减额度。",
  },
  {
    q: "模板与素材库支持哪些导入方式？退出团队会影响旧稿吗？",
    a: "支持粘贴公众号或秀米富文本、上传 .html 文件以及导入本项目导出的版本化 .json。系统会在服务端校验并拦截脚本与危险属性。将素材应用到稿件时会生成独立快照并复制所需图片，归档素材或退出团队后历史稿件仍可正常预览和导出。",
  },
  {
    q: "Pro 订阅支持哪些支付方式？订单超时怎么办？",
    a: "支持支付宝与微信支付，手动按月续订。在个人中心下单后，待付款订单保留 10 分钟付款窗口，期间可随时点击「去付款」继续完成支付；超过 10 分钟未支付将自动变为「取消付款」。",
  },
  {
    q: "公众号排版支持直接粘贴到微信后台吗？",
    a: "支持。在公众号排版工作台中，左侧编辑内容或套用个人与团队库组件后，右侧实时呈现微信文章效果，点击「复制到公众号」并在首次导出配图时确认公开说明，即可将带内联样式的富文本粘贴到微信公众号编辑器。",
  },
];

export function LandingFaq({ isAuthenticated = false }: { isAuthenticated?: boolean }) {
  return (
    <section id="faq" className="landing-section">
      <div className="landing-wrap wrap">
        <div className="space-y-4">
          <span className="inline-flex size-10 items-center justify-center rounded-xl bg-[#164b3e] text-white">
            <HelpCircle size={18} aria-hidden="true" />
          </span>
          <h2 className="text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl">
            常见问题
          </h2>
          <p className="text-sm leading-relaxed text-neutral-700">
            准备好开始你的下一篇公众号图文了吗？注册即可免费使用画布与排版素材库。
          </p>
          <div className="pt-1">
            <Link
              href={isAuthenticated ? "/protected" : "/auth/sign-up"}
              className="landing-button landing-button-primary"
            >
              {isAuthenticated ? "进入工作台" : "免费开始创作"}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>

        <div className="mt-8 divide-y divide-neutral-200 rounded-2xl border border-neutral-200 bg-white">
          {faqs.map((item) => (
            <details key={item.q} className="group p-5 sm:p-6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-medium text-neutral-950">
                <span>{item.q}</span>
                <span
                  aria-hidden="true"
                  className="grid size-7 shrink-0 place-items-center rounded-full border border-neutral-200 text-neutral-700 transition-transform duration-200 group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-neutral-700">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
