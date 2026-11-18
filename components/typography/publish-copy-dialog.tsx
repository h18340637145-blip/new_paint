"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, LoaderCircle, RefreshCw, ShieldAlert, X } from "lucide-react";

export function PublishCopyDialog({
  open,
  imageCount,
  publishing,
  error,
  onConfirm,
  onClose,
}: {
  open: boolean;
  imageCount: number;
  publishing: boolean;
  error: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="publish-copy-title"
      onClose={onClose}
      className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-0 text-neutral-950 shadow-2xl backdrop:bg-black/40"
    >
      <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
        <div className="flex items-center gap-2">
          <ShieldAlert size={17} className="text-amber-600" />
          <h2 id="publish-copy-title" className="text-base font-semibold">
            公开图片副本确认
          </h2>
        </div>
        <button
          type="button"
          aria-label="关闭"
          disabled={publishing}
          onClick={onClose}
          className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100"
        >
          <X size={15} />
        </button>
      </div>

      <div className="space-y-3 p-5 text-xs leading-relaxed text-neutral-700">
        <p>
          当前稿件包含 <strong>{imageCount}</strong> 张配图。为使微信公众号后台能够抓取并稳定显示图片：
        </p>
        <ul className="list-disc space-y-1.5 pl-5 text-neutral-600">
          <li>系统仅会为本次实际导出的图片生成独立副本，写入公开存储桶；</li>
          <li><strong>图片副本将长期公开，任何持有链接的人均可访问</strong>；</li>
          <li>公开副本与画布原件独立保留，后续日常整理或移除画布节点不会影响已发布文章；</li>
          <li>相同图片重复复制时将自动复用稳定的公开地址。</li>
        </ul>

        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-red-700">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-neutral-200 bg-neutral-50 px-5 py-3.5 text-xs">
        <button
          type="button"
          disabled={publishing}
          onClick={onClose}
          className="rounded-lg border border-neutral-200 bg-white px-3.5 py-1.5 font-medium text-neutral-700 hover:bg-neutral-100"
        >
          取消
        </button>
        <button
          type="button"
          disabled={publishing}
          onClick={onConfirm}
          className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-950 px-4 py-1.5 font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
        >
          {publishing ? (
            <>
              <LoaderCircle size={13} className="animate-spin" />
              正在准备公开图片…
            </>
          ) : error ? (
            <>
              <RefreshCw size={13} />
              重试准备图片并复制
            </>
          ) : (
            "确认公开图片并复制"
          )}
        </button>
      </div>
    </dialog>
  );
}
