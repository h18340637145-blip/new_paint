"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { NanoBanana, OpenAI } from "@lobehub/icons";
import { ArrowUp, ChevronDown, ImagePlus, LayoutGrid, LoaderCircle, Paperclip, Plus, X } from "lucide-react";
import {
  configLabel, defaultConfig, imageTypes, maxPromptLength, maxReferenceSize,
  manualModels, models, resolutions, supportedRatios, type GenerationConfig,
} from "@/lib/studio/models";
import type { ImageAsset } from "@/lib/studio/types";
import type { StudioAttachment } from "@/lib/studio/agent-events";
import { maxMarkdownBytes, markdownFilename } from "@/lib/studio/attachment-types";
import { AttachmentCard } from "./attachment-card";
import { ModeMenu, type StudioMode } from "./mode-menu";
export type { StudioMode } from "./mode-menu";

export interface ComposerInput {
  prompt: string;
  config: GenerationConfig;
  file: File | null;
  asset: ImageAsset | null;
  attachments?: StudioAttachment[];
}

export function Composer({
  onSend, home = false, onPickCanvas, canvasAsset, onClearCanvas, onUpload, selecting = false,
  mode = "image", onModeChange, generating = false, attachments = [], onRemoveAttachment, onClearAttachments,
}: {
  onSend: (input: ComposerInput) => Promise<void>;
  home?: boolean;
  onPickCanvas?: () => void;
  canvasAsset?: ImageAsset | null;
  onClearCanvas?: () => void;
  onUpload?: (file: File) => Promise<void>;
  selecting?: boolean;
  mode?: StudioMode;
  onModeChange?: (mode: StudioMode) => void;
  generating?: boolean;
  attachments?: StudioAttachment[];
  onRemoveAttachment?: (id: string) => void;
  onClearAttachments?: () => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [config, setConfig] = useState(defaultConfig);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [menu, setMenu] = useState<"reference" | "model" | "settings" | null>(null);
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const submitInProgress = useRef(false);
  const image = canvasAsset?.url ?? preview;
  const busy = pending || uploading;
  const isAgent = mode === "agent";
  const maySend = !!prompt.trim() || (isAgent && attachments.length > 0);
  const inUpload = useRef(false);

  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview); };
  }, [preview]);

  function replaceFile(next: File | null) {
    setFile(next);
    setPreview(next ? URL.createObjectURL(next) : null);
  }

  function changeConfig(next: GenerationConfig) {
    const ratios = supportedRatios(next.model, next.resolution);
    setConfig({
      ...next,
      aspectRatio: ratios.includes(next.aspectRatio) ? next.aspectRatio : "1:1",
      count: next.model === "gpt-image-2" ? next.count : 1,
    });
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = prompt.trim();
    if (!maySend || submitInProgress.current || selecting || uploading) return;
    submitInProgress.current = true;
    setPending(true);
    setError("");
    setMenu(null);
    const submission = { prompt: value, config, file: canvasAsset ? null : file, asset: canvasAsset ?? null, attachments };
    const reset = () => { setPrompt(""); replaceFile(null); onClearCanvas?.(); onClearAttachments?.(); };
    try {
      const sending = onSend(submission);
      if (mode === "agent") reset();
      await sending;
      if (mode === "image") reset();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "发送失败，请重试。");
    } finally {
      setPending(false);
      submitInProgress.current = false;
    }
  }

  async function addFiles(items: File[]) {
    if (!items.length || busy || inUpload.current) return;
    const batch = isAgent ? items : items.slice(0, 1);
    if (isAgent && attachments.length + batch.length > 16) {
      setError("每条消息最多添加 16 个附件。");
      return;
    }
    setError("");
    inUpload.current = true;
    setUploading(true);
    try {
      for (const selected of batch) {
        const markdown = isAgent && markdownFilename.test(selected.name);
        if (!selected.size || (markdown ? selected.size > maxMarkdownBytes
          : !imageTypes.includes(selected.type) || selected.size > maxReferenceSize)) {
          throw new Error(isAgent ? "请选择不超过 10 MB 的图片或 256 KB 的 Markdown。"
            : "请选择不超过 10 MB 的 JPEG、PNG 或 WebP 图片。");
        }
        if (onUpload) {
          await onUpload(selected);
          replaceFile(null);
        } else {
          onClearCanvas?.();
          replaceFile(selected);
        }
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "上传失败，请重试。");
    } finally {
      inUpload.current = false;
      setUploading(false);
    }
  }

  const ModelIcon = config.model === "gpt-image-2" ? OpenAI : NanoBanana;

  return (
    <form onSubmit={send}
      onDragOver={(event) => { if (event.dataTransfer.types.includes("Files")) event.preventDefault(); }}
      onDrop={(event) => {
        if (event.dataTransfer.files.length) { event.preventDefault(); void addFiles(Array.from(event.dataTransfer.files)); }
      }}
      onPaste={(event) => {
        if (event.clipboardData.files.length) { event.preventDefault(); void addFiles(Array.from(event.clipboardData.files)); }
      }}
      className={`relative rounded-2xl border border-neutral-200 bg-white p-3 text-neutral-900 shadow-sm ${home ? "w-full" : ""}`}>
      <input
        type="file"
        ref={input}
        className="hidden"
        accept={[...imageTypes, ...(isAgent ? [".md", ".markdown"] : [])].join(",")}
        multiple={isAgent}
        onChange={(event) => {
          const selected = Array.from(event.target.files ?? []);
          event.target.value = "";
          void addFiles(selected);
        }}
      />
      {(image || !home) && (
        <div className="relative mb-1 flex flex-wrap items-center gap-2">
          {isAgent && attachments.map((asset) => <AttachmentCard key={asset.id} asset={asset}
            onRemove={busy ? undefined : () => onRemoveAttachment?.(asset.id)} />)}
          {!isAgent && image && (
            <div className="relative size-12">
              {/* eslint-disable-next-line @next/next/no-img-element -- 本地预览和短期签名图片直接显示。 */}
              <img className="size-full rounded-xl object-cover" src={image} alt="参考图" />
              <button type="button" disabled={busy} aria-label="移除参考图" className="absolute -right-1 -top-1 rounded-full bg-neutral-900 p-0.5 text-white"
                onClick={() => { replaceFile(null); onClearCanvas?.(); }}><X size={12} /></button>
            </div>
          )}
          {!home && (
            <button type="button" disabled={busy} aria-expanded={menu === "reference"} onClick={() => setMenu(menu === "reference" ? null : "reference")}
              className="flex h-12 w-12 flex-col items-center justify-center gap-1 rounded-xl bg-neutral-100 text-[10px] text-neutral-600 hover:bg-neutral-200">
              {uploading ? <LoaderCircle size={14} className="animate-spin" /> : <ImagePlus size={14} />}{uploading ? "上传中" : "附件"}
            </button>
          )}
          {menu === "reference" && (
            <div className="absolute bottom-full left-0 z-30 mb-2 grid min-w-40 gap-1 rounded-xl border border-neutral-200 bg-white p-1.5 text-sm shadow-lg">
              <button type="button" className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-neutral-100"
                onClick={() => { setMenu(null); input.current?.click(); }}><Paperclip size={14} />{isAgent ? "上传图片或 Markdown" : "从本地上传图片"}</button>
              <button type="button" disabled={!onPickCanvas} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-neutral-100 disabled:opacity-40"
                onClick={() => { setMenu(null); onPickCanvas?.(); }}><LayoutGrid size={14} />从画布选择</button>
            </div>
          )}
        </div>
      )}
      <textarea
        className={`block w-full resize-none bg-transparent px-1 py-2 text-sm outline-none placeholder:text-neutral-400 ${home ? "h-14" : "h-16"}`}
        aria-label="生图提示词"
        placeholder={home ? "描述你想创作的图片" : "今天我们要创作什么"}
        value={prompt}
        disabled={pending}
        maxLength={maxPromptLength}
        onChange={(event) => setPrompt(event.target.value)}
      />
      {error && <p className="px-1 pb-2 text-xs text-red-700" role="alert">{error}</p>}
      <div className="flex items-end gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
        {!home && onModeChange && (
          <ModeMenu mode={mode} disabled={busy || generating} onChange={(value) => {
            setMenu(null);
            onModeChange(value);
          }} />
        )}
        {home ? (
          <button type="button" disabled={pending} aria-label="上传参考图" className="rounded-lg p-1.5 hover:bg-neutral-100" onClick={() => input.current?.click()}>
            <Plus size={17} />
          </button>
        ) : mode === "agent" ? (
          <span className="px-2 text-xs text-neutral-600">Agent自动规划</span>
        ) : (
          <>
            <div className="relative">
              <button type="button" title={models[config.model]} aria-label="选择模型" aria-expanded={menu === "model"} disabled={pending}
                className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs hover:bg-neutral-100" onClick={() => setMenu(menu === "model" ? null : "model")}>
                <ModelIcon size={16} /><span>图像</span><ChevronDown size={13} />
              </button>
              {menu === "model" && (
                <div className="absolute bottom-full left-0 z-30 mb-2 grid min-w-40 rounded-xl border border-neutral-200 bg-white p-1.5 text-sm shadow-lg">
                  {manualModels.map((model) => {
                    const Icon = model === "gpt-image-2" ? OpenAI : NanoBanana;
                    return <button key={model} type="button" aria-pressed={model === config.model}
                      className="flex items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-neutral-100 aria-pressed:bg-neutral-100"
                      onClick={() => { changeConfig({ ...config, model }); setMenu(null); }}><Icon size={16} />{models[model]}</button>;
                  })}
                </div>
              )}
            </div>
            <div className="relative">
              <button type="button" aria-expanded={menu === "settings"} aria-label={`配置 ${configLabel(config)}`} disabled={pending}
                className="flex h-8 items-center gap-1 rounded-lg px-2 text-xs hover:bg-neutral-100" onClick={() => setMenu(menu === "settings" ? null : "settings")}>
                {configLabel(config)}<ChevronDown size={13} />
              </button>
              {menu === "settings" && (
                <div className="absolute bottom-full left-0 z-30 mb-2 grid w-60 gap-2 rounded-xl border border-neutral-200 bg-white p-3 text-xs shadow-lg">
                  <p className="font-semibold">{models[config.model]}</p>
                  <p>分辨率</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {resolutions.map((resolution) => <button type="button" key={resolution} aria-pressed={resolution === config.resolution}
                      className="rounded-lg border border-neutral-200 py-1.5 hover:bg-neutral-100 aria-pressed:bg-neutral-200"
                      onClick={() => changeConfig({ ...config, resolution })}>{resolution}</button>)}
                  </div>
                  <p>宽高比</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {supportedRatios(config.model, config.resolution).map((aspectRatio) => <button type="button" key={aspectRatio} aria-pressed={aspectRatio === config.aspectRatio}
                      className="grid min-h-10 place-items-center rounded-lg border border-neutral-200 p-1 hover:bg-neutral-100 aria-pressed:bg-neutral-200"
                      onClick={() => changeConfig({ ...config, aspectRatio })}>{aspectRatio === "auto" ? "自动" : aspectRatio}</button>)}
                  </div>
                  {config.model === "gpt-image-2" && <>
                    <p>生成张数</p>
                    <div className="grid grid-cols-5 gap-1">
                      {[1, 2, 3, 4, 5].map((count) => <button type="button" key={count} aria-pressed={count === config.count}
                        className="rounded-lg border border-neutral-200 py-1.5 hover:bg-neutral-100 aria-pressed:bg-neutral-200"
                        onClick={() => changeConfig({ ...config, count })}>{count}</button>)}
                    </div>
                  </>}
                </div>
              )}
            </div>
          </>
        )}
        </div>
        <button type="submit" aria-label="发送" disabled={!maySend || busy || selecting}
          className="grid size-8 shrink-0 place-items-center rounded-full bg-neutral-900 text-white hover:bg-neutral-700 disabled:bg-neutral-100 disabled:text-neutral-400">
          {pending ? <LoaderCircle className="animate-spin" size={16} /> : <ArrowUp size={17} />}
        </button>
      </div>
    </form>
  );
}
