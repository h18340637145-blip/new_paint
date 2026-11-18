import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const pid = process.env.ZPAY_PID?.trim();
const key = process.env.ZPAY_KEY?.trim();
const configuredOrigin = process.env.NEXT_PUBLIC_BASE_URL;
const origin = URL.canParse(configuredOrigin || "") ? new URL(configuredOrigin) : null;

if (!url || !serviceKey || !/^[a-z0-9]{1,64}$/i.test(pid ?? "") || !key || !origin
  || origin.protocol !== "https:" || origin.username || origin.password
  || origin.pathname !== "/" || origin.search || origin.hash) {
  console.error("请在环境文件中填写有效的 Supabase 服务端配置、ZPAY 商户配置和 HTTPS 根地址。");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const { error } = await admin.rpc("configure_zpay_edge", {
  p_config: JSON.stringify({ origin: origin.origin, pid, key }),
});
if (error) {
  console.error("ZPAY 配置导入失败。", error.code || "请求错误");
  process.exit(1);
}
console.log("已将 ZPAY 配置写入目标项目的 Supabase Vault。");
