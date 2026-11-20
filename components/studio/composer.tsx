"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ByteDance, NanoBanana, OpenAI } from "@lobehub/icons";
import { ArrowUp, ChevronDown, ImagePlus, LayoutGrid, LoaderCircle, Paperclip, Plus, X } from "lucide-react";
import {
  configLabel,
  defaultConfig,
  imageTypes,
  manualModels,
  maxPromptLength,
  maxReferenceSize,
  models,
  promptBounds,
  supportedRatios,
  supportedResolutions,
  type GenerationConfig,
  type Model,
} from "@/lib/studio/models";
import type { ImageAsset } from "@/lib/studio/types";
import { SkillPicker } from "./skill-picker";
import type { StudioAttachment, StudioSkill } from "@/lib/studio/agent-events";
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
  skill?: StudioSkill | null;
}

function getModelIcon(model: Model) {
  if (model === "gpt-image-2" || model === "gpt-image-2-5-flare") return OpenAI;
  if (model === "seedream-5-5") return ByteDance;
  return NanoBanana;
}

export function Composer({
  onSend, home = false, onPickCanvas, canvasAsset, onClearCanvas, onUpload, selecting = false,
  mode = "image", onModeChange, generating = false, attachments = [], onRemoveAttachment, onClearAttachments, projectId,
  presetPrompt, onPresetConsumed,
}: {
  onSend: (input: ComposerInput) => Promise<void>;
  home?: boolean;
  projectId?: string;
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
  presetPrompt?: string | null;
  onPresetConsumed?: () => void;
}) {
  const [skill, setSkill] = useState<StudioSkill | null>(null);
  const [skillMutating, setSkillMutating] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [config, setConfig] = useState(defaultConfig);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [menu, setMenu] = useState<"reference" | "model" | "settings" | null>(null);
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const submitInProgress = useRef(false);
  const image = canvasAsset?.url ?? preview;
  const busy = pending || uploading || skillMutating;
  const isAgent = mode === "agent";
  const maySend = !!prompt.trim() || (isAgent && attachments.length > 0) || (home && isAgent && !!file);
  const inUpload = useRef(false);

  useEffect(() => {
    if (presetPrompt) {
      setPrompt(presetPrompt);
      onPresetConsumed?.();
      window.requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
    }
  }, [presetPrompt, onPresetConsumed]);

  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview); };
  }, [preview]);

  function replaceFile(next: File | null) {
    setFile(next);
    setPreview(next ? URL.createObjectURL(next) : null);
  }

  function changeConfig(next: GenerationConfig) {
    const allowedRes = supportedResolutions(next.model);
    const resolution = allowedRes.includes(next.resolution)
      ? next.resolution
      : next.model === "seedream-5-5"
        ? "2K"
        : "1K";
    const ratios = supportedRatios(next.model, resolution);
    setConfig({
      ...next,
      resolution,
      aspectRatio: ratios.includes(next.aspectRatio) ? next.aspectRatio : "1:1",
      count: next.model === "gpt-image-2" ? next.count : 1,
    });
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = prompt.trim();
    if (!maySend || submitInProgress.current || selecting || uploading || skillMutating) return;
    if (!isAgent) {
      const bounds = promptBounds(config.model);
      if (value.length < bounds.min || value.length > bounds.max) {
        setError(
          config.model === "seedream-5-5"
            ? "Seedream 5.5 提示词长度需在 5–5,000 个字符之间。"
            : "请检查提示词长度。",
        );
        return;
      }
    }
    submitInProgress.current = true;
    setPending(true);
    setError("");
    setMenu(null);
    const submission = { prompt: value, config, file: canvasAsset ? null : file, asset: canvasAsset ?? null, attachments, skill: isAgent ? skill : null };
    const reset = () => { setPrompt(""); replaceFile(null); onClearCanvas?.(); onClearAttachments?.(); setSkill(null); };
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

  const ModelIcon = getModelIcon(config.model);
  const modelResolutions = supportedResolutions(config.model);
  const currentBounds = promptBounds(config.model);

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
          {(!isAgent || home) && image && (
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
          {isAgent && projectId && <SkillPicker projectId={projectId} selected={skill} onChange={setSkill} onMutating={setSkillMutating} disabled={pending || uploading} />}
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
        ref={textareaRef}
        className={`block w-full resize-none bg-transparent px-1 py-2 text-sm leading-relaxed outline-none placeholder:text-neutral-400 ${home ? "h-16" : "h-16"}`}
        aria-label={isAgent ? "图文创意描述" : "生图提示词"}
        placeholder={
          isAgent
            ? "输入选题想法或公众号文章方向，AI 将规划图文分镜并自动铺上画布…"
            : "描述你想生成的配图画面（支持拖拽或 Ctrl+V 粘贴参考图）…"
        }
        value={prompt}
        disabled={pending}
        maxLength={isAgent ? maxPromptLength : currentBounds.max}
        onKeyDown={(event) => {
          if (
            event.key === "Enter"
            && !event.shiftKey
            && !event.nativeEvent.isComposing
            && event.keyCode !== 229
          ) {
            event.preventDefault();
            if (maySend && !busy && !selecting) {
              event.currentTarget.form?.requestSubmit();
            }
          }
        }}
        onChange={(event) => {
          setPrompt(event.target.value);
          if (error) setError("");
        }}
      />
      {error && <p className="px-1 pb-2 text-xs text-red-700" role="alert">{error}</p>}
      <div className="flex items-end gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {onModeChange && (
            <ModeMenu mode={mode} disabled={busy || generating} onChange={(value) => {
              setMenu(null);
              onModeChange(value);
            }} />
          )}
          {home && (
            <button type="button" disabled={pending} title="上传参考图" aria-label="上传参考图" className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950" onClick={() => input.current?.click()}>
              <Plus size={15} />
              <span className="hidden sm:inline">参考图</span>
            </button>
          )}
          {mode === "agent" ? (
            <span className="px-1.5 text-xs text-neutral-500">自动规划文案与配图</span>
          ) : (
            <>
              <div className="relative">
                <button type="button" title={models[config.model]} aria-label="选择模型" aria-expanded={menu === "model"} disabled={pending}
                  className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs hover:bg-neutral-100" onClick={() => setMenu(menu === "model" ? null : "model")}>
                  <ModelIcon size={16} /><span>{models[config.model]}</span><ChevronDown size={13} />
                </button>
                {menu === "model" && (
                  <div className="absolute bottom-full left-0 z-30 mb-2 grid min-w-44 rounded-xl border border-neutral-200 bg-white p-1.5 text-sm shadow-lg">
                    {manualModels.map((model) => {
                      const Icon = getModelIcon(model);
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
                      {modelResolutions.map((resolution) => <button type="button" key={resolution} aria-pressed={resolution === config.resolution}
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
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden text-[11px] text-neutral-400 sm:inline">Enter 发送</span>
          <button type="submit" aria-label="发送" disabled={!maySend || busy || selecting}
            className="grid size-8 shrink-0 place-items-center rounded-full bg-[#164b3e] text-white hover:bg-[#123d32] disabled:bg-neutral-100 disabled:text-neutral-400">
            {pending ? <LoaderCircle className="animate-spin" size={16} /> : <ArrowUp size={17} />}
          </button>
        </div>
      </div>
    </form>
  );
}
