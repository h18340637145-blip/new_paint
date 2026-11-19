"use client";

import Link from "next/link";
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
import { ArrowLeft, ArrowRight, BookmarkCheck, FilePlus2, LoaderCircle, RotateCcw } from "lucide-react";
import { Composer, type ComposerInput, type StudioMode } from "./composer";
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
import type { StudioAgentTurn, StudioAttachment, StudioPlacedNode } from "@/lib/studio/agent-events";
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
        className={`relative rounded-lg ${
          data.highlightedError ? "ring-2 ring-red-500 ring-offset-2" : ""
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
    <div className="relative grid size-full place-items-center overflow-hidden rounded-lg border border-neutral-200 bg-neutral-200">
      <div className={`grid size-full place-items-center ${processing(job) ? "animate-pulse bg-gradient-to-r from-neutral-100 to-neutral-300" : ""}`}>
        <span className="rounded-full bg-neutral-700/90 px-3 py-1 text-xs text-white">
          {processing(job) ? "Generating" : job.status === "unknown" ? "待核对" : job.status === "succeeded" ? "图片暂不可用" : "生成失败"}
        </span>
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
  const [mode, setMode] = useState<StudioMode>("image");
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
      syncing.current = studioRequest<{ submissions: CanvasSubmission[]; placedNodes: StudioPlacedNode[] }>({
        action: "sync",
        projectId: project.id,
      })
        .then(({ submissions, placedNodes }) => {
          setSubmissions(submissions);
          setPlacedNodes(placedNodes);
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
        if (job.canvasHidden || job.status !== "succeeded" || !job.asset) continue;
        list.push({
          nodeId: job.id,
          kind: "image",
          assetId: job.asset.id,
          assetKind: "generated",
          imageUrl: job.asset.url,
          filename: "生成图片",
        });
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
              articleConnectable: isArticleMode && !!job.asset,
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
          stroke: selected ? "#dc2626" : "#171717",
          strokeWidth: selected ? 2.5 : 2,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: selected ? "#dc2626" : "#171717",
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

  async function send(input: ComposerInput) {
    if (mode === "agent") {
      let id = crypto.randomUUID();
      setAgentTurns((previous) => [
        ...previous,
        {
          id,
          prompt: input.prompt,
          attachments: input.attachments ?? [],
          skillName: input.skill?.name,
          status: "running",
          events: [],
          createdAt: new Date().toISOString(),
        },
      ]);
      try {
        await sendAgentMessage(
          project.id,
          input.prompt,
          (input.attachments ?? []).map((item) => item.id),
          input.skill?.id ?? null,
          (event) => {
            const target = id;
            if (event.type === "start") id = event.id;
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
                if (event.type === "done") return { ...turn, status: turn.status === "failed" ? "failed" : "complete" };
                return {
                  ...turn,
                  status: event.type === "error" ? "failed" : turn.status,
                  events: [...turn.events, event],
                };
              }),
            );
            if (event.type === "tool-end" && !event.failed) void sync();
          },
        );
      } catch (failure) {
        const text = failure instanceof Error ? failure.message : "Agent 请求失败。";
        setAgentTurns((previous) =>
          previous.map((turn) =>
            turn.id === id ? { ...turn, status: "failed", events: [...turn.events, { type: "error", text }] } : turn,
          ),
        );
      } finally {
        await sync();
      }
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
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#aabacb" />
          <Controls showInteractive={false} />
        </ReactFlow>

        <div className="canvas-project-label absolute left-3 top-3 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-neutral-200 bg-white p-1.5 pr-2.5 shadow-sm">
          <Link href="/projects" aria-label="返回项目列表" className="rounded-lg p-1.5 hover:bg-neutral-100">
            <ArrowLeft size={15} />
          </Link>
          <h1 className="max-w-44 truncate text-sm font-semibold">{project.title}</h1>
          <div className="inline-flex rounded-lg bg-neutral-100 p-0.5 text-xs" role="group" aria-label="画布模式">
            <button
              type="button"
              onClick={() => setCanvasView("studio")}
              className={`rounded-md px-2.5 py-1 font-medium transition ${
                canvasView === "studio" ? "bg-white text-neutral-950 shadow-sm" : "text-neutral-600 hover:text-neutral-950"
              }`}
            >
              画布创作
            </button>
            <button
              type="button"
              onClick={() => setCanvasView("article")}
              className={`rounded-md px-2.5 py-1 font-medium transition ${
                canvasView === "article" ? "bg-neutral-950 text-white shadow-sm" : "text-neutral-600 hover:text-neutral-950"
              }`}
            >
              文章编排
            </button>
          </div>
        </div>

        {isArticleMode && (
          <div className="absolute right-3 top-3 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-neutral-200 bg-white/95 p-1.5 shadow-sm backdrop-blur">
            <button
              type="button"
              onClick={() => void addArticleTextNode()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-800 hover:bg-neutral-50"
            >
              <FilePlus2 size={13} />
              添加文本
            </button>

            {selectedEdgeIds.length > 0 && (
              <button
                type="button"
                onClick={() => selectedEdgeIds.forEach(deleteEdgeById)}
                className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
              >
                删除选中连线
              </button>
            )}

            <button
              type="button"
              onClick={() => setStagingOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-950 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800"
            >
              <BookmarkCheck size={13} />
              核对并暂存
              {snapshots.length > 0 && (
                <span className="rounded-full bg-white/20 px-1.5 text-[10px]">v{snapshots[0].versionNumber}</span>
              )}
            </button>

            <Link
              href={`/typography?projectId=${project.id}`}
              className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-xs font-medium text-neutral-800 hover:bg-neutral-100"
            >
              去排版
              <ArrowRight size={12} />
            </Link>
          </div>
        )}

        {!nodes.length && (
          <p className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-neutral-500">
            {isArticleMode ? "点击右上角「添加文本」或上传图片，用连线串联文章顺序" : "输入你的想法开始创作"}
          </p>
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
        }}
      />

      <aside
        aria-label="生图对话面板"
        style={{ "--panel-width": `${width}px` } as React.CSSProperties}
        className="flex h-[48dvh] min-h-0 w-full shrink-0 flex-col bg-white md:h-full md:w-[var(--panel-width)]"
      >
        <header className="canvas-chat-header border-b px-4 py-3 text-sm font-semibold">
          {entries.length ? "创作记录" : "新对话"}
        </header>
        <div ref={history} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {entries.length === 0 ? (
            <div className="grid h-full place-items-center text-sm font-medium">开始创作</div>
          ) : (
            <div className="space-y-5">
              {entries.map(({ kind, entry }) =>
                kind === "agent" ? (
                  <AgentMessage key={entry.id} turn={entry} />
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
            generating={active || !!regenerating}
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
