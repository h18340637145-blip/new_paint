import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { Pricing } from "@/components/pricing";
import { proPlan, checkoutConfiguration } from "@/lib/billing/plans";
import { createServerAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const dateFormat = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai", dateStyle: "medium", timeStyle: "short",
});

async function readBilling(userId: string) {
  try {
    const admin = createServerAdminClient();
    const [usage, orders] = await Promise.all([
      admin.rpc("read_billing_usage", { p_user: userId })
        .single<{ expires_at: string | null; image_limit: number; used: number }>(),
      admin.from("zpay_transactions").select("out_trade_no,product_name,amount,created_at,status")
        .eq("user_id", userId).order("created_at", { ascending: false }).limit(12)
        .returns<{out_trade_no: string; product_name: string; amount: number; created_at: string; status: string}[]>(),
    ]);
    if (usage.error || orders.error) return null;
    return { expiry: usage.data.expires_at, allowance: usage.data.image_limit, used: usage.data.used, orders: orders.data };
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

  const [{ payment }, billing] = await Promise.all([searchParams, readBilling(data.claims.sub)]);
  const active = !!billing?.expiry && Date.parse(billing.expiry) > Date.now();
  const status = !billing ? "暂时无法获取" : active ? "订阅有效" : billing.expiry ? "订阅已到期" : "尚未订阅";

  return (
    <main className="min-h-screen bg-white text-neutral-950">
      <div className="mx-auto max-w-3xl space-y-8 px-5 py-8 sm:px-8">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-4">
          <div>
            <Link href="/protected" className="text-sm text-neutral-600 hover:underline">返回工作台</Link>
            <h1 className="mt-2 text-2xl font-semibold">个人中心</h1>
            {data.claims.email && <p className="mt-1 text-sm text-neutral-600">{data.claims.email}</p>}
          </div>
          <LogoutButton />
        </header>
        {payment === "returned" && <p role="status" className="rounded-xl bg-neutral-100 p-3 text-sm">
          已从收银台返回。请查看下方订单，若状态仍为待付款，可稍后<Link href="/profile" className="mx-1 underline">刷新状态</Link>。
        </p>}
        <section aria-labelledby="subscription-title" className="space-y-4">
          <div>
            <h2 id="subscription-title" className="text-lg font-semibold">订阅</h2>
            <p className="mt-1 text-sm text-neutral-600">{status}
              {billing?.expiry && ` · 到期时间 ${dateFormat.format(new Date(billing.expiry))}（北京时间）`}
            </p>
            {billing && <p className="mt-1 text-sm text-neutral-600">
              本月剩余 {Math.max(0, billing.allowance - billing.used)} / {billing.allowance} 张 · 按北京时间自然月重置
            </p>}
          </div>
          <Pricing plan={proPlan} available={!!billing && !!checkoutConfiguration()} />
        </section>
        <section aria-labelledby="orders-title" className="space-y-3">
          <h2 id="orders-title" className="text-lg font-semibold">最近订单</h2>
          {!billing || billing.orders.length === 0 ? <p className="text-sm text-neutral-600">
            {billing ? "暂无订单。" : "订单暂时无法加载，请稍后重试。"}
          </p> : (
            <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200">
              {billing.orders.map((order) => (
                <li key={order.out_trade_no} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                  <div>
                    <p className="font-medium">{order.product_name}</p>
                    <p className="mt-1 text-neutral-600">{dateFormat.format(new Date(order.created_at))}</p>
                  </div>
                  <p className="tabular-nums">¥{Number(order.amount).toFixed(2)} · {order.status === "paid" ? "已支付" : "待付款"}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
