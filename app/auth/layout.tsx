import Link from "next/link";
import { ArrowLeft, CheckCircle2, Sparkles } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="account-shell landing-motion">
      <aside className="account-art" aria-label="工作台核心能力概览">
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur-sm">
          <Sparkles size={13} aria-hidden="true" />
          <span>画布生图 · 智能分镜 · 公众号排版</span>
        </div>

        <div className="max-w-md space-y-4">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight text-white">
            从一张参考图或一段灵感开始，直达公众号成稿。
          </h2>
          <ul className="space-y-2.5 text-sm text-white/85">
            <li className="flex items-center gap-2">
              <CheckCircle2 size={15} className="shrink-0 text-emerald-300" aria-hidden="true" />
              <span>无限节点画布管理参考图、生成图与文章编排顺序</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 size={15} className="shrink-0 text-emerald-300" aria-hidden="true" />
              <span>导入公众号或秀米模板，个人库与团队库云端同步</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 size={15} className="shrink-0 text-emerald-300" aria-hidden="true" />
              <span>免费版每月含 3 张生图额度，随时开箱体验</span>
            </li>
          </ul>
        </div>

        <p className="text-xs text-white/65">创作工作台 · 安全会话与私有素材隔离存储</p>
      </aside>

      <div className="account-content">
        <header className="account-nav">
          <Link href="/" className="surface-link font-medium text-neutral-700 hover:text-neutral-950">
            <ArrowLeft size={16} aria-hidden="true" />
            返回首页
          </Link>
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-950">
            <span className="grid size-6 place-items-center rounded-md bg-[#164b3e] text-xs font-bold text-white">
              创
            </span>
            创作工作台
          </span>
        </header>
        <div className="account-form" data-enter>
          {children}
        </div>
      </div>
    </main>
  );
}
