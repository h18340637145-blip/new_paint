import Link from "next/link";
import { Image as ImageIcon } from "lucide-react";

export function LandingNavbar({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200/80 bg-white/85 backdrop-blur-md">
      <div className="landing-wrap wrap flex h-16 items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2.5 text-neutral-950 transition-opacity hover:opacity-80">
          <span className="grid size-8 place-items-center rounded-full bg-neutral-950 text-white">
            <ImageIcon size={15} aria-hidden="true" />
          </span>
          <span className="text-base font-semibold tracking-tight">创作工作台</span>
        </Link>

        <nav aria-label="主导航" className="hidden items-center gap-5 text-sm font-medium text-neutral-600 lg:flex">
          <a href="#benefits" className="transition-colors hover:text-neutral-950">核心优势</a>
          <a href="#features" className="transition-colors hover:text-neutral-950">产品功能</a>
          <Link href="/typography" className="transition-colors hover:text-neutral-950">公众号排版</Link>
          <a href="#pricing" className="transition-colors hover:text-neutral-950">定价方案</a>
          <a href="#faq" className="transition-colors hover:text-neutral-950">常见问题</a>
        </nav>

        <div className="flex items-center gap-2.5">
          {isAuthenticated ? (
            <>
              <Link
                href="/profile"
                className="inline-flex min-h-11 items-center rounded-lg px-3.5 py-1.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-neutral-950"
              >
                个人中心
              </Link>
              <Link
                href="/protected"
                className="landing-button landing-button-primary"
              >
                进入工作台
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/auth/login"
                className="inline-flex min-h-11 items-center rounded-lg px-3.5 py-1.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-neutral-950"
              >
                登录
              </Link>
              <Link
                href="/auth/sign-up"
                className="landing-button landing-button-primary"
              >
                免费注册
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
