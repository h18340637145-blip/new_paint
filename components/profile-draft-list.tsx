"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Eye, FileText, Monitor, Smartphone, Sparkles, X } from "lucide-react";
import type { UserArticleDraftItem } from "@/lib/studio/article-data";
import {
  countArticleStats,
  getSubTemplate,
  renderStructuredArticleHtml,
  structuredDraftToPlainText,
} from "@/lib/typography/templates";

const dateTimeFormat = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  dateStyle: "medium",
  timeStyle: "short",
});

export function ProfileDraftList({
  items,
  imageUrls,
}: {
  items: UserArticleDraftItem[];
  imageUrls: Record<string, string>;
}) {
  const [previewItem, setPreviewItem] = useState<UserArticleDraftItem | null>(null);
  const [previewDevice, setPreviewDevice] = useState<"mobile" | "desktop">("mobile");
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (previewItem) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [previewItem]);

  const previewHtml = useMemo(() => {
    if (!previewItem) return "";
    return renderStructuredArticleHtml(previewItem.draft, imageUrls);
  }, [previewItem, imageUrls]);

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-200 bg-white p-6 text-center">
        <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-600">
          <FileText size={18} aria-hidden="true" />
        </div>
        <p className="mt-3 text-sm font-medium text-neutral-900">暂无已保存的 Qwen 排版稿</p>
        <p className="mt-1 text-xs text-neutral-500">
          在画布中整理图文并暂存后，前往公众号排版执行「从画布生成」，生成的排版结果会自动保存在这里供随时查看与继续精修。
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
          <Link
            href="/canvas"
            className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3.5 py-1.5 text-xs font-medium text-neutral-800 transition hover:bg-neutral-50"
          >
            前往画布编排
          </Link>
          <Link
            href="/typography"
            className="inline-flex items-center gap-1.5 rounded-xl bg-neutral-950 px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-neutral-800"
          >
            <Sparkles size={13} aria-hidden="true" />
            打开公众号排版
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-3.5 sm:grid-cols-2">
        {items.map((item) => {
          const { draft, projectTitle } = item;
          const sub = getSubTemplate(draft.subTemplateId);
          const plain = structuredDraftToPlainText(draft);
          const stats = countArticleStats(plain);
          const bodyPreview = plain
            .replace(draft.title, "")
            .replace(/\s+/g, " ")
            .trim();

          return (
            <article
              key={draft.id}
              className="flex flex-col justify-between rounded-2xl border border-neutral-200/90 bg-white p-4 shadow-sm transition hover:border-neutral-300"
            >
              <div>
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="rounded-full bg-neutral-950 px-2 py-0.5 font-medium text-white">
                    {sub.name}
                  </span>
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-600">
                    画布：{projectTitle}
                  </span>
                  <span className="ml-auto tabular-nums text-neutral-400">
                    v{draft.version}
                  </span>
                </div>

                <h3 className="mt-2.5 line-clamp-1 text-base font-semibold text-neutral-950">
                  {draft.title || "未命名公众号排版稿"}
                </h3>

                <p className="mt-1.5 line-clamp-2 min-h-[2.5rem] text-xs leading-relaxed text-neutral-600">
                  {bodyPreview || "点击「预览排版」查看完整公众号渲染效果。"}
                </p>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-3">
                <span className="text-[11px] tabular-nums text-neutral-400">
                  {stats.total} 字 · {dateTimeFormat.format(new Date(draft.updatedAt))}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewItem(item)}
                    className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 hover:text-neutral-950"
                  >
                    <Eye size={13} aria-hidden="true" />
                    预览排版
                  </button>
                  <Link
                    href={`/typography?draftId=${encodeURIComponent(draft.id)}`}
                    className="inline-flex items-center gap-1 rounded-lg bg-neutral-950 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-neutral-800"
                  >
                    继续编辑
                    <ArrowUpRight size={13} aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <dialog
        ref={dialogRef}
        onClose={() => setPreviewItem(null)}
        onClick={(e) => {
          if (e.target === dialogRef.current) setPreviewItem(null);
        }}
        className="m-auto w-full max-w-3xl rounded-2xl border border-neutral-200 bg-white p-0 text-neutral-950 shadow-2xl backdrop:bg-black/45"
      >
        {previewItem && (
          <div className="flex max-h-[88dvh] flex-col">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 px-5 py-3.5">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-neutral-950">
                  {previewItem.draft.title}
                </h3>
                <p className="text-xs text-neutral-500">
                  画布：{previewItem.projectTitle} · 模板：{getSubTemplate(previewItem.draft.subTemplateId).name} · 版本 v{previewItem.draft.version}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="inline-flex rounded-lg border border-neutral-200 bg-neutral-50 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setPreviewDevice("mobile")}
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium ${
                      previewDevice === "mobile" ? "bg-white text-neutral-950 shadow-sm" : "text-neutral-600"
                    }`}
                  >
                    <Smartphone size={12} />
                    手机
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewDevice("desktop")}
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium ${
                      previewDevice === "desktop" ? "bg-white text-neutral-950 shadow-sm" : "text-neutral-600"
                    }`}
                  >
                    <Monitor size={12} />
                    电脑
                  </button>
                </div>

                <Link
                  href={`/typography?draftId=${encodeURIComponent(previewItem.draft.id)}`}
                  className="inline-flex items-center gap-1 rounded-lg bg-neutral-950 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800"
                >
                  去工作台精修 / 复制
                  <ArrowUpRight size={13} />
                </Link>

                <button
                  type="button"
                  aria-label="关闭预览"
                  onClick={() => setPreviewItem(null)}
                  className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-neutral-100/80 p-4 sm:p-6">
              <div
                className={`mx-auto overflow-hidden border border-neutral-300 bg-white shadow-lg ${
                  previewDevice === "mobile" ? "max-w-[390px] rounded-[28px]" : "max-w-[677px] rounded-xl"
                }`}
              >
                <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
              </div>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
