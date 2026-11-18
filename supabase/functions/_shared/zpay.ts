import { Buffer } from "node:buffer";
import { createHash, randomInt, timingSafeEqual } from "node:crypto";

export const zpaySubmitUrl = "https://zpayz.cn/submit.php";
export const paymentMethods = ["alipay", "wxpay"] as const;

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

export const proPlan = {
  id: "monthly",
  name: "创作工作台 Pro 月度会员",
  amount: 10,
};

export function parseCheckoutOrigin(value: string | undefined) {
  try {
    const url = new URL(value || "");
    if (url.protocol === "https:" && !url.username && !url.password
      && !url.search && !url.hash && url.pathname === "/"
      && url.hostname.includes(".") && !/\.(?:localhost|local)$/.test(url.hostname)
      && !/^127\./.test(url.hostname) && url.hostname !== "0.0.0.0") return url.origin;
  } catch {
    return null;
  }
  return null;
}

export type ZpayConfig = { pid: string; key: string; origin: string };

export function checkoutPayload(order: string, type: (typeof paymentMethods)[number], config: ZpayConfig, notifyUrl: string) {
  const fields = {
    pid: config.pid,
    name: proPlan.name,
    money: (proPlan.amount / 100).toFixed(2),
    type,
    out_trade_no: order,
    notify_url: notifyUrl,
    return_url: `${config.origin}/checkout/return`,
  };
  const signedFields = { ...fields, sign: signZpay(fields, config.key), sign_type: "MD5" };
  return {
    order: {
      out_trade_no: order, zpay_pid: config.pid, payment_type: type,
      product_id: proPlan.id, product_name: proPlan.name, amount: fields.money,
      is_subscription: true, subscription_period: "monthly",
    },
    result: {
      action: zpaySubmitUrl,
      fields: signedFields,
      url: `${zpaySubmitUrl}?${new URLSearchParams(signedFields)}`,
    },
  };
}

export function zpaySettlement(request: Request, config: Pick<ZpayConfig, "pid" | "key">) {
  const fields: Record<string, string> = Object.create(null);
  for (const [name, value] of new URL(request.url).searchParams) {
    if (!/^[a-zA-Z0-9_]+$/.test(name) || Object.hasOwn(fields, name)) return null;
    fields[name] = value;
  }
  const amount = parseYuan(fields.money);
  if (fields.pid !== config.pid || fields.trade_status !== "TRADE_SUCCESS"
    || !paymentMethods.some((type) => type === fields.type)
    || !/^\d{1,32}$/.test(fields.out_trade_no ?? "")
    || !/^[a-z0-9_-]{1,128}$/i.test(fields.trade_no ?? "")
    || amount === null || !validateZpaySignature(fields, config.key)) return null;
  return {
    p_order: fields.out_trade_no,
    p_merchant: fields.pid,
    p_trade: fields.trade_no,
    p_method: fields.type,
    p_amount_cents: amount,
  };
}
