import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AuthStatusCard } from "@/components/auth-status-card";
import { LogoutButton } from "@/components/logout-button";

export default function InviteRequiredPage() {
  return (
    <main className="account-shell landing-motion">
      <aside className="account-art" aria-hidden="true">
        <div className="text-xs font-medium text-white/80">创作工作台 · 账号验证</div>
        <div className="max-w-sm space-y-2">
          <h2 className="text-2xl font-semibold text-white">完成邮箱确认后即可开通画布与云端素材库</h2>
          <p className="text-sm text-white/80">保护您的私有生成图片、排版稿与团队协作权限。</p>
        </div>
        <span className="text-xs text-white/60">安全会话保护</span>
      </aside>

      <div className="account-content">
        <header className="account-nav">
          <Link href="/" className="surface-link font-medium text-neutral-700 hover:text-neutral-950">
            <ArrowLeft size={16} aria-hidden="true" />
            返回首页
          </Link>
          <LogoutButton />
        </header>
        <div className="account-form" data-enter>
          <AuthStatusCard
            tone="info"
            title="请先完成邮箱验证"
            description="请打开注册邮件中的确认链接，完成邮箱激活后重新登录即可使用创作工作台。"
            primaryAction={{ label: "重新登录", href: "/auth/login" }}
            secondaryAction={{ label: "先试用公众号排版", href: "/typography" }}
          />
        </div>
      </div>
    </main>
  );
}
