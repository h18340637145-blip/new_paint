import { parseYuan, paymentMethods, validateZpaySignature, zpayCredentials } from "@/lib/billing/zpay";
import { createServerAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function reply(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function GET(request: Request) {
  const config = zpayCredentials();
  if (!config) return reply("fail", 503);

  const fields: Record<string, string> = Object.create(null);
  for (const [name, value] of new URL(request.url).searchParams) {
    if (Object.hasOwn(fields, name)) return reply("fail", 400);
    fields[name] = value;
  }
  const amount = parseYuan(fields.money);
  if (fields.pid !== config.pid || fields.trade_status !== "TRADE_SUCCESS"
    || !paymentMethods.some((type) => type === fields.type)
    || !/^\d{1,32}$/.test(fields.out_trade_no ?? "")
    || !/^[a-z0-9_-]{1,128}$/i.test(fields.trade_no ?? "")
    || amount === null || !validateZpaySignature(fields, config.key)) return reply("fail", 400);

  try {
    const { data, error } = await createServerAdminClient().rpc("settle_zpay_transaction", {
      p_order: fields.out_trade_no,
      p_merchant: fields.pid,
      p_trade: fields.trade_no,
      p_method: fields.type,
      p_amount_cents: amount,
    });
    if (error) return reply("fail", 503);
    return data === true ? reply("success") : reply("fail", 400);
  } catch {
    return reply("fail", 503);
  }
}
