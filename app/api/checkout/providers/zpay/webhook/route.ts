import { zpayCredentials } from "@/lib/billing/zpay";
import { zpaySettlement } from "@/supabase/functions/_shared/zpay";
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

  const settlement = zpaySettlement(request, config);
  if (!settlement) return reply("fail", 400);

  try {
    const { data, error } = await createServerAdminClient().rpc("settle_zpay_transaction", settlement);
    if (error) return reply("fail", 503);
    return data === true ? reply("success") : reply("fail", 400);
  } catch {
    return reply("fail", 503);
  }
}
