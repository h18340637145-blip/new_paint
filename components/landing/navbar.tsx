import Link from "next/link";
import { Image as ImageIcon } from "lucide-react";

export function LandingNavbar({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <header className="nav sticky top-0 z-40 border-b border-neutral-200/80 bg-white/90 backdrop-blur-md">
      <div className="landing-wrap wrap flex h-16 items-center justify-between gap-3">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-2.5 text-neutral-950 transition-opacity hover:opacity-80"
        >
          <span className="grid size-8 place-items-center rounded-full bg-[#164b3e] text-white">
            <ImageIcon size={15} aria-hidden="true" />
          </span>
          <span className="text-base font-semibold tracking-tight">创作工作台</span>
        </Link>

        <nav aria-label="主导航" className="hidden items-center gap-5 text-sm font-medium text-neutral-700 lg:flex">
          <a href="#benefits" className="inline-flex min-h-11 items-center transition-colors hover:text-neutral-950">
            核心优势
          </a>
          <a href="#features" className="inline-flex min-h-11 items-center transition-colors hover:text-neutral-950">
            产品功能
          </a>
          <Link href="/typography" className="inline-flex min-h-11 items-center transition-colors hover:text-neutral-950">
            公众号排版
          </Link>
          <a href="#pricing" className="inline-flex min-h-11 items-center transition-colors hover:text-neutral-950">
            价格与额度
          </a>
          <a href="#faq" className="inline-flex min-h-11 items-center transition-colors hover:text-neutral-950">
            常见问题
          </a>
        </nav>

        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <>
              <Link href="/profile" className="landing-button">
                个人中心
              </Link>
              <Link href="/protected" className="landing-button landing-button-primary">
                进入工作台
              </Link>
            </>
          ) : (
            <>
              <Link href="/auth/login" className="landing-button">
                登录
              </Link>
              <Link href="/auth/sign-up" className="landing-button landing-button-primary">
                免费开始创作
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
