const faqs = [
  {
    q: "生图额度是如何计算和重置的？",
    a: "免费用户每个北京时间自然月拥有 3 张生图额度，Pro 会员生效期间每月上限为 50 张。普通画布生图与 Agent 生图共用额度，单次生成多张图按实际张数计数；同一失败任务点击重试不会重复扣减额度。",
  },
  {
    q: "Pro 订阅支持哪些支付方式？订单超时怎么办？",
    a: "支持支付宝与微信支付，手动按月续订。在个人中心下单后，待付款订单保留 10 分钟付款窗口，期间可随时点击「去付款」继续完成支付；超过 10 分钟未支付将自动变为「取消付款」。",
  },
  {
    q: "什么是 Agent Skill（SKILL.md）？",
    a: "你可以上传自定义的 SKILL.md 文件到当前项目，把固定的提示词规范、风格选择流程或出图尺寸固化下来。例如内置的公众号封面技能，会先询问你的风格偏好再一次生成四张不同构图的宽幅封面。",
  },
  {
    q: "公众号排版支持直接粘贴到微信后台吗？",
    a: "支持。在公众号排版工作台（/typography）中，左侧编辑内容或调整预置模板配色/字号/行高后，右侧实时呈现手机端微信文章效果，点击「一键复制到公众号」即可将带内联样式的富文本粘贴到微信公众号编辑器。",
  },
];

export function LandingFaq() {
  return (
    <section id="faq" className="landing-section">
      <div className="landing-wrap wrap">
        <div className="space-y-3">
          <h2 className="text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl">
            常见问题
          </h2>
        </div>

        <div className="mt-8 divide-y divide-neutral-200 rounded-2xl border border-neutral-200 bg-white">
          {faqs.map((item) => (
            <details key={item.q} className="group p-5 sm:p-6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-medium text-neutral-950">
                <span>{item.q}</span>
                <span
                  aria-hidden="true"
                  className="grid size-7 shrink-0 place-items-center rounded-full border border-neutral-200 text-neutral-600 transition-transform duration-200 group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-neutral-600">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
