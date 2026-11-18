import Link from "next/link";
import { ChevronRight, Image as ImageIcon } from "lucide-react";
import { HomeComposer } from "@/components/studio/home";
import { ProjectGrid } from "@/components/studio/project-grid";
import { studioPageSession } from "@/lib/studio/auth";
import { readProjects } from "@/lib/studio/projects";

export default async function ProtectedPage() {
  const { supabase } = await studioPageSession();
  const projects = await readProjects(supabase, 4);
  return (
    <main className="studio-home pb-14 text-neutral-950">
      <section className="studio-hero" data-enter>
        <h1 className="flex items-center justify-center gap-2 text-center text-3xl font-semibold tracking-tight sm:text-5xl">
          <span className="grid size-8 place-items-center rounded-full bg-neutral-950 text-white"><ImageIcon size={16} /></span>
          用画布开始创作
        </h1>
        <HomeComposer />
      </section>
      <section className="studio-recent">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">最近项目</h2>
          <Link href="/projects" className="flex items-center gap-1 text-xs text-neutral-600 hover:text-neutral-950">
            查看全部<ChevronRight size={13} />
          </Link>
        </div>
        <ProjectGrid projects={projects} />
      </section>
    </main>
  );
}
