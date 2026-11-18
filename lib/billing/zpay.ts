import "server-only";
import { parseCheckoutOrigin } from "@/supabase/functions/_shared/zpay";

export function zpayCredentials() {
  const pid = process.env.ZPAY_PID?.trim();
  const key = process.env.ZPAY_KEY?.trim();
  return pid && /^[a-z0-9]{1,64}$/i.test(pid) && key ? { pid, key } : null;
}

export function checkoutOrigin() {
  return parseCheckoutOrigin(process.env.NEXT_PUBLIC_BASE_URL);
}
