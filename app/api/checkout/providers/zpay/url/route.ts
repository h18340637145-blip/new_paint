import { checkoutConfiguration, proPlan, zpayEdgeCheckout } from "@/lib/billing/plans";
import { checkoutPayload, orderNumber, paymentMethods } from "@/supabase/functions/_shared/zpay";
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
    const edge = zpayEdgeCheckout();
    if (edge) {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return Response.json({ error: "请先登录。" }, { status: 401 });
      const response = await fetch(edge.url, {
        method: "POST",
        headers: {
          apikey: edge.apiKey,
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ planId: plan.id, method: type }),
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
      });
      return Response.json(await response.json(), {
        status: response.status, headers: { "Cache-Control": "no-store" },
      });
    }
    const config = checkoutConfiguration();
    if (!config || process.env.ZPAY_BACKEND === "supabase") {
      return Response.json({ error: "该商品暂未开放支付。" }, { status: 503 });
    }
    const { order, result } = checkoutPayload(orderNumber(), type, config, `${config.origin}/api/checkout/providers/zpay/webhook`);
    const { error: insertError } = await createServerAdminClient().from("zpay_transactions")
      .insert({ ...order, user_id: userId });
    if (insertError) return Response.json({ error: "订单创建失败，请稍后重试。" }, { status: 503 });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "支付服务暂不可用。" }, { status: 503 });
  }
}
