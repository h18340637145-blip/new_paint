import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, Command, Layers, MousePointer2, Sparkles } from "lucide-react";

export function LandingHero({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <section className="landing-hero" data-enter>
      <div className="landing-wrap wrap">
        <div className="landing-hero-copy hero-text">
          <h1>
            在画布上编排图文，
            <br />
            直接排成公众号成稿。
          </h1>
          <p>
            在节点画布里生成图片、串联文字顺序并暂存版本；进入排版台导入模板或团队素材，改完一键复制进公众号后台。免费版每月含 3 张生图额度。
          </p>
          <div className="landing-actions">
            <Link
              className="landing-button landing-button-primary"
              href={isAuthenticated ? "/protected" : "/auth/sign-up"}
            >
              {isAuthenticated ? "进入工作台" : "免费开始创作"}
              <ArrowRight size={16} aria-hidden />
            </Link>
            <Link className="landing-button" href="/typography">
              打开公众号排版台
            </Link>
          </div>
        </div>

        {/* 真实画布编排 + 公众号排版双栏工作台界面 */}
        <div className="landing-frame app-frame" data-ui aria-label="画布编排与公众号排版真实界面">
          <div className="landing-frame-bar">
            <span className="inline-flex items-center gap-1.5 text-neutral-900">
              <Command size={14} aria-hidden />
              雾林建筑特辑 · 画布与公众号排版联动
            </span>
            <span className="inline-flex items-center gap-2 text-xs font-medium text-emerald-950">
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5">暂存 v2</span>
              <span className="hidden rounded-full bg-neutral-200 px-2.5 py-0.5 text-neutral-800 sm:inline">
                团队素材库已同步
              </span>
            </span>
          </div>

          <div className="landing-frame-body">
            {/* 左半屏：真实节点画布 */}
            <div className="landing-preview-board">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-neutral-900">导语与封面配图 · 已按阅读顺序串联</span>
                <span className="rounded-lg bg-[#164b3e] px-2.5 py-1 font-medium text-white">
                  去公众号排版
                </span>
              </div>

              <div className="grid items-stretch gap-3 sm:grid-cols-2">
                <div className="flex flex-col justify-between rounded-xl border border-neutral-300 bg-white p-3">
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="rounded bg-amber-900 px-2 py-0.5 text-[11px] font-semibold text-white">
                      #1 原文保留
                    </span>
                    <span className="font-medium text-neutral-600">开篇导语</span>
                  </div>
                  <p className="text-xs leading-relaxed text-neutral-800">
                    清晨六点的山谷雾气尚未散尽，木构屋檐与杉木林在同一条水平线上呼吸。
                  </p>
                </div>

                <div className="landing-preview-image">
                  <Image
                    src="/images/cover-example.jpg"
                    alt="画布中生成的雾林建筑宽幅配图节点"
                    width={360}
                    height={202}
                    unoptimized
                    priority
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-800">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <Sparkles size={13} className="text-[#164b3e]" aria-hidden />
                  AI 图文共创：已铺好导语与 16:9 配图并自动连线
                </span>
                <span className="font-semibold text-[#164b3e]">已采纳</span>
              </div>

              <span aria-hidden className="landing-preview-cursor">
                <MousePointer2 size={18} fill="currentColor" />
              </span>
            </div>

            {/* 右半屏：真实公众号手机排版与素材卡片预览 */}
            <div className="landing-preview-wechat">
              <div className="mb-2.5 flex items-center justify-between text-xs text-neutral-700">
                <span className="inline-flex items-center gap-1 font-semibold text-neutral-950">
                  <Layers size={13} aria-hidden />
                  公众号预览 · 纪实人文模板
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-[#164b3e] px-2 py-0.5 text-[11px] font-semibold text-white">
                  <Check size={11} aria-hidden />
                  复制到公众号
                </span>
              </div>

              <div className="flex flex-1 flex-col justify-between gap-2.5 rounded-xl border border-neutral-300 bg-white p-3.5 text-left">
                <div className="border-l-[3px] border-[#164b3e] bg-[#f3f6f4] px-2.5 py-1.5 text-xs font-bold text-[#164b3e]">
                  01 · 雾林里的木构建筑
                </div>
                <p className="text-xs leading-[1.75] text-neutral-800">
                  清晨六点的山谷雾气尚未散尽，木构屋檐与杉木林在同一条水平线上呼吸。从秀米或公众号粘贴卡片样式，一键套用并共享给团队。
                </p>
                <div className="flex items-center justify-between border-t border-dashed border-neutral-200 pt-2 text-[11px] text-neutral-600">
                  <span>松墨绿配色 · 正文 15px</span>
                  <span className="font-semibold text-[#164b3e]">可直接粘贴进公众号后台</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
