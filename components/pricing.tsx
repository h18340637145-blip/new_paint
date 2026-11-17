"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

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
      if (!form.current || payload.action !== "https://zpayz.cn/submit.php") {
        throw new Error("支付链接无效。");
      }
      const fields = Object.entries(payload.fields as Record<string, string>).map(([name, value]) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        return input;
      });
      form.current.replaceChildren(...fields);
      form.current.requestSubmit();
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
      <label className="inline-flex items-center gap-3 text-sm text-neutral-700">
        支付方式
        <select value={method} onChange={(event) => setMethod(event.target.value)} disabled={!!pending}
          className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-neutral-950">
          <option value="alipay">支付宝</option>
          <option value="wxpay">微信支付</option>
        </select>
      </label>
      <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 p-4">
        <h3 className="font-medium">{plan.name}</h3>
        <p className="text-xl font-semibold tabular-nums">
          ¥{(plan.amount / 100).toFixed(2)}
          <span className="ml-1 text-sm font-normal text-neutral-500">/ 月</span>
        </p>
        <p className="text-sm text-neutral-600">每月 50 张图。手动续订，提前续订从当前到期日开始顺延。</p>
        <button type="button" disabled={!available || !!pending}
          onClick={() => void purchase(plan.id)}
          className="self-start rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white disabled:bg-neutral-100 disabled:text-neutral-500">
          {pending ? "正在创建订单…" : available ? "订阅或续订" : "支付暂未开放"}
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
