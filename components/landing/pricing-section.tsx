import Link from "next/link";
import { Check } from "lucide-react";

const tiers = [
  {
    name: "免费版",
    price: "¥0",
    unit: "/ 月",
    description: "适合体验画布生图、Agent 对话与基础排版流程。",
    features: [
      "每月 3 张生图额度（按北京时间自然月重置）",
      "无限画布与多图参考生成",
      "Agent 协同与 SKILL.md 挂载",
      "公众号排版左右实时预览",
    ],
    ctaAuthenticated: "进入工作台",
    ctaGuest: "免费注册体验",
    hrefAuthenticated: "/protected",
    hrefGuest: "/auth/sign-up",
    featured: false,
  },
  {
    name: "Pro 月度会员",
    price: "¥0.10",
    unit: "/ 月",
    description: "适合高频图文创作与公众号日常发布。",
    features: [
      "每月 50 张生图额度（普通生图与 Agent 共用）",
      "有效期内提前续订从当前到期日顺延",
      "支持支付宝 / 微信支付，失败重试不扣额度",
      "公众号排版预置模板与后续 Pro 排版能力",
    ],
    ctaAuthenticated: "前往个人中心订阅",
    ctaGuest: "注册并订阅 Pro",
    hrefAuthenticated: "/profile",
    hrefGuest: "/auth/sign-up",
    featured: true,
  },
];

export function LandingPricing({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <section id="pricing" className="landing-section">
      <div className="landing-wrap wrap">
        <div className="max-w-2xl space-y-3">
          <h2 className="text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl">
            按月使用生图额度
          </h2>
          <p className="text-base text-neutral-600">
            生图额度按北京时间自然月重置。Pro 到期后可手动续订。
          </p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {tiers.map((tier) => (
            <article
              key={tier.name}
              className={`flex flex-col justify-between gap-6 rounded-2xl border p-6 shadow-sm transition-transform duration-200 hover:-translate-y-0.5 sm:p-8 ${
                tier.featured
                  ? "border-[#346451] bg-[#18362d] text-white"
                  : "border-neutral-200/90 bg-white text-neutral-950"
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-lg font-semibold">{tier.name}</h3>
                </div>
                <p className="text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl">
                  {tier.price}
                  <span className={`ml-1.5 text-sm font-normal ${tier.featured ? "text-neutral-300" : "text-neutral-500"}`}>
                    {tier.unit}
                  </span>
                </p>
                <p className={`text-sm ${tier.featured ? "text-neutral-300" : "text-neutral-600"}`}>
                  {tier.description}
                </p>
                <ul className="space-y-2.5 pt-2 text-sm">
                  {tier.features.map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <Check
                        size={16}
                        aria-hidden="true"
                        className={`mt-0.5 shrink-0 ${tier.featured ? "text-emerald-400" : "text-neutral-950"}`}
                      />
                      <span className={tier.featured ? "text-neutral-100" : "text-neutral-700"}>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Link
                href={isAuthenticated ? tier.hrefAuthenticated : tier.hrefGuest}
                className="landing-button landing-button-primary"
              >
                {isAuthenticated ? tier.ctaAuthenticated : tier.ctaGuest}
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
