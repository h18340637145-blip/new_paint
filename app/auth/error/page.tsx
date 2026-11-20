import { Suspense } from "react";
import { AuthStatusCard } from "@/components/auth-status-card";

async function ErrorBody({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const rawErr = params?.error?.trim();

  return (
    <AuthStatusCard
      tone="error"
      title="验证链接已失效或无法完成"
      description="邮件确认链接可能已过期、已被使用，或当前浏览器会话发生了变化。您可以尝试直接登录，或重新发送重置邮件。"
      detail={rawErr ? `状态说明：${rawErr}` : undefined}
      primaryAction={{ label: "前往登录", href: "/auth/login" }}
      secondaryAction={{ label: "找回密码", href: "/auth/forgot-password" }}
    />
  );
}

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <Suspense>
      <ErrorBody searchParams={searchParams} />
    </Suspense>
  );
}
