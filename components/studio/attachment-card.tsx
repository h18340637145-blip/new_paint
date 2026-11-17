import { Download, FileText, X } from "lucide-react";
import type { StudioAttachment } from "@/lib/studio/agent-events";

export function AttachmentCard({ asset, onRemove }: {
  asset: StudioAttachment;
  onRemove?: () => void;
}) {
  return (
    <div className="relative flex max-w-[min(240px,100%)] items-center rounded-lg border border-neutral-200 bg-white text-neutral-900">
      <a href={asset.url} target="_blank" rel="noreferrer" title={asset.filename}
        className="flex min-w-0 items-center gap-2 px-2 py-1 text-xs">
        {asset.kind === "markdown" ? <><FileText size={15} className="shrink-0" /><span className="truncate">{asset.filename}</span></> : (
          /* eslint-disable-next-line @next/next/no-img-element -- 私有素材使用短期签名地址。 */
          <img src={asset.url} alt={asset.filename} className="size-10 rounded object-cover" />
        )}
      </a>
      {asset.kind === "markdown" && <a href={asset.url + "&download=1"} aria-label="下载附件" className="shrink-0 p-1.5"><Download size={14} /></a>}
      {onRemove && <button type="button" aria-label={`移除 ${asset.filename}`} onClick={onRemove} className="shrink-0 p-1.5 hover:bg-neutral-100">
        <X size={13} />
      </button>}
    </div>
  );
}
