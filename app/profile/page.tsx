import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { OrderList, type BillingOrder } from "@/components/order-list";
import { Pricing } from "@/components/pricing";
import { ProfileDraftList } from "@/components/profile-draft-list";
import { ProfileLibraryOverview } from "@/components/profile-library-overview";
import { StudioTopNav } from "@/components/studio-top-nav";
import { TeamManagerPanel } from "@/components/typography/team-manager-dialog";
import { proPlan, checkoutConfiguration, zpayEdgeCheckout } from "@/lib/billing/plans";
import { ORDER_PAYMENT_WINDOW_MS } from "@/lib/billing/zpay-client";
import { readUserArticleDrafts } from "@/lib/studio/article-data";
import { createServerAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "个人中心",
};

const dateFormat = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  dateStyle: "medium",
  timeStyle: "short",
});

async function readBilling(userId: string) {
  try {
    const admin = createServerAdminClient();
    const now = Date.now();
    const expiredBefore = new Date(now - ORDER_PAYMENT_WINDOW_MS).toISOString();

    await admin
      .from("zpay_transactions")
      .update({ status: "failed", updated_at: new Date(now).toISOString() })
      .eq("user_id", userId)
      .eq("status", "pending")
      .lt("created_at", expiredBefore);

    const [usage, orders] = await Promise.all([
      admin
        .rpc("read_billing_usage", { p_user: userId })
        .single<{ expires_at: string | null; image_limit: number; used: number }>(),
      admin
        .from("zpay_transactions")
        .select("out_trade_no,product_name,amount,payment_type,created_at,status")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(12)
        .returns<BillingOrder[]>(),
    ]);
    if (usage.error || orders.error) return null;
    return {
      expiry: usage.data.expires_at,
      allowance: usage.data.image_limit,
      used: usage.data.used,
      orders: orders.data,
      now,
    };
  } catch {
    return null;
  }
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ payment?: string }>;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims.sub) redirect("/signin");

  const [{ payment }, billing, savedDrafts] = await Promise.all([
    searchParams,
    readBilling(data.claims.sub),
    readUserArticleDrafts(createServerAdminClient(), data.claims.sub).catch(() => ({
      items: [],
      imageUrls: {},
    })),
  ]);
  const now = billing?.now ?? Date.now();
  const active = !!billing?.expiry && Date.parse(billing.expiry) > now;
  const status = !billing
    ? "暂时无法获取"
    : active
      ? "Pro 订阅有效"
      : billing.expiry
        ? "订阅已到期"
        : "免费版";
  const checkoutAvailable =
    !!billing && !!(process.env.ZPAY_BACKEND === "supabase" ? zpayEdgeCheckout() : checkoutConfiguration());

  const remainingQuota = billing ? Math.max(0, billing.allowance - billing.used) : 0;
  const quotaRatio =
    billing && billing.allowance > 0
      ? Math.min(100, Math.round((remainingQuota / billing.allowance) * 100))
      : 0;

  return (
    <div className="profile-surface landing-motion min-h-screen text-neutral-950">
      <StudioTopNav current="profile" />

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-8">
        <header
          data-enter
          className="space-y-4 rounded-2xl border border-[#cde0d4] bg-white p-5 shadow-xs"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">
                  个人中心
                </h1>
                <span
                  className={
                    active
                      ? "inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-600/20"
                      : "inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-700 ring-1 ring-inset ring-neutral-500/15"
                  }
                >
                  {status}
                </span>
              </div>
              {data.claims.email && <p className="text-sm text-neutral-600">{data.claims.email}</p>}
            </div>

            <nav aria-label="个人中心快捷分区" className="flex flex-wrap items-center gap-1.5 text-xs">
              <a
                href="#drafts"
                className="inline-flex min-h-9 items-center rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-1.5 font-medium text-neutral-700 hover:bg-neutral-100 hover:text-neutral-950"
              >
                我的排版稿 ({savedDrafts.items.length})
              </a>
              <a
                href="#library"
                className="inline-flex min-h-9 items-center rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-1.5 font-medium text-neutral-700 hover:bg-neutral-100 hover:text-neutral-950"
              >
                模板与素材库
              </a>
              <a
                href="#teams"
                className="inline-flex min-h-9 items-center rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-1.5 font-medium text-neutral-700 hover:bg-neutral-100 hover:text-neutral-950"
              >
                团队与邀请
              </a>
              <a
                href="#subscription"
                className="inline-flex min-h-9 items-center rounded-xl bg-[#164b3e] px-3 py-1.5 font-semibold text-white hover:bg-[#123d32]"
              >
                {active ? "订阅与账单" : "升级 Pro 额度"}
              </a>
            </nav>
          </div>

          {billing && (
            <div className="flex flex-col gap-2 rounded-xl border border-neutral-200/75 bg-neutral-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
                  <span className="font-medium text-neutral-800">本月可用生图额度</span>
                  <span className="tabular-nums text-neutral-700">
                    剩余 <strong className="font-bold text-[#164b3e]">{remainingQuota}</strong> / {billing.allowance} 张
                    {billing.expiry ? ` · 到期 ${dateFormat.format(new Date(billing.expiry))}` : ""}
                  </span>
                </div>
                <div
                  className="h-2 w-full overflow-hidden rounded-full bg-neutral-200"
                  role="progressbar"
                  aria-valuenow={remainingQuota}
                  aria-valuemin={0}
                  aria-valuemax={billing.allowance}
                  aria-label="本月生图剩余额度"
                >
                  <div
                    className="profile-quota h-full rounded-full transition-[width] duration-300"
                    style={{ width: `${quotaRatio}%` }}
                  />
                </div>
              </div>
              <span className="shrink-0 text-[11px] text-neutral-500 sm:pl-4">
                自然月重置 · 失败重试不扣额度
              </span>
            </div>
          )}
        </header>

        {payment === "returned" && (
          <p
            role="status"
            className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950 shadow-xs"
          >
            已从收银台返回。可前往
            <a href="#orders" className="mx-1 font-semibold underline underline-offset-4">
              下方订单记录
            </a>
            查看状态；若仍显示待付款，可稍后
            <Link href="/profile" className="mx-1 font-semibold underline underline-offset-4">
              刷新页面
            </Link>
            。
          </p>
        )}

        {/* 1. 首屏核心区：我的排版稿 */}
        <section id="drafts" aria-labelledby="drafts-title" className="scroll-mt-20 space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 id="drafts-title" className="text-lg font-semibold text-neutral-950">
                我的排版稿
              </h2>
              <p className="text-xs text-neutral-500">
                画布生成与人工精修后的公众号文章自动保存在此，点击即可继续编辑或复制发布
              </p>
            </div>
            <Link
              href="/typography"
              className="inline-flex min-h-9 items-center text-xs font-semibold text-[#164b3e] underline underline-offset-4 hover:opacity-80"
            >
              前往公众号排版工作台 →
            </Link>
          </div>
          <ProfileDraftList items={savedDrafts.items} imageUrls={savedDrafts.imageUrls} />
        </section>

        {/* 2. 个人库与团队库 */}
        <section id="library" aria-labelledby="library-title" className="scroll-mt-20 space-y-3">
          <div>
            <h2 id="library-title" className="text-lg font-semibold text-neutral-950">
              模板与素材库
            </h2>
            <p className="text-xs text-neutral-500">
              管理从公众号、秀米或文件导入的模板、卡片、标题边框、图片边框和分割线
            </p>
          </div>
          <ProfileLibraryOverview />
        </section>

        {/* 3. 团队与站内邀请 */}
        <section id="teams" aria-labelledby="teams-title" className="scroll-mt-20 space-y-3">
          <div>
            <h2 id="teams-title" className="text-lg font-semibold text-neutral-950">
              协作团队与站内邀请
            </h2>
            <p className="text-xs text-neutral-500">
              创建团队与同事共享统一品牌排版组件；受邀成员可在此直接接受邀请
            </p>
          </div>
          <div className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-xs">
            <TeamManagerPanel />
          </div>
        </section>

        {/* 4. 订阅权益与升级 */}
        <section id="subscription" aria-labelledby="subscription-title" className="profile-plans scroll-mt-20">
          <article className="space-y-3 rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="subscription-title" className="text-lg font-semibold text-neutral-950">
                会员方案与权益说明
              </h2>
              <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-700">
                当前：{status}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-neutral-600">
              免费版每月包含 3 张生图额度及完整的公众号排版与个人/团队素材库能力；升级 Pro 可解锁更高月度配图额度，满足高频公众号日更与多项目创作需求。
            </p>
            {billing?.expiry && (
              <p className="text-xs text-neutral-500">
                当前订阅有效期至：{dateFormat.format(new Date(billing.expiry))}（北京时间）
              </p>
            )}
          </article>

          <Pricing plan={proPlan} available={checkoutAvailable} />
        </section>

        {/* 5. 最近订单 */}
        <section id="orders" aria-labelledby="orders-title" className="scroll-mt-20 space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="orders-title" className="text-lg font-semibold text-neutral-950">
              最近订单记录
            </h2>
            <p className="text-xs text-neutral-500">待付款订单保留 10 分钟，有效期内可继续付款，超时自动关闭</p>
          </div>
          {!billing || billing.orders.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-neutral-200 bg-white p-6 text-center text-sm text-neutral-600">
              {billing ? "暂无历史订单。" : "订单暂时无法加载，请稍后重试。"}
            </p>
          ) : (
            <OrderList orders={billing.orders} initialNow={now} available={checkoutAvailable} />
          )}
        </section>
      </main>
    </div>
  );
}
