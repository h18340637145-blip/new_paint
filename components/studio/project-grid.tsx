"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, Clock, Pencil, Plus, Sparkles, Trash2, X } from "lucide-react";
import { studioRequest } from "@/lib/studio/client";
import { createEmptyProject } from "@/lib/studio/project-actions";
import type { ProjectCardData } from "@/lib/studio/types";

const dateFormat = new Intl.DateTimeFormat("zh-CN", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Shanghai",
});

export function ProjectGrid({ projects }: { projects: ProjectCardData[] }) {
  const router = useRouter();
  const [items, setItems] = useState<ProjectCardData[]>(projects);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    setItems(projects);
  }, [projects]);

  async function saveRename(projectId: string) {
    const trimmed = draftTitle.trim();
    if (!trimmed) {
      setEditingId(null);
      return;
    }
    setBusyId(projectId);
    setActionError("");
    try {
      const res = await studioRequest<{ id: string; title: string }>({
        action: "rename-project",
        projectId,
        title: trimmed,
      });
      setItems((prev) => prev.map((p) => (p.id === projectId ? { ...p, title: res.title } : p)));
      setEditingId(null);
      router.refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "重命名失败，请稍后重试。");
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete(projectId: string) {
    setBusyId(projectId);
    setActionError("");
    try {
      await studioRequest({ action: "delete-project", projectId });
      setItems((prev) => prev.filter((p) => p.id !== projectId));
      setConfirmDeleteId(null);
      router.refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "删除失败，请稍后重试。");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3">
      {actionError && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-xs text-red-800">
          {actionError}
        </p>
      )}

      <div className="project-grid grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        <form action={createEmptyProject}>
          <button
            type="submit"
            className="project-tile group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-dashed border-[#b8c8bb] bg-white/85 p-3 text-left transition hover:border-[#164b3e] hover:bg-white hover:shadow-sm"
          >
            <div className="grid aspect-video w-full place-items-center rounded-xl bg-[#eef3ee] text-[#164b3e] transition group-hover:bg-[#e3ede4]">
              <div className="flex flex-col items-center gap-1.5">
                <span className="grid size-10 place-items-center rounded-full bg-[#164b3e] text-white shadow-sm">
                  <Plus size={18} aria-hidden="true" />
                </span>
                <span className="text-xs font-semibold">新建画布项目</span>
              </div>
            </div>
            <div className="mt-3 px-1">
              <div className="text-sm font-semibold text-neutral-950">从空白画布开始</div>
              <div className="mt-0.5 text-xs text-neutral-500">生图、粘贴参考图与文章连线</div>
            </div>
          </button>
        </form>

        {items.map((project) => {
          const isEditing = editingId === project.id;
          const isConfirmingDelete = confirmDeleteId === project.id;
          const isBusy = busyId === project.id;
          const initialChar = (project.title.trim()[0] ?? "画").toUpperCase();

          return (
            <div
              key={project.id}
              className="project-tile group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-neutral-200/85 bg-white p-2.5 shadow-xs transition hover:border-neutral-300 hover:shadow-md"
            >
              <Link href={`/canvas?projectId=${project.id}`} className="block">
                <div className="project-cover relative grid aspect-video place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-[#eef2ec] via-[#e7ede6] to-[#dde6dc]">
                  {project.coverUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element -- 封面使用项目私有存储的签名地址。 */
                    <img src={project.coverUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-[#4a6358]">
                      <span className="grid size-9 place-items-center rounded-xl bg-white/80 text-sm font-bold text-[#164b3e] shadow-xs">
                        {initialChar}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium opacity-80">
                        <Sparkles size={11} aria-hidden="true" />
                        点击进入画布创作
                      </span>
                    </div>
                  )}
                </div>
              </Link>

              {/* 右上角快捷改名与删除悬浮按钮 */}
              {!isEditing && !isConfirmingDelete && (
                <div className="absolute right-4 top-4 z-10 flex items-center gap-1 rounded-lg bg-white/92 p-1 opacity-100 shadow-xs backdrop-blur-xs transition sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                  <button
                    type="button"
                    aria-label={`重命名项目 ${project.title}`}
                    title="重命名项目"
                    onClick={(e) => {
                      e.preventDefault();
                      setConfirmDeleteId(null);
                      setEditingId(project.id);
                      setDraftTitle(project.title);
                    }}
                    className="inline-flex size-7 items-center justify-center rounded-md text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    type="button"
                    aria-label={`删除项目 ${project.title}`}
                    title="删除项目"
                    onClick={(e) => {
                      e.preventDefault();
                      setEditingId(null);
                      setConfirmDeleteId(project.id);
                    }}
                    className="inline-flex size-7 items-center justify-center rounded-md text-neutral-600 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              )}

              <div className="mt-2.5 px-1">
                {isEditing ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      aria-label="项目名称"
                      autoFocus
                      maxLength={80}
                      value={draftTitle}
                      disabled={isBusy}
                      onChange={(e) => setDraftTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void saveRename(project.id);
                        } else if (e.key === "Escape") {
                          setEditingId(null);
                        }
                      }}
                      className="min-w-0 flex-1 rounded-lg border border-[#164b3e] bg-white px-2 py-1 text-xs font-semibold text-neutral-950 focus:outline-none"
                    />
                    <button
                      type="button"
                      aria-label="确认修改项目名"
                      disabled={isBusy}
                      onClick={() => void saveRename(project.id)}
                      className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#164b3e] text-white hover:bg-[#123d32]"
                    >
                      <Check size={13} />
                    </button>
                    <button
                      type="button"
                      aria-label="取消重命名"
                      onClick={() => setEditingId(null)}
                      className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ) : isConfirmingDelete ? (
                  <div className="flex items-center justify-between gap-1 rounded-lg bg-red-50 px-2 py-1 text-xs">
                    <span className="font-medium text-red-900">确定删除此项目？</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => setConfirmDeleteId(null)}
                        className="rounded border border-red-200 bg-white px-2 py-0.5 text-[11px] font-medium text-neutral-700 hover:bg-neutral-50"
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void confirmDelete(project.id)}
                        className="rounded bg-red-600 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-red-700"
                      >
                        {isBusy ? "删除中…" : "确认删除"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <Link href={`/canvas?projectId=${project.id}`} className="block">
                    <div className="truncate text-sm font-semibold text-neutral-950 transition group-hover:text-[#164b3e]">
                      {project.title}
                    </div>
                    <div className="mt-1 inline-flex items-center gap-1 text-xs tabular-nums text-neutral-500">
                      <Clock size={11} aria-hidden="true" />
                      <span>更新于 {dateFormat.format(new Date(project.updatedAt))}</span>
                    </div>
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
