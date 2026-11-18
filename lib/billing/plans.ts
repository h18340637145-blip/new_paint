import "server-only";
import { checkoutOrigin, zpayCredentials } from "./zpay";

export { proPlan } from "@/supabase/functions/_shared/zpay";

export function zpayEdgeCheckout() {
  if (process.env.ZPAY_BACKEND !== "supabase") return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const apiKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && apiKey ? { url: `${url.replace(/\/$/, "")}/functions/v1/zpay-checkout`, apiKey } : null;
}

export function checkoutConfiguration() {
  const origin = checkoutOrigin();
  const credentials = zpayCredentials();
  return origin && credentials ? { ...credentials, origin } : null;
}
