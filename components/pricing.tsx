"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { submitZpayForm } from "@/lib/billing/zpay-client";

type Plan = {
  id: string;
  name: string;
  amount: number;
};

export function Pricing({ plan, available }: { plan: Plan; available: boolean }) {
  const router = useRouter();
  const [method, setMethod] = useState("alipay");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const inProgress = useRef(false);
  const form = useRef<HTMLFormElement>(null);

  async function purchase(planId: string) {
    if (inProgress.current) return;
    inProgress.current = true;
    setPending(planId);
    setError("");
    try {
      const response = await fetch("/api/checkout/providers/zpay/url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, method }),
      });
      if (response.status === 401) {
        router.push("/signin");
        return;
      }
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "创建支付链接失败。");
      submitZpayForm(form.current, payload);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "支付服务暂不可用。");
    } finally {
      inProgress.current = false;
      setPending(null);
    }
  }

  return (
    <div className="space-y-4">
      <form ref={form} action="https://zpayz.cn/submit.php" method="post" hidden />
      <article className="flex flex-col gap-5 rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-neutral-950">{plan.name}</h3>
            <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-700">
              按月订阅
            </span>
          </div>
          <p className="text-2xl font-semibold tracking-tight tabular-nums text-neutral-950">
            ¥{(plan.amount / 100).toFixed(2)}
            <span className="ml-1 text-sm font-normal text-neutral-500">/ 月</span>
          </p>
          <p className="text-sm text-neutral-600">每月 50 张图。手动续订，提前续订从当前到期日开始顺延。</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="inline-flex items-center gap-2.5 text-sm text-neutral-700">
            <span className="shrink-0">支付方式</span>
            <select
              value={method}
              onChange={(event) => setMethod(event.target.value)}
              disabled={!!pending}
              className="min-h-[44px] rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-950 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 sm:min-h-9"
            >
              <option value="alipay">支付宝</option>
              <option value="wxpay">微信支付</option>
            </select>
          </label>
          <button
            type="button"
            disabled={!available || !!pending}
            onClick={() => void purchase(plan.id)}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500 sm:min-h-9"
          >
            {pending ? "正在创建订单…" : available ? "订阅或续订" : "支付暂未开放"}
          </button>
        </div>
      </article>
      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
