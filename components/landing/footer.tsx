import Link from "next/link";
import { Image as ImageIcon } from "lucide-react";

export function LandingFooter({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <footer className="closing bg-neutral-50 py-12 text-sm text-neutral-700">
      <div className="landing-wrap wrap space-y-10">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-xs space-y-2.5">
            <div className="flex items-center gap-2 text-neutral-950">
              <span className="grid size-7 place-items-center rounded-full bg-[#164b3e] text-white">
                <ImageIcon size={13} aria-hidden="true" />
              </span>
              <span className="font-semibold">创作工作台</span>
            </div>
            <p className="text-xs leading-relaxed text-neutral-700">
              面向视觉与内容创作者的工作台：无限画布生图、创意分镜编排与微信公众号模板库。
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-900">产品</p>
              <ul className="space-y-1 text-xs">
                <li>
                  <a href="#features" className="hover:text-neutral-950">
                    画布与 Agent
                  </a>
                </li>
                <li>
                  <Link href="/typography" className="hover:text-neutral-950">
                    公众号排版
                  </Link>
                </li>
                <li>
                  <a href="#pricing" className="hover:text-neutral-950">
                    价格与额度
                  </a>
                </li>
              </ul>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-900">工作台</p>
              <ul className="space-y-1 text-xs">
                <li>
                  <Link href={isAuthenticated ? "/protected" : "/auth/login"} className="hover:text-neutral-950">
                    创作首页
                  </Link>
                </li>
                <li>
                  <Link href={isAuthenticated ? "/projects" : "/auth/login"} className="hover:text-neutral-950">
                    项目库
                  </Link>
                </li>
                <li>
                  <Link href={isAuthenticated ? "/profile" : "/auth/login"} className="hover:text-neutral-950">
                    个人中心
                  </Link>
                </li>
              </ul>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-900">账号</p>
              <ul className="space-y-1 text-xs">
                <li>
                  <Link href="/auth/login" className="hover:text-neutral-950">
                    登录
                  </Link>
                </li>
                <li>
                  <Link href="/auth/sign-up" className="hover:text-neutral-950">
                    免费开始创作
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="border-t border-neutral-200 pt-6 text-xs text-neutral-700">
          © {new Date().getFullYear()} 创作工作台 · All rights reserved.
        </div>
      </div>
    </footer>
  );
}
