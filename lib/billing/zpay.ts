import "server-only";
import { createHash, randomInt, timingSafeEqual } from "node:crypto";

export const zpaySubmitUrl = "https://zpayz.cn/submit.php";
export const paymentMethods = ["alipay", "wxpay"] as const;

export function zpayCredentials() {
  const pid = process.env.ZPAY_PID?.trim();
  const key = process.env.ZPAY_KEY?.trim();
  return pid && /^[a-z0-9]{1,64}$/i.test(pid) && key ? { pid, key } : null;
}

export function checkoutOrigin() {
  try {
    const origin = new URL(process.env.NEXT_PUBLIC_BASE_URL || "");
    if (origin.protocol === "https:" && !origin.username && !origin.password
      && !origin.search && !origin.hash && origin.pathname === "/"
      && origin.hostname.includes(".") && !/\.(?:localhost|local)$/.test(origin.hostname)) {
      return origin.origin;
    }
  } catch {
    return null;
  }
  return null;
}

export function signZpay(fields: Record<string, string>, key: string) {
  const canonical = Object.keys(fields).sort()
    .filter((name) => name !== "sign" && name !== "sign_type" && fields[name] !== "")
    .map((name) => `${name}=${fields[name]}`).join("&");
  return createHash("md5").update(canonical + key, "utf8").digest("hex");
}

export function validateZpaySignature(fields: Record<string, string>, key: string) {
  if (fields.sign_type !== "MD5" || !/^[0-9a-f]{32}$/.test(fields.sign ?? "")) return false;
  return timingSafeEqual(Buffer.from(fields.sign, "hex"), Buffer.from(signZpay(fields, key), "hex"));
}

export function parseYuan(value: string | undefined) {
  if (!value || !/^\d{1,7}(?:\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return cents > 0 ? cents : null;
}

export function orderNumber() {
  const clock = new Date().toISOString().replace(/\D/g, "");
  return clock + Array.from({ length: 3 }, () => String(randomInt(100_000)).padStart(5, "0")).join("");
}
