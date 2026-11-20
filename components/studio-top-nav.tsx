import Link from "next/link";
import { BookOpenText, FolderKanban, Sparkles, UserCircle2 } from "lucide-react";
import { LogoutButton } from "@/components/logout-button";

export type StudioNavSection = "home" | "projects" | "typography" | "profile";

const NAV_ITEMS: Array<{
  id: StudioNavSection;
  label: string;
  href: string;
  icon: typeof Sparkles;
}> = [
  { id: "home", label: "创作首页", href: "/protected", icon: Sparkles },
  { id: "projects", label: "项目库", href: "/projects", icon: FolderKanban },
  { id: "typography", label: "公众号排版", href: "/typography", icon: BookOpenText },
  { id: "profile", label: "个人中心", href: "/profile", icon: UserCircle2 },
];

export function StudioTopNav({
  current,
  centerSlot,
  rightSlot,
  showLogout = true,
  subHeader,
}: {
  current: StudioNavSection;
  centerSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  showLogout?: boolean;
  subHeader?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-[#dfe5da] bg-white/95 text-[#182721] backdrop-blur-md">
      <div className="mx-auto flex max-w-[1680px] flex-wrap items-center justify-between gap-2 px-4 py-2 sm:px-6">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Link
            href="/"
            className="inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-neutral-950 transition hover:bg-neutral-100"
          >
            <span className="grid size-6 place-items-center rounded-lg bg-[#164b3e] text-xs font-bold text-white shadow-xs">
              创
            </span>
            <span className="hidden sm:inline">创作工作台</span>
          </Link>

          <nav
            aria-label="工作台主导航"
            className="inline-flex flex-wrap items-center gap-0.5 rounded-xl bg-[#f2f4ef] p-1"
          >
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = item.id === current;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition sm:px-3 ${
                    active
                      ? "bg-white text-[#164b3e] shadow-xs"
                      : "text-neutral-600 hover:text-neutral-950"
                  }`}
                >
                  <Icon size={14} aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {centerSlot}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {rightSlot}
          {showLogout && <LogoutButton />}
        </div>
      </div>
      {subHeader}
    </header>
  );
}
