export const ORDER_PAYMENT_WINDOW_MS = 10 * 60 * 1000;

export function submitZpayForm(
  form: HTMLFormElement | null,
  payload: { action?: unknown; fields?: unknown },
) {
  if (
    !form
    || payload.action !== "https://zpayz.cn/submit.php"
    || !payload.fields
    || typeof payload.fields !== "object"
  ) {
    throw new Error("支付链接无效。");
  }
  const fields = Object.entries(payload.fields as Record<string, unknown>).map(([name, value]) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = typeof value === "string" ? value : String(value ?? "");
    return input;
  });
  form.replaceChildren(...fields);
  form.requestSubmit();
}
