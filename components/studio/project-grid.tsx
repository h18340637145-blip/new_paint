import Link from "next/link";
import { Plus } from "lucide-react";
import { createEmptyProject } from "@/lib/studio/project-actions";
import type { ProjectCardData } from "@/lib/studio/types";

const dateFormat = new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeZone: "Asia/Shanghai" });

export function ProjectGrid({ projects }: { projects: ProjectCardData[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      <form action={createEmptyProject}>
        <button type="submit" className="group block w-full text-left">
          <div className="grid aspect-video w-full place-items-center rounded-xl border border-dashed border-neutral-300 bg-neutral-100 text-neutral-600 group-hover:bg-neutral-200">
            <Plus size={19} />
          </div>
          <div className="mt-2 px-1 text-sm">新建项目</div>
        </button>
      </form>
      {projects.map((project) => (
        <Link key={project.id} href={`/canvas?projectId=${project.id}`} className="group block min-w-0">
          <div className="aspect-video overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100 group-hover:border-neutral-400">
            {/* eslint-disable-next-line @next/next/no-img-element -- 封面使用项目私有存储的签名地址。 */}
            {project.coverUrl && <img src={project.coverUrl} alt="" className="size-full object-cover" />}
          </div>
          <div className="mt-2 truncate px-1 text-sm">{project.title}</div>
          <div className="mt-1 px-1 text-xs text-neutral-500">更新于 {dateFormat.format(new Date(project.updatedAt))}</div>
        </Link>
      ))}
    </div>
  );
}
