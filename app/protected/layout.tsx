import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="studio-shell landing-motion">
      <header className="studio-nav">
        <Link href="/" className="surface-link font-semibold">创作工作台</Link>
        <nav aria-label="工作台导航" className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Link href="/typography" className="surface-link">公众号排版</Link>
          <Link href="/projects" className="surface-link">项目</Link>
          <Link href="/profile" className="surface-link">个人中心</Link>
          <LogoutButton />
        </nav>
      </header>
      {children}
    </div>
  );
}
