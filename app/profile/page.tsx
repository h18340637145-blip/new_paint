import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { OrderList, type BillingOrder } from "@/components/order-list";
import { Pricing } from "@/components/pricing";
import { ProfileDraftList } from "@/components/profile-draft-list";
import { proPlan, checkoutConfiguration, zpayEdgeCheckout } from "@/lib/billing/plans";
import { ORDER_PAYMENT_WINDOW_MS } from "@/lib/billing/zpay-client";
import { readUserArticleDrafts } from "@/lib/studio/article-data";
import { createServerAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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
      admin.rpc("read_billing_usage", { p_user: userId })
        .single<{ expires_at: string | null; image_limit: number; used: number }>(),
      admin.from("zpay_transactions")
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

export default async function ProfilePage({ searchParams }: {
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
  const status = !billing ? "暂时无法获取" : active ? "订阅有效" : billing.expiry ? "订阅已到期" : "尚未订阅";
  const checkoutAvailable = !!billing && !!(process.env.ZPAY_BACKEND === "supabase" ? zpayEdgeCheckout() : checkoutConfiguration());

  const remainingQuota = billing ? Math.max(0, billing.allowance - billing.used) : 0;
  const quotaRatio = billing && billing.allowance > 0
    ? Math.min(100, Math.round((remainingQuota / billing.allowance) * 100))
    : 0;

  return (
    <main className="profile-surface landing-motion min-h-screen text-neutral-950">
      <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-8">
        <header data-enter className="profile-heading flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm">
          <div className="min-w-0 space-y-1">
            <Link
              href="/protected"
              className="inline-flex items-center text-sm font-medium text-neutral-600 transition hover:text-neutral-950 hover:underline"
            >
              ← 返回工作台
            </Link>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">个人中心</h1>
            {data.claims.email && <p className="text-sm text-neutral-600">{data.claims.email}</p>}
          </div>
          <LogoutButton />
        </header>

        {payment === "returned" && (
          <p role="status" className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700 shadow-sm">
            已从收银台返回。请查看下方订单，若状态仍为待付款，可稍后
            <Link href="/profile" className="mx-1 font-medium text-neutral-950 underline underline-offset-4">
              刷新状态
            </Link>
            。
          </p>
        )}

        <section aria-labelledby="subscription-title" className="profile-plans">
          <article className="space-y-4 rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 id="subscription-title" className="text-lg font-semibold text-neutral-950">订阅状态</h2>
                  <span
                    className={
                      active
                        ? "inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20"
                        : "inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-600 ring-1 ring-inset ring-neutral-500/15"
                    }
                  >
                    {status}
                  </span>
                </div>
                {billing?.expiry && (
                  <p className="text-sm text-neutral-600">
                    到期时间 {dateFormat.format(new Date(billing.expiry))}（北京时间）
                  </p>
                )}
              </div>
            </div>

            {billing && (
              <div className="space-y-2 rounded-xl bg-neutral-50 p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-medium text-neutral-800">本月生图额度</span>
                  <span className="tabular-nums text-neutral-700">
                    剩余 <strong className="font-semibold text-neutral-950">{remainingQuota}</strong> / {billing.allowance} 张
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
                <p className="text-xs text-neutral-500">按北京时间自然月重置</p>
              </div>
            )}
          </article>

          <Pricing plan={proPlan} available={checkoutAvailable} />
        </section>

        <section aria-labelledby="drafts-title" className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 id="drafts-title" className="text-lg font-semibold text-neutral-950">我的排版稿</h2>
              <p className="text-xs text-neutral-500">Qwen 生成与人工精修后的公众号排版结果自动保存于此</p>
            </div>
            <Link
              href="/typography"
              className="text-xs font-medium text-neutral-700 underline underline-offset-4 hover:text-neutral-950"
            >
              前往公众号排版工作台 →
            </Link>
          </div>
          <ProfileDraftList items={savedDrafts.items} imageUrls={savedDrafts.imageUrls} />
        </section>

        <section aria-labelledby="orders-title" className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="orders-title" className="text-lg font-semibold text-neutral-950">最近订单</h2>
            <p className="text-xs text-neutral-500">待付款订单保留 10 分钟，超时自动取消</p>
          </div>
          {!billing || billing.orders.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-neutral-200 bg-white p-6 text-center text-sm text-neutral-600">
              {billing ? "暂无订单。" : "订单暂时无法加载，请稍后重试。"}
            </p>
          ) : (
            <OrderList orders={billing.orders} initialNow={now} available={checkoutAvailable} />
          )}
        </section>
      </div>
    </main>
  );
}
