"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  NodeResizer,
  Position,
  ReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type XYPosition,
} from "@xyflow/react";
import { ArrowLeft, ArrowRight, BookmarkCheck, Check, FilePlus2, Image as ImageIcon, LoaderCircle, Pencil, RotateCcw, Sparkles } from "lucide-react";
import { Composer, type ComposerInput, type StudioMode } from "./composer";
import { PENDING_AGENT_KICKOFF_KEY } from "./home";
import { AgentMessage } from "./agent-message";
import { ArticleTextNode, type ArticleTextNodeData } from "./article-text-node";
import { ArticleStagingDialog } from "./article-staging-dialog";
import {
  analyzeArticleGraph,
  type ArticleEdgeRecord,
  type ArticleGraphNode,
  type ArticleSnapshotRecord,
  type ArticleTextNodeRecord,
  type ArticleTextRole,
} from "@/lib/studio/article-graph";
import { sendAgentMessage } from "@/lib/studio/agent-client";
import type {
  CreativePlanProposal,
  StudioAgentTurn,
  StudioAttachment,
  StudioPlacedNode,
} from "@/lib/studio/agent-events";
import { studioRequest, submitGeneration, uploadReference } from "@/lib/studio/client";
import { configLabel, imageTypes, maxReferenceSize, models } from "@/lib/studio/models";
import type { CanvasJob, CanvasSubmission, ImageAsset } from "@/lib/studio/types";

async function normalizePastedImage(file: File): Promise<File> {
  const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  if (imageTypes.includes(file.type)) {
    const ext = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
    const safeName = file.name && /\.(jpe?g|png|webp)$/i.test(file.name)
      ? file.name
      : `pasted-${stamp}.${ext}`;
    return new File([file], safeName, { type: file.type });
  }

  const bitmapUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("无法解析剪贴板中的图片格式。"));
      el.src = bitmapUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("无法转换剪贴板图片。");
    ctx.drawImage(img, 0, 0);
    const pngBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!pngBlob) throw new Error("无法编码剪贴板图片。");
    return new File([pngBlob], `pasted-${stamp}.png`, { type: "image/png" });
  } finally {
    URL.revokeObjectURL(bitmapUrl);
  }
}

type NodeSize = { x: number; y: number; width: number };
type ImageNodeData = ({ job: CanvasJob } | { placed: StudioPlacedNode }) & {
  saveSize: (size: NodeSize) => void;
  articleConnectable?: boolean;
  articleBadge?: string;
  highlightedError?: boolean;
};

type StudioImageFlowNode = Node<ImageNodeData, "image">;
type StudioTextFlowNode = Node<ArticleTextNodeData, "articleText">;
type StudioFlowNode = StudioImageFlowNode | StudioTextFlowNode;

function nodeAsset(data: ImageNodeData) {
  return "placed" in data ? data.placed.asset : data.job.asset;
}

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

function ImageNode({ data, selected }: { data: ImageNodeData; selected?: boolean }) {
  const asset = nodeAsset(data);
  if (asset) {
    return (
      <div
        className={`relative rounded-lg transition-shadow ${
          data.highlightedError
            ? "ring-2 ring-red-600 ring-offset-2"
            : selected
              ? "ring-2 ring-[#164b3e] ring-offset-2 shadow-lg"
              : "shadow-sm"
        }`}
      >
        <NodeResizer
          isVisible={selected}
          keepAspectRatio
          minWidth={24}
          minHeight={1}
          maxWidth={4096}
          onResizeEnd={(_, size) => data.saveSize(size)}
        />
        {data.articleConnectable && (
          <>
            <Handle
              type="target"
              position={Position.Left}
              aria-label="连入图片节点"
              className="!size-3.5 !border-2 !border-white !bg-neutral-900"
            />
            <Handle
              type="source"
              position={Position.Right}
              aria-label="连出图片节点"
              className="!size-3.5 !border-2 !border-white !bg-neutral-900"
            />
          </>
        )}
        {data.articleBadge && (
          <span className="absolute -left-2.5 -top-2.5 z-10 inline-flex min-w-6 items-center justify-center rounded-full bg-neutral-950 px-2 py-0.5 text-[11px] font-bold text-white shadow">
            {data.articleBadge}
          </span>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element -- 画布素材使用私有签名 URL。 */}
        <img
          src={asset.url}
          alt={"placed" in data ? data.placed.asset.filename : "生成图片"}
          draggable={false}
          className="block h-auto w-full rounded-lg"
        />
      </div>
    );
  }
  if ("placed" in data) return null;
  const job = data.job;
  return (
    <div className="relative size-full rounded-lg">
      {data.articleConnectable && (
        <>
          <Handle
            type="target"
            position={Position.Left}
            aria-label="连入图片节点"
            className="!size-3.5 !border-2 !border-white !bg-neutral-900"
          />
          <Handle
            type="source"
            position={Position.Right}
            aria-label="连出图片节点"
            className="!size-3.5 !border-2 !border-white !bg-neutral-900"
          />
        </>
      )}
      {data.articleBadge && (
        <span className="absolute -left-2.5 -top-2.5 z-10 inline-flex min-w-6 items-center justify-center rounded-full bg-neutral-950 px-2 py-0.5 text-[11px] font-bold text-white shadow">
          {data.articleBadge}
        </span>
      )}
      <div className="grid size-full place-items-center overflow-hidden rounded-lg border border-neutral-200 bg-neutral-200">
        <div className={`grid size-full place-items-center ${processing(job) ? "animate-pulse bg-gradient-to-r from-neutral-100 to-neutral-300" : ""}`}>
          <span className="rounded-full bg-neutral-700/90 px-3 py-1 text-xs text-white">
            {processing(job) ? "生成中…" : job.status === "unknown" ? "待核对" : job.status === "succeeded" ? "图片暂不可用" : "生成失败"}
          </span>
        </div>
      </div>
    </div>
  );
}

const nodeTypes = {
  image: ImageNode,
  articleText: ArticleTextNode,
};

async function articleApi<T>(payload: Record<string, unknown>, init?: RequestInit): Promise<T> {
  const res = await fetch("/api/studio/article", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    ...init,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "文章编排操作失败。");
  return data as T;
}

export function CanvasWorkspace({
  project,
  initial,
  initialAgentTurns,
  initialPlacedNodes,
  initialTextNodes = [],
  initialArticleEdges = [],
  initialSnapshots = [],
}: {
  project: { id: string; title: string };
  initial: CanvasSubmission[];
  initialAgentTurns: StudioAgentTurn[];
  initialPlacedNodes: StudioPlacedNode[];
  initialTextNodes?: ArticleTextNodeRecord[];
  initialArticleEdges?: ArticleEdgeRecord[];
  initialSnapshots?: ArticleSnapshotRecord[];
}) {
  const router = useRouter();
  const [projectTitle, setProjectTitle] = useState(project.title);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(project.title);
  const [composerPreset, setComposerPreset] = useState<string | null>(null);
  const [autoStagingGo, setAutoStagingGo] = useState(false);
  const kickoffConsumedRef = useRef(false);

  const [submissions, setSubmissions] = useState(initial);
  const [agentTurns, setAgentTurns] = useState(initialAgentTurns);
  const [placedNodes, setPlacedNodes] = useState(initialPlacedNodes);
  const [textNodes, setTextNodes] = useState<ArticleTextNodeRecord[]>(initialTextNodes);
  const [articleEdges, setArticleEdges] = useState<ArticleEdgeRecord[]>(initialArticleEdges);
  const [snapshots, setSnapshots] = useState<ArticleSnapshotRecord[]>(initialSnapshots);
  const [canvasView, setCanvasView] = useState<"studio" | "article">(
    initialTextNodes.length > 0 || initialArticleEdges.length > 0 ? "article" : "studio",
  );
  const [selectedChainHeadId, setSelectedChainHeadId] = useState<string | null>(null);
  const [stagingOpen, setStagingOpen] = useState(false);
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([]);
  const [pastingImage, setPastingImage] = useState(false);

  const [attachments, setAttachments] = useState<StudioAttachment[]>([]);
  const [mode, setMode] = useState<StudioMode>(
    initialAgentTurns.length > 0 || (initial.length === 0 && initialPlacedNodes.length === 0) ? "agent" : "image",
  );
  const [width, setWidth] = useState(420);
  const [selecting, setSelecting] = useState(false);
  const [asset, setAsset] = useState<ImageAsset | null>(null);
  const [positions, setPositions] = useState<Record<string, XYPosition>>({});
  const [nodeWidths, setNodeWidths] = useState<Record<string, number>>({});
  const [measurements, setMeasurements] = useState<Record<string, { width: number; height: number }>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const regenerationDraft = useRef<{ source: string; id: string } | null>(null);
  const copied = useRef<{ assetId: string; width: number; x: number; y: number }[]>([]);
  const [error, setError] = useState("");
  const syncing = useRef<Promise<void> | null>(null);
  const draft = useRef<{ key: string; file: File | null; submissionId: string; assetId: string } | null>(null);
  const usedHeight = useRef(0);
  const history = useRef<HTMLDivElement>(null);
  const textNodesRef = useRef(textNodes);
  textNodesRef.current = textNodes;

  useEffect(() => {
    const saved = Number(localStorage.getItem("studio-panel-width"));
    if (saved >= minWidth && saved <= maxWidth) setWidth(saved);
  }, []);

  useEffect(() => {
    const count = submissions.length + agentTurns.length;
    if (history.current && (usedHeight.current < count || agentTurns.at(-1)?.status === "running")) {
      history.current.scrollTop = history.current.scrollHeight;
    }
    usedHeight.current = count;
  }, [submissions, agentTurns]);

  const sync = useCallback(async () => {
    if (!syncing.current) {
      syncing.current = studioRequest<{
        submissions: CanvasSubmission[];
        placedNodes: StudioPlacedNode[];
        textNodes?: ArticleTextNodeRecord[];
        articleEdges?: ArticleEdgeRecord[];
      }>({
        action: "sync",
        projectId: project.id,
      })
        .then(({ submissions, placedNodes, textNodes: syncedTexts, articleEdges: syncedEdges }) => {
          setSubmissions(submissions);
          setPlacedNodes(placedNodes);
          if (syncedTexts) setTextNodes(syncedTexts);
          if (syncedEdges) setArticleEdges(syncedEdges);
          setError("");
        })
        .catch((error: Error) => {
          setError(error.message);
        })
        .finally(() => {
          syncing.current = null;
        });
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
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [active, sync]);

  const saveNodePosition = useCallback(
    (id: string, placed: boolean, position: XYPosition & { width?: number }) => {
      if (id.length !== 36) return;
      void studioRequest({ action: "position", projectId: project.id, jobId: id, placed, ...position }, { keepalive: true })
        .catch((failure: Error) => setError(failure.message));
    },
    [project.id],
  );

  // Build unified graph nodes for Article Mode validation & order badges
  const graphNodes = useMemo<ArticleGraphNode[]>(() => {
    const list: ArticleGraphNode[] = [];
    for (const t of textNodes) {
      list.push({
        nodeId: t.id,
        kind: "text",
        role: t.role,
        text: t.content,
      });
    }
    for (const entry of submissions) {
      for (const job of entry.jobs) {
        if (job.canvasHidden) continue;
        if (job.status === "succeeded" && job.asset) {
          list.push({
            nodeId: job.id,
            kind: "image",
            assetId: job.asset.id,
            assetKind: "generated",
            imageUrl: job.asset.url,
            filename: "生成图片",
          });
        } else if (processing(job)) {
          list.push({
            nodeId: job.id,
            kind: "image",
            assetKind: "generated",
            filename: "配图生成中…",
            pending: true,
          });
        }
      }
    }
    for (const placed of placedNodes) {
      list.push({
        nodeId: placed.id,
        kind: "image",
        assetId: placed.asset.id,
        assetKind: "reference",
        imageUrl: placed.asset.url,
        filename: placed.asset.filename,
      });
    }
    return list;
  }, [textNodes, submissions, placedNodes]);

  const graphAnalysis = useMemo(
    () => analyzeArticleGraph(graphNodes, articleEdges, selectedChainHeadId),
    [graphNodes, articleEdges, selectedChainHeadId],
  );

  const commitTextNode = useCallback(
    (id: string, override?: Partial<ArticleTextNodeRecord> | string) => {
      const target = textNodesRef.current.find((n) => n.id === id);
      if (!target) return;
      const patch = typeof override === "string" ? { content: override } : override;
      const merged = { ...target, ...patch };
      const pos = positions[id] ?? { x: merged.x, y: merged.y };
      const w = nodeWidths[id] ?? merged.width;
      void articleApi({
        action: "upsert-text-node",
        projectId: project.id,
        nodeId: id,
        content: merged.content,
        role: merged.role,
        x: pos.x,
        y: pos.y,
        width: w,
      }).catch((err: Error) => setError(err.message));
    },
    [project.id, positions, nodeWidths],
  );

  const handleTextNodeChange = useCallback(
    (id: string, patch: { content?: string; role?: ArticleTextRole }) => {
      setTextNodes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
      if (patch.role) {
        commitTextNode(id, patch);
      }
    },
    [commitTextNode],
  );

  const handleDeleteTextNode = useCallback(
    (id: string) => {
      setTextNodes((prev) => prev.filter((n) => n.id !== id));
      setArticleEdges((prev) => prev.filter((e) => e.source !== id && e.target !== id));
      void articleApi({ action: "delete-text-node", projectId: project.id, nodeId: id }).catch((err: Error) =>
        setError(err.message),
      );
    },
    [project.id],
  );

  const handleResizeTextNode = useCallback(
    (id: string, size: { x: number; y: number; width: number }) => {
      setPositions((prev) => ({ ...prev, [id]: { x: size.x, y: size.y } }));
      setNodeWidths((prev) => ({ ...prev, [id]: size.width }));
      void articleApi(
        { action: "update-text-node-position", projectId: project.id, nodeId: id, ...size },
        { keepalive: true },
      ).catch((err: Error) => setError(err.message));
    },
    [project.id],
  );

  async function addArticleTextNode() {
    const id = crypto.randomUUID();
    const index = textNodes.length;
    const x = 100 + (index % 3) * 320;
    const y = 100 + Math.floor(index / 3) * 240;
    const now = new Date().toISOString();
    const record: ArticleTextNodeRecord = {
      id,
      content: "",
      role: "material",
      x,
      y,
      width: 280,
      createdAt: now,
      updatedAt: now,
    };
    setTextNodes((prev) => [...prev, record]);
    try {
      await articleApi({
        action: "upsert-text-node",
        projectId: project.id,
        nodeId: id,
        content: "",
        role: "material",
        x,
        y,
        width: 280,
      });
      setError("");
    } catch (err) {
      setTextNodes((prev) => prev.filter((n) => n.id !== id));
      setError(err instanceof Error ? err.message : "添加文本节点失败。");
    }
  }

  const handleConnect = useCallback(
    async (conn: Connection) => {
      if (canvasView !== "article" || !conn.source || !conn.target || conn.source === conn.target) return;
      if (articleEdges.some((e) => e.source === conn.source && e.target === conn.target)) return;
      const tempId = crypto.randomUUID();
      setArticleEdges((prev) => [...prev, { id: tempId, source: conn.source, target: conn.target }]);
      try {
        const { edge } = await articleApi<{ edge: ArticleEdgeRecord }>({
          action: "add-edge",
          projectId: project.id,
          source: conn.source,
          target: conn.target,
        });
        setArticleEdges((prev) => prev.map((e) => (e.id === tempId ? edge : e)));
        setError("");
      } catch (err) {
        setArticleEdges((prev) => prev.filter((e) => e.id !== tempId));
        setError(err instanceof Error ? err.message : "添加连线失败。");
      }
    },
    [canvasView, articleEdges, project.id],
  );

  const deleteEdgeById = useCallback(
    (edgeId: string) => {
      setArticleEdges((prev) => prev.filter((e) => e.id !== edgeId));
      setSelectedEdgeIds((prev) => prev.filter((id) => id !== edgeId));
      void articleApi({ action: "delete-edge", projectId: project.id, edgeId }).catch((err: Error) =>
        setError(err.message),
      );
    },
    [project.id],
  );

  const isArticleMode = canvasView === "article";
  const problemSet = useMemo(() => new Set(graphAnalysis.problemNodeIds), [graphAnalysis.problemNodeIds]);

  const nodes = useMemo<StudioFlowNode[]>(() => {
    const imageNodes: StudioImageFlowNode[] = [
      ...submissions.flatMap((entry) =>
        entry.jobs
          .filter((job) => !job.canvasHidden)
          .map((job): StudioImageFlowNode => ({
            id: job.id,
            type: "image",
            position: positions[job.id] ?? { x: job.x, y: job.y },
            selected: selectedIds.includes(job.id),
            measured: measurements[job.id],
            style: job.asset
              ? { width: nodeWidths[job.id] ?? job.canvasWidth ?? nodeDimensions(entry.config.aspectRatio).width }
              : nodeDimensions(entry.config.aspectRatio),
            data: {
              job,
              saveSize: (size) => saveNodePosition(job.id, false, size),
              articleConnectable: isArticleMode && (!!job.asset || processing(job)),
              articleBadge: isArticleMode ? graphAnalysis.badges[job.id] : undefined,
              highlightedError: isArticleMode && problemSet.has(job.id),
            },
          })),
      ),
      ...placedNodes.map((placed): StudioImageFlowNode => ({
        id: placed.id,
        type: "image",
        data: {
          placed,
          saveSize: (size) => saveNodePosition(placed.id, true, size),
          articleConnectable: isArticleMode,
          articleBadge: isArticleMode ? graphAnalysis.badges[placed.id] : undefined,
          highlightedError: isArticleMode && problemSet.has(placed.id),
        },
        selected: selectedIds.includes(placed.id),
        measured: measurements[placed.id],
        position: positions[placed.id] ?? { x: placed.x, y: placed.y },
        style: { width: nodeWidths[placed.id] ?? placed.width ?? 320 },
      })),
    ];

    if (!isArticleMode) return imageNodes;

    const articleFlowNodes: StudioTextFlowNode[] = textNodes.map((t) => ({
      id: t.id,
      type: "articleText",
      position: positions[t.id] ?? { x: t.x, y: t.y },
      selected: selectedIds.includes(t.id),
      measured: measurements[t.id],
      style: { width: nodeWidths[t.id] ?? t.width ?? 280 },
      data: {
        node: t,
        badge: graphAnalysis.badges[t.id],
        connectable: true,
        highlightedError: problemSet.has(t.id),
        onChange: handleTextNodeChange,
        onCommit: commitTextNode,
        onResizeEnd: handleResizeTextNode,
        onDelete: handleDeleteTextNode,
      },
    }));

    return [...imageNodes, ...articleFlowNodes];
  }, [
    submissions,
    placedNodes,
    textNodes,
    positions,
    nodeWidths,
    measurements,
    selectedIds,
    isArticleMode,
    graphAnalysis.badges,
    problemSet,
    saveNodePosition,
    handleTextNodeChange,
    commitTextNode,
    handleResizeTextNode,
    handleDeleteTextNode,
  ]);

  const flowEdges = useMemo<Edge[]>(() => {
    if (!isArticleMode) return [];
    return articleEdges.map((e) => {
      const selected = selectedEdgeIds.includes(e.id);
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        selected,
        animated: false,
        style: {
          stroke: selected ? "#c2410c" : "#164b3e",
          strokeWidth: selected ? 3.2 : 2.5,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: selected ? "#c2410c" : "#164b3e",
        },
      };
    });
  }, [isArticleMode, articleEdges, selectedEdgeIds]);

  function handleEdgesChange(changes: EdgeChange<Edge>[]) {
    for (const change of changes) {
      if (change.type === "select") {
        setSelectedEdgeIds((prev) =>
          change.selected ? [...new Set([...prev, change.id])] : prev.filter((id) => id !== change.id),
        );
      } else if (change.type === "remove") {
        deleteEdgeById(change.id);
      }
    }
  }

  function moveNodes(changes: NodeChange<StudioFlowNode>[]) {
    const changed = changes.filter((change) => change.type === "position");
    if (changed.length)
      setPositions((previous) => {
        const next = { ...previous };
        for (const change of changed) if (change.position) next[change.id] = change.position;
        return next;
      });
    const widths = changes.filter((change) => change.type === "dimensions" && change.resizing !== undefined);
    const measured = changes.filter((change) => change.type === "dimensions");
    if (measured.length)
      setMeasurements((previous) => {
        let next = previous;
        for (const item of measured) {
          const size = item.dimensions;
          if (!size || (next[item.id]?.width === size.width && next[item.id]?.height === size.height)) continue;
          if (next === previous) next = { ...previous };
          next[item.id] = size;
        }
        return next;
      });
    if (widths.length)
      setNodeWidths((previous) => {
        const next = { ...previous };
        for (const change of widths)
          if (change.type === "dimensions" && change.dimensions) next[change.id] = change.dimensions.width;
        return next;
      });
    const selection = changes.filter((change) => change.type === "select");
    if (selection.length)
      setSelectedIds((previous) => {
        const next = new Set(previous);
        for (const item of selection) if (item.selected) next.add(item.id); else next.delete(item.id);
        return [...next];
      });
  }

  useEffect(() => {
    async function handleWindowPaste(event: ClipboardEvent) {
      const items = Array.from(event.clipboardData?.items ?? []);
      const imageFiles = items
        .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
        .map((item) => item.getAsFile())
        .filter((f): f is File => f !== null);

      if (imageFiles.length === 0) return;
      event.preventDefault();
      setPastingImage(true);
      setError("");
      try {
        for (const rawFile of imageFiles) {
          const normalized = await normalizePastedImage(rawFile);
          if (!normalized.size || normalized.size > maxReferenceSize) {
            throw new Error("粘贴的图片不能超过 10 MB。");
          }
          await uploadReference(normalized, project.id, crypto.randomUUID(), false, true);
        }
        await sync();
      } catch (err) {
        setError(err instanceof Error ? err.message : "粘贴图片上传失败，请重试。");
      } finally {
        setPastingImage(false);
      }
    }

    window.addEventListener("paste", handleWindowPaste);
    return () => window.removeEventListener("paste", handleWindowPaste);
  }, [project.id, sync]);

  function canvasKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    const target = event.target;
    if (target instanceof Element && target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])")) return;
    const key = event.key.toLowerCase();

    if ((key === "delete" || key === "backspace") && isArticleMode && selectedEdgeIds.length > 0) {
      event.preventDefault();
      for (const edgeId of selectedEdgeIds) deleteEdgeById(edgeId);
      return;
    }

    const selectedText = nodes.filter(
      (node): node is StudioTextFlowNode => Boolean(node.selected) && node.type === "articleText",
    );
    if ((key === "delete" || key === "backspace") && selectedText.length > 0) {
      event.preventDefault();
      for (const tNode of selectedText) handleDeleteTextNode(tNode.id);
      return;
    }

    const selectedImages = nodes.filter(
      (node): node is StudioImageFlowNode =>
        Boolean(node.selected) && node.type === "image" && !!nodeAsset(node.data),
    );
    let requests: Record<string, unknown>[] = [];
    if (key === "delete" || key === "backspace") {
      requests = selectedImages.map((node) => ({
        action: "remove-node",
        nodeId: node.id,
        placed: "placed" in node.data,
      }));
    } else if ((event.metaKey || event.ctrlKey) && key === "c" && selectedImages.length) {
      copied.current = selectedImages.map((node) => ({
        assetId: nodeAsset(node.data)!.id,
        width: Number(node.style?.width) || 320,
        ...node.position,
      }));
      event.preventDefault();
    } else if ((event.metaKey || event.ctrlKey) && key === "v" && copied.current.length) {
      requests = copied.current.map(({ x, y, ...item }) => ({
        action: "duplicate-node",
        ...item,
        x: x + 24,
        y: y + 24,
      }));
    }
    if (!requests.length) return;
    event.preventDefault();
    void Promise.all(
      requests.map((request) => studioRequest({ ...request, projectId: project.id }, { keepalive: true })),
    )
      .then(sync)
      .catch((failure: Error) => setError(failure.message));
  }

  const agentRunning = agentTurns.some((t) => t.status === "running");

  const proposalStatus = useMemo(() => {
    const executedIds = new Set<string>();
    const proposalTurnIds: string[] = [];

    for (let i = 0; i < agentTurns.length; i += 1) {
      const turn = agentTurns[i];
      const hasProposal = turn.events.some(
        (ev) => ev.type === "tool-start" && ev.name === "propose_creative_plan",
      );
      if (hasProposal && turn.status === "complete") {
        proposalTurnIds.push(turn.id);
      }
      const hasCompose = turn.events.some(
        (ev) => ev.type === "tool-start" && ev.name === "compose_canvas_flow",
      );
      if (hasCompose) {
        const composeCallIds = new Set(
          turn.events
            .filter((ev) => ev.type === "tool-start" && ev.name === "compose_canvas_flow")
            .map((ev) => (ev.type === "tool-start" ? ev.id : "")),
        );
        const composeSucceeded = turn.events.some(
          (ev) => ev.type === "tool-end" && !ev.failed && composeCallIds.has(ev.id),
        );
        if (composeSucceeded) {
          for (const prevId of proposalTurnIds) {
            executedIds.add(prevId);
          }
        }
      }
    }

    const unexecuted = proposalTurnIds.filter((pid) => !executedIds.has(pid));
    const latestPendingId = unexecuted[unexecuted.length - 1] ?? null;
    return { executedIds, latestPendingId };
  }, [agentTurns]);

  async function runAgentTurn(
    promptText: string,
    turnAttachments: StudioAttachment[] = [],
    skill?: { id: string; name: string } | null,
  ) {
    let id = crypto.randomUUID();
    const graphMutatingNames = new Set([
      "compose_canvas_flow",
      "upsert_text_node",
      "connect_canvas_nodes",
    ]);
    const graphCallIds = new Set<string>();

    setAgentTurns((previous) => [
      ...previous,
      {
        id,
        prompt: promptText,
        attachments: turnAttachments,
        skillName: skill?.name,
        status: "running",
        events: [],
        createdAt: new Date().toISOString(),
      },
    ]);
    try {
      await sendAgentMessage(
        project.id,
        promptText,
        turnAttachments.map((item) => item.id),
        skill?.id ?? null,
        (event) => {
          const target = id;
          if (event.type === "start") id = event.id;
          if (event.type === "tool-start" && graphMutatingNames.has(event.name)) {
            graphCallIds.add(event.id);
          }
          setAgentTurns((previous) =>
            previous.map((turn) => {
              if (turn.id !== target) return turn;
              if (event.type === "start")
                return {
                  ...turn,
                  id: event.id,
                  prompt: event.prompt,
                  attachments: event.attachments,
                  createdAt: event.createdAt,
                  skillName: event.skillName,
                };
              if (event.type === "done")
                return { ...turn, status: turn.status === "failed" ? "failed" : "complete" };
              return {
                ...turn,
                status: event.type === "error" ? "failed" : turn.status,
                events: [...turn.events, event],
              };
            }),
          );
          if (event.type === "tool-end" && !event.failed) {
            if (graphCallIds.has(event.id)) {
              setCanvasView("article");
            }
            void sync();
          }
        },
      );
    } catch (failure) {
      const text = failure instanceof Error ? failure.message : "Agent 请求失败。";
      setAgentTurns((previous) =>
        previous.map((turn) =>
          turn.id === id
            ? { ...turn, status: "failed", events: [...turn.events, { type: "error", text }] }
            : turn,
        ),
      );
    } finally {
      await sync();
    }
  }

  function handleConfirmProposal(proposal: CreativePlanProposal) {
    if (agentRunning) return;
    setMode("agent");
    void runAgentTurn(
      `我认同方案「${proposal.title}」，请按该分镜方案在画布中自动生成完整文案节点与配图（配图使用 ${proposal.recommendedModel}），并按顺序自动连线。`,
    );
  }

  async function send(input: ComposerInput) {
    if (mode === "agent") {
      await runAgentTurn(input.prompt, input.attachments ?? [], input.skill);
      return;
    }
    const key = JSON.stringify([input.prompt, input.config, input.asset?.id]);
    if (draft.current?.key !== key || draft.current.file !== input.file) {
      draft.current = { key, file: input.file, submissionId: crypto.randomUUID(), assetId: crypto.randomUUID() };
    }
    const { submissionId, assetId } = draft.current;
    await submitGeneration(input, project.id, submissionId, assetId);
    draft.current = null;
    setSubmissions((previous) =>
      previous.some((row) => row.id === submissionId)
        ? previous
        : [
            ...previous,
            {
              id: submissionId,
              createdAt: new Date().toISOString(),
              prompt: input.prompt,
              config: input.config,
              reference: input.asset,
              jobs: Array.from({ length: input.config.count }, (_, slot) => ({
                id: `${submissionId}-${slot}`,
                slot,
                attempt: 1,
                status: "pending",
                error: null,
                asset: null,
                x: 80 + slot * 365,
                y: 80 + previous.length * 390,
              })),
            },
          ],
    );
  }

  async function retry(job: CanvasJob) {
    try {
      const { submissions } = await studioRequest<{ submissions: CanvasSubmission[] }>({
        action: "retry",
        projectId: project.id,
        jobId: job.id,
      });
      setSubmissions(submissions);
      setError("");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "重试失败。");
    }
  }

  async function regenerate(entry: CanvasSubmission) {
    if (regenerating) return;
    if (regenerationDraft.current?.source !== entry.id) {
      regenerationDraft.current = { source: entry.id, id: crypto.randomUUID() };
    }
    setRegenerating(entry.id);
    try {
      await studioRequest({
        action: "regenerate",
        projectId: project.id,
        submissionId: entry.id,
        newId: regenerationDraft.current.id,
      });
      regenerationDraft.current = null;
      await sync();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "重新生成失败。");
    } finally {
      setRegenerating(null);
    }
  }

  function setPanelWidth(value: number) {
    const next = clampWidth(value);
    setWidth(next);
    localStorage.setItem("studio-panel-width", String(next));
  }

  async function handleStageSnapshot(headId: string | null) {
    const { snapshot } = await articleApi<{ snapshot: ArticleSnapshotRecord }>({
      action: "stage-snapshot",
      projectId: project.id,
      selectedChainHeadId: headId,
    });
    setSnapshots((prev) => [snapshot, ...prev.filter((s) => s.id !== snapshot.id)]);
    return snapshot;
  }

  async function saveProjectRename() {
    const trimmed = titleDraft.trim();
    setEditingTitle(false);
    if (!trimmed || trimmed === projectTitle) {
      setTitleDraft(projectTitle);
      return;
    }
    const prev = projectTitle;
    setProjectTitle(trimmed);
    try {
      const res = await studioRequest<{ id: string; title: string }>({
        action: "rename-project",
        projectId: project.id,
        title: trimmed,
      });
      setProjectTitle(res.title);
      setTitleDraft(res.title);
    } catch (err) {
      setProjectTitle(prev);
      setTitleDraft(prev);
      setError(err instanceof Error ? err.message : "重命名项目失败。");
    }
  }

  async function handleQuickGoTypography() {
    if (autoStagingGo) return;
    if (graphAnalysis.status === "ok" && !graphAnalysis.needsChainSelection && graphAnalysis.activeChain.length > 0) {
      setAutoStagingGo(true);
      setError("");
      try {
        const snap = await handleStageSnapshot(graphAnalysis.selectedChainHeadId);
        router.push(`/typography?projectId=${project.id}&snapshotId=${snap.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "自动暂存失败，请点击「核对并暂存」检查连线。");
      } finally {
        setAutoStagingGo(false);
      }
      return;
    }
    if (isArticleMode && graphNodes.length > 0 && snapshots.length === 0) {
      setStagingOpen(true);
      return;
    }
    const latestSnap = snapshots[0]?.id;
    router.push(
      latestSnap
        ? `/typography?projectId=${project.id}&snapshotId=${latestSnap}`
        : `/typography?projectId=${project.id}`,
    );
  }

  // 承接从创作首页带过来的首次 AI 共创提问
  useEffect(() => {
    if (kickoffConsumedRef.current) return;
    try {
      const raw = window.sessionStorage.getItem(PENDING_AGENT_KICKOFF_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        projectId?: string;
        prompt?: string;
        attachments?: StudioAttachment[];
      };
      if (parsed.projectId !== project.id || !parsed.prompt) return;
      kickoffConsumedRef.current = true;
      window.sessionStorage.removeItem(PENDING_AGENT_KICKOFF_KEY);
      setMode("agent");
      void runAgentTurn(parsed.prompt, Array.isArray(parsed.attachments) ? parsed.attachments : []);
    } catch {
      // 忽略缓存解析异常
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  const entries = [
    ...submissions.map((entry) => ({ kind: "image" as const, entry })),
    ...agentTurns.map((entry) => ({ kind: "agent" as const, entry })),
  ].sort((a, b) => a.entry.createdAt.localeCompare(b.entry.createdAt));

  return (
    <main className="canvas-surface landing-motion flex h-dvh min-h-0 flex-col overflow-hidden bg-neutral-100 text-neutral-950 md:flex-row">
      <section aria-label="项目画布" onKeyDown={canvasKeyDown} className="relative min-h-0 flex-1">
        <ReactFlow<StudioFlowNode>
          nodes={nodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          onNodesChange={moveNodes}
          onEdgesChange={handleEdgesChange}
          onConnect={(conn) => void handleConnect(conn)}
          nodesDraggable={!selecting}
          nodesConnectable={isArticleMode}
          deleteKeyCode={null}
          minZoom={0.12}
          maxZoom={3}
          fitView={initial.length > 0 || initialPlacedNodes.length > 0 || initialTextNodes.length > 0}
          fitViewOptions={{ maxZoom: 1, padding: 0.2 }}
          onNodeClick={(_, node) => {
            if (node.type !== "image") return;
            const image = nodeAsset(node.data);
            if (!image || (!selecting && mode !== "agent") || active) return;
            if (mode === "agent") {
              const attachment: StudioAttachment =
                "placed" in node.data ? node.data.placed.asset : { ...image, kind: "generated", filename: "画布图片" };
              setAttachments((previous) =>
                previous.some((item) => item.id === image.id) || previous.length >= 16
                  ? previous
                  : [...previous, attachment],
              );
            } else {
              setAsset(image);
            }
            setSelecting(false);
          }}
          onNodeDragStop={(_, node) => {
            if (node.type === "articleText") {
              void articleApi(
                {
                  action: "update-text-node-position",
                  projectId: project.id,
                  nodeId: node.id,
                  x: node.position.x,
                  y: node.position.y,
                },
                { keepalive: true },
              ).catch((err: Error) => setError(err.message));
              return;
            }
            saveNodePosition(node.id, "placed" in node.data, node.position);
          }}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1.25} color="#8fa4b8" />
          <Controls showInteractive={false} />
        </ReactFlow>

        <div className="canvas-project-label absolute left-3 top-3 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-neutral-200/90 bg-white/95 p-1.5 pr-2.5 shadow-md backdrop-blur">
          <Link
            href="/projects"
            title="返回项目库"
            aria-label="返回项目列表"
            className="inline-flex size-8 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950"
          >
            <ArrowLeft size={16} />
          </Link>

          {editingTitle ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                aria-label="修改项目名称"
                autoFocus
                maxLength={80}
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={() => void saveProjectRename()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void saveProjectRename();
                  } else if (e.key === "Escape") {
                    setTitleDraft(projectTitle);
                    setEditingTitle(false);
                  }
                }}
                className="w-40 rounded-lg border border-[#164b3e] bg-white px-2 py-1 text-xs font-semibold text-neutral-950 focus:outline-none sm:w-52"
              />
              <button
                type="button"
                aria-label="保存项目名称"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void saveProjectRename()}
                className="inline-flex size-7 items-center justify-center rounded-md bg-[#164b3e] text-white"
              >
                <Check size={13} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              title="点击修改项目名称"
              onClick={() => {
                setTitleDraft(projectTitle);
                setEditingTitle(true);
              }}
              className="group inline-flex max-w-48 items-center gap-1.5 rounded-lg px-2 py-1 text-left text-sm font-semibold text-neutral-950 hover:bg-neutral-100"
            >
              <span className="truncate">{projectTitle}</span>
              <Pencil size={12} className="shrink-0 text-neutral-400 opacity-70 group-hover:text-neutral-700 group-hover:opacity-100" aria-hidden="true" />
            </button>
          )}

          <div className="inline-flex rounded-lg border border-neutral-200 bg-neutral-100 p-0.5 text-xs" role="group" aria-label="画布模式">
            <button
              type="button"
              onClick={() => setCanvasView("studio")}
              className={`min-h-8 rounded-md px-2.5 py-1 font-semibold transition ${
                canvasView === "studio" ? "bg-white text-neutral-950 shadow-xs" : "text-neutral-600 hover:text-neutral-950"
              }`}
            >
              自由画布
            </button>
            <button
              type="button"
              onClick={() => setCanvasView("article")}
              className={`min-h-8 rounded-md px-2.5 py-1 font-semibold transition ${
                canvasView === "article" ? "bg-[#164b3e] text-white shadow-xs" : "text-neutral-600 hover:text-neutral-950"
              }`}
            >
              文章连线
            </button>
          </div>
        </div>

        <div className="absolute right-3 top-3 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-neutral-200/90 bg-white/95 p-1.5 shadow-md backdrop-blur">
          {isArticleMode && (
            <>
              <button
                type="button"
                onClick={() => void addArticleTextNode()}
                className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
              >
                <FilePlus2 size={14} />
                添加文本
              </button>

              {selectedEdgeIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => selectedEdgeIds.forEach(deleteEdgeById)}
                  className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                >
                  删除连线
                </button>
              )}

              <button
                type="button"
                onClick={() => setStagingOpen(true)}
                className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
              >
                <BookmarkCheck size={14} />
                核对暂存
                {snapshots.length > 0 && (
                  <span className="rounded-full bg-emerald-100 px-1.5 text-[10px] font-bold text-[#164b3e]">
                    v{snapshots[0].versionNumber}
                  </span>
                )}
              </button>
            </>
          )}

          <button
            type="button"
            disabled={autoStagingGo}
            onClick={() => void handleQuickGoTypography()}
            className="inline-flex min-h-8 items-center gap-1 rounded-lg bg-[#164b3e] px-3 py-1 text-xs font-semibold text-white shadow-xs hover:bg-[#123d32] disabled:opacity-60"
          >
            <span>{autoStagingGo ? "正在同步…" : "去公众号排版"}</span>
            <ArrowRight size={13} />
          </button>
        </div>

        {!nodes.length && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center p-6 text-center">
            <div className="max-w-sm space-y-1.5 rounded-2xl border border-neutral-200/70 bg-white/80 px-5 py-4 shadow-xs backdrop-blur-xs">
              <p className="text-sm font-semibold text-neutral-800">
                {isArticleMode ? "从添加文案或配图开始串联文章" : "画布已就绪，随时放置灵感与配图"}
              </p>
              <p className="text-xs leading-relaxed text-neutral-500">
                {isArticleMode
                  ? "点击右上角「添加文本」，或在右侧让 AI 自动规划图文并连好顺序；也支持直接按 Ctrl+V / ⌘V 粘贴截图上画布。"
                  : "可在右侧与 AI 聊选题自动铺画布、生成单张配图，或直接按 Ctrl+V / ⌘V 粘贴本地图片。"}
              </p>
            </div>
          </div>
        )}
        {selecting && (
          <div className="absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-3 whitespace-nowrap rounded-full bg-neutral-950 px-4 py-2 text-xs text-white">
            请点击画布中的图片
            <button type="button" className="underline" onClick={() => setSelecting(false)}>
              取消
            </button>
          </div>
        )}
        {pastingImage && (
          <div
            role="status"
            className="absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-neutral-950 px-4 py-2 text-xs text-white shadow-lg"
          >
            <LoaderCircle size={13} className="animate-spin" />
            正在将粘贴的图片存入素材库并放入画布…
          </div>
        )}
      </section>

      <div
        role="separator"
        aria-label="调整对话面板宽度"
        aria-orientation="vertical"
        aria-valuemin={minWidth}
        aria-valuemax={maxWidth}
        aria-valuenow={width}
        tabIndex={0}
        className="z-10 hidden w-2.5 shrink-0 cursor-col-resize touch-none items-center justify-center border-x border-neutral-300 bg-neutral-200/80 transition hover:bg-neutral-300 focus-visible:bg-[#164b3e]/20 md:flex"
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
        }}
      >
        <span aria-hidden="true" className="h-10 w-0.5 rounded-full bg-neutral-500" />
      </div>

      <aside
        aria-label="生图对话面板"
        style={{ "--panel-width": `${width}px` } as React.CSSProperties}
        className="flex h-[48dvh] min-h-0 w-full shrink-0 flex-col border-t border-neutral-300 bg-white shadow-sm md:h-full md:w-[var(--panel-width)] md:border-t-0"
      >
        <header className="canvas-chat-header flex items-center justify-between border-b px-4 py-3 text-sm font-semibold">
          <span>{entries.length ? "创作对话与记录" : "创作助手"}</span>
          <span className="text-xs font-normal text-neutral-500">
            {mode === "agent" ? "AI 图文共创" : "单图生成"}
          </span>
        </header>
        <div ref={history} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {entries.length === 0 ? (
            <div className="flex h-full flex-col justify-center gap-4 py-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-neutral-900">三步完成一篇公众号好图文</p>
                <p className="text-xs leading-relaxed text-neutral-500">
                  不用纠结先写字还是先找图，直接把想法发在下方输入框即可。
                </p>
              </div>

              <div className="space-y-2 text-xs">
                <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/80 p-3">
                  <div className="font-semibold text-neutral-900">1. 聊选题、出图文分镜</div>
                  <p className="mt-0.5 text-neutral-600">用「AI 图文共创」模式商量结构，满意后一键铺好文案节点与配图并连好顺序。</p>
                </div>
                <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/80 p-3">
                  <div className="font-semibold text-neutral-900">2. 补充单图或粘贴截图</div>
                  <p className="mt-0.5 text-neutral-600">切到「单图生成」单独补图，或在画布任意位置按 Ctrl+V / ⌘V 粘贴参考图。</p>
                </div>
                <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/80 p-3">
                  <div className="font-semibold text-neutral-900">3. 一键送去公众号排版</div>
                  <p className="mt-0.5 text-neutral-600">点击画布右上角「去公众号排版」，套用模板与秀米素材直接复制发布。</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setMode("agent");
                    setComposerPreset("帮我策划一篇周末城市漫步主题的公众号推文，包含导语、两段正文和 2 张纪实感配图。");
                  }}
                  className="inline-flex items-center gap-1 rounded-full border border-[#c8dbd0] bg-[#f2f7f4] px-3 py-1.5 text-xs font-medium text-[#164b3e] hover:bg-[#e6f0ea]"
                >
                  <Sparkles size={12} />
                  示例：策划城市漫步图文
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("image");
                    setComposerPreset("温暖木质书桌上的手冲咖啡与翻开的笔记本，柔和晨光，胶片摄影质感，16:9");
                  }}
                  className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  <ImageIcon size={12} />
                  示例：生成 16:9 封面配图
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {entries.map(({ kind, entry }) =>
                kind === "agent" ? (
                  <AgentMessage
                    key={entry.id}
                    turn={entry}
                    planExecuted={proposalStatus.executedIds.has(entry.id)}
                    canConfirmPlan={!agentRunning && proposalStatus.latestPendingId === entry.id}
                    onConfirmPlan={handleConfirmProposal}
                  />
                ) : (
                  <article key={entry.id} className="space-y-2 text-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element -- 历史记录保留提交时的参考图。 */}
                    {entry.reference && <img src={entry.reference.url} alt="提交的参考图" className="size-10 rounded-lg object-cover" />}
                    {!!entry.references?.length && (
                      <div className="flex flex-wrap gap-1">
                        {entry.references.map((image, index) => (
                          /* eslint-disable-next-line @next/next/no-img-element -- 显示生成任务实际引用的私有素材。 */
                          <img key={`${image.id}-${index}`} src={image.url} alt={`参考图 ${index + 1}`} className="size-10 rounded-lg object-cover" />
                        ))}
                      </div>
                    )}
                    <p className="whitespace-pre-wrap break-words">{entry.prompt}</p>
                    <div className="text-xs text-neutral-500">
                      {models[entry.config.model]} · {configLabel(entry.config)}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {entry.jobs.map((job) => (
                        <div key={job.id} className="flex min-h-16 w-20 flex-col items-start justify-center gap-1 rounded-lg bg-neutral-100 p-1.5 text-[11px]">
                          {job.asset ? (
                            /* eslint-disable-next-line @next/next/no-img-element -- 生成结果使用私有图片签名地址。 */
                            <img src={job.asset.url} alt={`生成结果 ${job.slot + 1}`} className="aspect-square w-full rounded-md object-cover" />
                          ) : processing(job) ? (
                            <>
                              <LoaderCircle size={15} className="animate-spin" />
                              {job.status === "importing" ? "保存中" : "生成中"}
                            </>
                          ) : (
                            <>
                              <span title={job.error ?? undefined}>
                                {job.status === "unknown" ? "待核对" : job.status === "succeeded" ? "图片暂不可用" : "生成失败"}
                              </span>
                              {job.status === "failed" && (
                                <button type="button" className="flex items-center gap-1 rounded py-0.5 underline" onClick={() => void retry(job)}>
                                  <RotateCcw size={11} />
                                  重试
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
                    {entry.config.model === "gpt-image-2-5-flare" && entry.jobs.some((job) => job.status === "succeeded") && (
                      <button
                        type="button"
                        disabled={!!regenerating || active}
                        className="flex items-center gap-1 text-xs text-neutral-600 underline disabled:opacity-40"
                        onClick={() => void regenerate(entry)}
                      >
                        <RotateCcw size={13} />
                        重新生成
                      </button>
                    )}
                  </article>
                ),
              )}
            </div>
          )}
        </div>
        <div className="px-2 pb-2">
          {error && <div role="alert" className="mb-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">{error}</div>}
          <Composer
            projectId={project.id}
            onSend={send}
            mode={mode}
            onModeChange={setMode}
            presetPrompt={composerPreset}
            onPresetConsumed={() => setComposerPreset(null)}
            generating={active || !!regenerating || agentRunning}
            selecting={selecting}
            canvasAsset={asset}
            onClearCanvas={() => setAsset(null)}
            attachments={attachments}
            onClearAttachments={() => setAttachments([])}
            onRemoveAttachment={(id) => setAttachments((previous) => previous.filter((item) => item.id !== id))}
            onUpload={async (file) => {
              const attachment = await uploadReference(file, project.id, crypto.randomUUID(), false, true);
              if (mode === "agent") setAttachments((previous) => [...previous, attachment]);
              else setAsset(attachment);
              setSelecting(false);
              if (attachment.kind !== "markdown") await sync();
            }}
            onPickCanvas={
              nodes.some((node) => node.type === "image" && nodeAsset(node.data)) ? () => setSelecting(true) : undefined
            }
          />
        </div>
      </aside>

      <ArticleStagingDialog
        open={stagingOpen}
        projectId={project.id}
        analysis={graphAnalysis}
        snapshots={snapshots}
        selectedChainHeadId={selectedChainHeadId}
        onSelectChainHead={setSelectedChainHeadId}
        onStage={handleStageSnapshot}
        onClose={() => setStagingOpen(false)}
      />
    </main>
  );
}
