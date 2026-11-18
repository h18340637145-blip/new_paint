import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { ProjectGrid } from "@/components/studio/project-grid";
import { studioPageSession } from "@/lib/studio/auth";
import { projectPageSize, readProjects } from "@/lib/studio/projects";

export default async function ProjectsPage({ searchParams }: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { supabase } = await studioPageSession();
  const rawPage = Number((await searchParams).page ?? 1);
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 && rawPage <= 10_000 ? rawPage : 1;
  const projects = await readProjects(supabase, projectPageSize + 1, (page - 1) * projectPageSize);
  return (
    <main className="landing-motion project-library">
      <header className="library-heading" data-enter>
        <Link href="/protected" aria-label="返回创作首页" className="rounded-lg p-1.5 hover:bg-neutral-100"><ArrowLeft size={18} /></Link>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">项目库</h1>
      </header>
      <ProjectGrid projects={projects.slice(0, projectPageSize)} />
      {(page > 1 || projects.length > projectPageSize) && (
        <nav aria-label="项目分页" className="mt-8 flex items-center justify-center gap-5 text-sm">
          {page > 1 && <Link className="flex items-center gap-1" href={`/projects?page=${page - 1}`}><ChevronLeft size={16} />上一页</Link>}
          <span className="text-neutral-500">第 {page} 页</span>
          {projects.length > projectPageSize && <Link className="flex items-center gap-1" href={`/projects?page=${page + 1}`}>下一页<ChevronRight size={16} /></Link>}
        </nav>
      )}
    </main>
  );
}
