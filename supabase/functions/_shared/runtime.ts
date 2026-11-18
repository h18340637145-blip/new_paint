import { createClient } from "npm:@supabase/supabase-js@2.119.0";
import { parseCheckoutOrigin, type ZpayConfig } from "./zpay.ts";

export function edgeAdmin() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) throw new Error("Supabase 服务端配置缺失。");
  return {
    url: url.replace(/\/$/, ""),
    admin: createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } }),
  };
}

export async function readEdgeZpayConfig(admin: ReturnType<typeof edgeAdmin>["admin"]): Promise<ZpayConfig | null> {
  const { data, error } = await admin.rpc("read_zpay_edge_config");
  const origin = parseCheckoutOrigin(data?.origin);
  if (error || !origin || !/^[a-z0-9]{1,64}$/i.test(data?.pid ?? "") || typeof data?.key !== "string" || !data.key) {
    return null;
  }
  return { origin, pid: data.pid, key: data.key };
}
