import Link from "next/link";
import { Check, Sparkles } from "lucide-react";

const tiers = [
  {
    name: "免费版",
    price: "¥0",
    unit: "/ 月",
    quotaHighlight: "每月 3 张生图额度",
    description: "适合体验画布生图、Agent 分镜建议以及公众号模板导入排版。",
    features: [
      "每月 3 张生图额度（按北京时间自然月自动重置）",
      "无限节点画布、有向连线编排与版本暂存",
      "公众号模板与素材导入、个人库与团队协作",
      "左右同步实时预览与一键复制公众号富文本",
    ],
    ctaAuthenticated: "进入工作台",
    ctaGuest: "免费开始创作",
    hrefAuthenticated: "/protected",
    hrefGuest: "/auth/sign-up",
    featured: false,
  },
  {
    name: "Pro 月度会员",
    price: "¥0.10",
    unit: "/ 月",
    quotaHighlight: "每月 50 张生图额度",
    description: "适合公众号日更团队与高频多模型图文生产。",
    features: [
      "每月 50 张生图额度（普通生图与 Agent 分镜共用）",
      "有效期内提前续订自动从当前到期日顺延",
      "支持支付宝与微信支付，生图失败重试不重复扣额度",
      "包含全部公众号排版模板、团队素材库与公开配图导出",
    ],
    ctaAuthenticated: "前往个人中心订阅",
    ctaGuest: "开通 Pro 会员",
    hrefAuthenticated: "/profile",
    hrefGuest: "/auth/login?next=profile",
    featured: true,
  },
];

export function LandingPricing({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <section id="pricing" className="landing-section">
      <div className="landing-wrap wrap">
        <div className="max-w-2xl space-y-2.5">
          <h2 className="text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl">
            清楚透明的价格与月度额度
          </h2>
          <p className="text-base text-neutral-700">
            额度按北京时间自然月重置，不自动扣费；Pro 到期后可按需手动续订。
          </p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {tiers.map((tier) => (
            <article
              key={tier.name}
              className={`flex flex-col justify-between gap-6 rounded-2xl border p-6 shadow-sm sm:p-8 ${
                tier.featured
                  ? "border-[#164b3e] bg-[#f4f8f5] text-neutral-950"
                  : "border-neutral-200/90 bg-white text-neutral-950"
              }`}
            >
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="inline-flex items-center gap-2 text-lg font-semibold text-neutral-950">
                    {tier.featured && <Sparkles size={17} className="text-[#164b3e]" aria-hidden="true" />}
                    <span>{tier.name}</span>
                  </h3>
                  <span className="rounded-full bg-[#164b3e] px-2.5 py-0.5 text-xs font-semibold text-white">
                    {tier.quotaHighlight}
                  </span>
                </div>

                <p className="text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl">
                  {tier.price}
                  <span className="ml-1.5 text-sm font-normal text-neutral-600">
                    {tier.unit}
                  </span>
                </p>

                <p className="text-sm text-neutral-700">
                  {tier.description}
                </p>

                <ul className="space-y-2.5 pt-2 text-sm text-neutral-800">
                  {tier.features.map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <Check
                        size={16}
                        aria-hidden="true"
                        className="mt-0.5 shrink-0 text-[#164b3e]"
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Link
                href={isAuthenticated ? tier.hrefAuthenticated : tier.hrefGuest}
                className={tier.featured ? "landing-button landing-button-primary" : "landing-button"}
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
