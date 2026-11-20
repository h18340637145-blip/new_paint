import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { StudioTopNav } from "@/components/studio-top-nav";
import { ProjectGrid } from "@/components/studio/project-grid";
import { studioPageSession } from "@/lib/studio/auth";
import { createEmptyProject } from "@/lib/studio/project-actions";
import { projectPageSize, readProjects } from "@/lib/studio/projects";

export const metadata: Metadata = {
  title: "项目库",
};

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { supabase } = await studioPageSession();
  const rawPage = Number((await searchParams).page ?? 1);
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 && rawPage <= 10_000 ? rawPage : 1;
  const projects = await readProjects(supabase, projectPageSize + 1, (page - 1) * projectPageSize);

  return (
    <div className="project-library landing-motion">
      <StudioTopNav current="projects" />

      <main className="project-library-body">
        <header className="library-heading" data-enter>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 sm:text-4xl">
              项目库
            </h1>
            <p className="text-sm text-neutral-600">
              按最近修改时间排列，随时恢复画布节点、参考图与文章暂存链。
            </p>
          </div>

          <form action={createEmptyProject}>
            <button
              type="submit"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[#164b3e] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#123d32]"
            >
              <Plus size={16} aria-hidden="true" />
              新建空白项目
            </button>
          </form>
        </header>

        <ProjectGrid projects={projects.slice(0, projectPageSize)} />

        {(page > 1 || projects.length > projectPageSize) && (
          <nav aria-label="项目分页" className="mt-10 flex items-center justify-center gap-4 text-sm">
            {page > 1 && (
              <Link
                className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-neutral-200 bg-white px-3.5 py-2 font-medium text-neutral-800 hover:bg-neutral-50"
                href={`/projects?page=${page - 1}`}
              >
                <ChevronLeft size={16} aria-hidden="true" />
                上一页
              </Link>
            )}
            <span className="tabular-nums text-neutral-600">第 {page} 页</span>
            {projects.length > projectPageSize && (
              <Link
                className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-neutral-200 bg-white px-3.5 py-2 font-medium text-neutral-800 hover:bg-neutral-50"
                href={`/projects?page=${page + 1}`}
              >
                下一页
                <ChevronRight size={16} aria-hidden="true" />
              </Link>
            )}
          </nav>
        )}
      </main>
    </div>
  );
}
