import Link from "next/link";
import { ArrowLeft, Image as ImageIcon } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="account-shell landing-motion">
      <aside className="account-art" aria-hidden="true" />
      <div className="account-content">
        <header className="account-nav">
          <Link href="/" className="surface-link"><ArrowLeft size={16} aria-hidden />首页</Link>
          <span className="flex items-center gap-2 font-semibold"><ImageIcon size={17} aria-hidden />创作工作台</span>
        </header>
        <div className="account-form" data-enter>{children}</div>
      </div>
    </main>
  );
}
