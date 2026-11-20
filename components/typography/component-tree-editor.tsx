"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Bold,
  ChevronDown,
  ChevronRight,
  Columns2,
  Copy,
  Eraser,
  GripVertical,
  Image as ImageIcon,
  Italic,
  Minus,
  Plus,
  Rows3,
  Trash2,
  Type,
  Upload,
} from "lucide-react";
import { AutoGrowTextarea } from "@/components/ui/auto-grow-textarea";
import {
  applyRunStyleRange,
  createDefaultNode,
  duplicateNodeById,
  escapeHtml,
  findNodeById,
  insertChildNode,
  renderComponentTreeHtml,
  removeNodeById,
  reorderSiblingNode,
  runsToPlainText,
  safeUrl,
  syncPlainTextIntoRuns,
  updateNodeById,
  type BorderSidesKind,
  type ComponentBoxStyle,
  type ComponentImageRef,
  type ComponentNode,
  type ComponentTypographyStyle,
  type FontFamilyChoice,
  type LibraryScopeType,
  type TextRunStyle,
} from "@/lib/typography/templates";
import { uploadReference } from "@/lib/studio/client";
import { sanitizeBoxStyle } from "@/lib/typography/custom-tree";
import type { TemplateStyleConfig } from "@/lib/typography/types";

export interface ComponentTreeEditorProps {
  rootNode: ComponentNode;
  baseStyle: TemplateStyleConfig;
  authenticated: boolean;
  scopeType: LibraryScopeType;
  teamId?: string | null;
  projectId?: string;
  onChangeRoot: (nextRoot: ComponentNode) => void;
}

const NODE_TYPE_LABELS: Record<ComponentNode["type"], string> = {
  container: "容器",
  heading: "标题",
  text: "文字",
  image: "图片",
  divider: "分割线",
};

function summarizeNode(node: ComponentNode): string {
  if (node.type === "container") {
    return `${node.label || (node.direction === "horizontal" ? "横向容器" : "纵向容器")} (${node.children.length})`;
  }
  if (node.type === "heading" || node.type === "text") {
    const plain = runsToPlainText(node.runs).replace(/\s+/g, " ").trim();
    return plain ? (plain.length > 14 ? `${plain.slice(0, 14)}…` : plain) : "空文本";
  }
  if (node.type === "image") {
    if (node.imageRef.kind === "missing-external") {
      return `待补图片：${node.alt || "外部图"}`;
    }
    if (node.imageRef.kind === "inline-svg") {
      return `矢量装饰：${node.alt || "图标"}`;
    }
    return node.alt || "配图节点";
  }
  return `${node.dividerStyle === "dashed" ? "虚线" : node.dividerStyle === "short" ? "短线" : "实线"} (${node.widthPercent}%)`;
}

export function ComponentTreeEditor({
  rootNode,
  baseStyle,
  authenticated,
  scopeType,
  teamId,
  projectId,
  onChangeRoot,
}: ComponentTreeEditorProps) {
  const [selectedId, setSelectedId] = useState<string>(rootNode.id);
  const [collapsedIds, setCollapsedIds] = useState<Record<string, boolean>>({});
  const [dragging, setDragging] = useState<{
    nodeId: string;
    parentId: string;
    overIndex: number;
  } | null>(null);
  const [runSelection, setRunSelection] = useState<{ start: number; end: number; snippet: string } | null>(null);
  const [localRunColor, setLocalRunColor] = useState("#164b3e");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const replaceFileRef = useRef<HTMLInputElement>(null);
  const replaceTargetNodeIdRef = useRef<string | null>(null);

  // 确保选中的节点始终存在
  const selectedNode = useMemo(
    () => findNodeById(rootNode, selectedId) ?? rootNode,
    [rootNode, selectedId],
  );

  // 查找父容器信息（用于判断当前选中节点是否处于横向分栏容器内）
  const parentContainer = useMemo(() => {
    let found: Extract<ComponentNode, { type: "container" }> | null = null;
    function walk(node: ComponentNode) {
      if (found || node.type !== "container") return;
      if (node.children.some((c) => c.id === selectedNode.id)) {
        found = node;
        return;
      }
      node.children.forEach(walk);
    }
    walk(rootNode);
    return found as Extract<ComponentNode, { type: "container" }> | null;
  }, [rootNode, selectedNode.id]);

  // 按 Escape 取消拖拽
  useEffect(() => {
    if (!dragging) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDragging(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dragging]);

  function selectNode(id: string) {
    setSelectedId(id);
    setRunSelection(null);
    setCollapsedIds((previous) => {
      const expanded = { ...previous };
      function reveal(node: ComponentNode): boolean {
        if (node.id === id) return true;
        if (node.type !== "container" || !node.children.some(reveal)) return false;
        delete expanded[node.id];
        return true;
      }
      reveal(rootNode);
      return expanded;
    });
  }

  function toggleCollapse(id: string) {
    setCollapsedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function patchSelected(updater: (n: ComponentNode) => ComponentNode) {
    onChangeRoot(updateNodeById(rootNode, selectedNode.id, updater));
  }

  function patchBox(patch: Partial<ComponentBoxStyle>) {
    patchSelected((n) => ({
      ...n,
      boxStyle: sanitizeBoxStyle({ ...n.boxStyle, ...patch }),
    }));
  }

  function patchTextStyle(patch: Partial<ComponentTypographyStyle>) {
    patchSelected((n) =>
      n.type === "heading" || n.type === "text"
        ? { ...n, textStyle: { ...n.textStyle, ...patch } }
        : n,
    );
  }

  function applySelectedRunStyle(patch: Partial<TextRunStyle> | "clear") {
    if (!runSelection || runSelection.end <= runSelection.start) return;
    patchSelected((n) =>
      n.type === "heading" || n.type === "text"
        ? { ...n, runs: applyRunStyleRange(n.runs, runSelection.start, runSelection.end, patch) }
        : n,
    );
  }

  function handleAddNode(kind: ComponentNode["type"]) {
    const created = createDefaultNode(kind);
    const targetParentId =
      selectedNode.type === "container"
        ? selectedNode.id
        : parentContainer?.id ?? rootNode.id;
    onChangeRoot(insertChildNode(rootNode, targetParentId, created));
    setSelectedId(created.id);
    setCollapsedIds((prev) => ({ ...prev, [targetParentId]: false }));
  }

  function handleDuplicate(id: string) {
    if (id === rootNode.id) return;
    const { nextRoot, duplicatedId } = duplicateNodeById(rootNode, id);
    onChangeRoot(nextRoot);
    if (duplicatedId) setSelectedId(duplicatedId);
  }

  function handleDelete(id: string) {
    if (id === rootNode.id) return;
    const next = removeNodeById(rootNode, id);
    onChangeRoot(next);
    if (selectedId === id) setSelectedId(rootNode.id);
  }

  function triggerReplaceImage(nodeId: string) {
    replaceTargetNodeIdRef.current = nodeId;
    setUploadError("");
    replaceFileRef.current?.click();
  }

  async function handleImageFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    const targetId = replaceTargetNodeIdRef.current ?? selectedNode.id;
    if (!file) return;

    if (!/^image\/(png|jpeg|webp)$/i.test(file.type)) {
      setUploadError("请选择 PNG、JPEG 或 WebP 格式图片。");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("图片大小不能超过 10 MB。");
      return;
    }

    setUploadingImage(true);
    setUploadError("");
    try {
      let nextRef: ComponentImageRef;
      if (projectId) {
        const asset = await uploadReference(file, projectId, crypto.randomUUID());
        nextRef = { kind: "project-asset", assetId: asset.id };
      } else if (authenticated) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("scopeType", scopeType);
        if (scopeType === "team" && teamId) {
          fd.append("teamId", teamId);
        }
        const res = await fetch("/api/library/media", { method: "POST", body: fd });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.media?.id) {
          throw new Error(data.error || "上传图片失败。");
        }
        nextRef = { kind: "library-media", mediaId: String(data.media.id) };
      } else {
        // 匿名用户先在本地预览，登录后保存时由服务端持久化为私有文件
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result ?? ""));
          reader.onerror = () => reject(new Error("读取本地图片失败。"));
          reader.readAsDataURL(file);
        });
        nextRef = { kind: "inline-data", dataUrl };
      }

      onChangeRoot(
        updateNodeById(rootNode, targetId, (n) =>
          n.type === "image"
            ? {
                ...n,
                imageRef: nextRef,
                alt: n.alt === "导入配图" || !n.alt ? file.name.replace(/\.[^.]+$/, "") : n.alt,
              }
            : n,
        ),
      );
      setSelectedId(targetId);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "更换图片失败。");
    } finally {
      setUploadingImage(false);
    }
  }

  function handleHandlePointerDown(
    e: React.PointerEvent<HTMLButtonElement>,
    nodeId: string,
    parentId: string,
    currentIndex: number,
  ) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const handleEl = e.currentTarget;
    handleEl.setPointerCapture(e.pointerId);
    setDragging({ nodeId, parentId, overIndex: currentIndex });
  }

  function handleHandlePointerMove(
    e: React.PointerEvent<HTMLButtonElement>,
    parentId: string,
  ) {
    if (!dragging || dragging.parentId !== parentId) return;
    const siblingEls = Array.from(
      document.querySelectorAll<HTMLElement>(`[data-sibling-parent="${CSS.escape(parentId)}"]`),
    );
    if (siblingEls.length === 0) return;

    let targetIndex = siblingEls.length - 1;
    for (let i = 0; i < siblingEls.length; i += 1) {
      const rect = siblingEls[i].getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      if (e.clientY < midY) {
        targetIndex = i;
        break;
      }
    }
    if (targetIndex !== dragging.overIndex) {
      setDragging((prev) => (prev ? { ...prev, overIndex: targetIndex } : null));
    }
  }

  function handleHandlePointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    if (!dragging) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    const { nodeId, overIndex } = dragging;
    setDragging(null);
    onChangeRoot(reorderSiblingNode(rootNode, nodeId, { kind: "index", toIndex: overIndex }));
  }

  const previewHtml = useMemo(() => {
    const resolveImg = (ref: ComponentImageRef): string => {
      if (ref.kind === "library-media") {
        return `/api/library/media/${encodeURIComponent(ref.mediaId)}`;
      }
      if (ref.kind === "inline-data") {
        return escapeHtml(ref.dataUrl);
      }
      if (ref.kind === "inline-svg") {
        return escapeHtml(ref.svgDataUrl);
      }
      if (ref.kind === "project-asset" && projectId) {
        return safeUrl(`/api/typography/preview-image/${encodeURIComponent(projectId)}/${encodeURIComponent(ref.assetId)}`);
      }
      return "";
    };
    return renderComponentTreeHtml(rootNode, baseStyle, escapeHtml, resolveImg, {
      selectedNodeId: selectedNode.id,
    });
  }, [rootNode, baseStyle, selectedNode.id, projectId]);

  function renderTreeBranch(
    node: ComponentNode,
    depth: number,
    parentId: string | null,
    siblingIndex: number,
    siblingCount: number,
  ) {
    const isSelected = selectedNode.id === node.id;
    const isContainer = node.type === "container";
    const isCollapsed = Boolean(collapsedIds[node.id]);
    const isDropTarget =
      dragging !== null && dragging.parentId === parentId && dragging.overIndex === siblingIndex;
    const isPendingExternal = node.type === "image" && node.imageRef.kind === "missing-external";

    return (
      <div
        key={node.id}
        data-sibling-parent={parentId ?? undefined}
        data-sibling-index={parentId ? siblingIndex : undefined}
        className={`rounded-lg transition ${isDropTarget ? "ring-2 ring-emerald-700/60" : ""}`}
      >
        <div
          style={{ paddingLeft: `${Math.min(depth * 12, 48) + 6}px` }}
          className={`group flex min-h-9 items-center gap-1 rounded-lg px-2 py-1 text-xs transition ${
            isSelected
              ? "bg-neutral-900 text-white"
              : "text-neutral-700 hover:bg-neutral-100"
          }`}
        >
          {parentId ? (
            <button
              type="button"
              aria-label={`按住拖动排序 ${summarizeNode(node)}`}
              title="按住上下拖动排序（也可使用右侧上下箭头按钮）"
              onPointerDown={(e) => handleHandlePointerDown(e, node.id, parentId, siblingIndex)}
              onPointerMove={(e) => handleHandlePointerMove(e, parentId)}
              onPointerUp={handleHandlePointerUp}
              onPointerCancel={() => setDragging(null)}
              style={{ touchAction: "none" }}
              className={`inline-flex size-6 shrink-0 cursor-grab items-center justify-center rounded active:cursor-grabbing ${
                isSelected ? "text-neutral-300 hover:text-white" : "text-neutral-400 hover:text-neutral-700"
              }`}
            >
              <GripVertical size={13} aria-hidden="true" />
            </button>
          ) : (
            <span className="inline-block w-2 shrink-0" />
          )}

          {isContainer ? (
            <button
              type="button"
              aria-label={isCollapsed ? "展开子层级" : "折叠子层级"}
              onClick={() => toggleCollapse(node.id)}
              className="inline-flex size-5 shrink-0 items-center justify-center rounded hover:bg-black/10"
            >
              {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
            </button>
          ) : (
            <span className="inline-block w-5 shrink-0" />
          )}

          <button
            type="button"
            onClick={() => {
              selectNode(node.id);
            }}
            className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
          >
            <span
              className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                isSelected
                  ? "bg-white/15 text-white"
                  : isPendingExternal
                    ? "bg-amber-100 text-amber-900"
                    : "bg-neutral-200/70 text-neutral-700"
              }`}
            >
              {NODE_TYPE_LABELS[node.type]}
            </span>
            <span className="truncate font-medium">{summarizeNode(node)}</span>
          </button>

          {parentId && (
            <div className="flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                aria-label={`上移 ${summarizeNode(node)}`}
                disabled={siblingIndex === 0}
                onClick={(e) => {
                  e.stopPropagation();
                  onChangeRoot(reorderSiblingNode(rootNode, node.id, { kind: "delta", delta: -1 }));
                }}
                className={`inline-flex size-6 items-center justify-center rounded disabled:opacity-25 ${
                  isSelected ? "hover:bg-white/15" : "hover:bg-neutral-200"
                }`}
              >
                <ArrowUp size={12} />
              </button>
              <button
                type="button"
                aria-label={`下移 ${summarizeNode(node)}`}
                disabled={siblingIndex === siblingCount - 1}
                onClick={(e) => {
                  e.stopPropagation();
                  onChangeRoot(reorderSiblingNode(rootNode, node.id, { kind: "delta", delta: 1 }));
                }}
                className={`inline-flex size-6 items-center justify-center rounded disabled:opacity-25 ${
                  isSelected ? "hover:bg-white/15" : "hover:bg-neutral-200"
                }`}
              >
                <ArrowDown size={12} />
              </button>
              <button
                type="button"
                aria-label={`复制 ${summarizeNode(node)}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDuplicate(node.id);
                }}
                className={`inline-flex size-6 items-center justify-center rounded ${
                  isSelected ? "hover:bg-white/15" : "hover:bg-neutral-200"
                }`}
              >
                <Copy size={11} />
              </button>
              <button
                type="button"
                aria-label={`删除 ${summarizeNode(node)}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(node.id);
                }}
                className={`inline-flex size-6 items-center justify-center rounded ${
                  isSelected ? "hover:bg-red-500/30" : "hover:bg-red-50 hover:text-red-600"
                }`}
              >
                <Trash2 size={11} />
              </button>
            </div>
          )}
        </div>

        {isContainer && !isCollapsed && (
          <div className="mt-0.5 space-y-0.5">
            {node.children.map((child, idx) =>
              renderTreeBranch(child, depth + 1, node.id, idx, node.children.length),
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-4 text-neutral-900 [color-scheme:light] lg:grid-cols-12">
      <input
        ref={replaceFileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(e) => void handleImageFileSelected(e)}
        hidden
      />

      {/* 左栏：组件层级树与新增节点 */}
      <div className="flex flex-col rounded-xl border border-neutral-200 bg-white lg:col-span-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-3 py-2.5">
          <span className="text-xs font-semibold text-neutral-900">组件层级树（拖拽或箭头排序）</span>
          <div className="flex flex-wrap items-center gap-1">
            {(
              [
                { kind: "container", label: "容器", icon: Columns2 },
                { kind: "heading", label: "标题", icon: Type },
                { kind: "text", label: "文字", icon: Rows3 },
                { kind: "image", label: "图片", icon: ImageIcon },
                { kind: "divider", label: "分割线", icon: Minus },
              ] as const
            ).map((btn) => {
              const Icon = btn.icon;
              return (
                <button
                  key={btn.kind}
                  type="button"
                  onClick={() => handleAddNode(btn.kind)}
                  className="inline-flex min-h-7 items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] font-medium text-neutral-700 hover:bg-neutral-100 hover:text-neutral-950"
                >
                  <Plus size={10} />
                  <Icon size={11} />
                  <span>{btn.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="max-h-[420px] space-y-0.5 overflow-y-auto p-2">
          {renderTreeBranch(rootNode, 0, null, 0, 1)}
        </div>
      </div>

      {/* 中栏：选中节点属性与内容精细调节 */}
      <div className="flex flex-col space-y-3 rounded-xl border border-neutral-200 bg-white p-3.5 text-xs lg:col-span-4">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
          <span className="font-semibold text-neutral-900">
            属性编辑：{NODE_TYPE_LABELS[selectedNode.type]}
          </span>
          {selectedNode.id !== rootNode.id && (
            <button
              type="button"
              onClick={() => handleDuplicate(selectedNode.id)}
              className="inline-flex items-center gap-1 rounded border border-neutral-200 px-2 py-0.5 text-[11px] font-medium text-neutral-700 hover:bg-neutral-50"
            >
              <Copy size={11} />
              复制节点
            </button>
          )}
        </div>

        {/* 若父容器为横向排列，显示列宽权重滑块 */}
        {parentContainer?.direction === "horizontal" && (
          <label className="block rounded-lg border border-emerald-200 bg-emerald-50/50 p-2.5">
            <div className="flex items-center justify-between font-medium text-emerald-950">
              <span>分栏列宽权重（共 12 份）</span>
              <span className="tabular-nums">{selectedNode.boxStyle.widthFlex ?? 6} / 12</span>
            </div>
            <input
              type="range"
              min={1}
              max={12}
              value={selectedNode.boxStyle.widthFlex ?? 6}
              onChange={(e) => patchBox({ widthFlex: Number(e.target.value), intrinsicWidth: undefined })}
              className="mt-1.5 w-full accent-emerald-800"
            />
          </label>
        )}

        {/* 容器专属设置 */}
        {selectedNode.type === "container" && (
          <div className="space-y-2.5 rounded-lg bg-neutral-50 p-2.5">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  patchSelected((n) => (n.type === "container" ? { ...n, direction: "vertical" } : n))
                }
                className={`inline-flex min-h-8 items-center justify-center gap-1 rounded-md border font-medium ${
                  selectedNode.direction === "vertical"
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-200 bg-white text-neutral-700"
                }`}
              >
                <Rows3 size={13} />
                纵向排列
              </button>
              <button
                type="button"
                onClick={() =>
                  patchSelected((n) => (n.type === "container" ? { ...n, direction: "horizontal" } : n))
                }
                className={`inline-flex min-h-8 items-center justify-center gap-1 rounded-md border font-medium ${
                  selectedNode.direction === "horizontal"
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-200 bg-white text-neutral-700"
                }`}
              >
                <Columns2 size={13} />
                横向分栏
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1 text-neutral-600">
                <span>内部间距 ({selectedNode.gap}px)</span>
                <input
                  type="range"
                  min={0}
                  max={36}
                  value={selectedNode.gap}
                  onChange={(e) =>
                    patchSelected((n) =>
                      n.type === "container" ? { ...n, gap: Number(e.target.value) } : n,
                    )
                  }
                  className="w-full accent-neutral-900"
                />
              </label>
              <label className="space-y-1 text-neutral-600">
                <span>交叉轴对齐</span>
                <select
                  value={selectedNode.alignItems ?? "stretch"}
                  onChange={(e) =>
                    patchSelected((n) =>
                      n.type === "container"
                        ? {
                            ...n,
                            alignItems: e.target.value as typeof selectedNode.alignItems,
                          }
                        : n,
                    )
                  }
                  className="w-full rounded border border-neutral-200 bg-white px-2 py-1 text-neutral-900"
                >
                  <option value="stretch">等高拉伸</option>
                  <option value="center">居中对齐</option>
                  <option value="flex-start">起点对齐</option>
                  <option value="flex-end">终点对齐</option>
                </select>
              </label>
              <label className="space-y-1 text-neutral-600">
                <span>排列方向对齐</span>
                <select
                  value={selectedNode.justifyContent ?? "flex-start"}
                  onChange={(e) =>
                    patchSelected((n) => n.type === "container"
                      ? { ...n, justifyContent: e.target.value as typeof selectedNode.justifyContent }
                      : n)
                  }
                  className="w-full rounded border border-neutral-200 bg-white px-2 py-1 text-neutral-900"
                >
                  <option value="flex-start">起点对齐</option>
                  <option value="center">居中</option>
                  <option value="flex-end">终点对齐</option>
                  <option value="space-between">两端对齐</option>
                </select>
              </label>
            </div>
          </div>
        )}

        {/* 标题 / 文字专属设置与选区局部样式 */}
        {(selectedNode.type === "heading" || selectedNode.type === "text") && (
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              {selectedNode.type === "heading" && (
                <select
                  aria-label="标题级别"
                  value={selectedNode.level}
                  onChange={(e) =>
                    patchSelected((n) =>
                      n.type === "heading"
                        ? { ...n, level: Number(e.target.value) as 1 | 2 | 3 }
                        : n,
                    )
                  }
                  className="rounded border border-neutral-200 bg-neutral-50 px-2 py-1 font-medium"
                >
                  <option value={1}>H1 大标题</option>
                  <option value={2}>H2 章节标题</option>
                  <option value={3}>H3 小标题</option>
                </select>
              )}
              <label className="inline-flex items-center gap-1.5 text-[11px] text-neutral-700">
                <input
                  type="checkbox"
                  checked={selectedNode.slotRole === "content"}
                  onChange={(e) =>
                    patchSelected((n) =>
                      n.type === "heading" || n.type === "text"
                        ? { ...n, slotRole: e.target.checked ? "content" : undefined }
                        : n,
                    )
                  }
                />
                <span>套用到块时填入原块文字</span>
              </label>
            </div>

            <AutoGrowTextarea
              minHeightPx={64}
              aria-label="组件文字内容"
              value={runsToPlainText(selectedNode.runs)}
              onSelect={(e) => {
                const start = e.currentTarget.selectionStart ?? 0;
                const end = e.currentTarget.selectionEnd ?? 0;
                if (end > start) {
                  const s = e.currentTarget.value.slice(start, end);
                  setRunSelection({
                    start,
                    end,
                    snippet: s.length > 12 ? `${s.slice(0, 12)}…` : s,
                  });
                } else {
                  setRunSelection(null);
                }
              }}
              onChange={(e) => {
                const val = e.target.value;
                patchSelected((n) =>
                  n.type === "heading" || n.type === "text"
                    ? { ...n, runs: syncPlainTextIntoRuns(n.runs, val) }
                    : n,
                );
              }}
              className="w-full rounded-lg border border-neutral-200 p-2 text-xs leading-relaxed text-neutral-900 focus:border-neutral-500 focus:outline-none"
            />

            {/* 复用稿件级 TextRun 局部选区样式 */}
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-neutral-100 bg-neutral-50 p-2">
              <span className="text-[11px] text-neutral-500">
                {runSelection ? `已选「${runSelection.snippet}」：` : "划选文字设局部样式："}
              </span>
              <button
                type="button"
                disabled={!runSelection}
                onClick={() => applySelectedRunStyle({ bold: true })}
                className="inline-flex items-center gap-0.5 rounded border border-neutral-200 bg-white px-1.5 py-0.5 disabled:opacity-40"
              >
                <Bold size={11} />
                加粗
              </button>
              <button
                type="button"
                disabled={!runSelection}
                onClick={() => applySelectedRunStyle({ italic: true })}
                className="inline-flex items-center gap-0.5 rounded border border-neutral-200 bg-white px-1.5 py-0.5 disabled:opacity-40"
              >
                <Italic size={11} />
                斜体
              </button>
              <input
                type="color"
                aria-label="选区文字颜色"
                value={localRunColor}
                onChange={(e) => setLocalRunColor(e.target.value)}
                className="size-5 cursor-pointer border-0 bg-transparent p-0"
              />
              <button
                type="button"
                disabled={!runSelection}
                onClick={() => applySelectedRunStyle({ color: localRunColor })}
                className="rounded border border-neutral-200 bg-white px-1.5 py-0.5 disabled:opacity-40"
              >
                染色
              </button>
              <button
                type="button"
                disabled={!runSelection}
                onClick={() => applySelectedRunStyle("clear")}
                className="inline-flex items-center gap-0.5 rounded border border-neutral-200 bg-white px-1.5 py-0.5 disabled:opacity-40"
              >
                <Eraser size={11} />
                清除
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1 text-neutral-600">
                <span>字号 (px)</span>
                <input
                  type="number"
                  min={12}
                  max={34}
                  value={selectedNode.textStyle.fontSize ?? (selectedNode.type === "heading" ? 18 : 15)}
                  onChange={(e) => patchTextStyle({ fontSize: Number(e.target.value) })}
                  className="w-full rounded border border-neutral-200 px-2 py-1 text-neutral-900"
                />
              </label>
              <label className="space-y-1 text-neutral-600">
                <span>字重</span>
                <select
                  value={selectedNode.textStyle.fontWeight ?? (selectedNode.type === "heading" ? 700 : 400)}
                  onChange={(e) =>
                    patchTextStyle({ fontWeight: Number(e.target.value) as 400 | 600 | 700 })
                  }
                  className="w-full rounded border border-neutral-200 bg-white px-2 py-1 text-neutral-900"
                >
                  <option value={400}>常规 400</option>
                  <option value={600}>中粗 600</option>
                  <option value={700}>粗体 700</option>
                </select>
              </label>
              <label className="space-y-1 text-neutral-600">
                <span>字体</span>
                <select
                  value={selectedNode.textStyle.fontFamily ?? "default"}
                  onChange={(e) => patchTextStyle({ fontFamily: e.target.value as FontFamilyChoice })}
                  className="w-full rounded border border-neutral-200 bg-white px-2 py-1 text-neutral-900"
                >
                  <option value="default">默认无衬线</option>
                  <option value="serif">人文宋楷</option>
                  <option value="mono">等宽代码</option>
                </select>
              </label>
              <label className="space-y-1 text-neutral-600">
                <span>对齐</span>
                <select
                  value={selectedNode.textStyle.textAlign ?? "left"}
                  onChange={(e) =>
                    patchTextStyle({
                      textAlign: e.target.value as "left" | "center" | "right" | "justify",
                    })
                  }
                  className="w-full rounded border border-neutral-200 bg-white px-2 py-1 text-neutral-900"
                >
                  <option value="left">左对齐</option>
                  <option value="center">居中</option>
                  <option value="justify">两端对齐</option>
                  <option value="right">右对齐</option>
                </select>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <label className="inline-flex items-center gap-2 text-neutral-600">
                <span>文字配色</span>
                <input
                  type="color"
                  value={
                    selectedNode.textStyle.color && /^#[0-9a-fA-F]{6}$/.test(selectedNode.textStyle.color)
                      ? selectedNode.textStyle.color
                      : "#262626"
                  }
                  onChange={(e) => patchTextStyle({ color: e.target.value })}
                  className="size-6 cursor-pointer border-0 bg-transparent p-0"
                />
              </label>
              {selectedNode.textStyle.color && (
                <button
                  type="button"
                  onClick={() => patchTextStyle({ color: undefined })}
                  className="text-[11px] text-neutral-500 underline"
                >
                  跟随模板文字色
                </button>
              )}
            </div>
          </div>
        )}

        {/* 图片节点专属设置与上传更换 */}
        {selectedNode.type === "image" && (
          <div className="space-y-2.5">
            {selectedNode.imageRef.kind === "missing-external" && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-950">
                <div className="flex items-center gap-1 font-semibold">
                  <AlertCircle size={13} className="text-amber-700" />
                  <span>外部图片（待补素材）</span>
                </div>
                <p className="mt-1 break-all text-amber-800">
                  原链接：{selectedNode.imageRef.originalUrl}
                </p>
                <p className="mt-1 text-amber-700">
                  为避免外链防盗链失效，请点击下方按钮上传自有图片替换。
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                disabled={uploadingImage}
                onClick={() => triggerReplaceImage(selectedNode.id)}
                className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-1 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
              >
                <Upload size={13} />
                {uploadingImage ? "上传保存中…" : "上传更换图片"}
              </button>

              <label className="inline-flex items-center gap-1.5 text-[11px] text-neutral-700">
                <input
                  type="checkbox"
                  checked={selectedNode.slotRole === "image"}
                  onChange={(e) =>
                    patchSelected((n) =>
                      n.type === "image"
                        ? { ...n, slotRole: e.target.checked ? "image" : undefined }
                        : n,
                    )
                  }
                />
                <span>套用到图片块时填入原图</span>
              </label>
            </div>

            {uploadError && <p className="text-[11px] text-red-600">{uploadError}</p>}

            <label className="block space-y-1 text-neutral-600">
              <span>显示最大宽度 ({selectedNode.maxWidthPercent ?? 100}%)</span>
              <input
                type="range"
                min={30}
                max={100}
                value={selectedNode.maxWidthPercent ?? 100}
                onChange={(e) =>
                  patchSelected((n) =>
                    n.type === "image" ? { ...n, maxWidthPercent: Number(e.target.value) } : n,
                  )
                }
                className="w-full accent-neutral-900"
              />
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1 text-neutral-600">
                <span>图片说明 (alt)</span>
                <input
                  type="text"
                  value={selectedNode.alt}
                  onChange={(e) =>
                    patchSelected((n) =>
                      n.type === "image" ? { ...n, alt: e.target.value } : n,
                    )
                  }
                  className="w-full rounded border border-neutral-200 px-2 py-1 text-neutral-900"
                />
              </label>
              <label className="space-y-1 text-neutral-600">
                <span>图注（可选）</span>
                <input
                  type="text"
                  value={selectedNode.caption ?? ""}
                  onChange={(e) =>
                    patchSelected((n) =>
                      n.type === "image" ? { ...n, caption: e.target.value } : n,
                    )
                  }
                  className="w-full rounded border border-neutral-200 px-2 py-1 text-neutral-900"
                />
              </label>
            </div>
          </div>
        )}

        {/* 分割线专属设置 */}
        {selectedNode.type === "divider" && (
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1 text-neutral-600">
              <span>线条样式</span>
              <select
                value={selectedNode.dividerStyle}
                onChange={(e) =>
                  patchSelected((n) =>
                    n.type === "divider"
                      ? {
                          ...n,
                          dividerStyle: e.target.value as "solid" | "dashed" | "dotted" | "short",
                        }
                      : n,
                  )
                }
                className="w-full rounded border border-neutral-200 bg-white px-2 py-1 text-neutral-900"
              >
                <option value="solid">实线</option>
                <option value="dashed">虚线</option>
                <option value="dotted">点线</option>
                <option value="short">居中短线</option>
              </select>
            </label>
            <label className="space-y-1 text-neutral-600">
              <span>宽度 ({selectedNode.widthPercent}%)</span>
              <input
                type="range"
                min={15}
                max={100}
                value={selectedNode.widthPercent}
                onChange={(e) =>
                  patchSelected((n) =>
                    n.type === "divider" ? { ...n, widthPercent: Number(e.target.value) } : n,
                  )
                }
                className="w-full accent-neutral-900"
              />
            </label>
            <label className="space-y-1 text-neutral-600">
              <span>粗细 ({selectedNode.thickness}px)</span>
              <input
                type="number"
                min={1}
                max={6}
                value={selectedNode.thickness}
                onChange={(e) =>
                  patchSelected((n) =>
                    n.type === "divider" ? { ...n, thickness: Number(e.target.value) } : n,
                  )
                }
                className="w-full rounded border border-neutral-200 px-2 py-1 text-neutral-900"
              />
            </label>
            <label className="space-y-1 text-neutral-600">
              <span>线条颜色</span>
              <input
                type="color"
                value={/^#[0-9a-fA-F]{6}$/.test(selectedNode.color) ? selectedNode.color : "#d4d4d4"}
                onChange={(e) =>
                  patchSelected((n) =>
                    n.type === "divider" ? { ...n, color: e.target.value } : n,
                  )
                }
                className="block h-7 w-12 cursor-pointer rounded border border-neutral-200 bg-white p-0.5"
              />
            </label>
          </div>
        )}

        <details key={selectedNode.id} open={Boolean(selectedNode.boxStyle.position)} className="space-y-2 border-t border-neutral-100 pt-2.5">
          <summary className="cursor-pointer font-semibold text-neutral-800">尺寸与位置</summary>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-0.5 text-neutral-600">
              <span>定位方式</span>
              <select
                value={selectedNode.boxStyle.position ?? ""}
                onChange={(e) => patchBox({ position: e.target.value as ComponentBoxStyle["position"] })}
                className="w-full rounded border border-neutral-200 bg-white px-2 py-1"
              >
                <option value="">随容器排列</option>
                <option value="relative">相对偏移</option>
                <option value="absolute">叠放在容器内</option>
              </select>
            </label>
            <label className="space-y-0.5 text-neutral-600">
              <span>旋转角度</span>
              <input
                type="number"
                min={-360}
                max={360}
                value={selectedNode.boxStyle.rotation ?? 0}
                onChange={(e) => patchBox({ rotation: Number(e.target.value) })}
                className="w-full rounded border border-neutral-200 px-2 py-1"
              />
            </label>
            {([
              { key: "width", label: "宽度" },
              { key: "height", label: "高度" },
              { key: "top", label: "上偏移" },
              { key: "right", label: "右偏移" },
              { key: "bottom", label: "下偏移" },
              { key: "left", label: "左偏移" },
            ] as const).slice(0, selectedNode.boxStyle.position ? 6 : 2).map(({ key, label }) => (
              <label key={key} className="space-y-0.5 text-neutral-600">
                <span>{label}</span>
                <input
                  key={selectedNode.boxStyle[key] ?? ""}
                  defaultValue={selectedNode.boxStyle[key] ?? ""}
                  placeholder="自动"
                  onBlur={(e) => {
                    const value = e.currentTarget.value.trim();
                    const length = /^-?\d+(?:\.\d+)?$/.test(value) ? `${value}px` : value;
                    const cleaned = sanitizeBoxStyle({ [key]: length })[key];
                    if (value && !cleaned) {
                      e.currentTarget.value = selectedNode.boxStyle[key] ?? "";
                      return;
                    }
                    e.currentTarget.value = cleaned ?? "";
                    patchBox({ [key]: cleaned });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                  }}
                  className="w-full rounded border border-neutral-200 px-2 py-1"
                />
              </label>
            ))}
            {selectedNode.boxStyle.position && (
              <label className="space-y-0.5 text-neutral-600">
                <span>叠放层级</span>
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={selectedNode.boxStyle.zIndex ?? 0}
                  onChange={(e) => patchBox({ zIndex: Number(e.target.value) })}
                  className="w-full rounded border border-neutral-200 px-2 py-1"
                />
              </label>
            )}
          </div>
          <p className="text-[11px] text-neutral-500">尺寸和偏移可输入像素或百分比，例如 32px、25%。</p>
        </details>

        {/* 通用盒模型：间距、边框、圆角、底色 */}
        <div className="space-y-2.5 border-t border-neutral-100 pt-2.5">
          <div className="font-semibold text-neutral-800">间距、边框、圆角与背景</div>

          <div className="grid grid-cols-4 gap-1.5">
            {(
              [
                { key: "paddingTop", label: "上内距" },
                { key: "paddingBottom", label: "下内距" },
                { key: "paddingLeft", label: "左内距" },
                { key: "paddingRight", label: "右内距" },
                { key: "marginTop", label: "上外距" },
                { key: "marginBottom", label: "下外距" },
                { key: "marginLeft", label: "左外距" },
                { key: "marginRight", label: "右外距" },
              ] as const
            ).map((f) => (
              <label key={f.key} className="space-y-0.5 text-[11px] text-neutral-500">
                <span>{f.label}</span>
                <input
                  type="number"
                  min={f.key.startsWith("margin") ? -240 : 0}
                  max={f.key.startsWith("margin") ? 240 : 160}
                  value={selectedNode.boxStyle[f.key] ?? 0}
                  onChange={(e) => patchBox({ [f.key]: Number(e.target.value) })}
                  className="w-full rounded border border-neutral-200 bg-white px-1.5 py-1 text-xs text-neutral-900"
                />
              </label>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <label className="space-y-0.5 text-[11px] text-neutral-500">
              <span>边框位置</span>
              <select
                value={selectedNode.boxStyle.borderSides ?? "all"}
                onChange={(e) =>
                  patchBox({
                    borderSides: e.target.value as BorderSidesKind,
                    borderTopDecl: undefined,
                    borderRightDecl: undefined,
                    borderBottomDecl: undefined,
                    borderLeftDecl: undefined,
                  })
                }
                className="w-full rounded border border-neutral-200 bg-white px-1.5 py-1 text-xs text-neutral-900"
              >
                <option value="all">四周边框</option>
                <option value="left">左侧竖条</option>
                <option value="bottom">底部下划线</option>
                <option value="top">仅上边</option>
                <option value="right">仅右边</option>
                <option value="top-right">右上角</option>
                <option value="top-bottom">上下双线</option>
                <option value="left-top">左上折角</option>
              </select>
            </label>
            <label className="space-y-0.5 text-[11px] text-neutral-500">
              <span>边框样式</span>
              <select
                value={selectedNode.boxStyle.borderStyle ?? "solid"}
                onChange={(e) =>
                  patchBox({
                    borderStyle: e.target.value as "none" | "solid" | "dashed" | "dotted",
                    borderTopDecl: undefined,
                    borderRightDecl: undefined,
                    borderBottomDecl: undefined,
                    borderLeftDecl: undefined,
                  })
                }
                className="w-full rounded border border-neutral-200 bg-white px-1.5 py-1 text-xs text-neutral-900"
              >
                <option value="solid">实线</option>
                <option value="dashed">虚线</option>
                <option value="dotted">点线</option>
                <option value="none">无边框</option>
              </select>
            </label>
            <label className="space-y-0.5 text-[11px] text-neutral-500">
              <span>线宽 (px)</span>
              <input
                type="number"
                min={0}
                max={24}
                value={selectedNode.boxStyle.borderWidth ?? 0}
                onChange={(e) =>
                  patchBox({
                    borderWidth: Number(e.target.value),
                    borderTopDecl: undefined,
                    borderRightDecl: undefined,
                    borderBottomDecl: undefined,
                    borderLeftDecl: undefined,
                  })
                }
                className="w-full rounded border border-neutral-200 px-1.5 py-1 text-xs text-neutral-900"
              />
            </label>
          </div>

          <div className="grid grid-cols-3 items-end gap-2">
            <label className="space-y-0.5 text-[11px] text-neutral-500">
              <span>圆角 ({selectedNode.boxStyle.borderRadius ?? 0}px)</span>
              <input
                type="range"
                min={0}
                max={32}
                value={selectedNode.boxStyle.borderRadius ?? 0}
                onChange={(e) => patchBox({ borderRadius: Number(e.target.value), cornerRadii: undefined })}
                className="w-full accent-neutral-900"
              />
            </label>
            <label className="space-y-0.5 text-[11px] text-neutral-500">
              <span>边框色</span>
              <input
                type="color"
                value={
                  selectedNode.boxStyle.borderColor
                  && /^#[0-9a-fA-F]{6}$/.test(selectedNode.boxStyle.borderColor)
                    ? selectedNode.boxStyle.borderColor
                    : "#164b3e"
                }
                onChange={(e) =>
                  patchBox({
                    borderColor: e.target.value,
                    borderTopDecl: undefined,
                    borderRightDecl: undefined,
                    borderBottomDecl: undefined,
                    borderLeftDecl: undefined,
                  })
                }
                className="block h-7 w-full cursor-pointer rounded border border-neutral-200 bg-white p-0.5"
              />
            </label>
            <div className="space-y-0.5 text-[11px] text-neutral-500">
              <div className="flex items-center justify-between">
                <span>背景色</span>
                {(selectedNode.boxStyle.backgroundColor || selectedNode.boxStyle.backgroundGradient) && (
                  <button
                    type="button"
                    onClick={() => patchBox({ backgroundColor: undefined, backgroundGradient: undefined })}
                    className="text-[10px] underline"
                  >
                    透明
                  </button>
                )}
              </div>
              <input
                type="color"
                value={
                  selectedNode.boxStyle.backgroundColor
                  && /^#[0-9a-fA-F]{6}$/.test(selectedNode.boxStyle.backgroundColor)
                    ? selectedNode.boxStyle.backgroundColor
                    : "#f7f6f3"
                }
                onChange={(e) => patchBox({ backgroundColor: e.target.value, backgroundGradient: undefined })}
                className="block h-7 w-full cursor-pointer rounded border border-neutral-200 bg-white p-0.5"
              />
            </div>
          </div>

          {(selectedNode.boxStyle.backgroundGradient || selectedNode.boxStyle.boxShadow) && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-neutral-50 px-2.5 py-1.5 text-[11px] text-neutral-600">
              <span>已保留导入高阶装饰：</span>
              {selectedNode.boxStyle.backgroundGradient && (
                <button
                  type="button"
                  onClick={() => patchBox({ backgroundGradient: undefined })}
                  className="rounded border border-neutral-200 bg-white px-2 py-0.5 text-neutral-700 hover:bg-neutral-100"
                >
                  渐变背景 ×
                </button>
              )}
              {selectedNode.boxStyle.boxShadow && (
                <button
                  type="button"
                  onClick={() => patchBox({ boxShadow: undefined })}
                  className="rounded border border-neutral-200 bg-white px-2 py-0.5 text-neutral-700 hover:bg-neutral-100"
                >
                  投影效果 ×
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 右栏：画布式实时效果预览（点击元素即可在左侧树中选中） */}
      <div className="flex flex-col rounded-xl border border-neutral-200 bg-neutral-100/80 p-3.5 lg:col-span-4">
        <div className="mb-2 flex items-center justify-between text-xs text-neutral-600">
          <span className="font-semibold text-neutral-900">画布式预览（点击组件可定位层级）</span>
          <span className="text-[11px] text-neutral-400">375px 公众号视口</span>
        </div>

        <div className="mx-auto w-full max-w-[375px] flex-1 overflow-hidden rounded-2xl border border-neutral-300 bg-white p-4 shadow-sm">
          <div
            onClick={(e) => {
              const target = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-tree-node-id]");
              if (target?.dataset.treeNodeId) {
                selectNode(target.dataset.treeNodeId);
              }
            }}
            className="cursor-pointer"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </div>
      </div>
    </div>
  );
}
