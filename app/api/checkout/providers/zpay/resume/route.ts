import { checkoutConfiguration, proPlan } from "@/lib/billing/plans";
import { ORDER_PAYMENT_WINDOW_MS } from "@/lib/billing/zpay-client";
import { createServerAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  checkoutPayload,
  parseCheckoutOrigin,
  paymentMethods,
  type ZpayConfig,
} from "@/supabase/functions/_shared/zpay";

export const runtime = "nodejs";

async function resolveZpayRuntime(admin: ReturnType<typeof createServerAdminClient>): Promise<{
  config: ZpayConfig;
  notifyUrl: string;
} | null> {
  if (process.env.ZPAY_BACKEND === "supabase") {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
    if (!supabaseUrl) return null;
    const { data, error } = await admin.rpc("read_zpay_edge_config");
    const origin = parseCheckoutOrigin(data?.origin);
    if (!error && origin && /^[a-z0-9]{1,64}$/i.test(data?.pid ?? "") && typeof data?.key === "string" && data.key) {
      return {
        config: { origin, pid: data.pid, key: data.key },
        notifyUrl: `${supabaseUrl}/functions/v1/zpay-webhook`,
      };
    }
    const fallback = checkoutConfiguration();
    return fallback ? { config: fallback, notifyUrl: `${supabaseUrl}/functions/v1/zpay-webhook` } : null;
  }
  const config = checkoutConfiguration();
  return config ? { config, notifyUrl: `${config.origin}/api/checkout/providers/zpay/webhook` } : null;
}

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
    const outTradeNo = typeof input?.outTradeNo === "string" ? input.outTradeNo.trim() : "";
    if (!/^\d{1,32}$/.test(outTradeNo)) {
      return Response.json({ error: "订单号无效。" }, { status: 400 });
    }

    const admin = createServerAdminClient();
    const { data: order, error: orderError } = await admin
      .from("zpay_transactions")
      .select("out_trade_no,product_id,payment_type,created_at,status")
      .eq("out_trade_no", outTradeNo)
      .eq("user_id", userId)
      .maybeSingle<{
        out_trade_no: string;
        product_id: string;
        payment_type: string;
        created_at: string;
        status: string;
      }>();

    if (orderError) return Response.json({ error: "订单查询失败，请稍后重试。" }, { status: 503 });
    if (!order) return Response.json({ error: "订单不存在。" }, { status: 404 });
    if (order.status === "paid") return Response.json({ error: "该订单已完成支付。" }, { status: 409 });
    if (order.status !== "pending") return Response.json({ error: "该订单已取消付款，请重新下单。" }, { status: 410 });

    const createdAtMs = Date.parse(order.created_at);
    if (!Number.isFinite(createdAtMs) || Date.now() - createdAtMs >= ORDER_PAYMENT_WINDOW_MS) {
      await admin
        .from("zpay_transactions")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("out_trade_no", outTradeNo)
        .eq("user_id", userId)
        .eq("status", "pending");
      return Response.json({ error: "订单已超过 10 分钟未付款，已自动取消。" }, { status: 410 });
    }

    const method = paymentMethods.find((item) => item === order.payment_type);
    if (!method || order.product_id !== proPlan.id) {
      return Response.json({ error: "该订单暂不支持继续支付，请重新下单。" }, { status: 400 });
    }

    const runtimeConfig = await resolveZpayRuntime(admin);
    if (!runtimeConfig) {
      return Response.json({ error: "支付服务暂未配置。" }, { status: 503 });
    }

    const { result } = checkoutPayload(order.out_trade_no, method, runtimeConfig.config, runtimeConfig.notifyUrl);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "支付服务暂不可用。" }, { status: 503 });
  }
}
