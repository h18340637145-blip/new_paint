import "server-only";
import { checkoutOrigin, zpayCredentials } from "./zpay";

export const proPlan = {
  id: "monthly",
  name: "创作工作台 Pro 月度会员",
  amount: 1000,
};

export function checkoutConfiguration() {
  const origin = checkoutOrigin();
  const credentials = zpayCredentials();
  return origin && credentials ? { ...credentials, origin } : null;
}
