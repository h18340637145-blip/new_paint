import { checkoutConfiguration, proPlan } from "@/lib/billing/plans";
import { orderNumber, paymentMethods, signZpay, zpaySubmitUrl } from "@/lib/billing/zpay";
import { createServerAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();
    const userId = data?.claims.sub;
    if (error || !userId) return Response.json({ error: "请先登录。" }, { status: 401 });
    if (request.headers.get("content-type")?.split(";")[0] !== "application/json") {
      return Response.json({ error: "请求格式无效。" }, { status: 415 });
    }
    const input = await request.json().catch(() => null);
    const type = paymentMethods.find((method) => method === input?.method);
    const plan = proPlan;
    if (input?.planId !== plan.id || !type) return Response.json({ error: "请选择有效的商品和支付方式。" }, { status: 400 });
    const config = checkoutConfiguration();
    if (!config) {
      return Response.json({ error: "该商品暂未开放支付。" }, { status: 503 });
    }

    const order = orderNumber();
    const fields = {
      pid: config.pid,
      name: plan.name,
      money: (plan.amount / 100).toFixed(2),
      type,
      out_trade_no: order,
      notify_url: `${config.origin}/api/checkout/providers/zpay/webhook`,
      return_url: `${config.origin}/checkout/return`,
    };
    const { error: insertError } = await createServerAdminClient().from("zpay_transactions").insert({
      user_id: userId, out_trade_no: order, zpay_pid: config.pid, payment_type: type,
      product_id: plan.id, product_name: plan.name, amount: fields.money,
      is_subscription: true, subscription_period: "monthly",
    });
    if (insertError) return Response.json({ error: "订单创建失败，请稍后重试。" }, { status: 503 });

    const signedFields = { ...fields, sign: signZpay(fields, config.key), sign_type: "MD5" };
    return Response.json({
      url: `${zpaySubmitUrl}?${new URLSearchParams(signedFields)}`,
      action: zpaySubmitUrl,
      fields: signedFields,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "支付服务暂不可用。" }, { status: 503 });
  }
}
