"use client";

import { useEffect, useRef, useState } from "react";
import { Handle, NodeResizer, Position } from "@xyflow/react";
import { Trash2 } from "lucide-react";
import {
  ARTICLE_TEXT_ROLE_LABEL,
  type ArticleTextNodeRecord,
  type ArticleTextRole,
} from "@/lib/studio/article-graph";

export interface ArticleTextNodeData extends Record<string, unknown> {
  node: ArticleTextNodeRecord;
  badge?: string;
  connectable: boolean;
  highlightedError?: boolean;
  onChange: (id: string, patch: { content?: string; role?: ArticleTextRole }) => void;
  onCommit: (id: string, overrideContent?: string) => void;
  onResizeEnd: (id: string, size: { x: number; y: number; width: number }) => void;
  onDelete: (id: string) => void;
}

const ROLE_STYLES: Record<ArticleTextRole, { active: string; cardBorder: string; hint: string }> = {
  material: {
    active: "bg-neutral-900 text-white",
    cardBorder: "border-neutral-200",
    hint: "由 Qwen 结合上下文扩写润色",
  },
  requirement: {
    active: "bg-indigo-600 text-white",
    cardBorder: "border-indigo-300",
    hint: "仅作为写作指令参与生成，不直接输出为正文",
  },
  verbatim: {
    active: "bg-amber-600 text-white",
    cardBorder: "border-amber-300",
    hint: "逐字保留进入最终稿件，模型不会篡改",
  },
};

const ROLES: ArticleTextRole[] = ["material", "requirement", "verbatim"];

export function ArticleTextNode({
  data,
  selected,
}: {
  data: ArticleTextNodeData;
  selected?: boolean;
}) {
  const { node, badge, connectable, highlightedError } = data;
  const roleMeta = ROLE_STYLES[node.role] ?? ROLE_STYLES.material;

  const [localContent, setLocalContent] = useState(node.content);
  const isComposingRef = useRef(false);
  const isFocusedRef = useRef(false);
  const debounceTimerRef = useRef<number | null>(null);
  const latestContentRef = useRef(localContent);
  latestContentRef.current = localContent;

  // Sync external updates only when user is neither composing nor actively editing this input
  useEffect(() => {
    if (!isComposingRef.current && !isFocusedRef.current && node.content !== latestContentRef.current) {
      setLocalContent(node.content);
    }
  }, [node.content]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
    };
  }, []);

  function scheduleSyncToParent(nextVal: string, immediateCommit = false) {
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (immediateCommit) {
      data.onChange(node.id, { content: nextVal });
      data.onCommit(node.id, nextVal);
      return;
    }
    debounceTimerRef.current = window.setTimeout(() => {
      if (!isComposingRef.current) {
        data.onChange(node.id, { content: nextVal });
        data.onCommit(node.id, nextVal);
      }
    }, 350);
  }

  return (
    <div
      className={`group relative rounded-2xl border bg-white p-3 shadow-md transition ${
        highlightedError
          ? "border-red-500 ring-2 ring-red-500/30"
          : selected
            ? "border-neutral-950 ring-2 ring-neutral-950/15"
            : roleMeta.cardBorder
      }`}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={200}
        maxWidth={720}
        minHeight={130}
        onResizeEnd={(_, params) =>
          data.onResizeEnd(node.id, { x: params.x, y: params.y, width: params.width })
        }
      />

      {connectable && (
        <>
          <Handle
            type="target"
            position={Position.Left}
            aria-label="连入节点"
            className="!size-3.5 !border-2 !border-white !bg-neutral-900"
          />
          <Handle
            type="source"
            position={Position.Right}
            aria-label="连出节点"
            className="!size-3.5 !border-2 !border-white !bg-neutral-900"
          />
        </>
      )}

      {badge && (
        <span className="absolute -left-2.5 -top-2.5 z-10 inline-flex min-w-6 items-center justify-center rounded-full bg-neutral-950 px-2 py-0.5 text-[11px] font-bold text-white shadow">
          {badge}
        </span>
      )}

      <div className="mb-2 flex items-center justify-between gap-1.5">
        <div className="nodrag nopan inline-flex rounded-lg bg-neutral-100 p-0.5" role="group" aria-label="文本用途">
          {ROLES.map((r) => {
            const isCurr = node.role === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => data.onChange(node.id, { role: r })}
                className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition ${
                  isCurr ? ROLE_STYLES[r].active : "text-neutral-600 hover:text-neutral-950"
                }`}
              >
                {ARTICLE_TEXT_ROLE_LABEL[r]}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          aria-label="删除文本节点"
          onClick={() => data.onDelete(node.id)}
          className="nodrag nopan rounded-md p-1 text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 size={13} aria-hidden="true" />
        </button>
      </div>

      <textarea
        aria-label="文章文本节点内容"
        value={localContent}
        onFocus={() => {
          isFocusedRef.current = true;
        }}
        onCompositionStart={() => {
          isComposingRef.current = true;
          if (debounceTimerRef.current) {
            window.clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = null;
          }
        }}
        onCompositionEnd={(e) => {
          isComposingRef.current = false;
          const nextVal = e.currentTarget.value;
          setLocalContent(nextVal);
          scheduleSyncToParent(nextVal, false);
        }}
        onChange={(e) => {
          const nextVal = e.target.value;
          setLocalContent(nextVal);
          if (!isComposingRef.current && !(e.nativeEvent as InputEvent).isComposing) {
            scheduleSyncToParent(nextVal, false);
          }
        }}
        onBlur={(e) => {
          isFocusedRef.current = false;
          isComposingRef.current = false;
          const nextVal = e.currentTarget.value;
          scheduleSyncToParent(nextVal, true);
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
        }}
        rows={4}
        placeholder={
          node.role === "requirement"
            ? "输入写作要求（如受众、语气、结构偏好）…"
            : node.role === "verbatim"
              ? "输入需一字不改保留的段落或声明…"
              : "输入想法、提纲或创作素材…"
        }
        className="nodrag nopan nowheel w-full resize-y rounded-lg border border-neutral-200/80 bg-neutral-50/70 p-2.5 text-xs leading-relaxed text-neutral-900 focus:border-neutral-400 focus:bg-white focus:outline-none"
      />

      <p className="mt-1.5 text-[10px] text-neutral-400">{roleMeta.hint}</p>
    </div>
  );
}
