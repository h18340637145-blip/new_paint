"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background, BackgroundVariant, Controls, ReactFlow, type Node, type NodeChange, type XYPosition,
} from "@xyflow/react";
import { ArrowLeft, LoaderCircle, RotateCcw } from "lucide-react";
import { Composer, type ComposerInput } from "./composer";
import { studioRequest, submitGeneration, uploadReference } from "@/lib/studio/client";
import { configLabel, models } from "@/lib/studio/models";
import type { CanvasJob, CanvasSubmission, ImageAsset } from "@/lib/studio/types";

type StudioNode = Node<{ job: CanvasJob }, "image">;

const minWidth = 320;
const maxWidth = 620;
const clampWidth = (value: number) => Math.min(maxWidth, Math.max(minWidth, value));

function processing(job: CanvasJob) {
  return ["pending", "starting", "generating", "importing"].includes(job.status);
}

function nodeDimensions(aspectRatio: string) {
  const [w, h] = aspectRatio.split(":").map(Number);
  if (!w || !h) return { width: 300, height: 300 };
  return { width: Math.max(45, 320 * Math.min(1, w / h)), height: Math.max(45, 320 * Math.min(1, h / w)) };
}

function ImageNode({ data }: { data: StudioNode["data"] }) {
  const job = data.job;
  return (
    <div className="relative grid size-full place-items-center overflow-hidden rounded-lg border border-neutral-200 bg-neutral-200">
      {/* eslint-disable-next-line @next/next/no-img-element -- 画布显示短期签名图片地址。 */}
      {job.asset ? <img src={job.asset.url} alt="生成图片" draggable={false} className="size-full object-contain" /> : (
        <div className={`grid size-full place-items-center ${processing(job) ? "animate-pulse bg-gradient-to-r from-neutral-100 to-neutral-300" : ""}`}>
          <span className="rounded-full bg-neutral-700/90 px-3 py-1 text-xs text-white">
            {processing(job) ? "Generating" : job.status === "unknown" ? "待核对" : job.status === "succeeded" ? "图片暂不可用" : "生成失败"}
          </span>
        </div>
      )}
    </div>
  );
}

const nodeTypes = { image: ImageNode };

export function CanvasWorkspace({ project, initial }: {
  project: { id: string; title: string };
  initial: CanvasSubmission[];
}) {
  const [submissions, setSubmissions] = useState(initial);
  const [width, setWidth] = useState(420);
  const [selecting, setSelecting] = useState(false);
  const [asset, setAsset] = useState<ImageAsset | null>(null);
  const [positions, setPositions] = useState<Record<string, XYPosition>>({});
  const [error, setError] = useState("");
  const syncing = useRef<Promise<void> | null>(null);
  const draft = useRef<{ key: string; file: File | null; submissionId: string; assetId: string } | null>(null);
  const usedHeight = useRef(0);
  const history = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = Number(localStorage.getItem("studio-panel-width"));
    if (saved >= minWidth && saved <= maxWidth) setWidth(saved);
  }, []);

  useEffect(() => {
    if (history.current && usedHeight.current < submissions.length) {
      history.current.scrollTop = history.current.scrollHeight;
    }
    usedHeight.current = submissions.length;
  }, [submissions]);

  const sync = useCallback(async () => {
    if (!syncing.current) {
      syncing.current = studioRequest<{ submissions: CanvasSubmission[] }>({ action: "sync", projectId: project.id })
        .then(({ submissions }) => { setSubmissions(submissions); setError(""); })
        .catch((error: Error) => { setError(error.message); })
        .finally(() => { syncing.current = null; });
    }
    await syncing.current;
  }, [project.id]);

  const active = submissions.some((entry) => entry.jobs.some(processing));
  useEffect(() => {
    if (!active) return;
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    async function poll() {
      await sync();
      if (!stopped) timer = setTimeout(poll, 4000);
    }
    timer = setTimeout(poll, 900);
    return () => { stopped = true; clearTimeout(timer); };
  }, [active, sync]);

  const nodes = useMemo<StudioNode[]>(() => submissions.flatMap((entry) => entry.jobs.map((job) => ({
    id: job.id,
    type: "image",
    position: positions[job.id] ?? { x: job.x, y: job.y },
    style: nodeDimensions(entry.config.aspectRatio),
    data: { job },
  }))), [submissions, positions]);

  function moveNodes(changes: NodeChange<StudioNode>[]) {
    const changed = changes.filter((change) => change.type === "position");
    if (!changed.length) return;
    setPositions((previous) => {
      const next = { ...previous };
      for (const change of changed) if (change.position) next[change.id] = change.position;
      return next;
    });
  }

  async function send(input: ComposerInput) {
    const key = JSON.stringify([input.prompt, input.config, input.asset?.id]);
    if (draft.current?.key !== key || draft.current.file !== input.file) {
      draft.current = { key, file: input.file, submissionId: crypto.randomUUID(), assetId: crypto.randomUUID() };
    }
    const { submissionId, assetId } = draft.current;
    await submitGeneration(input, project.id, submissionId, assetId);
    draft.current = null;
    setSubmissions((previous) => previous.some((row) => row.id === submissionId) ? previous : [
      ...previous,
      {
        id: submissionId,
        prompt: input.prompt,
        config: input.config,
        reference: input.asset,
        jobs: Array.from({ length: input.config.count }, (_, slot) => ({
          id: `${submissionId}-${slot}`, slot, attempt: 1, status: "pending",
          error: null, asset: null, x: 80 + slot * 365, y: 80 + previous.length * 390,
        })),
      },
    ]);
  }

  async function retry(job: CanvasJob) {
    try {
      const { submissions } = await studioRequest<{ submissions: CanvasSubmission[] }>({
        action: "retry", projectId: project.id, jobId: job.id,
      });
      setSubmissions(submissions);
      setError("");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "重试失败。");
    }
  }

  function setPanelWidth(value: number) {
    const next = clampWidth(value);
    setWidth(next);
    localStorage.setItem("studio-panel-width", String(next));
  }

  return (
    <main className="flex h-dvh min-h-0 flex-col overflow-hidden bg-neutral-100 text-neutral-950 md:flex-row">
      <section aria-label="项目画布" className="relative min-h-0 flex-1">
        <ReactFlow<StudioNode> nodes={nodes} edges={[]} nodeTypes={nodeTypes} onNodesChange={moveNodes}
          nodesDraggable={!selecting} nodesConnectable={false} deleteKeyCode={null} minZoom={0.12} maxZoom={3}
          fitView={initial.length > 0} fitViewOptions={{ maxZoom: 1, padding: 0.2 }}
          onNodeClick={(_, node) => {
            if (!selecting || !node.data.job.asset) return;
            setAsset(node.data.job.asset);
            setSelecting(false);
          }}
          onNodeDragStop={(_, node) => {
            if (node.id.length !== 36) return;
            void studioRequest({ action: "position", projectId: project.id, jobId: node.id, ...node.position })
              .catch((failure: Error) => setError(failure.message));
          }}>
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#d4d4d4" />
          <Controls showInteractive={false} />
        </ReactFlow>
        <div className="absolute left-3 top-3 z-10 flex items-center gap-2 rounded-xl border border-neutral-200 bg-white p-1.5 pr-3 shadow-sm">
          <Link href="/projects" aria-label="返回项目列表" className="rounded-lg p-1.5 hover:bg-neutral-100"><ArrowLeft size={15} /></Link>
          <h1 className="max-w-64 truncate text-sm font-semibold">{project.title}</h1>
        </div>
        {!nodes.length && <p className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-neutral-500">输入你的想法开始创作</p>}
        {selecting && (
          <div className="absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-3 whitespace-nowrap rounded-full bg-neutral-950 px-4 py-2 text-xs text-white">
            请点击画布中的图片
            <button type="button" className="underline" onClick={() => setSelecting(false)}>取消</button>
          </div>
        )}
      </section>
      <div role="separator" aria-label="调整对话面板宽度" aria-orientation="vertical" aria-valuemin={minWidth}
        aria-valuemax={maxWidth} aria-valuenow={width} tabIndex={0}
        className="z-10 hidden w-2 shrink-0 cursor-col-resize touch-none border-l border-neutral-200 bg-white hover:bg-neutral-200 focus-visible:bg-neutral-300 md:block"
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            setPanelWidth(width + (event.key === "ArrowLeft" ? 16 : -16));
          }
        }}
        onPointerDown={(event) => event.currentTarget.setPointerCapture(event.pointerId)}
        onPointerMove={(event) => {
          if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
          setPanelWidth(window.innerWidth - event.clientX);
        }} />
      <aside aria-label="生图对话面板" style={{ "--panel-width": `${width}px` } as React.CSSProperties}
        className="flex h-[48dvh] min-h-0 w-full shrink-0 flex-col bg-white md:h-full md:w-[var(--panel-width)]">
        <header className="border-b border-neutral-100 px-4 py-3 text-sm font-semibold">
          {submissions.length ? "创作记录" : "新对话"}
        </header>
        <div ref={history} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {submissions.length === 0 ? (
            <div className="grid h-full place-items-center text-sm font-medium">开始创作</div>
          ) : (
            <div className="space-y-5">
              {submissions.map((entry) => (
                <article key={entry.id} className="space-y-2 text-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element -- 历史记录保留提交时的参考图。 */}
                  {entry.reference && <img src={entry.reference.url} alt="提交的参考图" className="size-10 rounded-lg object-cover" />}
                  <p className="whitespace-pre-wrap break-words">{entry.prompt}</p>
                  <div className="text-xs text-neutral-500">{models[entry.config.model]} · {configLabel(entry.config)}</div>
                  <div className="flex flex-wrap gap-2">
                    {entry.jobs.map((job) => (
                      <div key={job.id} className="flex min-h-16 w-20 flex-col items-start justify-center gap-1 rounded-lg bg-neutral-100 p-1.5 text-[11px]">
                        {job.asset ? (
                          /* eslint-disable-next-line @next/next/no-img-element -- 生成结果使用私有图片签名地址。 */
                          <img src={job.asset.url} alt={`生成结果 ${job.slot + 1}`} className="aspect-square w-full rounded-md object-cover" />
                        ) : processing(job) ? (
                          <><LoaderCircle size={15} className="animate-spin" />{job.status === "importing" ? "保存中" : "生成中"}</>
                        ) : (
                          <>
                            <span title={job.error ?? undefined}>{job.status === "unknown" ? "待核对" : job.status === "succeeded" ? "图片暂不可用" : "生成失败"}</span>
                            {job.status === "failed" && (
                              <button type="button" className="flex items-center gap-1 rounded py-0.5 underline" onClick={() => void retry(job)}>
                                <RotateCcw size={11} />重试
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                  {entry.jobs.some((job) => job.error) && (
                    <p className="text-xs text-amber-800">{entry.jobs.find((job) => job.error)?.error}</p>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
        <div className="px-2 pb-2">
          {error && <div role="alert" className="mb-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">{error}</div>}
          <Composer onSend={send} selecting={selecting} canvasAsset={asset} onClearCanvas={() => setAsset(null)}
            onUpload={async (file) => {
              setAsset(await uploadReference(file, project.id, crypto.randomUUID()));
              setSelecting(false);
            }}
            onPickCanvas={nodes.some((node) => node.data.job.asset) ? () => setSelecting(true) : undefined} />
        </div>
      </aside>
    </main>
  );
}
