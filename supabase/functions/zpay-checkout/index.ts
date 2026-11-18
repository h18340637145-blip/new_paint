import { checkoutPayload, orderNumber, paymentMethods, proPlan } from "../_shared/zpay.ts";
import { edgeAdmin, readEdgeZpayConfig } from "../_shared/runtime.ts";

function json(body: object, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "请求方法无效。" }, 405);
  const token = /^Bearer (\S+)$/i.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!token) return json({ error: "请先登录。" }, 401);
  try {
    const { admin, url } = edgeAdmin();
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user) return json({ error: "请先登录。" }, 401);

    const input = await request.json().catch(() => null);
    const type = paymentMethods.find((method) => method === input?.method);
    if (input?.planId !== proPlan.id || !type) return json({ error: "请选择有效的商品和支付方式。" }, 400);
    const config = await readEdgeZpayConfig(admin);
    if (!config) return json({ error: "支付服务尚未配置。" }, 503);

    const { order, result } = checkoutPayload(orderNumber(), type, config, `${url}/functions/v1/zpay-webhook`);
    const { error: insertError } = await admin.from("zpay_transactions").insert({ ...order, user_id: data.user.id });
    if (insertError) return json({ error: "订单创建失败，请稍后重试。" }, 503);
    return json(result);
  } catch {
    return json({ error: "支付服务暂不可用。" }, 503);
  }
});
