import type { Metadata } from "next";
import Link from "next/link";
import { BookOpenText, ChevronRight, FolderKanban, Sparkles } from "lucide-react";
import { HomeComposer } from "@/components/studio/home";
import { ProjectGrid } from "@/components/studio/project-grid";
import { studioPageSession } from "@/lib/studio/auth";
import { readProjects } from "@/lib/studio/projects";

export const metadata: Metadata = {
  title: "创作首页",
};

export default async function ProtectedPage() {
  const { supabase } = await studioPageSession();
  const projects = await readProjects(supabase, 4);
  return (
    <main className="studio-home pb-14 text-neutral-950">
      <section className="studio-hero" data-enter>
        <div className="space-y-3 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#c6d6cc] bg-white px-3 py-1 text-xs font-semibold text-[#164b3e]">
            <Sparkles size={13} aria-hidden="true" />
            AI 图文分镜共创 · 自由画布连线 · 一键排成公众号成稿
          </span>
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-950 sm:text-5xl">
            今天想写哪一篇好文章？
          </h1>
          <p className="mx-auto max-w-xl text-sm text-neutral-600">
            告诉我选题想法或切换「单图生成」，自动在画布里铺好文案与配图，随后送入排版台精修发布。
          </p>
        </div>

        <HomeComposer />

        <div className="flex flex-wrap items-center justify-center gap-2.5 text-xs">
          <Link
            href="/typography"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3.5 py-2 font-medium text-neutral-700 shadow-xs transition hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-950"
          >
            <BookOpenText size={14} aria-hidden="true" />
            已有文字草稿？直接去公众号排版台
          </Link>
          <Link
            href="/projects"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3.5 py-2 font-medium text-neutral-700 shadow-xs transition hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-950"
          >
            <FolderKanban size={14} aria-hidden="true" />
            浏览全部画布项目
          </Link>
        </div>
      </section>

      <section className="studio-recent">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-neutral-950 sm:text-xl">最近更新的项目</h2>
            <p className="text-xs text-neutral-500">悬停卡片可重命名或清理项目，点击进入画布继续创作</p>
          </div>
          <Link
            href="/projects"
            className="inline-flex min-h-10 items-center gap-1 rounded-xl px-2.5 text-xs font-semibold text-[#164b3e] hover:bg-white/70 hover:underline"
          >
            查看全部项目
            <ChevronRight size={14} aria-hidden="true" />
          </Link>
        </div>
        <ProjectGrid projects={projects} />
      </section>
    </main>
  );
}
