"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowRight, CheckCircle2, Clock, X } from "lucide-react";
import {
  ARTICLE_TEXT_ROLE_LABEL,
  type ArticleGraphAnalysis,
  type ArticleGraphNode,
  type ArticleSnapshotRecord,
  type SnapshotOrderedNode,
} from "@/lib/studio/article-graph";

const timeFormat = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  dateStyle: "short",
  timeStyle: "short",
});

function NodeRowPreview({
  order,
  kind,
  role,
  text,
  imageUrl,
  filename,
}: {
  order?: number;
  kind: "text" | "image";
  role?: "material" | "requirement" | "verbatim";
  text?: string;
  imageUrl?: string;
  filename?: string;
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-neutral-200/90 bg-white p-2.5 text-xs">
      {order != null && (
        <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-[10px] font-bold text-white">
          {order}
        </span>
      )}
      {kind === "image" ? (
        <div className="flex items-center gap-2.5">
          {imageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element -- 画布私有签名图片预览 */
            <img src={imageUrl} alt={filename || "配图"} className="size-10 rounded-lg object-cover" />
          ) : (
            <div className="grid size-10 place-items-center rounded-lg bg-neutral-100 text-[10px] text-neutral-500">
              图片
            </div>
          )}
          <div>
            <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
              画布图片
            </span>
            <p className="mt-1 text-neutral-600">{filename || "项目配图"}</p>
          </div>
        </div>
      ) : (
        <div className="min-w-0 flex-1 space-y-1">
          <span
            className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${
              role === "requirement"
                ? "bg-indigo-50 text-indigo-700"
                : role === "verbatim"
                  ? "bg-amber-50 text-amber-800"
                  : "bg-neutral-100 text-neutral-700"
            }`}
          >
            {ARTICLE_TEXT_ROLE_LABEL[role ?? "material"]}
          </span>
          <p className="line-clamp-2 whitespace-pre-wrap break-words text-neutral-800">
            {text || "（空）"}
          </p>
        </div>
      )}
    </div>
  );
}

export function ArticleStagingDialog({
  open,
  projectId,
  analysis,
  snapshots,
  selectedChainHeadId,
  onSelectChainHead,
  onStage,
  onClose,
}: {
  open: boolean;
  projectId: string;
  analysis: ArticleGraphAnalysis;
  snapshots: ArticleSnapshotRecord[];
  selectedChainHeadId: string | null;
  onSelectChainHead: (headId: string) => void;
  onStage: (headId: string | null) => Promise<ArticleSnapshotRecord | null>;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<"stage" | "history">("stage");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [justSaved, setJustSaved] = useState<ArticleSnapshotRecord | null>(null);
  const [expandedSnapId, setExpandedSnapId] = useState<string | null>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) {
      setError("");
      setJustSaved(null);
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  const effectiveHead = selectedChainHeadId ?? analysis.selectedChainHeadId;
  const canStage =
    analysis.status === "ok" && (!analysis.needsChainSelection || Boolean(effectiveHead));

  async function handleConfirmStage() {
    if (!canStage || saving) return;
    setSaving(true);
    setError("");
    try {
      const created = await onStage(effectiveHead);
      if (created) {
        setJustSaved(created);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "暂存失败，请稍后重试。");
    } finally {
      setSaving(false);
    }
  }

  function snapshotImageLookup(snapNode: SnapshotOrderedNode, allNodes: ArticleGraphNode[]) {
    return allNodes.find((n) => n.assetId && n.assetId === snapNode.assetId)?.imageUrl;
  }

  const allGraphNodes = [...analysis.activeChain, ...analysis.excludedNodes];

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="article-staging-title"
      onClose={onClose}
      className="w-full max-w-2xl rounded-2xl border border-neutral-200 bg-white p-0 text-neutral-950 shadow-2xl backdrop:bg-black/40"
    >
      <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
        <div className="flex items-center gap-3">
          <h2 id="article-staging-title" className="text-base font-semibold">
            文章顺序核对与不可变暂存
          </h2>
          <div className="inline-flex rounded-lg bg-neutral-100 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setTab("stage")}
              className={`rounded-md px-2.5 py-1 font-medium ${
                tab === "stage" ? "bg-white text-neutral-950 shadow-sm" : "text-neutral-600"
              }`}
            >
              新建暂存
            </button>
            <button
              type="button"
              onClick={() => setTab("history")}
              className={`rounded-md px-2.5 py-1 font-medium ${
                tab === "history" ? "bg-white text-neutral-950 shadow-sm" : "text-neutral-600"
              }`}
            >
              历史版本 ({snapshots.length})
            </button>
          </div>
        </div>
        <button
          type="button"
          aria-label="关闭弹窗"
          onClick={onClose}
          className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="max-h-[72vh] space-y-4 overflow-y-auto p-5">
        {tab === "stage" ? (
          <>
            {justSaved && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-900">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                  <span>
                    已保存不可变版本 <strong>v{justSaved.versionNumber}</strong>（共 {justSaved.nodes.length} 个有序节点）
                  </span>
                </div>
                <Link
                  href={`/typography?projectId=${projectId}&snapshotId=${justSaved.id}`}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-1.5 font-medium text-white hover:bg-emerald-800"
                >
                  去排版工作台生成文章
                  <ArrowRight size={13} />
                </Link>
              </div>
            )}

            {error && (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {error}
              </div>
            )}

            {analysis.status !== "ok" && analysis.status !== "generating_in_chain" ? (
              <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800">
                <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-600" />
                <div className="space-y-1">
                  <p className="font-semibold">暂存前请先修复画布连线</p>
                  <p>{analysis.message}</p>
                </div>
              </div>
            ) : (
              <>
                {analysis.status === "generating_in_chain" && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900">
                    <Clock size={16} className="mt-0.5 shrink-0 text-amber-600" />
                    <div className="space-y-0.5">
                      <p className="font-semibold">配图生成中</p>
                      <p>{analysis.message}</p>
                    </div>
                  </div>
                )}
                {analysis.needsChainSelection && (
                  <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3.5">
                    <p className="text-xs font-semibold text-amber-950">
                      检测到 {analysis.chains.length} 条独立内容链，请选定一条作为本次暂存主链：
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {analysis.chains.map((chain, idx) => {
                        const headId = chain[0].nodeId;
                        const checked = effectiveHead === headId;
                        const label =
                          chain.length > 1
                            ? `链 ${String.fromCharCode(65 + idx)}（${chain.length} 个相连节点）`
                            : `单节点 ${idx + 1}（未连线）`;
                        return (
                          <label
                            key={headId}
                            className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-xs ${
                              checked
                                ? "border-neutral-950 bg-white font-semibold"
                                : "border-amber-200/80 bg-white/70"
                            }`}
                          >
                            <input
                              type="radio"
                              name="selected-chain"
                              checked={checked}
                              onChange={() => onSelectChainHead(headId)}
                            />
                            <span>{label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-neutral-800">
                    按顺序采用的有效主链（{analysis.activeChain.length} 个节点）
                  </h3>
                  <div className="space-y-2 rounded-xl bg-neutral-50 p-3">
                    {analysis.activeChain.map((node, idx) => (
                      <NodeRowPreview
                        key={node.nodeId}
                        order={idx + 1}
                        kind={node.kind}
                        role={node.role}
                        text={node.text}
                        imageUrl={node.imageUrl}
                        filename={node.filename}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-neutral-500">
                    未采用的节点（{analysis.excludedNodes.length} 个）
                  </h3>
                  {analysis.excludedNodes.length === 0 ? (
                    <p className="text-xs text-neutral-400">当前无未采用的独立有内容节点。</p>
                  ) : (
                    <div className="space-y-2 rounded-xl border border-dashed border-neutral-200 p-3 opacity-75">
                      {analysis.excludedNodes.map((node) => (
                        <NodeRowPreview
                          key={node.nodeId}
                          kind={node.kind}
                          role={node.role}
                          text={node.text}
                          imageUrl={node.imageUrl}
                          filename={node.filename}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        ) : snapshots.length === 0 ? (
          <p className="py-10 text-center text-xs text-neutral-500">暂无已保存的暂存版本。</p>
        ) : (
          <div className="space-y-2.5">
            {snapshots.map((snap) => {
              const expanded = expandedSnapId === snap.id;
              return (
                <div key={snap.id} className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-3.5 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="rounded bg-neutral-950 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        v{snap.versionNumber}
                      </span>
                      <span className="ml-2 font-semibold text-neutral-950">{snap.title}</span>
                      <p className="mt-1 flex items-center gap-1.5 text-[11px] text-neutral-500">
                        <Clock size={11} />
                        {timeFormat.format(new Date(snap.createdAt))} · {snap.nodes.length} 个有序节点
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setExpandedSnapId(expanded ? null : snap.id)}
                        className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-neutral-700 hover:bg-neutral-50"
                      >
                        {expanded ? "收起预览" : "预览节点"}
                      </button>
                      <Link
                        href={`/typography?projectId=${projectId}&snapshotId=${snap.id}`}
                        className="inline-flex items-center gap-1 rounded-lg bg-neutral-950 px-3 py-1 font-medium text-white hover:bg-neutral-800"
                      >
                        用于排版
                        <ArrowRight size={12} />
                      </Link>
                    </div>
                  </div>
                  {expanded && (
                    <div className="mt-3 space-y-2 border-t border-neutral-200 pt-3">
                      {snap.nodes.map((n) => (
                        <NodeRowPreview
                          key={`${snap.id}-${n.order}`}
                          order={n.order}
                          kind={n.kind}
                          role={n.role}
                          text={n.text}
                          imageUrl={snapshotImageLookup(n, allGraphNodes)}
                          filename={n.filename}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {tab === "stage" && (
        <div className="flex items-center justify-between border-t border-neutral-200 bg-neutral-50 px-5 py-3.5 text-xs">
          <span className="text-neutral-500">每次暂存均生成独立不可变快照，后续修改画布不会改动历史版本。</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-neutral-200 bg-white px-3.5 py-1.5 font-medium text-neutral-700 hover:bg-neutral-100"
            >
              关闭
            </button>
            <button
              type="button"
              disabled={!canStage || saving}
              onClick={() => void handleConfirmStage()}
              className="rounded-lg bg-neutral-950 px-4 py-1.5 font-medium text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-500"
            >
              {saving ? "正在暂存…" : "保存暂存版本"}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
