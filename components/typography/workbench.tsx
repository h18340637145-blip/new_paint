"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bold,
  BookOpen,
  Check,
  Code,
  Copy,
  Download,
  Heading1,
  Heading2,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  Minus,
  Monitor,
  Palette,
  Quote,
  Smartphone,
  Sparkles,
  Table2,
  Upload,
} from "lucide-react";
import { FromCanvasDialog } from "@/components/typography/from-canvas-dialog";
import { PublishCopyDialog } from "@/components/typography/publish-copy-dialog";
import { StructuredDraftEditor } from "@/components/typography/structured-editor";
import { StylePanel } from "@/components/typography/style-panel";
import { ThemePicker } from "@/components/typography/theme-picker";
import { XiumiDrawer } from "@/components/typography/xiumi-drawer";
import { AutoGrowTextarea } from "@/components/ui/auto-grow-textarea";
import {
  applyPresetToMarkdown,
  cloneStyleConfig,
  countArticleStats,
  createDefaultPersistedState,
  extractDraftImageAssetIds,
  getSubTemplate,
  getSubTemplatesForTheme,
  migratePersistedState,
  plainToRuns,
  renderStructuredArticleHtml,
  renderWechatHtml,
  runsToPlainText,
  structuredDraftToPlainText,
  TYPOGRAPHY_STORAGE_KEY,
  TYPOGRAPHY_SUBTEMPLATES,
  type XiumiPreset,
} from "@/lib/typography/templates";
import type { StructuredArticleBlock, StructuredArticleDraft } from "@/lib/typography/structured";
import type {
  ColorPalette,
  TemplateStyleConfig,
  ThemeId,
  TypographyPersistedState,
  TypographySubTemplate,
} from "@/lib/typography/types";

const PUBLIC_COPY_CONSENT_KEY = "new_paint_public_image_copy_ack_v1";

async function writeWechatClipboard(html: string, plainText: string) {
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    const item = new ClipboardItem({
      "text/html": new Blob([html], { type: "text/html" }),
      "text/plain": new Blob([plainText], { type: "text/plain" }),
    });
    await navigator.clipboard.write([item]);
  } else {
    await navigator.clipboard.writeText(html);
  }
}

function inspectMarkdownRegion(markdown: string, selStart: number, selEnd: number): {
  label: string;
  presetId?: string;
  rangeStart: number;
  rangeEnd: number;
  innerBody?: string;
} {
  if (!markdown.trim()) {
    return { label: "空白正文（将直接插入）", rangeStart: 0, rangeEnd: 0 };
  }
  let rangeStart = Math.min(markdown.length, Math.max(0, selStart));
  let rangeEnd = Math.min(markdown.length, Math.max(0, selEnd));
  if (rangeEnd <= rangeStart) {
    const prevBlank = markdown.lastIndexOf("\n\n", Math.max(0, rangeStart - 1));
    rangeStart = prevBlank === -1 ? 0 : prevBlank + 2;
    const nextBlank = markdown.indexOf("\n\n", rangeStart);
    rangeEnd = nextBlank === -1 ? markdown.length : nextBlank;
  }
  const rawSlice = markdown.slice(rangeStart, rangeEnd).trim();
  const match = /^:::preset\[([a-z0-9-]+)\]\r?\n([\s\S]*?)\r?\n:::$/i.exec(rawSlice);
  const cleanText = (match ? match[2] : rawSlice).replace(/\s+/g, " ").trim();
  const snippet = cleanText.length > 16 ? `${cleanText.slice(0, 16)}…` : cleanText || "当前光标段落";
  return {
    label: selEnd > selStart ? `选区「${snippet}」` : `段落「${snippet}」`,
    presetId: match ? match[1].toLowerCase() : undefined,
    rangeStart,
    rangeEnd,
    innerBody: match ? match[2].trim() : undefined,
  };
}

export function TypographyWorkbench({
  initialProjectId = null,
  initialSnapshotId = null,
  initialDraftId = null,
}: {
  initialProjectId?: string | null;
  initialSnapshotId?: string | null;
  initialDraftId?: string | null;
}) {
  const [state, setState] = useState<TypographyPersistedState>(() => createDefaultPersistedState());
  const [selectedThemeId, setSelectedThemeId] = useState<ThemeId>(TYPOGRAPHY_SUBTEMPLATES[0].themeId);
  const [editorMode, setEditorMode] = useState<"markdown" | "draft">("markdown");
  const [activeDraft, setActiveDraft] = useState<StructuredArticleDraft | null>(null);
  const [draftImageUrls, setDraftImageUrls] = useState<Record<string, string>>({});
  const [draftDirty, setDraftDirty] = useState(false);
  const [draftSaving, setDraftSaving] = useState(false);
  const [conflictError, setConflictError] = useState("");
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [mdSelection, setMdSelection] = useState<{ start: number; end: number }>({ start: 0, end: 0 });

  const [fromCanvasOpen, setFromCanvasOpen] = useState(Boolean(initialProjectId || initialSnapshotId));
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [publishingImages, setPublishingImages] = useState(false);
  const [publishError, setPublishError] = useState("");
  const [hasConsentedPublicImages, setHasConsentedPublicImages] = useState(false);

  const [showStylePanel, setShowStylePanel] = useState(true);
  const [previewDevice, setPreviewDevice] = useState<"mobile" | "desktop">("mobile");
  const [confirmLoadSample, setConfirmLoadSample] = useState(false);
  const [copied, setCopied] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [copyError, setCopyError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const draftRef = useRef<StructuredArticleDraft | null>(null);
  draftRef.current = activeDraft;

  const flashStatus = useCallback((msg: string) => {
    setStatusMessage(msg);
    window.setTimeout(() => {
      setStatusMessage((curr) => (curr === msg ? "" : curr));
    }, 2400);
  }, []);

  const openDraftById = useCallback(
    async (draftId: string) => {
      const res = await fetch(`/api/typography/drafts/${encodeURIComponent(draftId)}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.draft) {
        throw new Error(data.error || "加载排版稿失败。");
      }
      const loaded = data.draft as StructuredArticleDraft;
      setActiveDraft(loaded);
      setSelectedBlockId(loaded.blocks[0]?.id ?? null);
      setDraftImageUrls((data.imageUrls ?? {}) as Record<string, string>);
      setDraftDirty(false);
      setConflictError("");
      setEditorMode("draft");
      setSelectedThemeId(getSubTemplate(loaded.subTemplateId).themeId);
      const url = new URL(window.location.href);
      url.searchParams.set("draftId", loaded.id);
      window.history.replaceState(null, "", url.toString());
      flashStatus(`已打开排版稿「${loaded.title}」`);
    },
    [flashStatus],
  );

  useEffect(() => {
    const raw = window.localStorage.getItem(TYPOGRAPHY_STORAGE_KEY);
    if (raw) {
      const migrated = migratePersistedState(raw);
      setState(migrated);
      setSelectedThemeId(getSubTemplate(migrated.activeSubTemplateId).themeId);
    }
    if (window.localStorage.getItem(PUBLIC_COPY_CONSENT_KEY) === "1") {
      setHasConsentedPublicImages(true);
    }
    if (initialDraftId) {
      void openDraftById(initialDraftId).catch((err: Error) => setCopyError(err.message));
    }
  }, [initialDraftId, openDraftById]);

  const saveDraftToServer = useCallback(async () => {
    const current = draftRef.current;
    if (!current || draftSaving) return;
    setDraftSaving(true);
    try {
      const res = await fetch(`/api/typography/drafts/${encodeURIComponent(current.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: current.projectId,
          expectedVersion: current.version,
          title: current.title,
          subTemplateId: current.subTemplateId,
          templateStyle: current.templateStyle,
          documentStyle: current.documentStyle,
          blocks: current.blocks,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        setConflictError(data.error || "该排版稿已在其他窗口修改，请刷新加载最新版本。");
        return;
      }
      if (!res.ok || !data.draft) {
        throw new Error(data.error || "保存排版稿失败。");
      }
      const saved = data.draft as StructuredArticleDraft;
      setActiveDraft((prev) =>
        prev && prev.id === saved.id ? { ...prev, version: saved.version, updatedAt: saved.updatedAt } : prev,
      );
      setDraftDirty(false);
      setConflictError("");
    } catch (err) {
      setCopyError(err instanceof Error ? err.message : "保存失败。");
    } finally {
      setDraftSaving(false);
    }
  }, [draftSaving]);

  // Auto-save draft changes after 1200ms idle
  useEffect(() => {
    if (editorMode !== "draft" || !draftDirty || !activeDraft || conflictError) return;
    const timer = window.setTimeout(() => {
      void saveDraftToServer();
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [editorMode, draftDirty, activeDraft, conflictError, saveDraftToServer]);

  function commitState(updater: (prev: TypographyPersistedState) => TypographyPersistedState) {
    setState((prev) => {
      const next = updater(prev);
      try {
        window.localStorage.setItem(TYPOGRAPHY_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage quota errors
      }
      return next;
    });
  }

  const isDraftMode = editorMode === "draft" && activeDraft !== null;
  const activeSub = getSubTemplate(
    isDraftMode ? activeDraft.subTemplateId : state.activeSubTemplateId,
  );
  const activeStyle = isDraftMode
    ? activeDraft.templateStyle
    : state.styleOverrides[activeSub.id] ?? activeSub.defaultStyle;

  function mutateDraft(updater: (prev: StructuredArticleDraft) => StructuredArticleDraft) {
    setActiveDraft((prev) => (prev ? updater(prev) : prev));
    setDraftDirty(true);
  }

  function syncMdSelectionFromTextarea() {
    const el = textareaRef.current;
    if (!el) return;
    setMdSelection({
      start: el.selectionStart ?? 0,
      end: el.selectionEnd ?? 0,
    });
  }

  const mdRegion = useMemo(
    () => inspectMarkdownRegion(state.content, mdSelection.start, mdSelection.end),
    [state.content, mdSelection.start, mdSelection.end],
  );

  const selectedDraftBlock = useMemo(() => {
    if (!isDraftMode || !activeDraft) return null;
    return (
      activeDraft.blocks.find((b) => b.id === selectedBlockId)
      ?? activeDraft.blocks[0]
      ?? null
    );
  }, [isDraftMode, activeDraft, selectedBlockId]);

  const drawerTargetInfo = useMemo(() => {
    if (!isDraftMode) {
      return { label: mdRegion.label, activePresetId: mdRegion.presetId };
    }
    if (!selectedDraftBlock) {
      return { label: "文末新增组件块", activePresetId: undefined };
    }
    const presetId =
      "presetId" in selectedDraftBlock ? selectedDraftBlock.presetId : undefined;
    if (
      selectedDraftBlock.type === "heading"
      || selectedDraftBlock.type === "paragraph"
      || selectedDraftBlock.type === "blockquote"
      || selectedDraftBlock.type === "preset"
    ) {
      const txt = runsToPlainText(selectedDraftBlock.runs).replace(/\s+/g, " ").trim();
      const short = txt.length > 14 ? `${txt.slice(0, 14)}…` : txt || "空文本块";
      return { label: `块「${short}」`, activePresetId: presetId };
    }
    if (selectedDraftBlock.type === "image") {
      return { label: `配图「${selectedDraftBlock.alt || "画布配图"}」`, activePresetId: presetId };
    }
    if (selectedDraftBlock.type === "list") {
      return { label: `列表（共 ${selectedDraftBlock.items.length} 项）`, activePresetId: undefined };
    }
    return { label: "分割线块", activePresetId: undefined };
  }, [isDraftMode, mdRegion, selectedDraftBlock]);

  function handleApplyPresetToRegion(preset: XiumiPreset) {
    if (!isDraftMode) {
      const liveStart = textareaRef.current?.selectionStart ?? mdSelection.start;
      const liveEnd = textareaRef.current?.selectionEnd ?? mdSelection.end;
      const { nextMarkdown, focusOffset } = applyPresetToMarkdown(
        state.content,
        liveStart,
        liveEnd,
        preset,
        "replace-region",
      );
      handleContentChange(nextMarkdown);
      window.requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (el) {
          el.focus();
          el.setSelectionRange(focusOffset, focusOffset);
          setMdSelection({ start: focusOffset, end: focusOffset });
        }
      });
      flashStatus(`已将「${preset.name}」套用到当前区域`);
      return;
    }

    if (!activeDraft) return;
    const target = selectedDraftBlock;
    if (!target) {
      handleInsertPresetBlock(preset);
      return;
    }

    if (preset.category === "image" && target.type !== "image") {
      flashStatus("请先点击选中一个「画布配图」块，再套用图片边框模板");
      return;
    }

    mutateDraft((prev) => ({
      ...prev,
      blocks: prev.blocks.map((b): StructuredArticleBlock => {
        if (b.id !== target.id) return b;
        if (b.type === "image") {
          return preset.category === "image" ? { ...b, presetId: preset.id } : b;
        }
        if (
          b.type === "heading"
          || b.type === "paragraph"
          || b.type === "blockquote"
          || b.type === "preset"
        ) {
          return { ...b, presetId: preset.id };
        }
        if (b.type === "list") {
          const joined = b.items.map((it) => runsToPlainText(it.runs)).join("\n");
          return {
            id: b.id,
            type: "preset",
            presetId: preset.id,
            runs: plainToRuns(joined || preset.sampleText),
            sourceNodeId: b.sourceNodeId,
          };
        }
        return {
          id: b.id,
          type: "preset",
          presetId: preset.id,
          runs: plainToRuns(preset.sampleText),
        };
      }),
    }));
    flashStatus(`已将「${preset.name}」应用到选中块`);
  }

  function handleInsertPresetBlock(preset: XiumiPreset) {
    if (!isDraftMode) {
      const liveStart = textareaRef.current?.selectionStart ?? mdSelection.start;
      const liveEnd = textareaRef.current?.selectionEnd ?? mdSelection.end;
      const { nextMarkdown, focusOffset } = applyPresetToMarkdown(
        state.content,
        liveStart,
        liveEnd,
        preset,
        "insert-below",
      );
      handleContentChange(nextMarkdown);
      window.requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (el) {
          el.focus();
          el.setSelectionRange(focusOffset, focusOffset);
          setMdSelection({ start: focusOffset, end: focusOffset });
        }
      });
      flashStatus(`已插入「${preset.name}」组件块`);
      return;
    }

    const newId = crypto.randomUUID();
    const newBlock: StructuredArticleBlock = {
      id: newId,
      type: "preset",
      presetId: preset.id,
      runs: plainToRuns(preset.sampleText),
    };
    mutateDraft((prev) => {
      const idx = selectedBlockId ? prev.blocks.findIndex((b) => b.id === selectedBlockId) : -1;
      if (idx === -1) {
        return { ...prev, blocks: [...prev.blocks, newBlock] };
      }
      const next = [...prev.blocks];
      next.splice(idx + 1, 0, newBlock);
      return { ...prev, blocks: next };
    });
    setSelectedBlockId(newId);
    flashStatus(`已插入「${preset.name}」组件块`);
  }

  function handleClearRegionPreset() {
    if (!isDraftMode) {
      if (!mdRegion.presetId || mdRegion.innerBody === undefined) return;
      const next =
        state.content.slice(0, mdRegion.rangeStart)
        + mdRegion.innerBody
        + state.content.slice(mdRegion.rangeEnd);
      handleContentChange(next);
      flashStatus("已移除当前区域的组件样式");
      return;
    }
    if (!selectedDraftBlock) return;
    mutateDraft((prev) => ({
      ...prev,
      blocks: prev.blocks.map((b) => {
        if (b.id !== selectedDraftBlock.id) return b;
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
    flashStatus("已还原选中块的默认样式");
  }

  function handlePreviewClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!isDraftMode) return;
    const target = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-block-id]");
    const blockId = target?.dataset.blockId;
    if (!blockId) return;
    setSelectedBlockId(blockId);
    const editorCard = document.querySelector<HTMLElement>(
      `[data-editor-block-id="${CSS.escape(blockId)}"]`,
    );
    editorCard?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function handleSelectTheme(themeId: ThemeId) {
    setSelectedThemeId(themeId);
    const firstSub = getSubTemplatesForTheme(themeId)[0];
    if (!firstSub) return;
    if (isDraftMode) {
      mutateDraft((prev) => ({
        ...prev,
        subTemplateId: firstSub.id,
        templateStyle: cloneStyleConfig(firstSub.defaultStyle),
      }));
    } else if (firstSub.id !== state.activeSubTemplateId) {
      commitState((prev) => ({ ...prev, activeSubTemplateId: firstSub.id }));
      setConfirmLoadSample(false);
    }
  }

  function handleSelectSubTemplate(sub: TypographySubTemplate) {
    setSelectedThemeId(sub.themeId);
    if (isDraftMode) {
      mutateDraft((prev) => ({
        ...prev,
        subTemplateId: sub.id,
        templateStyle: cloneStyleConfig(sub.defaultStyle),
      }));
    } else {
      commitState((prev) => ({ ...prev, activeSubTemplateId: sub.id }));
      setConfirmLoadSample(false);
    }
  }

  function updateActiveStyle(updater: (prev: TemplateStyleConfig) => TemplateStyleConfig) {
    if (isDraftMode) {
      mutateDraft((prev) => ({
        ...prev,
        templateStyle: updater(cloneStyleConfig(prev.templateStyle)),
      }));
      return;
    }
    commitState((prev) => {
      const sub = getSubTemplate(prev.activeSubTemplateId);
      const current = prev.styleOverrides[sub.id] ?? sub.defaultStyle;
      const updated = updater(cloneStyleConfig(current));
      return {
        ...prev,
        styleOverrides: {
          ...prev.styleOverrides,
          [sub.id]: updated,
        },
      };
    });
  }

  function handleSelectPalette(palette: ColorPalette) {
    updateActiveStyle((prev) => ({
      ...prev,
      paletteId: palette.id,
      colors: {
        primaryColor: palette.primaryColor,
        accentColor: palette.accentColor,
        textColor: palette.textColor,
        bgColor: palette.bgColor,
        borderColor: palette.borderColor,
        quoteBgColor: palette.quoteBgColor,
      },
      divider: {
        ...prev.divider,
        color: palette.borderColor,
      },
    }));
  }

  function handleResetTemplateDefault() {
    if (isDraftMode) {
      const def = getSubTemplate(activeDraft.subTemplateId).defaultStyle;
      mutateDraft((prev) => ({
        ...prev,
        templateStyle: cloneStyleConfig(def),
      }));
      flashStatus(`已恢复「${activeSub.name}」默认样式`);
      return;
    }
    commitState((prev) => {
      const nextOverrides = { ...prev.styleOverrides };
      delete nextOverrides[activeSub.id];
      return { ...prev, styleOverrides: nextOverrides };
    });
    flashStatus(`已恢复「${activeSub.name}」默认样式`);
  }

  function handleContentChange(nextContent: string) {
    setConfirmLoadSample(false);
    commitState((prev) => ({
      ...prev,
      content: nextContent,
      hasEditedContent: true,
      drafts: { ...prev.drafts, [prev.activeSubTemplateId]: nextContent },
    }));
  }

  function applyCurrentSample() {
    setConfirmLoadSample(false);
    commitState((prev) => ({
      ...prev,
      content: activeSub.sampleMarkdown,
      hasEditedContent: false,
    }));
    flashStatus(`已加载「${activeSub.name}」示例文章`);
  }

  function handleRequestLoadSample() {
    const trimmed = state.content.trim();
    const isUneditedSample =
      !state.hasEditedContent || trimmed.length === 0 || state.content === activeSub.sampleMarkdown;
    if (isUneditedSample) {
      applyCurrentSample();
      return;
    }
    setConfirmLoadSample(true);
  }

  function insertSnippet(before: string, after = "", placeholder = "") {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? state.content.length;
    const end = el.selectionEnd ?? state.content.length;
    const selected = state.content.slice(start, end) || placeholder;
    const next = state.content.slice(0, start) + before + selected + after + state.content.slice(end);
    handleContentChange(next);
    window.requestAnimationFrame(() => {
      el.focus();
      const cursorStart = start + before.length;
      el.setSelectionRange(cursorStart, cursorStart + selected.length);
      setMdSelection({ start: cursorStart, end: cursorStart + selected.length });
    });
  }

  function exportMarkdown() {
    const text = isDraftMode ? structuredDraftToPlainText(activeDraft) : state.content;
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${isDraftMode ? activeDraft.title : activeSub.name}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importMarkdown(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const text = await file.text();
    setEditorMode("markdown");
    handleContentChange(text);
    flashStatus(`已导入 ${file.name}`);
  }

  const effectiveDraftImageUrls = useMemo(() => {
    if (!activeDraft) return draftImageUrls;
    const merged: Record<string, string> = { ...draftImageUrls };
    for (const id of extractDraftImageAssetIds(activeDraft.blocks)) {
      const existing = merged[id];
      if (!existing || existing.includes("/storage/v1/object/sign/")) {
        merged[id] = `/api/typography/preview-image/${encodeURIComponent(activeDraft.projectId)}/${encodeURIComponent(id)}`;
      }
    }
    return merged;
  }, [activeDraft, draftImageUrls]);

  const draftProjectId = activeDraft?.projectId;
  const draftTitle = activeDraft?.title;
  const draftTemplateStyle = activeDraft?.templateStyle;
  const draftDocumentStyle = activeDraft?.documentStyle;
  const draftBlocks = activeDraft?.blocks;

  const previewHtml = useMemo(() => {
    if (isDraftMode && draftTitle !== undefined && draftTemplateStyle && draftDocumentStyle && draftBlocks) {
      return renderStructuredArticleHtml(
        {
          projectId: draftProjectId,
          title: draftTitle,
          templateStyle: draftTemplateStyle,
          documentStyle: draftDocumentStyle,
          blocks: draftBlocks,
        },
        effectiveDraftImageUrls,
      );
    }
    return renderWechatHtml(state.content, activeStyle);
  }, [
    isDraftMode,
    draftProjectId,
    draftTitle,
    draftTemplateStyle,
    draftDocumentStyle,
    draftBlocks,
    effectiveDraftImageUrls,
    state.content,
    activeStyle,
  ]);

  const stats = useMemo(
    () => countArticleStats(isDraftMode ? structuredDraftToPlainText(activeDraft) : state.content),
    [isDraftMode, activeDraft, state.content],
  );

  async function executeDraftCopyWithPublicImages() {
    if (!activeDraft) return;
    setPublishingImages(true);
    setPublishError("");
    setCopyError("");
    try {
      const assetIds = extractDraftImageAssetIds(activeDraft.blocks);
      let publicUrls: Record<string, string> = {};

      if (assetIds.length > 0) {
        const res = await fetch(
          `/api/typography/drafts/${encodeURIComponent(activeDraft.id)}/publish-images`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId: activeDraft.projectId,
              blocks: activeDraft.blocks,
            }),
          },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.images) {
          throw new Error(data.error || "公开图片副本准备失败，请重试。");
        }
        publicUrls = data.images as Record<string, string>;
        for (const id of assetIds) {
          if (!publicUrls[id]) {
            throw new Error("部分文章配图尚未准备完成，请点击重试。");
          }
        }
      }

      const exportHtml = renderStructuredArticleHtml(activeDraft, publicUrls, { forExport: true });
      const plain = structuredDraftToPlainText(activeDraft);
      await writeWechatClipboard(exportHtml, plain);

      window.localStorage.setItem(PUBLIC_COPY_CONSENT_KEY, "1");
      setHasConsentedPublicImages(true);
      setPublishDialogOpen(false);
      setCopied(true);
      flashStatus("已复制含长期公开图片的公众号富文本");
      window.setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "准备公开图片或复制失败，请重试。";
      setPublishError(msg);
      if (!publishDialogOpen) setPublishDialogOpen(true);
    } finally {
      setPublishingImages(false);
    }
  }

  async function handleCopyClick() {
    setCopyError("");
    if (isDraftMode) {
      const imgCount = extractDraftImageAssetIds(activeDraft.blocks).length;
      if (imgCount > 0 && !hasConsentedPublicImages) {
        setPublishError("");
        setPublishDialogOpen(true);
        return;
      }
      await executeDraftCopyWithPublicImages();
      return;
    }

    try {
      await writeWechatClipboard(previewHtml, state.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError("复制失败，请检查浏览器剪贴板权限。");
    }
  }

  const toolbarActions = [
    { label: "一级标题", icon: Heading1, action: () => insertSnippet("# ", "", "一级标题") },
    { label: "二级标题", icon: Heading2, action: () => insertSnippet("## ", "", "二级标题") },
    { label: "加粗", icon: Bold, action: () => insertSnippet("**", "**", "重点文字") },
    { label: "斜体", icon: Italic, action: () => insertSnippet("*", "*", "斜体文字") },
    { label: "引用", icon: Quote, action: () => insertSnippet("> ", "", "引用内容") },
    { label: "列表", icon: List, action: () => insertSnippet("- ", "", "列表项") },
    { label: "代码块", icon: Code, action: () => insertSnippet("\n```ts\n", "\n```\n", "console.log('hello');") },
    { label: "表格", icon: Table2, action: () => insertSnippet("\n| 列1 | 列2 |\n| --- | --- |\n| 内容1 | 内容2 |\n") },
    { label: "分割线", icon: Minus, action: () => insertSnippet("\n---\n") },
    { label: "图片", icon: ImageIcon, action: () => insertSnippet("![图片描述](", ")", "/images/cover-example.jpg") },
    { label: "链接", icon: Link2, action: () => insertSnippet("[链接文字](", ")", "https://") },
  ];

  const styleOverridesMap = useMemo(() => {
    if (isDraftMode) {
      return { ...state.styleOverrides, [activeDraft.subTemplateId]: activeDraft.templateStyle };
    }
    return state.styleOverrides;
  }, [isDraftMode, activeDraft, state.styleOverrides]);

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50 text-neutral-950">
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1680px] flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <div className="flex flex-wrap items-center gap-2.5">
            <Link href="/" className="text-sm font-medium text-neutral-600 hover:text-neutral-950 hover:underline">
              ← 首页
            </Link>
            <span className="text-neutral-300" aria-hidden="true">/</span>
            <Link href="/protected" className="text-sm font-medium text-neutral-600 hover:text-neutral-950 hover:underline">
              工作台
            </Link>
            <span className="text-neutral-300" aria-hidden="true">/</span>
            <Link href="/profile" className="text-sm font-medium text-neutral-600 hover:text-neutral-950 hover:underline">
              个人中心
            </Link>
            <span className="text-neutral-300" aria-hidden="true">/</span>
            <h1 className="text-base font-semibold text-neutral-950">公众号排版</h1>

            {activeDraft && (
              <div className="inline-flex rounded-lg border border-neutral-200 bg-neutral-100 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setEditorMode("markdown")}
                  className={`rounded-md px-2.5 py-0.5 font-medium ${
                    editorMode === "markdown" ? "bg-white text-neutral-950 shadow-sm" : "text-neutral-600"
                  }`}
                >
                  Markdown 自由排版
                </button>
                <button
                  type="button"
                  onClick={() => setEditorMode("draft")}
                  className={`rounded-md px-2.5 py-0.5 font-medium ${
                    editorMode === "draft" ? "bg-neutral-950 text-white shadow-sm" : "text-neutral-600"
                  }`}
                >
                  画布排版稿
                </button>
              </div>
            )}

            <span className="hidden rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs tabular-nums text-neutral-600 sm:inline-flex">
              {stats.total} 字 · 约 {stats.minutes} 分钟阅读
            </span>
            {statusMessage && (
              <span role="status" className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                {statusMessage}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setFromCanvasOpen(true)}
              className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-neutral-900 bg-white px-3 py-1 text-xs font-semibold text-neutral-950 shadow-sm transition hover:bg-neutral-100"
            >
              <Sparkles size={13} aria-hidden="true" />
              从画布生成
            </button>

            <div className="inline-flex rounded-lg border border-neutral-200 bg-neutral-50 p-0.5" role="group" aria-label="预览视口">
              <button
                type="button"
                onClick={() => setPreviewDevice("mobile")}
                aria-pressed={previewDevice === "mobile"}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  previewDevice === "mobile" ? "bg-white text-neutral-950 shadow-sm" : "text-neutral-600 hover:text-neutral-950"
                }`}
              >
                <Smartphone size={13} aria-hidden="true" />
                手机
              </button>
              <button
                type="button"
                onClick={() => setPreviewDevice("desktop")}
                aria-pressed={previewDevice === "desktop"}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  previewDevice === "desktop" ? "bg-white text-neutral-950 shadow-sm" : "text-neutral-600 hover:text-neutral-950"
                }`}
              >
                <Monitor size={13} aria-hidden="true" />
                电脑
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowStylePanel((v) => !v)}
              aria-expanded={showStylePanel}
              className={`inline-flex min-h-8 items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-medium transition ${
                showStylePanel
                  ? "border-neutral-950 bg-neutral-950 text-white"
                  : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
              }`}
            >
              <Palette size={13} aria-hidden="true" />
              模板与样式
            </button>

            {!isDraftMode && (
              <>
                <button
                  type="button"
                  onClick={handleRequestLoadSample}
                  className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50"
                >
                  <BookOpen size={13} aria-hidden="true" />
                  加载示例
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".md,.markdown,.txt"
                  onChange={(e) => void importMarkdown(e)}
                  hidden
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50"
                >
                  <Upload size={13} aria-hidden="true" />
                  导入
                </button>
              </>
            )}

            <button
              type="button"
              onClick={exportMarkdown}
              className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50"
            >
              <Download size={13} aria-hidden="true" />
              导出
            </button>

            <button
              type="button"
              disabled={publishingImages}
              onClick={() => void handleCopyClick()}
              className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-neutral-950 px-3.5 py-1 text-xs font-medium text-white shadow-sm transition hover:bg-neutral-800 disabled:opacity-60"
            >
              {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
              {publishingImages ? "正在准备图片…" : copied ? "已复制富文本" : "一键复制到公众号"}
            </button>
          </div>
        </div>
      </header>

      {confirmLoadSample && !isDraftMode && (
        <div
          role="alertdialog"
          aria-labelledby="confirm-sample-title"
          className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-950 sm:px-6"
        >
          <div className="mx-auto flex max-w-[1680px] flex-wrap items-center justify-between gap-2">
            <p id="confirm-sample-title">
              当前编辑区已有正文，加载「<strong>{activeSub.name}</strong>」示例将替换当前内容，是否继续？
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmLoadSample(false)}
                className="rounded-md border border-amber-300 bg-white px-2.5 py-1 font-medium text-amber-900 hover:bg-amber-100"
              >
                保留当前正文
              </button>
              <button
                type="button"
                onClick={applyCurrentSample}
                className="rounded-md bg-amber-900 px-2.5 py-1 font-medium text-white hover:bg-amber-800"
              >
                确认替换示例
              </button>
            </div>
          </div>
        </div>
      )}

      {copyError && (
        <p role="alert" className="mx-auto mt-3 max-w-xl rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
          {copyError}
        </p>
      )}

      {showStylePanel && (
        <section aria-label="模板库与局部样式设置" className="border-b border-neutral-200 bg-white">
          <div className="mx-auto max-w-[1680px] space-y-3 px-4 py-3.5 sm:px-6">
            <ThemePicker
              activeThemeId={selectedThemeId}
              activeSubTemplateId={activeSub.id}
              styleOverrides={styleOverridesMap}
              onSelectTheme={handleSelectTheme}
              onSelectSubTemplate={handleSelectSubTemplate}
            />
            <StylePanel
              themeId={selectedThemeId}
              style={activeStyle}
              onSelectPalette={handleSelectPalette}
              onUpdateStyle={updateActiveStyle}
              onResetDefault={handleResetTemplateDefault}
            />
          </div>
        </section>
      )}

      <main className="mx-auto flex w-full max-w-[1680px] flex-1 flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-start">
        {/* 秀米式左侧图文组件抽屉栏 */}
        <XiumiDrawer
          style={activeStyle}
          targetLabel={drawerTargetInfo.label}
          activePresetId={drawerTargetInfo.activePresetId}
          onApplyToRegion={handleApplyPresetToRegion}
          onInsertBlock={handleInsertPresetBlock}
          onClearRegionPreset={
            drawerTargetInfo.activePresetId ? handleClearRegionPreset : undefined
          }
        />

        {/* 左右等高同步流双栏（无内部滚动条，随页面自然滚动左右对齐） */}
        <div className="grid min-w-0 flex-1 items-start gap-4 lg:grid-cols-12">
          {/* 左侧：Markdown 自由编辑器 或 画布排版稿精修器 */}
          <section
            aria-label={isDraftMode ? "左侧排版稿结构化编辑区" : "左侧 Markdown 编辑区"}
            className="flex flex-col rounded-2xl border border-neutral-200 bg-white shadow-sm lg:col-span-6"
          >
            {isDraftMode ? (
              <StructuredDraftEditor
                draft={activeDraft}
                imageUrls={effectiveDraftImageUrls}
                saving={draftSaving}
                dirty={draftDirty}
                conflictError={conflictError}
                selectedBlockId={selectedBlockId}
                onSelectBlock={setSelectedBlockId}
                onChangeDraft={mutateDraft}
                onSaveNow={() => void saveDraftToServer()}
                onReloadLatest={() => void openDraftById(activeDraft.id)}
              />
            ) : (
              <>
                <div className="sticky top-[53px] z-20 flex flex-wrap items-center gap-1 rounded-t-2xl border-b border-neutral-100 bg-neutral-50/95 px-3 py-2 backdrop-blur-md">
                  {toolbarActions.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.label}
                        type="button"
                        title={item.label}
                        aria-label={item.label}
                        onClick={item.action}
                        className="inline-flex size-8 items-center justify-center rounded-md text-neutral-600 transition hover:bg-white hover:text-neutral-950 hover:shadow-sm"
                      >
                        <Icon size={15} aria-hidden="true" />
                      </button>
                    );
                  })}
                  <span className="ml-auto text-[11px] text-neutral-400">左右同步流对齐 · 自动保存</span>
                </div>

                <AutoGrowTextarea
                  ref={textareaRef}
                  minHeightPx={560}
                  aria-label="Markdown 正文编辑器"
                  value={state.content}
                  onSelect={syncMdSelectionFromTextarea}
                  onClick={syncMdSelectionFromTextarea}
                  onMouseUp={syncMdSelectionFromTextarea}
                  onKeyUp={syncMdSelectionFromTextarea}
                  onBlur={syncMdSelectionFromTextarea}
                  onChange={(e) => {
                    handleContentChange(e.target.value);
                    setMdSelection({
                      start: e.target.selectionStart ?? 0,
                      end: e.target.selectionEnd ?? 0,
                    });
                  }}
                  className="w-full rounded-b-2xl border-0 bg-white p-5 font-mono text-sm leading-[1.85] text-neutral-900 focus:outline-none"
                />
              </>
            )}
          </section>

          {/* 右侧：微信公众号实时预览（无内部滚动条，与左侧编辑区左右并排对齐） */}
          <section
            aria-label="右侧公众号预览区"
            className="flex flex-col items-center rounded-2xl border border-neutral-200 bg-neutral-100/80 p-4 sm:p-6 lg:col-span-6"
          >
            <div
              className={`w-full overflow-hidden border border-neutral-300 bg-white shadow-xl transition-[max-width] duration-200 ${
                previewDevice === "mobile" ? "max-w-[390px] rounded-[28px]" : "max-w-[677px] rounded-xl"
              }`}
            >
              <div className="flex items-center justify-between border-b border-neutral-100 bg-neutral-50 px-5 py-3 text-xs text-neutral-500">
                <span className="font-medium text-neutral-900">
                  创作工作台 · {isDraftMode ? "画布排版稿预览（点击块可定位左侧）" : "公众号预览"}
                </span>
                <span>{activeSub.name}</span>
              </div>
              <div
                onClick={handlePreviewClick}
                className={`min-h-[560px] ${isDraftMode ? "cursor-pointer" : ""}`}
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>
          </section>
        </div>
      </main>

      <FromCanvasDialog
        open={fromCanvasOpen}
        initialProjectId={initialProjectId}
        initialSnapshotId={initialSnapshotId}
        activeSubTemplateId={activeSub.id}
        activeTemplateStyle={activeStyle}
        onSelectSubTemplateId={(id) => {
          const tpl = getSubTemplate(id);
          handleSelectSubTemplate(tpl);
        }}
        onOpenDraft={openDraftById}
        onClose={() => setFromCanvasOpen(false)}
      />

      <PublishCopyDialog
        open={publishDialogOpen}
        imageCount={activeDraft ? extractDraftImageAssetIds(activeDraft.blocks).length : 0}
        publishing={publishingImages}
        error={publishError}
        onConfirm={() => void executeDraftCopyWithPublicImages()}
        onClose={() => {
          if (!publishingImages) setPublishDialogOpen(false);
        }}
      />
    </div>
  );
}
