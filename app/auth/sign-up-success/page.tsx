import { AuthStatusCard } from "@/components/auth-status-card";

export default function Page() {
  return (
    <AuthStatusCard
      tone="info"
      title="请查收邮箱完成验证"
      description="首次注册时，请打开发送到您邮箱的确认链接激活账号。已经完成邮箱验证的账号可直接登录。"
      primaryAction={{ label: "返回登录", href: "/auth/login" }}
      secondaryAction={{ label: "重置密码", href: "/auth/forgot-password" }}
    />
  );
}
