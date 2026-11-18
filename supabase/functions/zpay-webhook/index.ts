import { zpaySettlement } from "../_shared/zpay.ts";
import { edgeAdmin, readEdgeZpayConfig } from "../_shared/runtime.ts";

function text(body: string, status: number) {
  return new Response(body, {
    status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

Deno.serve(async (request) => {
  if (request.method !== "GET") return text("fail", 405);
  if (!new URL(request.url).searchParams.has("sign")) return text("fail", 400);
  try {
    const { admin } = edgeAdmin();
    const config = await readEdgeZpayConfig(admin);
    if (!config) return text("fail", 503);
    const settlement = zpaySettlement(request, config);
    if (!settlement) return text("fail", 400);
    const { data, error } = await admin.rpc("settle_zpay_transaction", settlement);
    if (error) return text("fail", 503);
    return data === true ? text("success", 200) : text("fail", 400);
  } catch {
    return text("fail", 503);
  }
});
