"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Bold,
  Eraser,
  Italic,
  Plus,
  Save,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { AutoGrowTextarea } from "@/components/ui/auto-grow-textarea";
import {
  applyRunStyleRange,
  plainToRuns,
  runsToPlainText,
  syncPlainTextIntoRuns,
  type DocumentTextStyle,
  type FontFamilyChoice,
  type StructuredArticleBlock,
  type StructuredArticleDraft,
  type TextRun,
  type TextRunStyle,
} from "@/lib/typography/structured";
import { getXiumiPreset } from "@/lib/typography/xiumi-presets";

interface SelectionTarget {
  blockId: string;
  itemId?: string;
  start: number;
  end: number;
  snippet: string;
}

function RunsBadgePreview({ runs }: { runs: TextRun[] }) {
  const hasStyledRun = runs.some((r) => r.style && Object.keys(r.style).length > 0);
  if (!hasStyledRun) return null;
  return (
    <div className="mt-1.5 rounded-lg border border-dashed border-neutral-200 bg-neutral-50/70 px-2.5 py-1.5 text-xs leading-relaxed">
      {runs.map((r, idx) => (
        <span
          key={idx}
          style={{
            fontSize: r.style?.fontSize ? `${r.style.fontSize}px` : undefined,
            fontWeight: r.style?.bold === true ? 700 : r.style?.bold === false ? 400 : undefined,
            fontStyle: r.style?.italic === true ? "italic" : r.style?.italic === false ? "normal" : undefined,
            color: r.style?.color ?? undefined,
            fontFamily:
              r.style?.fontFamily === "serif"
                ? "Georgia, serif"
                : r.style?.fontFamily === "mono"
                  ? "ui-monospace, monospace"
                  : undefined,
          }}
        >
          {r.text}
        </span>
      ))}
    </div>
  );
}

export function StructuredDraftEditor({
  draft,
  imageUrls,
  saving,
  dirty,
  conflictError,
  selectedBlockId,
  onSelectBlock,
  onChangeDraft,
  onSaveNow,
  onReloadLatest,
}: {
  draft: StructuredArticleDraft;
  imageUrls: Record<string, string>;
  saving: boolean;
  dirty: boolean;
  conflictError: string;
  selectedBlockId: string | null;
  onSelectBlock: (blockId: string) => void;
  onChangeDraft: (updater: (prev: StructuredArticleDraft) => StructuredArticleDraft) => void;
  onSaveNow: () => void;
  onReloadLatest: () => void;
}) {
  const [selection, setSelection] = useState<SelectionTarget | null>(null);
  const [localColor, setLocalColor] = useState("#d80f30");

  function captureSelection(
    el: HTMLInputElement | HTMLTextAreaElement,
    blockId: string,
    itemId?: string,
  ) {
    onSelectBlock(blockId);
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    if (end > start) {
      const snippet = el.value.slice(start, end);
      setSelection({
        blockId,
        itemId,
        start,
        end,
        snippet: snippet.length > 18 ? `${snippet.slice(0, 18)}…` : snippet,
      });
    } else if (selection?.blockId === blockId && selection?.itemId === itemId) {
      setSelection(null);
    }
  }

  function applySelectionPatch(patch: Partial<TextRunStyle> | "clear") {
    if (!selection || selection.end <= selection.start) return;
    const { blockId, itemId, start, end } = selection;

    onChangeDraft((prev) => ({
      ...prev,
      blocks: prev.blocks.map((block) => {
        if (block.id !== blockId) return block;
        if (
          block.type === "heading"
          || block.type === "paragraph"
          || block.type === "blockquote"
          || block.type === "preset"
        ) {
          return {
            ...block,
            runs: applyRunStyleRange(block.runs, start, end, patch),
          };
        }
        if (block.type === "list" && itemId) {
          return {
            ...block,
            items: block.items.map((it) =>
              it.id === itemId ? { ...it, runs: applyRunStyleRange(it.runs, start, end, patch) } : it,
            ),
          };
        }
        return block;
      }),
    }));
  }

  function clearBlockPreset(blockId: string) {
    onChangeDraft((prev) => ({
      ...prev,
      blocks: prev.blocks.map((b) => {
        if (b.id !== blockId) return b;
        if (b.type === "preset") {
          return { id: b.id, type: "paragraph", runs: b.runs, sourceNodeId: b.sourceNodeId };
        }
        if ("presetId" in b && b.presetId) {
          const copy = { ...b };
          delete copy.presetId;
          return copy;
        }
        return b;
      }),
    }));
  }

  function updateDocStyle(patch: Partial<DocumentTextStyle>) {
    onChangeDraft((prev) => ({
      ...prev,
      documentStyle: { ...prev.documentStyle, ...patch },
    }));
  }

  function moveBlock(index: number, delta: -1 | 1) {
    onChangeDraft((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.blocks.length) return prev;
      const next = [...prev.blocks];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return { ...prev, blocks: next };
    });
  }

  function removeBlock(id: string) {
    onChangeDraft((prev) => ({
      ...prev,
      blocks: prev.blocks.filter((b) => b.id !== id),
    }));
    if (selection?.blockId === id) setSelection(null);
  }

  function appendBlock(kind: "heading" | "paragraph" | "blockquote" | "divider") {
    const newId = crypto.randomUUID();
    const newBlock: StructuredArticleBlock =
      kind === "heading"
        ? { id: newId, type: "heading", level: 2, runs: plainToRuns("新小标题") }
        : kind === "blockquote"
          ? { id: newId, type: "blockquote", runs: plainToRuns("引用观点…") }
          : kind === "divider"
            ? { id: newId, type: "divider" }
            : { id: newId, type: "paragraph", runs: plainToRuns("新增正文段落…") };
    onChangeDraft((prev) => ({ ...prev, blocks: [...prev.blocks, newBlock] }));
    onSelectBlock(newId);
  }

  const doc = draft.documentStyle ?? {};

  return (
    <div className="flex flex-col">
      {/* 并发冲突告警 */}
      {conflictError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 border-b border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-800">
          <span>{conflictError}</span>
          <button
            type="button"
            onClick={onReloadLatest}
            className="rounded-md bg-red-700 px-2.5 py-1 font-medium text-white hover:bg-red-800"
          >
            加载最新版本
          </button>
        </div>
      )}

      {/* Qwen 提请核对警告 */}
      {draft.warnings.length > 0 && (
        <div className="border-b border-amber-200 bg-amber-50/80 px-4 py-2.5 text-xs text-amber-950">
          <div className="flex items-center gap-1.5 font-semibold">
            <AlertTriangle size={14} className="text-amber-600" />
            <span>提请人工核对（素材中缺少明确依据的人名、日期、数据或引语）：</span>
          </div>
          <ul className="mt-1.5 list-disc space-y-1 pl-5">
            {draft.warnings.map((w, idx) => (
              <li key={idx} className="flex items-center justify-between gap-2">
                <span>{w}</span>
                <button
                  type="button"
                  onClick={() =>
                    onChangeDraft((prev) => ({
                      ...prev,
                      warnings: prev.warnings.filter((_, i) => i !== idx),
                    }))
                  }
                  className="shrink-0 text-[11px] text-amber-700 underline hover:text-amber-950"
                >
                  已核对移除
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 吸顶工具栏组（随页面自然滚动保持可见，无内部滚动容器） */}
      <div className="sticky top-[53px] z-20 rounded-t-2xl bg-white/95 backdrop-blur-md">
        {/* 第二级：全文样式设置栏 */}
        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 bg-neutral-50/80 px-3.5 py-2 text-xs">
          <span className="font-semibold text-neutral-700">全文设置：</span>

          <label className="inline-flex items-center gap-1 text-neutral-600">
            <span>字体</span>
            <select
              value={doc.fontFamily ?? "default"}
              onChange={(e) => updateDocStyle({ fontFamily: e.target.value as FontFamilyChoice })}
              className="rounded border border-neutral-200 bg-white px-2 py-0.5 text-neutral-900"
            >
              <option value="default">跟随模板</option>
              <option value="sans">无衬线（萍方）</option>
              <option value="serif">衬线（宋楷）</option>
              <option value="mono">等宽体</option>
            </select>
          </label>

          <label className="inline-flex items-center gap-1 text-neutral-600">
            <span>字号</span>
            <select
              value={doc.fontSize ?? ""}
              onChange={(e) =>
                updateDocStyle({ fontSize: e.target.value ? Number(e.target.value) : null })
              }
              className="rounded border border-neutral-200 bg-white px-2 py-0.5 text-neutral-900"
            >
              <option value="">跟随模板</option>
              {[14, 15, 16, 17, 18, 20].map((sz) => (
                <option key={sz} value={sz}>
                  {sz}px
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            aria-pressed={doc.bold === true}
            onClick={() => updateDocStyle({ bold: doc.bold === true ? null : true })}
            className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 font-medium ${
              doc.bold === true ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-200 bg-white text-neutral-700"
            }`}
          >
            <Bold size={12} />
            全文加粗
          </button>

          <button
            type="button"
            aria-pressed={doc.italic === true}
            onClick={() => updateDocStyle({ italic: doc.italic === true ? null : true })}
            className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 font-medium ${
              doc.italic === true ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-200 bg-white text-neutral-700"
            }`}
          >
            <Italic size={12} />
            全文斜体
          </button>

          <label className="inline-flex items-center gap-1 text-neutral-600">
            <span>正文色</span>
            <input
              type="color"
              aria-label="全文正文色"
              value={doc.color && /^#[0-9a-fA-F]{6}$/.test(doc.color) ? doc.color : "#3e3e3e"}
              onChange={(e) => updateDocStyle({ color: e.target.value })}
              className="size-5 cursor-pointer border-0 bg-transparent p-0"
            />
            {doc.color && (
              <button
                type="button"
                onClick={() => updateDocStyle({ color: null })}
                className="text-[11px] text-neutral-500 underline"
              >
                还原
              </button>
            )}
          </label>

          <div className="ml-auto flex items-center gap-2">
            <span className="text-[11px] text-neutral-400">
              版本 v{draft.version} {saving ? "· 保存中…" : dirty ? "· 待保存" : "· 已保存"}
            </span>
            <button
              type="button"
              disabled={saving || !dirty}
              onClick={onSaveNow}
              className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-800 hover:bg-neutral-100 disabled:opacity-40"
            >
              <Save size={12} />
              保存
            </button>
          </div>
        </div>

        {/* 第三级：选区局部样式工具栏 */}
        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 bg-white px-3.5 py-2 text-xs">
          <span className="font-semibold text-neutral-700">
            选区局部样式{selection ? `（已选：「${selection.snippet}」）` : "（划选文字设置局部样式，或点左侧组件抽屉套用整块模板）"}：
          </span>

          <select
            aria-label="局部字号"
            disabled={!selection}
            defaultValue=""
            onChange={(e) => {
              if (!e.target.value) return;
              applySelectionPatch({ fontSize: Number(e.target.value) });
              e.target.value = "";
            }}
            className="rounded border border-neutral-200 bg-neutral-50 px-2 py-0.5 disabled:opacity-40"
          >
            <option value="">局部字号</option>
            {[12, 13, 14, 15, 16, 18, 20, 22, 24].map((sz) => (
              <option key={sz} value={sz}>
                {sz}px
              </option>
            ))}
          </select>

          <select
            aria-label="局部字体样式"
            disabled={!selection}
            defaultValue=""
            onChange={(e) => {
              const val = e.target.value as "sans" | "serif" | "mono" | "";
              if (!val) return;
              applySelectionPatch({ fontFamily: val });
              e.target.value = "";
            }}
            className="rounded border border-neutral-200 bg-neutral-50 px-2 py-0.5 disabled:opacity-40"
          >
            <option value="">局部字体</option>
            <option value="sans">无衬线</option>
            <option value="serif">衬线</option>
            <option value="mono">等宽</option>
          </select>

          <button
            type="button"
            disabled={!selection}
            onClick={() => applySelectionPatch({ bold: true })}
            className="inline-flex items-center gap-1 rounded border border-neutral-200 bg-neutral-50 px-2 py-0.5 font-medium hover:bg-neutral-100 disabled:opacity-40"
          >
            <Bold size={12} />
            加粗
          </button>

          <button
            type="button"
            disabled={!selection}
            onClick={() => applySelectionPatch({ italic: true })}
            className="inline-flex items-center gap-1 rounded border border-neutral-200 bg-neutral-50 px-2 py-0.5 font-medium hover:bg-neutral-100 disabled:opacity-40"
          >
            <Italic size={12} />
            斜体
          </button>

          <div className="inline-flex items-center gap-1">
            <input
              type="color"
              aria-label="选区局部颜色"
              value={localColor}
              onChange={(e) => setLocalColor(e.target.value)}
              className="size-5 cursor-pointer border-0 bg-transparent p-0"
            />
            <button
              type="button"
              disabled={!selection}
              onClick={() => applySelectionPatch({ color: localColor })}
              className="rounded border border-neutral-200 bg-neutral-50 px-2 py-0.5 font-medium hover:bg-neutral-100 disabled:opacity-40"
            >
              应用颜色
            </button>
          </div>

          <button
            type="button"
            disabled={!selection}
            onClick={() => applySelectionPatch("clear")}
            className="inline-flex items-center gap-1 rounded border border-neutral-200 bg-white px-2 py-0.5 text-neutral-600 hover:bg-neutral-50 disabled:opacity-40"
          >
            <Eraser size={12} />
            清除选区样式
          </button>
        </div>
      </div>

      {/* 结构化块编辑列表（无内部滚动条，随页面与右侧预览自然对齐） */}
      <div className="space-y-3 p-4">
        <div className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-3">
          <label className="mb-1 block text-[11px] font-semibold text-neutral-500">文章主标题（H1）</label>
          <input
            type="text"
            aria-label="文章主标题"
            value={draft.title}
            onChange={(e) => onChangeDraft((prev) => ({ ...prev, title: e.target.value }))}
            className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-base font-semibold text-neutral-950 focus:border-neutral-400 focus:outline-none"
          />
        </div>

        {draft.blocks.map((block, index) => {
          const isSelected = selectedBlockId === block.id;
          const appliedPreset =
            "presetId" in block && block.presetId ? getXiumiPreset(block.presetId) : undefined;

          return (
            <div
              key={block.id}
              data-editor-block-id={block.id}
              onClick={() => onSelectBlock(block.id)}
              onFocusCapture={() => onSelectBlock(block.id)}
              className={`rounded-xl border bg-white p-3 transition ${
                isSelected
                  ? "border-neutral-950 shadow-sm ring-2 ring-neutral-950/10"
                  : "border-neutral-200 hover:border-neutral-300"
              }`}
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  {block.type === "heading" && (
                    <select
                      aria-label="标题层级"
                      value={block.level}
                      onChange={(e) => {
                        const level = Number(e.target.value) as 1 | 2 | 3;
                        onChangeDraft((prev) => ({
                          ...prev,
                          blocks: prev.blocks.map((b) =>
                            b.id === block.id && b.type === "heading" ? { ...b, level } : b,
                          ),
                        }));
                      }}
                      className="rounded bg-neutral-950 px-2 py-0.5 text-[11px] font-semibold text-white"
                    >
                      <option value={1}>一级标题 H1</option>
                      <option value={2}>二级标题 H2</option>
                      <option value={3}>三级标题 H3</option>
                    </select>
                  )}
                  {block.type === "paragraph" && (
                    <span className="rounded bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-700">
                      正文段落
                    </span>
                  )}
                  {block.type === "blockquote" && (
                    <span className="rounded bg-purple-50 px-2 py-0.5 text-[11px] font-medium text-purple-700">
                      引用块
                    </span>
                  )}
                  {block.type === "preset" && (
                    <span className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                      图文组件块
                    </span>
                  )}
                  {block.type === "list" && (
                    <button
                      type="button"
                      onClick={() =>
                        onChangeDraft((prev) => ({
                          ...prev,
                          blocks: prev.blocks.map((b) =>
                            b.id === block.id && b.type === "list" ? { ...b, ordered: !b.ordered } : b,
                          ),
                        }))
                      }
                      className="rounded bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700"
                    >
                      {block.ordered ? "有序列表（点击切无序）" : "无序列表（点击切有序）"}
                    </button>
                  )}
                  {block.type === "image" && (
                    <span className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                      画布配图
                    </span>
                  )}
                  {block.type === "divider" && (
                    <span className="rounded bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600">
                      分割线
                    </span>
                  )}
                  {"verbatim" in block && block.verbatim && (
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                      原文保留快照
                    </span>
                  )}
                  {appliedPreset && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                      <Wand2 size={10} />
                      <span>{appliedPreset.name}</span>
                      <button
                        type="button"
                        aria-label="移除该块组件样式"
                        title="恢复普通样式"
                        onClick={(e) => {
                          e.stopPropagation();
                          clearBlockPreset(block.id);
                        }}
                        className="rounded-full p-0.5 hover:bg-emerald-200/70"
                      >
                        <X size={10} />
                      </button>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="上移块"
                    disabled={index === 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      moveBlock(index, -1);
                    }}
                    className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-30"
                  >
                    <ArrowUp size={13} />
                  </button>
                  <button
                    type="button"
                    aria-label="下移块"
                    disabled={index === draft.blocks.length - 1}
                    onClick={(e) => {
                      e.stopPropagation();
                      moveBlock(index, 1);
                    }}
                    className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-30"
                  >
                    <ArrowDown size={13} />
                  </button>
                  <button
                    type="button"
                    aria-label="删除块"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeBlock(block.id);
                    }}
                    className="rounded p-1 text-neutral-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {block.type === "heading" && (
                <>
                  <input
                    type="text"
                    value={runsToPlainText(block.runs)}
                    onSelect={(e) => captureSelection(e.currentTarget, block.id)}
                    onChange={(e) => {
                      const val = e.target.value;
                      onChangeDraft((prev) => ({
                        ...prev,
                        blocks: prev.blocks.map((b) =>
                          b.id === block.id && b.type === "heading"
                            ? { ...b, runs: syncPlainTextIntoRuns(b.runs, val) }
                            : b,
                        ),
                      }));
                    }}
                    className="w-full rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-semibold text-neutral-950 focus:border-neutral-400 focus:outline-none"
                  />
                  <RunsBadgePreview runs={block.runs} />
                </>
              )}

              {(block.type === "paragraph" || block.type === "blockquote" || block.type === "preset") && (
                <>
                  <AutoGrowTextarea
                    minHeightPx={68}
                    value={runsToPlainText(block.runs)}
                    onSelect={(e) => captureSelection(e.currentTarget, block.id)}
                    onChange={(e) => {
                      const val = e.target.value;
                      onChangeDraft((prev) => ({
                        ...prev,
                        blocks: prev.blocks.map((b) =>
                          b.id === block.id
                          && (b.type === "paragraph" || b.type === "blockquote" || b.type === "preset")
                            ? { ...b, runs: syncPlainTextIntoRuns(b.runs, val) }
                            : b,
                        ),
                      }));
                    }}
                    className="w-full rounded-lg border border-neutral-200 p-2.5 text-sm leading-relaxed text-neutral-900 focus:border-neutral-400 focus:outline-none"
                  />
                  <RunsBadgePreview runs={block.runs} />
                </>
              )}

              {block.type === "list" && (
                <div className="space-y-2">
                  {block.items.map((item, itemIdx) => (
                    <div key={item.id} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-5 text-right text-xs text-neutral-400">
                          {block.ordered ? `${itemIdx + 1}.` : "•"}
                        </span>
                        <input
                          type="text"
                          value={runsToPlainText(item.runs)}
                          onSelect={(e) => captureSelection(e.currentTarget, block.id, item.id)}
                          onChange={(e) => {
                            const val = e.target.value;
                            onChangeDraft((prev) => ({
                              ...prev,
                              blocks: prev.blocks.map((b) =>
                                b.id === block.id && b.type === "list"
                                  ? {
                                      ...b,
                                      items: b.items.map((it) =>
                                        it.id === item.id ? { ...it, runs: syncPlainTextIntoRuns(it.runs, val) } : it,
                                      ),
                                    }
                                  : b,
                              ),
                            }));
                          }}
                          className="flex-1 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-sm text-neutral-900 focus:border-neutral-400 focus:outline-none"
                        />
                        {block.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              onChangeDraft((prev) => ({
                                ...prev,
                                blocks: prev.blocks.map((b) =>
                                  b.id === block.id && b.type === "list"
                                    ? { ...b, items: b.items.filter((it) => it.id !== item.id) }
                                    : b,
                                ),
                              }))
                            }
                            className="text-xs text-neutral-400 hover:text-red-600"
                          >
                            移除
                          </button>
                        )}
                      </div>
                      <RunsBadgePreview runs={item.runs} />
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      onChangeDraft((prev) => ({
                        ...prev,
                        blocks: prev.blocks.map((b) =>
                          b.id === block.id && b.type === "list"
                            ? { ...b, items: [...b.items, { id: crypto.randomUUID(), runs: plainToRuns("新条目") }] }
                            : b,
                        ),
                      }))
                    }
                    className="inline-flex items-center gap-1 text-xs font-medium text-neutral-600 hover:text-neutral-950"
                  >
                    <Plus size={12} />
                    新增列表项
                  </button>
                </div>
              )}

              {block.type === "image" && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  {(imageUrls[block.assetId] || draft.projectId) ? (
                    /* eslint-disable-next-line @next/next/no-img-element -- 私有项目图片预览 */
                    <img
                      src={
                        imageUrls[block.assetId]
                        || `/api/typography/preview-image/${encodeURIComponent(draft.projectId)}/${encodeURIComponent(block.assetId)}`
                      }
                      alt={block.alt}
                      className="h-20 w-28 shrink-0 rounded-lg border border-neutral-200 object-cover"
                    />
                  ) : (
                    <div className="grid h-20 w-28 shrink-0 place-items-center rounded-lg bg-neutral-100 text-xs text-neutral-400">
                      配图预览
                    </div>
                  )}
                  <div className="grid flex-1 gap-2 sm:grid-cols-2">
                    <label className="space-y-1 text-xs text-neutral-600">
                      <span>图片说明（alt）</span>
                      <input
                        type="text"
                        value={block.alt}
                        onChange={(e) => {
                          const alt = e.target.value;
                          onChangeDraft((prev) => ({
                            ...prev,
                            blocks: prev.blocks.map((b) =>
                              b.id === block.id && b.type === "image" ? { ...b, alt } : b,
                            ),
                          }));
                        }}
                        className="w-full rounded border border-neutral-200 px-2.5 py-1 text-neutral-900"
                      />
                    </label>
                    <label className="space-y-1 text-xs text-neutral-600">
                      <span>图注（显示在图下方，可选）</span>
                      <input
                        type="text"
                        value={block.caption ?? ""}
                        onChange={(e) => {
                          const caption = e.target.value;
                          onChangeDraft((prev) => ({
                            ...prev,
                            blocks: prev.blocks.map((b) =>
                              b.id === block.id && b.type === "image" ? { ...b, caption } : b,
                            ),
                          }));
                        }}
                        className="w-full rounded border border-neutral-200 px-2.5 py-1 text-neutral-900"
                      />
                    </label>
                  </div>
                </div>
              )}

              {block.type === "divider" && (
                <div className="py-1">
                  <div className="h-px w-full bg-neutral-200" />
                </div>
              )}
            </div>
          );
        })}

        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-neutral-200 bg-neutral-50/70 p-3 text-xs">
          <span className="text-neutral-500">插入块：</span>
          <button
            type="button"
            onClick={() => appendBlock("paragraph")}
            className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1 font-medium hover:bg-neutral-50"
          >
            + 正文段落
          </button>
          <button
            type="button"
            onClick={() => appendBlock("heading")}
            className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1 font-medium hover:bg-neutral-50"
          >
            + 小标题
          </button>
          <button
            type="button"
            onClick={() => appendBlock("blockquote")}
            className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1 font-medium hover:bg-neutral-50"
          >
            + 引用块
          </button>
          <button
            type="button"
            onClick={() => appendBlock("divider")}
            className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1 font-medium hover:bg-neutral-50"
          >
            + 分割线
          </button>
        </div>
      </div>
    </div>
  );
}
