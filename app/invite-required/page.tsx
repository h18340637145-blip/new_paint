import { LogoutButton } from "@/components/logout-button";

export default function InviteRequiredPage() {
  return (
    <main className="verification-surface landing-motion grid min-h-screen place-items-center p-6 text-neutral-950">
      <div data-enter className="max-w-md rounded-2xl border border-neutral-200 bg-white p-8">
        <h1 className="mb-3 text-xl font-semibold">请先验证邮箱</h1>
        <p className="mb-6 text-sm text-neutral-600">打开注册邮件中的确认链接，完成验证后重新登录。</p>
        <LogoutButton />
      </div>
    </main>
  );
}
