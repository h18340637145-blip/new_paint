"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Clock, LoaderCircle, RefreshCw, Sparkles, X } from "lucide-react";
import { ARTICLE_TEXT_ROLE_LABEL, type ArticleSnapshotRecord } from "@/lib/studio/article-graph";
import type { ArticleTaskRecord } from "@/lib/studio/article-data";
import { getSubTemplate, getThemeById, TYPOGRAPHY_SUBTEMPLATES } from "@/lib/typography/catalog";
import type { TemplateStyleConfig } from "@/lib/typography/types";

interface WorkspaceProject {
  id: string;
  title: string;
  updatedAt: string;
}

export interface DraftListItem {
  id: string;
  projectId: string;
  snapshotId: string;
  taskId: string | null;
  title: string;
  subTemplateId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

const timeFormat = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  dateStyle: "short",
  timeStyle: "short",
});

export function FromCanvasDialog({
  open,
  initialProjectId,
  initialSnapshotId,
  activeSubTemplateId,
  activeTemplateStyle,
  onSelectSubTemplateId,
  onOpenDraft,
  onClose,
}: {
  open: boolean;
  initialProjectId?: string | null;
  initialSnapshotId?: string | null;
  activeSubTemplateId: string;
  activeTemplateStyle: TemplateStyleConfig;
  onSelectSubTemplateId: (id: string) => void;
  onOpenDraft: (draftId: string) => Promise<void>;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);
  const [authError, setAuthError] = useState("");
  const [projects, setProjects] = useState<WorkspaceProject[]>([]);
  const [projectId, setProjectId] = useState<string>(initialProjectId ?? "");
  const [snapshots, setSnapshots] = useState<ArticleSnapshotRecord[]>([]);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string>(initialSnapshotId ?? "");
  const [tasks, setTasks] = useState<ArticleTaskRecord[]>([]);
  const [drafts, setDrafts] = useState<DraftListItem[]>([]);
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({});

  const [lockedSubId, setLockedSubId] = useState(activeSubTemplateId);
  const [lockedStyle, setLockedStyle] = useState<TemplateStyleConfig>(activeTemplateStyle);
  const [activeTask, setActiveTask] = useState<ArticleTaskRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const loadWorkspace = useCallback(
    async (targetProjId?: string) => {
      setLoadingWorkspace(true);
      setAuthError("");
      setError("");
      try {
        const qs = targetProjId ? `?projectId=${encodeURIComponent(targetProjId)}` : "";
        const res = await fetch(`/api/typography/workspace${qs}`, { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (res.status === 401 || res.status === 403) {
          setAuthError(data.error || "请先登录工作台后再从画布生成文章。");
          return;
        }
        if (!res.ok) {
          throw new Error(data.error || "读取画布项目失败。");
        }
        setProjects(data.projects ?? []);
        const resolvedProj = data.activeProjectId ?? "";
        setProjectId(resolvedProj);
        const snapList: ArticleSnapshotRecord[] = data.snapshots ?? [];
        setSnapshots(snapList);
        setTasks(data.tasks ?? []);
        setDrafts(data.drafts ?? []);
        setAssetUrls(data.assetUrls ?? {});

        setSelectedSnapshotId((prev) => {
          if (initialSnapshotId && snapList.some((s) => s.id === initialSnapshotId)) {
            return initialSnapshotId;
          }
          if (prev && snapList.some((s) => s.id === prev)) return prev;
          return snapList[0]?.id ?? "";
        });

        // Resume any currently running task automatically
        const running = (data.tasks as ArticleTaskRecord[] | undefined)?.find((t) => t.status === "running");
        if (running) {
          setActiveTask(running);
          setStep(3);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "加载画布数据失败。");
      } finally {
        setLoadingWorkspace(false);
      }
    },
    [initialSnapshotId],
  );

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) {
      setLockedSubId(activeSubTemplateId);
      setLockedStyle(activeTemplateStyle);
      setStep(initialSnapshotId ? 2 : 1);
      el.showModal();
      void loadWorkspace(initialProjectId ?? undefined);
    } else if (!open && el.open) {
      el.close();
    }
  }, [open, initialProjectId, initialSnapshotId, activeSubTemplateId, activeTemplateStyle, loadWorkspace]);

  // Poll running task
  useEffect(() => {
    if (!open || !activeTask || activeTask.status !== "running") return;
    let cancelled = false;
    const timer = window.setInterval(async () => {
      try {
        const res = await fetch(
          `/api/typography/tasks?projectId=${encodeURIComponent(activeTask.projectId)}&taskId=${encodeURIComponent(activeTask.id)}`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const data = (await res.json()) as { task?: ArticleTaskRecord };
        if (cancelled || !data.task) return;
        setActiveTask(data.task);
        if (data.task.status === "succeeded" && data.task.draftId) {
          await onOpenDraft(data.task.draftId);
          onClose();
        }
      } catch {
        // Ignore transient poll errors
      }
    }, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [open, activeTask, onOpenDraft, onClose]);

  const currentSub = getSubTemplate(lockedSubId);
  const currentTheme = getThemeById(currentSub.themeId);
  const selectedSnapshot = snapshots.find((s) => s.id === selectedSnapshotId) ?? null;

  async function startGeneration(forceNew = false) {
    if (!projectId || !selectedSnapshotId || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/typography/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          snapshotId: selectedSnapshotId,
          subTemplateId: lockedSubId,
          templateStyle: lockedStyle,
          forceNew,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "提交生成任务失败。");
      setActiveTask(data.task as ArticleTaskRecord);
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败，请重试。");
    } finally {
      setSubmitting(false);
    }
  }

  async function retryFailedTask(task: ArticleTaskRecord) {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/typography/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: task.projectId, taskId: task.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "重试失败。");
      setActiveTask(data.task as ArticleTaskRecord);
    } catch (err) {
      setError(err instanceof Error ? err.message : "重试失败。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="from-canvas-title"
      onClose={onClose}
      className="w-full max-w-3xl rounded-2xl border border-neutral-200 bg-white p-0 text-neutral-950 shadow-2xl backdrop:bg-black/40"
    >
      <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
        <div>
          <h2 id="from-canvas-title" className="text-base font-semibold">
            从画布生成公众号文章
          </h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            依次确认模板样式与画布暂存版本，由 Qwen 读图扩写并生成可人工精修的排版稿
          </p>
        </div>
        <button
          type="button"
          aria-label="关闭"
          onClick={onClose}
          className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950"
        >
          <X size={16} />
        </button>
      </div>

      {/* 步骤条 */}
      <div className="grid grid-cols-3 border-b border-neutral-100 bg-neutral-50/80 px-5 py-2.5 text-xs">
        {[
          { n: 1 as const, label: "1. 确认模板样式" },
          { n: 2 as const, label: "2. 确认暂存版本" },
          { n: 3 as const, label: "3. 应用模板并排版" },
        ].map((item) => (
          <button
            key={item.n}
            type="button"
            disabled={Boolean(authError)}
            onClick={() => setStep(item.n)}
            className={`text-left font-medium transition ${
              step === item.n ? "text-neutral-950" : "text-neutral-400 hover:text-neutral-700"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="max-h-[70vh] space-y-4 overflow-y-auto p-5 text-xs">
        {authError ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
            <p className="font-semibold">{authError}</p>
            <a
              href="/auth/login"
              className="mt-2 inline-block rounded-lg bg-neutral-950 px-3.5 py-1.5 font-medium text-white"
            >
              前往登录
            </a>
          </div>
        ) : loadingWorkspace ? (
          <div className="flex items-center justify-center gap-2 py-12 text-neutral-500">
            <LoaderCircle size={16} className="animate-spin" />
            正在读取画布项目与暂存记录…
          </div>
        ) : (
          <>
            {error && (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-700">
                {error}
              </div>
            )}

            {/* 已有历史排版稿快捷打开 */}
            {drafts.length > 0 && step !== 3 && (
              <div className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-3">
                <p className="mb-2 font-semibold text-neutral-700">该项目已生成的排版稿（点击直接打开继续编辑）：</p>
                <div className="flex flex-wrap gap-2">
                  {drafts.slice(0, 6).map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={async () => {
                        await onOpenDraft(d.id);
                        onClose();
                      }}
                      className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-left transition hover:border-neutral-950"
                    >
                      <span className="font-medium text-neutral-900">{d.title}</span>
                      <span className="ml-1.5 text-[10px] text-neutral-400">v{d.version}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-3">
                <div className="rounded-xl border border-neutral-200 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-medium text-neutral-700">
                        {currentTheme.name}
                      </span>
                      <h3 className="mt-1.5 text-sm font-semibold text-neutral-950">{currentSub.name}</h3>
                      <p className="mt-0.5 text-neutral-500">{currentSub.description}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="size-5 rounded-full border border-neutral-200"
                        style={{ backgroundColor: lockedStyle.colors.primaryColor }}
                        title="主色"
                      />
                      <span
                        className="size-5 rounded-full border border-neutral-200"
                        style={{ backgroundColor: lockedStyle.colors.accentColor }}
                        title="强调色"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block font-medium text-neutral-700">快速切换子模板（默认沿用工作台当前模板与局部样式）：</label>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {TYPOGRAPHY_SUBTEMPLATES.map((tpl) => {
                      const selected = tpl.id === lockedSubId;
                      return (
                        <button
                          key={tpl.id}
                          type="button"
                          onClick={() => {
                            setLockedSubId(tpl.id);
                            setLockedStyle(tpl.defaultStyle);
                            onSelectSubTemplateId(tpl.id);
                          }}
                          className={`flex items-center gap-2 rounded-xl border p-2.5 text-left transition ${
                            selected ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-200 hover:border-neutral-300"
                          }`}
                        >
                          <span
                            className="size-3 shrink-0 rounded-full border border-white/50"
                            style={{ backgroundColor: tpl.defaultStyle.colors.primaryColor }}
                          />
                          <span className="truncate font-medium">{tpl.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex items-center gap-2">
                    <span className="font-medium text-neutral-700">选择画布项目</span>
                    <select
                      value={projectId}
                      onChange={(e) => void loadWorkspace(e.target.value)}
                      className="rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-neutral-950"
                    >
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {snapshots.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-neutral-200 p-6 text-center text-neutral-500">
                    该项目尚无已保存的暂存版本。请先前往画布开启「文章编排」模式并点击「核对并暂存」。
                    {projectId && (
                      <div className="mt-3">
                        <a
                          href={`/canvas?projectId=${projectId}`}
                          className="inline-block rounded-lg bg-neutral-950 px-3.5 py-1.5 font-medium text-white"
                        >
                          前往该项目画布
                        </a>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-12">
                    <div className="space-y-2 md:col-span-5">
                      <p className="font-medium text-neutral-700">选择不可变暂存版本：</p>
                      {snapshots.map((s) => {
                        const active = s.id === selectedSnapshotId;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setSelectedSnapshotId(s.id)}
                            className={`w-full rounded-xl border p-3 text-left transition ${
                              active ? "border-neutral-950 bg-neutral-50 ring-1 ring-neutral-950" : "border-neutral-200 hover:border-neutral-300"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="rounded bg-neutral-950 px-1.5 py-0.5 text-[10px] font-bold text-white">
                                v{s.versionNumber}
                              </span>
                              <span className="flex items-center gap-1 text-[10px] text-neutral-400">
                                <Clock size={10} />
                                {timeFormat.format(new Date(s.createdAt))}
                              </span>
                            </div>
                            <p className="mt-1.5 truncate font-semibold text-neutral-900">{s.title}</p>
                            <p className="mt-0.5 text-[11px] text-neutral-500">{s.nodes.length} 个有序节点</p>
                          </button>
                        );
                      })}
                    </div>

                    <div className="space-y-2 rounded-xl border border-neutral-200 bg-neutral-50/70 p-3 md:col-span-7">
                      <p className="font-semibold text-neutral-800">
                        版本内容与顺序预览 {selectedSnapshot ? `（v${selectedSnapshot.versionNumber}）` : ""}
                      </p>
                      {selectedSnapshot ? (
                        <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                          {selectedSnapshot.nodes.map((n) => (
                            <div key={`${selectedSnapshot.id}-${n.order}`} className="flex items-start gap-2 rounded-lg border border-neutral-200 bg-white p-2">
                              <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-[10px] font-bold text-white">
                                {n.order}
                              </span>
                              {n.kind === "image" ? (
                                <div className="flex items-center gap-2">
                                  {n.assetId && assetUrls[n.assetId] && (
                                    /* eslint-disable-next-line @next/next/no-img-element -- 暂存缩略图预览 */
                                    <img src={assetUrls[n.assetId]} alt={n.filename || "配图"} className="size-9 rounded object-cover" />
                                  )}
                                  <span className="text-neutral-700">[图片] {n.filename || "画布配图"}</span>
                                </div>
                              ) : (
                                <div className="min-w-0 flex-1">
                                  <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-700">
                                    {ARTICLE_TEXT_ROLE_LABEL[n.role ?? "material"]}
                                  </span>
                                  <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-neutral-800">{n.text}</p>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-neutral-400">请在左侧选择一个暂存版本。</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="grid gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4 sm:grid-cols-2">
                  <div>
                    <p className="text-[11px] text-neutral-500">已锁定模板</p>
                    <p className="mt-0.5 text-sm font-semibold text-neutral-950">
                      {currentTheme.name} · {currentSub.name}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-neutral-500">已锁定暂存版本</p>
                    <p className="mt-0.5 text-sm font-semibold text-neutral-950">
                      {selectedSnapshot ? `v${selectedSnapshot.versionNumber} · ${selectedSnapshot.title}` : "未选择"}
                    </p>
                  </div>
                </div>

                {activeTask?.status === "running" && (
                  <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4">
                    <LoaderCircle size={18} className="animate-spin text-neutral-950" />
                    <div>
                      <p className="font-semibold text-neutral-950">Qwen 正在读图、扩写并套用模板排版…</p>
                      <p className="mt-0.5 text-neutral-500">任务已持久化在服务端，即使刷新页面也可继续查看进度。</p>
                    </div>
                  </div>
                )}

                {activeTask?.status === "failed" && (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
                    <div className="flex items-start gap-2">
                      <AlertCircle size={16} className="mt-0.5 shrink-0" />
                      <div>
                        <p className="font-semibold">生成失败</p>
                        <p>{activeTask.errorMessage || "请稍后重试。"}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => void retryFailedTask(activeTask)}
                      className="inline-flex items-center gap-1 rounded-lg bg-red-700 px-3 py-1.5 font-medium text-white hover:bg-red-800"
                    >
                      <RefreshCw size={13} />
                      用原参数重试
                    </button>
                  </div>
                )}

                {tasks.some((t) => t.status === "failed" && t.id !== activeTask?.id) && (
                  <div className="space-y-1.5">
                    <p className="font-medium text-neutral-600">最近失败任务：</p>
                    {tasks
                      .filter((t) => t.status === "failed" && t.id !== activeTask?.id)
                      .slice(0, 2)
                      .map((t) => (
                        <div key={t.id} className="flex items-center justify-between rounded-lg border border-neutral-200 p-2.5">
                          <span className="text-neutral-600">{t.errorMessage || "生成失败"}</span>
                          <button
                            type="button"
                            onClick={() => void retryFailedTask(t)}
                            className="underline hover:text-neutral-950"
                          >
                            原输入重试
                          </button>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {!authError && (
        <div className="flex items-center justify-between border-t border-neutral-200 bg-neutral-50 px-5 py-3.5 text-xs">
          <div>
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((s) => (s === 3 ? 2 : 1))}
                className="rounded-lg border border-neutral-200 bg-white px-3.5 py-1.5 font-medium text-neutral-700 hover:bg-neutral-100"
              >
                上一步
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {step === 1 && (
              <button
                type="button"
                onClick={() => setStep(2)}
                className="rounded-lg bg-neutral-950 px-4 py-1.5 font-medium text-white hover:bg-neutral-800"
              >
                下一步：选择暂存版本
              </button>
            )}
            {step === 2 && (
              <button
                type="button"
                disabled={!selectedSnapshot}
                onClick={() => setStep(3)}
                className="rounded-lg bg-neutral-950 px-4 py-1.5 font-medium text-white hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-500"
              >
                下一步：确认并排版
              </button>
            )}
            {step === 3 && (
              <>
                {drafts.some((d) => d.snapshotId === selectedSnapshotId) && (
                  <button
                    type="button"
                    disabled={!selectedSnapshot || submitting || activeTask?.status === "running"}
                    onClick={() => void startGeneration(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3.5 py-1.5 font-medium text-neutral-800 hover:bg-neutral-100 disabled:opacity-50"
                  >
                    另建新排版稿（保留旧稿）
                  </button>
                )}
                <button
                  type="button"
                  disabled={!selectedSnapshot || submitting || activeTask?.status === "running"}
                  onClick={() => void startGeneration(false)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-950 px-4 py-1.5 font-medium text-white hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-500"
                >
                  {activeTask?.status === "running" ? (
                    <>
                      <LoaderCircle size={13} className="animate-spin" />
                      正在生成排版稿…
                    </>
                  ) : (
                    <>
                      <Sparkles size={13} />
                      应用模板并开始 Qwen 排版
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </dialog>
  );
}
