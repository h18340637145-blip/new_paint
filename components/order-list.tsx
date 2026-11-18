"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ORDER_PAYMENT_WINDOW_MS, submitZpayForm } from "@/lib/billing/zpay-client";

export type BillingOrder = {
  out_trade_no: string;
  product_name: string;
  amount: number | string;
  payment_type: string;
  created_at: string;
  status: string;
};

const dateFormat = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  dateStyle: "medium",
  timeStyle: "short",
});

const paymentMethodLabel: Record<string, string> = {
  alipay: "支付宝",
  wxpay: "微信支付",
  qqpay: "QQ钱包",
  tenpay: "财付通",
};

function formatCountdown(remainingMs: number) {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function OrderList({
  orders,
  initialNow,
  available,
}: {
  orders: BillingOrder[];
  initialNow: number;
  available: boolean;
}) {
  const router = useRouter();
  const [now, setNow] = useState(initialNow);
  const [pendingOrder, setPendingOrder] = useState<string | null>(null);
  const [cancelledOrders, setCancelledOrders] = useState<Record<string, true>>({});
  const [error, setError] = useState("");
  const inProgress = useRef(false);
  const form = useRef<HTMLFormElement>(null);

  const hasActivePending = orders.some((order) => {
    if (order.status !== "pending" || cancelledOrders[order.out_trade_no]) return false;
    const deadline = Date.parse(order.created_at) + ORDER_PAYMENT_WINDOW_MS;
    return Number.isFinite(deadline) && deadline > now;
  });

  useEffect(() => {
    setNow(Date.now());
    if (!hasActivePending) return;
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [hasActivePending]);

  async function resumePayment(outTradeNo: string) {
    if (inProgress.current) return;
    inProgress.current = true;
    setPendingOrder(outTradeNo);
    setError("");
    try {
      const response = await fetch("/api/checkout/providers/zpay/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outTradeNo }),
      });
      if (response.status === 401) {
        router.push("/signin");
        return;
      }
      const payload = await response.json();
      if (!response.ok) {
        if (response.status === 410) {
          setCancelledOrders((prev) => ({ ...prev, [outTradeNo]: true }));
        }
        throw new Error(payload.error || "发起支付失败，请稍后重试。");
      }
      submitZpayForm(form.current, payload);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "支付服务暂不可用。");
    } finally {
      inProgress.current = false;
      setPendingOrder(null);
    }
  }

  return (
    <div className="space-y-3">
      <form ref={form} action="https://zpayz.cn/submit.php" method="post" hidden />
      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          {error}
        </p>
      )}
      <ul className="space-y-3">
        {orders.map((order) => {
          const createdMs = Date.parse(order.created_at);
          const remainingMs = Number.isFinite(createdMs) ? createdMs + ORDER_PAYMENT_WINDOW_MS - now : 0;
          const isPaid = order.status === "paid";
          const isCancelled =
            order.status === "failed"
            || !!cancelledOrders[order.out_trade_no]
            || (order.status === "pending" && remainingMs <= 0);
          const isPayable = order.status === "pending" && !isCancelled;

          return (
            <li key={order.out_trade_no}>
              <article className="flex flex-col gap-3 rounded-2xl border border-neutral-200/90 bg-white p-4 shadow-sm transition-colors hover:border-neutral-300 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-neutral-950">{order.product_name}</h3>
                    {isPaid && (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                        已支付
                      </span>
                    )}
                    {isPayable && (
                      <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-600/20">
                        待付款
                      </span>
                    )}
                    {isCancelled && (
                      <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-600 ring-1 ring-inset ring-neutral-500/15">
                        取消付款
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-500">
                    {Number.isFinite(createdMs) ? dateFormat.format(new Date(createdMs)) : order.created_at}
                    {" · "}
                    {paymentMethodLabel[order.payment_type] ?? order.payment_type}
                    {" · 订单号 "}
                    <span className="font-mono">{order.out_trade_no}</span>
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
                  <div className="text-left sm:text-right">
                    <p className="text-base font-semibold tabular-nums text-neutral-950">
                      ¥{Number(order.amount).toFixed(2)}
                    </p>
                    {isPayable && (
                      <p className="text-xs font-medium tabular-nums text-amber-700" aria-live="off">
                        剩余 {formatCountdown(remainingMs)}
                      </p>
                    )}
                  </div>

                  {isPayable && (
                    <button
                      type="button"
                      disabled={!available || pendingOrder === order.out_trade_no}
                      onClick={() => void resumePayment(order.out_trade_no)}
                      className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-500 sm:min-h-9"
                    >
                      {pendingOrder === order.out_trade_no ? "正在跳转…" : "去付款"}
                    </button>
                  )}

                  {isCancelled && (
                    <button
                      type="button"
                      disabled
                      aria-disabled="true"
                      className="inline-flex min-h-[44px] cursor-not-allowed items-center justify-center rounded-xl border border-neutral-200 bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-400 sm:min-h-9"
                    >
                      取消付款
                    </button>
                  )}
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
