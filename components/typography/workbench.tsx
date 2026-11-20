"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bold,
  BookOpen,
  Check,
  Code,
  Copy,
  Download,
  Eraser,
  Eye,
  FileEdit,
  Heading1,
  Heading2,
  Image as ImageIcon,
  Italic,
  Layers,
  Link2,
  List,
  LoaderCircle,
  Minus,
  Monitor,
  MoreHorizontal,
  Palette,
  Pencil,
  Quote,
  RefreshCw,
  Smartphone,
  Sparkles,
  Table2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { StudioTopNav } from "@/components/studio-top-nav";
import { ComponentTreeEditor } from "@/components/typography/component-tree-editor";
import { FromCanvasDialog } from "@/components/typography/from-canvas-dialog";
import {
  ImportLibraryDialog,
  PENDING_ANON_IMPORT_KEY,
  type EditableTeamOption,
} from "@/components/typography/import-library-dialog";
import { PublishCopyDialog } from "@/components/typography/publish-copy-dialog";
import { StructuredDraftEditor } from "@/components/typography/structured-editor";
import { StylePanel } from "@/components/typography/style-panel";
import { TeamManagerDialog } from "@/components/typography/team-manager-dialog";
import { ThemePicker } from "@/components/typography/theme-picker";
import { XiumiDrawer } from "@/components/typography/xiumi-drawer";
import { AutoGrowTextarea } from "@/components/ui/auto-grow-textarea";
import {
  applyPresetToMarkdown,
  cloneComponentNode,
  cloneStyleConfig,
  countArticleStats,
  createDefaultPersistedState,
  extractDraftImageAssetIds,
  extractMarkdownSnapshotMediaIds,
  extractPlainTextFromTree,
  getSubTemplate,
  getSubTemplatesForTheme,
  getXiumiPreset,
  migratePersistedState,
  plainToRuns,
  renderStructuredArticleHtml,
  renderWechatHtml,
  runsToPlainText,
  structuredDraftToPlainText,
  TYPOGRAPHY_STORAGE_KEY,
  TYPOGRAPHY_SUBTEMPLATES,
  type AppliedComponentSnapshot,
  type ComponentNode,
  type LibraryAssetCategory,
  type LibraryItemKind,
  type LibraryItemRecord,
  type XiumiPreset,
} from "@/lib/typography/templates";
import type { StructuredArticleBlock, StructuredArticleDraft } from "@/lib/typography/structured";
import type {
  AppliedLibraryTemplateMeta,
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
  snapshotId?: string;
  rangeStart: number;
  rangeEnd: number;
  innerBody?: string;
  rawSlice: string;
} {
  if (!markdown.trim()) {
    return { label: "空白正文（将直接插入）", rangeStart: 0, rangeEnd: 0, rawSlice: "" };
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
  const presetMatch = /^:::preset\[([a-z0-9-]+)\]\r?\n([\s\S]*?)\r?\n:::$/i.exec(rawSlice);
  const compMatch = /^:::component\[([a-zA-Z0-9_-]+)\]\r?\n([\s\S]*?)\r?\n:::$/i.exec(rawSlice);
  const unwrapped = presetMatch ? presetMatch[2] : compMatch ? compMatch[2] : rawSlice;
  const cleanText = unwrapped.replace(/\s+/g, " ").trim();
  const snippet = cleanText.length > 16 ? `${cleanText.slice(0, 16)}…` : cleanText || "当前光标段落";
  return {
    label: selEnd > selStart ? `选区「${snippet}」` : `段落「${snippet}」`,
    presetId: presetMatch ? presetMatch[1].toLowerCase() : undefined,
    snapshotId: compMatch ? compMatch[1] : undefined,
    rangeStart,
    rangeEnd,
    innerBody: presetMatch || compMatch ? unwrapped.trim() : undefined,
    rawSlice,
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
  const [componentEdit, setComponentEdit] = useState<{
    snapshot: AppliedComponentSnapshot;
    projectId?: string;
    draftBlockId?: string;
  } | null>(null);
  const openComponentDialog = useCallback((element: HTMLDialogElement | null) => {
    if (element && !element.open) element.showModal();
  }, []);
  const [state, setState] = useState<TypographyPersistedState>(() => createDefaultPersistedState());
  const [selectedThemeId, setSelectedThemeId] = useState<ThemeId>(TYPOGRAPHY_SUBTEMPLATES[0].themeId);
  const [editorMode, setEditorMode] = useState<"markdown" | "draft">("markdown");
  const [mobilePane, setMobilePane] = useState<"library" | "editor" | "preview">("editor");
  const [activeDraft, setActiveDraft] = useState<StructuredArticleDraft | null>(null);
  const [draftImageUrls, setDraftImageUrls] = useState<Record<string, string>>({});
  const [draftDirty, setDraftDirty] = useState(false);
  const [draftSaving, setDraftSaving] = useState(false);
  const [conflictError, setConflictError] = useState("");
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [mdSelection, setMdSelection] = useState<{ start: number; end: number }>({ start: 0, end: 0 });

  // 个人库、团队库与协作状态
  const [authenticated, setAuthenticated] = useState(false);
  const [personalItems, setPersonalItems] = useState<LibraryItemRecord[]>([]);
  const [teamItems, setTeamItems] = useState<LibraryItemRecord[]>([]);
  const [teams, setTeams] = useState<EditableTeamOption[]>([]);
  const [incomingInviteCount, setIncomingInviteCount] = useState(0);
  const [showArchivedLibrary, setShowArchivedLibrary] = useState(false);

  const [importModalState, setImportModalState] = useState<{
    open: boolean;
    mode: "import" | "edit";
    kind: LibraryItemKind;
    editingItem?: LibraryItemRecord | null;
    resumeDraft?: {
      kind: LibraryItemKind;
      category: LibraryAssetCategory;
      name: string;
      summary: string;
      rootNode: ComponentNode;
      templateStyle: TemplateStyleConfig;
      sampleMarkdown: string;
    } | null;
  }>({ open: false, mode: "import", kind: "asset" });
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);

  const [fromCanvasOpen, setFromCanvasOpen] = useState(Boolean(initialProjectId || initialSnapshotId));
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [publishingImages, setPublishingImages] = useState(false);
  const [publishError, setPublishError] = useState("");
  const [hasConsentedPublicImages, setHasConsentedPublicImages] = useState(false);

  const [showStylePanel, setShowStylePanel] = useState(false);
  const [styleDrawerTab, setStyleDrawerTab] = useState<"templates" | "styles">("templates");
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [pastingMdImage, setPastingMdImage] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<"mobile" | "desktop">("mobile");
  const [pendingSampleConfirm, setPendingSampleConfirm] = useState<{
    name: string;
    markdown: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [copyError, setCopyError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef<StructuredArticleDraft | null>(null);
  draftRef.current = activeDraft;

  useEffect(() => {
    if (!moreMenuOpen && !showStylePanel) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMoreMenuOpen(false);
        setShowStylePanel(false);
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      if (moreMenuOpen && e.target instanceof Node && !moreMenuRef.current?.contains(e.target)) {
        setMoreMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [moreMenuOpen, showStylePanel]);

  const flashStatus = useCallback((msg: string) => {
    setStatusMessage(msg);
    window.setTimeout(() => {
      setStatusMessage((curr) => (curr === msg ? "" : curr));
    }, 2600);
  }, []);

  const refreshLibraries = useCallback(async (withArchived = showArchivedLibrary) => {
    try {
      const [libRes, teamRes] = await Promise.all([
        fetch(`/api/library/items?includeArchived=${withArchived ? "1" : "0"}`, {
          cache: "no-store",
        }),
        fetch("/api/teams", { cache: "no-store" }),
      ]);
      const libData = await libRes.json().catch(() => ({}));
      const teamData = await teamRes.json().catch(() => ({}));

      setAuthenticated(Boolean(libData.authenticated));
      setPersonalItems(Array.isArray(libData.personalItems) ? libData.personalItems : []);
      setTeamItems(Array.isArray(libData.teamItems) ? libData.teamItems : []);
      setTeams(Array.isArray(libData.teams) ? libData.teams : []);
      setIncomingInviteCount(
        Array.isArray(teamData.incomingInvites) ? teamData.incomingInvites.length : 0,
      );
    } catch {
      // 网络暂不可用时静默保留本地状态
    }
  }, [showArchivedLibrary]);

  useEffect(() => {
    void refreshLibraries(showArchivedLibrary);
  }, [refreshLibraries, showArchivedLibrary]);

  const openDraftById = useCallback(
    async (draftId: string) => {
      const res = await fetch(`/api/typography/drafts/${encodeURIComponent(draftId)}`, {
        cache: "no-store",
      });
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

    // 检查是否从匿名导入登录后恢复待保存项
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get("resumeImport") === "1") {
        const pendingRaw = window.sessionStorage.getItem(PENDING_ANON_IMPORT_KEY);
        if (pendingRaw) {
          const parsed = JSON.parse(pendingRaw);
          if (parsed && typeof parsed === "object" && parsed.rootNode) {
            setImportModalState({
              open: true,
              mode: "import",
              kind: parsed.kind === "template" ? "template" : "asset",
              resumeDraft: parsed,
            });
          }
        }
        url.searchParams.delete("resumeImport");
        window.history.replaceState(null, "", url.toString());
      }
    } catch {
      // 忽略会话缓存异常
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
        // 忽略本地存储容量超限
      }
      return next;
    });
  }

  const isDraftMode = editorMode === "draft" && activeDraft !== null;
  const activeSub = getSubTemplate(
    isDraftMode ? activeDraft.subTemplateId : state.activeSubTemplateId,
  );
  const activeLibraryTplMeta: AppliedLibraryTemplateMeta | null = isDraftMode
    ? activeDraft.documentStyle?.appliedLibraryTemplate ?? null
    : state.activeLibraryTemplate ?? null;

  const activeStyle: TemplateStyleConfig = isDraftMode
    ? activeDraft.templateStyle
    : activeLibraryTplMeta
      ? activeLibraryTplMeta.style
      : state.styleOverrides[activeSub.id] ?? activeSub.defaultStyle;

  const personalTemplates = useMemo(
    () => personalItems.filter((i) => i.kind === "template"),
    [personalItems],
  );
  const teamTemplates = useMemo(
    () => teamItems.filter((i) => i.kind === "template"),
    [teamItems],
  );
  const personalAssets = useMemo(
    () => personalItems.filter((i) => i.kind === "asset"),
    [personalItems],
  );
  const teamAssets = useMemo(
    () => teamItems.filter((i) => i.kind === "asset"),
    [teamItems],
  );

  const latestItemVersions = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of personalItems) map[item.id] = item.version;
    for (const item of teamItems) map[item.id] = item.version;
    return map;
  }, [personalItems, teamItems]);

  const activeLibraryTplNewerVersion =
    activeLibraryTplMeta?.itemId && latestItemVersions[activeLibraryTplMeta.itemId]
      ? latestItemVersions[activeLibraryTplMeta.itemId] > activeLibraryTplMeta.version
        ? latestItemVersions[activeLibraryTplMeta.itemId]
        : null
      : null;

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
      const snap = mdRegion.snapshotId ? state.appliedSnapshots?.[mdRegion.snapshotId] ?? null : null;
      return {
        label: mdRegion.label,
        activePresetId: mdRegion.presetId,
        activeSnapshot: snap,
      };
    }
    if (!selectedDraftBlock) {
      return { label: "文末新增组件块", activePresetId: undefined, activeSnapshot: null };
    }
    const presetId =
      "presetId" in selectedDraftBlock ? selectedDraftBlock.presetId : undefined;
    const snap =
      selectedDraftBlock.type === "custom-component"
        ? selectedDraftBlock.snapshot
        : "customComponent" in selectedDraftBlock
          ? selectedDraftBlock.customComponent ?? null
          : null;

    if (
      selectedDraftBlock.type === "heading"
      || selectedDraftBlock.type === "paragraph"
      || selectedDraftBlock.type === "blockquote"
      || selectedDraftBlock.type === "preset"
    ) {
      const txt = runsToPlainText(selectedDraftBlock.runs).replace(/\s+/g, " ").trim();
      const short = txt.length > 14 ? `${txt.slice(0, 14)}…` : txt || "空文本块";
      return { label: `块「${short}」`, activePresetId: presetId, activeSnapshot: snap };
    }
    if (selectedDraftBlock.type === "custom-component") {
      return {
        label: `导入块「${selectedDraftBlock.snapshot.name}」`,
        activePresetId: undefined,
        activeSnapshot: snap,
      };
    }
    if (selectedDraftBlock.type === "image") {
      return {
        label: `配图「${selectedDraftBlock.alt || "画布配图"}」`,
        activePresetId: presetId,
        activeSnapshot: snap,
      };
    }
    if (selectedDraftBlock.type === "list") {
      return {
        label: `列表（共 ${selectedDraftBlock.items.length} 项）`,
        activePresetId: undefined,
        activeSnapshot: null,
      };
    }
    return { label: "分割线块", activePresetId: undefined, activeSnapshot: snap };
  }, [isDraftMode, mdRegion, selectedDraftBlock, state.appliedSnapshots]);

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
          return preset.category === "image"
            ? { ...b, presetId: preset.id, customComponent: undefined }
            : b;
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

  /**
   * 应用快照到当前 Markdown 或画布排版稿（卡片/分割线支持插入，标题边框/图片边框保留原文字或原图）
   */
  function applyMaterializedSnapshotToEditor(
    snapshot: AppliedComponentSnapshot,
    mode: "apply-region" | "insert-below",
  ) {
    if (!isDraftMode) {
      const liveStart = textareaRef.current?.selectionStart ?? mdSelection.start;
      const liveEnd = textareaRef.current?.selectionEnd ?? mdSelection.end;
      const region = inspectMarkdownRegion(state.content, liveStart, liveEnd);

      let nextContent: string;
      if (mode === "insert-below" || snapshot.category === "divider" || !state.content.trim()) {
        const blockStr = `:::component[${snapshot.snapshotId}]\n:::`;
        const insertPos = region.rangeEnd;
        const prefix = state.content.slice(0, insertPos).replace(/\s*$/, "");
        const suffix = state.content.slice(insertPos).replace(/^\s*/, "");
        nextContent = [prefix, blockStr, suffix].filter(Boolean).join("\n\n");
      } else {
        const preservedInner =
          region.innerBody !== undefined
            ? region.innerBody
            : snapshot.category === "image-border" && !/!\[[^\]]*\]\([^)]+\)/.test(region.rawSlice)
              ? "![示例配图](/images/cover-example.jpg)"
              : region.rawSlice || snapshot.name;
        const blockStr = preservedInner
          ? `:::component[${snapshot.snapshotId}]\n${preservedInner}\n:::`
          : `:::component[${snapshot.snapshotId}]\n:::`;
        nextContent =
          state.content.slice(0, region.rangeStart)
          + blockStr
          + state.content.slice(region.rangeEnd);
      }

      commitState((prev) => ({
        ...prev,
        content: nextContent,
        hasEditedContent: true,
        drafts: { ...prev.drafts, [prev.activeSubTemplateId]: nextContent },
        appliedSnapshots: {
          ...(prev.appliedSnapshots ?? {}),
          [snapshot.snapshotId]: snapshot,
        },
      }));
      flashStatus(`已应用组件快照「${snapshot.name}」`);
      if (snapshot.category === "template" || mobilePane === "library") setMobilePane("preview");
      return;
    }

    if (!activeDraft) return;
    const target = selectedDraftBlock;

    // 插入独立快照块（卡片、分割线或显式插入）
    if (
      mode === "insert-below"
      || !target
      || snapshot.category === "divider"
      || (snapshot.category === "card" && target.type === "image")
    ) {
      const newId = crypto.randomUUID();
      const newBlock: StructuredArticleBlock =
        snapshot.category === "divider"
          ? { id: newId, type: "divider", customComponent: snapshot }
          : {
              id: newId,
              type: "custom-component",
              snapshot,
            };
      mutateDraft((prev) => {
        const idx = selectedBlockId ? prev.blocks.findIndex((b) => b.id === selectedBlockId) : -1;
        if (idx === -1) return { ...prev, blocks: [...prev.blocks, newBlock] };
        const next = [...prev.blocks];
        next.splice(idx + 1, 0, newBlock);
        return { ...prev, blocks: next };
      });
      setSelectedBlockId(newId);
      flashStatus(`已插入「${snapshot.name}」`);
      if (snapshot.category === "template" || mobilePane === "library") setMobilePane("preview");
      return;
    }

    if (snapshot.category === "image-border" && target.type !== "image") {
      flashStatus("请先选中一个「画布配图」块，再套用图片边框（将自动保留原配图）");
      return;
    }

    if (snapshot.category === "heading-border" && target.type === "image") {
      flashStatus("请先选中一个标题或文字块，再套用标题边框（将自动保留原文字）");
      return;
    }

    mutateDraft((prev) => ({
      ...prev,
      blocks: prev.blocks.map((b): StructuredArticleBlock => {
        if (b.id !== target.id) return b;
        if (b.type === "image" && snapshot.category === "image-border") {
          return { ...b, presetId: undefined, customComponent: snapshot };
        }
        if (b.type === "heading" || b.type === "paragraph" || b.type === "blockquote") {
          return { ...b, presetId: undefined, customComponent: snapshot };
        }
        if (b.type === "preset") {
          return {
            id: b.id,
            type: "paragraph",
            runs: b.runs,
            customComponent: snapshot,
            sourceNodeId: b.sourceNodeId,
          };
        }
        if (b.type === "custom-component") {
          return { ...b, snapshot };
        }
        return b;
      }),
    }));
    flashStatus(`已将「${snapshot.name}」套用到当前块并保留原内容`);
    if (mobilePane === "library") setMobilePane("preview");
  }

  async function handleApplyLibraryAsset(
    item: LibraryItemRecord,
    mode: "apply-region" | "insert-below",
  ) {
    try {
      const res = await fetch(`/api/library/items/${encodeURIComponent(item.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "materialize",
          projectId: isDraftMode && activeDraft ? activeDraft.projectId : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.snapshot) {
        throw new Error(data.error || "准备组件快照失败。");
      }
      applyMaterializedSnapshotToEditor(data.snapshot as AppliedComponentSnapshot, mode);
    } catch (err) {
      setCopyError(err instanceof Error ? err.message : "应用素材失败。");
    }
  }

  function editComponent(snapshot: AppliedComponentSnapshot, draftBlockId?: string) {
    setComponentEdit({
      snapshot,
      draftBlockId,
      projectId: draftBlockId ? activeDraft?.projectId : undefined,
    });
  }

  function saveComponentEdit() {
    if (!componentEdit) return;
    const { snapshot, draftBlockId, projectId } = componentEdit;
    if (draftBlockId) {
      if (activeDraft?.projectId !== projectId) return;
      mutateDraft((prev) => ({
        ...prev,
        blocks: prev.blocks.map((block) => {
          if (block.id !== draftBlockId) return block;
          if (block.type === "custom-component") return { ...block, snapshot };
          if ("customComponent" in block) return { ...block, customComponent: snapshot };
          return block;
        }),
      }));
    } else {
      commitState((prev) => ({
        ...prev,
        appliedSnapshots: { ...(prev.appliedSnapshots ?? {}), [snapshot.snapshotId]: snapshot },
      }));
    }
    setComponentEdit(null);
    flashStatus("已更新当前稿件中的组件");
  }

  async function handleReapplyDraftBlockSnapshot(blockId: string, sourceItemId: string) {
    if (!activeDraft) return;
    try {
      const res = await fetch(`/api/library/items/${encodeURIComponent(sourceItemId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "materialize",
          projectId: activeDraft.projectId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.snapshot) {
        throw new Error(data.error || "获取最新素材版本失败。");
      }
      const nextSnap = data.snapshot as AppliedComponentSnapshot;
      mutateDraft((prev) => ({
        ...prev,
        blocks: prev.blocks.map((b) => {
          if (b.id !== blockId) return b;
          if (b.type === "custom-component") return { ...b, snapshot: nextSnap };
          if ("customComponent" in b) return { ...b, customComponent: nextSnap };
          return b;
        }),
      }));
      flashStatus(`已手动重新应用最新版本 v${nextSnap.sourceVersion}`);
    } catch (err) {
      setCopyError(err instanceof Error ? err.message : "重新应用失败。");
    }
  }

  async function handleReapplyMarkdownRegionSnapshot() {
    const snap = drawerTargetInfo.activeSnapshot;
    if (!snap?.sourceItemId) return;
    if (isDraftMode && selectedDraftBlock) {
      await handleReapplyDraftBlockSnapshot(selectedDraftBlock.id, snap.sourceItemId);
      return;
    }
    if (!mdRegion.snapshotId) return;
    try {
      const res = await fetch(`/api/library/items/${encodeURIComponent(snap.sourceItemId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "materialize", projectId: null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.snapshot) throw new Error(data.error || "更新快照失败。");
      const fresh = data.snapshot as AppliedComponentSnapshot;
      const keptIdSnap: AppliedComponentSnapshot = { ...fresh, snapshotId: mdRegion.snapshotId };
      commitState((prev) => ({
        ...prev,
        appliedSnapshots: {
          ...(prev.appliedSnapshots ?? {}),
          [mdRegion.snapshotId!]: keptIdSnap,
        },
      }));
      flashStatus(`已手动更新为库内最新版本 v${fresh.sourceVersion}`);
    } catch (err) {
      setCopyError(err instanceof Error ? err.message : "重新应用失败。");
    }
  }

  function handleClearRegionPreset() {
    if (!isDraftMode) {
      if ((!mdRegion.presetId && !mdRegion.snapshotId) || mdRegion.innerBody === undefined) return;
      const next =
        state.content.slice(0, mdRegion.rangeStart)
        + (mdRegion.innerBody || (drawerTargetInfo.activeSnapshot
          ? extractPlainTextFromTree(drawerTargetInfo.activeSnapshot.rootNode)
          : ""))
        + state.content.slice(mdRegion.rangeEnd);
      handleContentChange(next);
      flashStatus("已移除当前区域的组件样式并保留原文");
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
        if (b.type === "custom-component") {
          return {
            id: b.id,
            type: "paragraph",
            runs: b.runs ?? plainToRuns(b.snapshot.name),
            sourceNodeId: b.sourceNodeId,
          };
        }
        const copy = { ...b } as StructuredArticleBlock & {
          presetId?: string;
          customComponent?: unknown;
        };
        delete copy.presetId;
        delete copy.customComponent;
        return copy;
      }),
    }));
    flashStatus("已还原选中块的默认样式");
  }

  function handlePreviewClick(e: React.MouseEvent<HTMLDivElement>) {
    const clicked = e.target as HTMLElement | null;
    if (!isDraftMode) {
      const rangeHolder = clicked?.closest<HTMLElement>("[data-md-range]");
      const rawRange = rangeHolder?.dataset.mdRange;
      if (rawRange) {
        const [sStr, eStr] = rawRange.split("-");
        const start = Number.parseInt(sStr, 10);
        const end = Number.parseInt(eStr, 10);
        if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
          setMdSelection({ start, end });
          const el = textareaRef.current;
          if (el) {
            el.focus({ preventScroll: true });
            el.setSelectionRange(start, end);
          }
        }
      }
      if (e.detail >= 2) {
        const snapshotId = clicked?.closest<HTMLElement>("[data-component-snapshot]")?.dataset.componentSnapshot;
        const snapshot = snapshotId ? state.appliedSnapshots?.[snapshotId] : undefined;
        if (snapshot) editComponent(snapshot);
      }
      return;
    }
    const target = clicked?.closest<HTMLElement>("[data-block-id]");
    const blockId = target?.dataset.blockId;
    if (!blockId) return;
    setSelectedBlockId(blockId);
    const block = activeDraft?.blocks.find((entry) => entry.id === blockId);
    if (block?.type === "custom-component" && block.snapshot.category === "template") {
      editComponent(block.snapshot, blockId);
      return;
    }
    const editorCard = document.querySelector<HTMLElement>(
      `[data-editor-block-id="${CSS.escape(blockId)}"]`,
    );
    editorCard?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  async function handleMarkdownPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const fileFromFiles = Array.from(e.clipboardData?.files ?? []).find((f) =>
      f.type.startsWith("image/"),
    );
    const items = Array.from(e.clipboardData?.items ?? []);
    const imageItem = items.find((it) => it.kind === "file" && it.type.startsWith("image/"));
    const rawFile = fileFromFiles ?? imageItem?.getAsFile() ?? null;
    if (!rawFile) return;

    e.preventDefault();
    const insertAt = e.currentTarget.selectionEnd ?? state.content.length;
    setPastingMdImage(true);
    setCopyError("");
    try {
      let uploadFile = rawFile;
      if (!/^image\/(png|jpeg|webp)$/i.test(rawFile.type)) {
        const bmpUrl = URL.createObjectURL(rawFile);
        try {
          const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const el = new Image();
            el.onload = () => resolve(el);
            el.onerror = () => reject(new Error("无法读取粘贴的图片。"));
            el.src = bmpUrl;
          });
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("图片编码失败。");
          ctx.drawImage(img, 0, 0);
          const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
          if (!blob) throw new Error("图片编码失败。");
          uploadFile = new File([blob], "pasted-screenshot.png", { type: "image/png" });
        } finally {
          URL.revokeObjectURL(bmpUrl);
        }
      }

      if (uploadFile.size > 10 * 1024 * 1024) {
        throw new Error("粘贴图片不能超过 10 MB。");
      }

      if (authenticated) {
        const fd = new FormData();
        fd.append("file", uploadFile);
        fd.append("scopeType", "personal");
        const res = await fetch("/api/library/media", { method: "POST", body: fd });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.media?.id) {
          throw new Error(data.error || "保存粘贴图片失败。");
        }
        const imgSyntax = `\n\n![文章配图](/api/library/media/${encodeURIComponent(String(data.media.id))})\n\n`;
        commitState((prev) => {
          const pos = Math.min(prev.content.length, Math.max(0, insertAt));
          const nextContent = prev.content.slice(0, pos) + imgSyntax + prev.content.slice(pos);
          return {
            ...prev,
            content: nextContent,
            hasEditedContent: true,
            drafts: { ...prev.drafts, [prev.activeSubTemplateId]: nextContent },
          };
        });
        flashStatus("已将粘贴图片存入私有素材并插入正文");
      } else {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result ?? ""));
          reader.onerror = () => reject(new Error("读取图片失败。"));
          reader.readAsDataURL(uploadFile);
        });
        const snapId = `local-img-${Math.random().toString(36).slice(2, 8)}`;
        const localSnap: AppliedComponentSnapshot = {
          snapshotId: snapId,
          sourceItemId: null,
          sourceScopeType: "local",
          sourceVersion: 1,
          name: "粘贴截图",
          category: "card",
          rootNode: {
            id: `root-${snapId}`,
            type: "container",
            direction: "vertical",
            gap: 0,
            boxStyle: { marginTop: 10, marginBottom: 10 },
            children: [
              {
                id: `img-${snapId}`,
                type: "image",
                imageRef: { kind: "inline-data", dataUrl },
                alt: "粘贴配图",
                maxWidthPercent: 100,
                boxStyle: { borderRadius: 8 },
              },
            ],
          },
          appliedAt: new Date().toISOString(),
        };
        applyMaterializedSnapshotToEditor(localSnap, "insert-below");
        flashStatus("已插入粘贴截图预览（登录后可存为云端私有素材）");
      }
    } catch (err) {
      setCopyError(err instanceof Error ? err.message : "粘贴图片失败。");
    } finally {
      setPastingMdImage(false);
    }
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
        documentStyle: { ...prev.documentStyle, appliedLibraryTemplate: null },
      }));
    } else {
      commitState((prev) => ({
        ...prev,
        activeSubTemplateId: firstSub.id,
        activeLibraryTemplate: null,
      }));
      setPendingSampleConfirm(null);
    }
  }

  function handleSelectSubTemplate(sub: TypographySubTemplate) {
    setSelectedThemeId(sub.themeId);
    if (isDraftMode) {
      mutateDraft((prev) => ({
        ...prev,
        subTemplateId: sub.id,
        templateStyle: cloneStyleConfig(sub.defaultStyle),
        documentStyle: { ...prev.documentStyle, appliedLibraryTemplate: null },
      }));
    } else {
      commitState((prev) => ({
        ...prev,
        activeSubTemplateId: sub.id,
        activeLibraryTemplate: null,
      }));
      setPendingSampleConfirm(null);
    }
  }

  /**
   * 应用库内导入模板（默认仅套用样式，不替换正文；示例需显式加载）
   */
  function handleApplyLibraryTemplate(item: LibraryItemRecord) {
    const nextStyle = cloneStyleConfig(item.templateStyle ?? activeSub.defaultStyle);
    const tplMeta: AppliedLibraryTemplateMeta = {
      itemId: item.id,
      name: item.name,
      version: item.version,
      style: nextStyle,
      sampleMarkdown: item.sampleMarkdown ?? activeSub.sampleMarkdown,
    };

    if (isDraftMode) {
      mutateDraft((prev) => ({
        ...prev,
        templateStyle: nextStyle,
        documentStyle: { ...prev.documentStyle, appliedLibraryTemplate: tplMeta },
      }));
    } else {
      commitState((prev) => ({
        ...prev,
        activeLibraryTemplate: tplMeta,
      }));
    }
    flashStatus(`已应用模板「${item.name}」样式（正文保持不变）`);
  }

  function requestLoadMarkdownSample(name: string, sampleMd: string) {
    if (isDraftMode) {
      setEditorMode("markdown");
    }
    const trimmed = state.content.trim();
    const isUnedited = !state.hasEditedContent || trimmed.length === 0 || state.content === activeSub.sampleMarkdown;
    if (isUnedited) {
      commitState((prev) => ({
        ...prev,
        content: sampleMd,
        hasEditedContent: false,
      }));
      flashStatus(`已加载「${name}」示例内容`);
      return;
    }
    setPendingSampleConfirm({ name, markdown: sampleMd });
  }

  async function handleDuplicateLibraryItem(item: LibraryItemRecord) {
    try {
      const res = await fetch(`/api/library/items/${encodeURIComponent(item.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "duplicate", targetScopeType: "personal" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.item) throw new Error(data.error || "复制失败。");
      await refreshLibraries();
      flashStatus(`已将「${item.name}」复制到个人库`);
    } catch (err) {
      setCopyError(err instanceof Error ? err.message : "复制失败。");
    }
  }

  async function handleToggleArchiveLibraryItem(item: LibraryItemRecord) {
    try {
      const res = await fetch(`/api/library/items/${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedVersion: item.version,
          archived: !item.archived,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "更新归档状态失败。");
      await refreshLibraries();
      flashStatus(item.archived ? `已取消归档「${item.name}」` : `已归档「${item.name}」（旧稿不受影响）`);
    } catch (err) {
      setCopyError(err instanceof Error ? err.message : "操作失败。");
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
      if (prev.activeLibraryTemplate) {
        return {
          ...prev,
          activeLibraryTemplate: {
            ...prev.activeLibraryTemplate,
            style: updater(cloneStyleConfig(prev.activeLibraryTemplate.style)),
          },
        };
      }
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
        documentStyle: { ...prev.documentStyle, appliedLibraryTemplate: null },
      }));
      flashStatus(`已恢复「${activeSub.name}」默认样式`);
      return;
    }
    commitState((prev) => {
      const nextOverrides = { ...prev.styleOverrides };
      delete nextOverrides[activeSub.id];
      return { ...prev, styleOverrides: nextOverrides, activeLibraryTemplate: null };
    });
    flashStatus(`已恢复「${activeSub.name}」默认样式`);
  }

  function handleContentChange(nextContent: string) {
    setPendingSampleConfirm(null);
    commitState((prev) => ({
      ...prev,
      content: nextContent,
      hasEditedContent: true,
      drafts: { ...prev.drafts, [prev.activeSubTemplateId]: nextContent },
    }));
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
    link.download = `${isDraftMode ? activeDraft.title : activeLibraryTplMeta?.name ?? activeSub.name}.md`;
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
    return renderWechatHtml(state.content, activeStyle, {
      snapshots: state.appliedSnapshots,
    });
  }, [
    isDraftMode,
    draftProjectId,
    draftTitle,
    draftTemplateStyle,
    draftDocumentStyle,
    draftBlocks,
    effectiveDraftImageUrls,
    state.content,
    state.appliedSnapshots,
    activeStyle,
  ]);

  const stats = useMemo(
    () => countArticleStats(isDraftMode ? structuredDraftToPlainText(activeDraft) : state.content),
    [isDraftMode, activeDraft, state.content],
  );

  const pendingPublicImageCount = useMemo(() => {
    if (isDraftMode && activeDraft) {
      return extractDraftImageAssetIds(activeDraft.blocks).length;
    }
    return extractMarkdownSnapshotMediaIds(state.content, state.appliedSnapshots).length;
  }, [isDraftMode, activeDraft, state.content, state.appliedSnapshots]);

  async function executeCopyWithPublicImages() {
    setPublishingImages(true);
    setPublishError("");
    setCopyError("");
    try {
      if (isDraftMode && activeDraft) {
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
      } else {
        const mediaIds = extractMarkdownSnapshotMediaIds(state.content, state.appliedSnapshots);
        let publicMediaUrls: Record<string, string> = {};
        if (mediaIds.length > 0) {
          const res = await fetch("/api/library/publish-media", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mediaIds }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data.images) {
            throw new Error(data.error || "准备组件公开图片副本失败，请重试。");
          }
          publicMediaUrls = data.images as Record<string, string>;
        }
        const exportHtml = renderWechatHtml(state.content, activeStyle, {
          snapshots: state.appliedSnapshots,
          libraryMediaUrls: publicMediaUrls,
          forExport: true,
        });
        await writeWechatClipboard(exportHtml, state.content);
      }

      window.localStorage.setItem(PUBLIC_COPY_CONSENT_KEY, "1");
      setHasConsentedPublicImages(true);
      setPublishDialogOpen(false);
      setCopied(true);
      flashStatus("已复制公众号富文本");
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
    if (pendingPublicImageCount > 0 && !hasConsentedPublicImages) {
      setPublishError("");
      setPublishDialogOpen(true);
      return;
    }
    await executeCopyWithPublicImages();
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

  const activeMdPresetMeta = drawerTargetInfo.activePresetId
    ? getXiumiPreset(drawerTargetInfo.activePresetId)
    : undefined;

  return (
    <div className="flex min-h-screen flex-col bg-[#f5f4f0] text-neutral-950">
      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.markdown,.txt"
        onChange={(e) => void importMarkdown(e)}
        hidden
      />

      <StudioTopNav
        current="typography"
        showLogout={false}
        centerSlot={
          <div className="flex flex-wrap items-center gap-2">
            {activeDraft && (
              <div className="inline-flex rounded-xl border border-neutral-200 bg-neutral-100 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setEditorMode("markdown")}
                  className={`min-h-8 rounded-lg px-2.5 py-1 font-medium ${
                    editorMode === "markdown" ? "bg-white text-neutral-950 shadow-xs" : "text-neutral-600"
                  }`}
                >
                  自由写作
                </button>
                <button
                  type="button"
                  onClick={() => setEditorMode("draft")}
                  className={`min-h-8 rounded-lg px-2.5 py-1 font-medium ${
                    editorMode === "draft" ? "bg-[#164b3e] text-white shadow-xs" : "text-neutral-600"
                  }`}
                >
                  画布排版稿
                </button>
              </div>
            )}

            <span className="hidden rounded-full bg-neutral-100 px-2.5 py-1 text-xs tabular-nums text-neutral-600 xl:inline-flex">
              {stats.total} 字 · 约 {stats.minutes} 分钟
            </span>

            {activeLibraryTplMeta && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-900">
                <span>模板：{activeLibraryTplMeta.name}</span>
                {activeLibraryTplNewerVersion && activeLibraryTplMeta.itemId && (
                  <button
                    type="button"
                    onClick={() => {
                      const latest =
                        personalItems.find((i) => i.id === activeLibraryTplMeta.itemId)
                        ?? teamItems.find((i) => i.id === activeLibraryTplMeta.itemId);
                      if (latest) handleApplyLibraryTemplate(latest);
                    }}
                    className="inline-flex items-center gap-0.5 rounded bg-emerald-800 px-1.5 py-0.5 text-[10px] font-semibold text-white hover:bg-emerald-950"
                  >
                    <RefreshCw size={10} />
                    升至 v{activeLibraryTplNewerVersion}
                  </button>
                )}
              </span>
            )}
          </div>
        }
        rightSlot={
          <>
            <button
              type="button"
              onClick={() => setFromCanvasOpen(true)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-900 shadow-xs transition hover:bg-neutral-50"
            >
              <Sparkles size={14} className="text-[#164b3e]" aria-hidden="true" />
              从画布生成
            </button>

            <div className="hidden rounded-xl border border-neutral-200 bg-neutral-50 p-0.5 sm:inline-flex" role="group" aria-label="预览视口">
              <button
                type="button"
                onClick={() => setPreviewDevice("mobile")}
                aria-pressed={previewDevice === "mobile"}
                className={`inline-flex min-h-8 items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  previewDevice === "mobile" ? "bg-white text-neutral-950 shadow-xs" : "text-neutral-600 hover:text-neutral-950"
                }`}
              >
                <Smartphone size={13} aria-hidden="true" />
                手机
              </button>
              <button
                type="button"
                onClick={() => setPreviewDevice("desktop")}
                aria-pressed={previewDevice === "desktop"}
                className={`inline-flex min-h-8 items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  previewDevice === "desktop" ? "bg-white text-neutral-950 shadow-xs" : "text-neutral-600 hover:text-neutral-950"
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
              className={`inline-flex min-h-10 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                showStylePanel
                  ? "border-neutral-950 bg-neutral-950 text-white"
                  : "border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50"
              }`}
            >
              <Palette size={14} aria-hidden="true" />
              模板与样式
            </button>

            <div ref={moreMenuRef} className="relative">
              <button
                type="button"
                aria-label="更多文档与团队操作"
                aria-expanded={moreMenuOpen}
                onClick={() => setMoreMenuOpen((v) => !v)}
                className="relative inline-flex min-h-10 items-center gap-1 rounded-xl border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
              >
                <MoreHorizontal size={15} />
                <span className="hidden md:inline">更多</span>
                {incomingInviteCount > 0 && (
                  <span className="rounded-full bg-[#164b3e] px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {incomingInviteCount}
                  </span>
                )}
              </button>

              {moreMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-40 mt-1.5 grid w-48 gap-0.5 rounded-xl border border-neutral-200 bg-white p-1.5 text-xs text-neutral-800 shadow-xl"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMoreMenuOpen(false);
                      setTeamDialogOpen(true);
                    }}
                    className="flex min-h-9 items-center justify-between rounded-lg px-2.5 py-1.5 text-left font-medium hover:bg-neutral-100"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Users size={14} />
                      团队库与协作
                    </span>
                    {incomingInviteCount > 0 && (
                      <span className="rounded-full bg-[#164b3e] px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {incomingInviteCount}
                      </span>
                    )}
                  </button>

                  {!isDraftMode && (
                    <>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMoreMenuOpen(false);
                          requestLoadMarkdownSample(
                            activeLibraryTplMeta?.name ?? activeSub.name,
                            activeLibraryTplMeta?.sampleMarkdown ?? activeSub.sampleMarkdown,
                          );
                        }}
                        className="flex min-h-9 items-center gap-2 rounded-lg px-2.5 py-1.5 text-left font-medium hover:bg-neutral-100"
                      >
                        <BookOpen size={14} />
                        加载模板示例文
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMoreMenuOpen(false);
                          fileInputRef.current?.click();
                        }}
                        className="flex min-h-9 items-center gap-2 rounded-lg px-2.5 py-1.5 text-left font-medium hover:bg-neutral-100"
                      >
                        <Upload size={14} />
                        导入 Markdown 文件
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMoreMenuOpen(false);
                      exportMarkdown();
                    }}
                    className="flex min-h-9 items-center gap-2 rounded-lg px-2.5 py-1.5 text-left font-medium hover:bg-neutral-100"
                  >
                    <Download size={14} />
                    导出 Markdown 文件
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              disabled={publishingImages}
              onClick={() => void handleCopyClick()}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[#164b3e] px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-[#123d32] disabled:opacity-60"
            >
              {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
              {publishingImages ? "准备图片…" : copied ? "已复制富文本" : "复制到公众号"}
            </button>
          </>
        }
        subHeader={
          <div
            role="tablist"
            aria-label="窄屏工作区切换"
            className="grid grid-cols-3 gap-1 border-t border-neutral-200/80 bg-neutral-50 px-4 py-1.5 lg:hidden"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mobilePane === "library"}
              onClick={() => setMobilePane("library")}
              className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl text-xs font-semibold transition ${
                mobilePane === "library"
                  ? "bg-neutral-950 text-white shadow-xs"
                  : "text-neutral-600 hover:bg-white"
              }`}
            >
              <Layers size={14} />
              素材库
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mobilePane === "editor"}
              onClick={() => setMobilePane("editor")}
              className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl text-xs font-semibold transition ${
                mobilePane === "editor"
                  ? "bg-neutral-950 text-white shadow-xs"
                  : "text-neutral-600 hover:bg-white"
              }`}
            >
              <FileEdit size={14} />
              编辑区
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mobilePane === "preview"}
              onClick={() => setMobilePane("preview")}
              className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl text-xs font-semibold transition ${
                mobilePane === "preview"
                  ? "bg-neutral-950 text-white shadow-xs"
                  : "text-neutral-600 hover:bg-white"
              }`}
            >
              <Eye size={14} />
              公众号预览
            </button>
          </div>
        }
      />

      {pendingSampleConfirm && (
        <div
          role="alertdialog"
          aria-labelledby="confirm-sample-title"
          className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-950 sm:px-6"
        >
          <div className="mx-auto flex max-w-[1680px] flex-wrap items-center justify-between gap-2">
            <p id="confirm-sample-title">
              当前编辑区已有正文，加载「<strong>{pendingSampleConfirm.name}</strong>」示例将替换当前内容，是否继续？
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPendingSampleConfirm(null)}
                className="min-h-9 rounded-lg border border-amber-300 bg-white px-3 py-1 font-medium text-amber-900 hover:bg-amber-100"
              >
                保留当前正文
              </button>
              <button
                type="button"
                onClick={() => {
                  const chosen = pendingSampleConfirm;
                  setPendingSampleConfirm(null);
                  commitState((prev) => ({
                    ...prev,
                    content: chosen.markdown,
                    hasEditedContent: false,
                  }));
                  flashStatus(`已加载「${chosen.name}」示例文章`);
                }}
                className="min-h-9 rounded-lg bg-amber-900 px-3 py-1 font-medium text-white hover:bg-amber-800"
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

      {/* 左侧非遮挡式「模板与样式」抽屉面板（桌面端贴左侧展开，右侧公众号手机预览全程完整裸露可见） */}
      {showStylePanel && (
        <>
          <div
            aria-hidden="true"
            onClick={() => setShowStylePanel(false)}
            className="fixed inset-0 z-30 bg-black/25 lg:hidden"
          />
          <aside
            aria-label="模板库与局部样式设置"
            className="animate-drawer-left fixed inset-y-0 left-0 z-40 flex w-full max-w-[500px] flex-col border-r border-neutral-200 bg-white shadow-2xl lg:top-[57px] lg:h-[calc(100dvh-57px)]"
          >
            <div className="flex items-center justify-between gap-2 border-b border-neutral-100 px-4 py-3">
              <div className="inline-flex rounded-xl bg-neutral-100 p-1 text-xs" role="tablist" aria-label="模板与样式分栏">
                <button
                  type="button"
                  role="tab"
                  aria-selected={styleDrawerTab === "templates"}
                  onClick={() => setStyleDrawerTab("templates")}
                  className={`min-h-8 rounded-lg px-3 py-1 font-semibold transition ${
                    styleDrawerTab === "templates"
                      ? "bg-white text-neutral-950 shadow-xs"
                      : "text-neutral-600 hover:text-neutral-950"
                  }`}
                >
                  切换整套模板
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={styleDrawerTab === "styles"}
                  onClick={() => setStyleDrawerTab("styles")}
                  className={`min-h-8 rounded-lg px-3 py-1 font-semibold transition ${
                    styleDrawerTab === "styles"
                      ? "bg-white text-neutral-950 shadow-xs"
                      : "text-neutral-600 hover:text-neutral-950"
                  }`}
                >
                  调配色与字号
                </button>
              </div>

              <button
                type="button"
                aria-label="收起模板与样式面板"
                onClick={() => setShowStylePanel(false)}
                className="inline-flex size-8 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {styleDrawerTab === "templates" ? (
                <ThemePicker
                  activeThemeId={selectedThemeId}
                  activeSubTemplateId={activeSub.id}
                  activeLibraryTemplateId={activeLibraryTplMeta?.itemId ?? null}
                  styleOverrides={styleOverridesMap}
                  personalTemplates={personalTemplates}
                  teamTemplates={teamTemplates}
                  incomingInviteCount={incomingInviteCount}
                  showArchived={showArchivedLibrary}
                  onToggleShowArchived={() => setShowArchivedLibrary((v) => !v)}
                  onSelectTheme={handleSelectTheme}
                  onSelectSubTemplate={handleSelectSubTemplate}
                  onApplyLibraryTemplate={handleApplyLibraryTemplate}
                  onLoadLibraryTemplateSample={(tpl) => {
                    handleApplyLibraryTemplate(tpl);
                    if (tpl.sampleMarkdown) {
                      requestLoadMarkdownSample(tpl.name, tpl.sampleMarkdown);
                    }
                  }}
                  onInsertLibraryTemplate={(item) => void handleApplyLibraryAsset(item, "insert-below")}
                  onOpenImportTemplate={() =>
                    setImportModalState({ open: true, mode: "import", kind: "template" })
                  }
                  onEditLibraryItem={(item) =>
                    setImportModalState({ open: true, mode: "edit", kind: item.kind, editingItem: item })
                  }
                  onDuplicateLibraryItem={(item) => void handleDuplicateLibraryItem(item)}
                  onToggleArchiveItem={(item) => void handleToggleArchiveLibraryItem(item)}
                  onOpenTeamManager={() => setTeamDialogOpen(true)}
                />
              ) : (
                <StylePanel
                  themeId={selectedThemeId}
                  style={activeStyle}
                  onSelectPalette={handleSelectPalette}
                  onUpdateStyle={updateActiveStyle}
                  onResetDefault={handleResetTemplateDefault}
                />
              )}
            </div>
          </aside>
        </>
      )}

      <main className="mx-auto flex w-full max-w-[1680px] flex-1 flex-col gap-4 p-3 sm:p-5 lg:flex-row lg:items-start">
        {/* 第一栏：素材库抽屉（桌面常驻，窄屏按 mobilePane === 'library' 切换） */}
        <div className={`${mobilePane === "library" ? "block" : "hidden"} w-full lg:block lg:w-auto`}>
          <XiumiDrawer
            style={activeStyle}
            targetLabel={drawerTargetInfo.label}
            activePresetId={drawerTargetInfo.activePresetId}
            activeCustomSnapshot={drawerTargetInfo.activeSnapshot}
            latestItemVersions={latestItemVersions}
            personalAssets={personalAssets}
            teamAssets={teamAssets}
            showArchived={showArchivedLibrary}
            onToggleShowArchived={() => setShowArchivedLibrary((v) => !v)}
            onApplyToRegion={handleApplyPresetToRegion}
            onInsertBlock={handleInsertPresetBlock}
            onApplyLibraryAsset={(item, mode) => void handleApplyLibraryAsset(item, mode)}
            onReapplyUpdatedSnapshot={() => void handleReapplyMarkdownRegionSnapshot()}
            onEditAppliedComponent={drawerTargetInfo.activeSnapshot
              ? () => editComponent(drawerTargetInfo.activeSnapshot!, isDraftMode ? selectedDraftBlock?.id : undefined)
              : undefined}
            onOpenImportAsset={() =>
              setImportModalState({ open: true, mode: "import", kind: "asset" })
            }
            onEditLibraryItem={(item) =>
              setImportModalState({ open: true, mode: "edit", kind: item.kind, editingItem: item })
            }
            onDuplicateLibraryItem={(item) => void handleDuplicateLibraryItem(item)}
            onToggleArchiveItem={(item) => void handleToggleArchiveLibraryItem(item)}
            onOpenTeamManager={() => setTeamDialogOpen(true)}
            onClearRegionPreset={
              drawerTargetInfo.activePresetId || drawerTargetInfo.activeSnapshot
                ? handleClearRegionPreset
                : undefined
            }
          />
        </div>

        {/* 第二栏 & 第三栏：编辑区与公众号预览分栏 */}
        <div className="grid min-w-0 flex-1 items-start gap-4 lg:grid-cols-12">
          {/* 编辑区 */}
          <section
            aria-label={isDraftMode ? "排版稿结构化编辑区" : "Markdown 编辑区"}
            className={`${
              mobilePane === "editor" ? "flex" : "hidden"
            } flex-col rounded-2xl border border-neutral-200 bg-white shadow-sm lg:col-span-6 lg:flex`}
          >
            {isDraftMode ? (
              <StructuredDraftEditor
                draft={activeDraft}
                imageUrls={effectiveDraftImageUrls}
                saving={draftSaving}
                dirty={draftDirty}
                conflictError={conflictError}
                selectedBlockId={selectedBlockId}
                latestItemVersions={latestItemVersions}
                onSelectBlock={setSelectedBlockId}
                onChangeDraft={mutateDraft}
                onReapplyBlockSnapshot={(blockId, sourceItemId) =>
                  void handleReapplyDraftBlockSnapshot(blockId, sourceItemId)
                }
                onSaveNow={() => void saveDraftToServer()}
                onReloadLatest={() => void openDraftById(activeDraft.id)}
              />
            ) : (
              <>
                <div className="sticky top-[57px] z-20 rounded-t-2xl border-b border-neutral-100 bg-neutral-50/95 backdrop-blur-md">
                  <div className="flex flex-wrap items-center gap-1 px-3 py-2">
                    {toolbarActions.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.label}
                          type="button"
                          title={item.label}
                          aria-label={item.label}
                          onClick={item.action}
                          className="inline-flex size-8 items-center justify-center rounded-lg text-neutral-600 transition hover:bg-white hover:text-neutral-950 hover:shadow-xs"
                        >
                          <Icon size={15} aria-hidden="true" />
                        </button>
                      );
                    })}
                    <span className="ml-auto hidden items-center gap-1.5 text-[11px] text-neutral-400 sm:inline-flex">
                      {pastingMdImage ? (
                        <>
                          <LoaderCircle size={12} className="animate-spin text-[#164b3e]" />
                          <span className="text-[#164b3e]">正在粘贴图片…</span>
                        </>
                      ) : (
                        "支持 Ctrl+V 粘贴截图 · 自动保存"
                      )}
                    </span>
                  </div>

                  {/* 当前光标位于图文组件块内时展示直观操作条，弱化 ::: 语法门槛 */}
                  {(drawerTargetInfo.activeSnapshot || activeMdPresetMeta) && (
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-emerald-200/70 bg-emerald-50/80 px-3.5 py-1.5 text-xs text-emerald-950">
                      <span className="truncate">
                        当前选中样式块：
                        <strong className="font-semibold">
                          {drawerTargetInfo.activeSnapshot
                            ? drawerTargetInfo.activeSnapshot.name
                            : activeMdPresetMeta?.name}
                        </strong>
                      </span>
                      <div className="flex items-center gap-1.5">
                        {drawerTargetInfo.activeSnapshot && (
                          <button
                            type="button"
                            onClick={() => editComponent(drawerTargetInfo.activeSnapshot!)}
                            className="inline-flex items-center gap-1 rounded-md bg-[#164b3e] px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-[#123d32]"
                          >
                            <Pencil size={11} />
                            可视化微调样式
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleClearRegionPreset}
                          className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-white px-2 py-0.5 text-[11px] font-medium text-emerald-900 hover:bg-emerald-100"
                        >
                          <Eraser size={11} />
                          还原为纯文字
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <AutoGrowTextarea
                  ref={textareaRef}
                  minHeightPx={560}
                  aria-label="Markdown 正文编辑器"
                  value={state.content}
                  onPaste={(e) => void handleMarkdownPaste(e)}
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
                  className="w-full rounded-b-2xl border-0 bg-white p-5 font-sans text-[15px] leading-[1.85] text-neutral-900 focus:outline-none"
                />
              </>
            )}
          </section>

          {/* 公众号预览区 */}
          <section
            aria-label="公众号实时预览区"
            className={`${
              mobilePane === "preview" ? "flex" : "hidden"
            } flex-col items-center rounded-2xl border border-neutral-200 bg-[#ebe9e2]/70 p-3 sm:p-6 lg:col-span-6 lg:flex`}
          >
            <div
              className={`w-full overflow-hidden border border-neutral-300/90 bg-white shadow-xl transition-[max-width] duration-200 ${
                previewDevice === "mobile" ? "max-w-[390px] rounded-[28px]" : "max-w-[677px] rounded-xl"
              }`}
            >
              <div className="flex items-center justify-between border-b border-neutral-100 bg-neutral-50 px-5 py-3 text-xs text-neutral-500">
                <span className="font-medium text-neutral-900">
                  公众号实时预览（点击任意段落可定位编辑）
                </span>
                <span className="truncate pl-2">
                  {activeLibraryTplMeta?.name ?? activeSub.name}
                </span>
              </div>
              <div
                onClick={handlePreviewClick}
                className="min-h-[560px] cursor-pointer"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>
          </section>
        </div>
      </main>

      {statusMessage && (
        <div
          role="status"
          aria-live="polite"
          className="animate-toast-up pointer-events-none fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-neutral-950/92 px-4 py-2 text-xs font-medium text-white shadow-lg backdrop-blur-xs"
        >
          <Check size={13} className="text-emerald-400" aria-hidden="true" />
          <span>{statusMessage}</span>
        </div>
      )}

      {componentEdit && (
        <dialog
          ref={openComponentDialog}
          aria-labelledby="typography-component-edit-title"
          onCancel={() => setComponentEdit(null)}
          className="max-h-[92dvh] w-[calc(100%_-_1rem)] max-w-6xl overflow-y-auto rounded-2xl bg-white text-neutral-950 shadow-xl backdrop:bg-neutral-950/50"
        >
          <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 bg-white px-4 py-3">
            <h2 id="typography-component-edit-title" className="text-sm font-semibold">
              编辑稿件组件 · {componentEdit.snapshot.name}
            </h2>
            <div className="flex gap-2">
              <button type="button" onClick={() => setComponentEdit(null)} className="rounded-lg border border-neutral-200 px-3 py-2 text-xs">
                取消
              </button>
              <button type="button" onClick={saveComponentEdit} className="rounded-lg bg-neutral-950 px-3 py-2 text-xs font-medium text-white">
                保存到稿件
              </button>
            </div>
          </div>
          <div className="p-4">
            <ComponentTreeEditor
              rootNode={componentEdit.snapshot.rootNode}
              baseStyle={activeStyle}
              authenticated={authenticated}
              scopeType="personal"
              projectId={componentEdit.projectId}
              onChangeRoot={(rootNode) => setComponentEdit((current) => current
                ? { ...current, snapshot: { ...current.snapshot, rootNode } }
                : null)}
            />
          </div>
        </dialog>
      )}

      <ImportLibraryDialog
        open={importModalState.open}
        mode={importModalState.mode}
        initialKind={importModalState.kind}
        editingItem={importModalState.editingItem}
        authenticated={authenticated}
        teams={teams}
        activeBaseStyle={activeStyle}
        resumeDraft={importModalState.resumeDraft}
        onClose={() =>
          setImportModalState((prev) => ({ ...prev, open: false, editingItem: null, resumeDraft: null }))
        }
        onSaved={(savedItem) => {
          void refreshLibraries();
          flashStatus(`已保存「${savedItem.name}」（v${savedItem.version}）`);
        }}
        onApplyLocalAnonymous={(payload) => {
          if (payload.kind === "template") {
            commitState((prev) => ({
              ...prev,
              activeLibraryTemplate: {
                itemId: null,
                name: payload.name,
                version: 1,
                style: payload.templateStyle,
                sampleMarkdown: payload.sampleMarkdown || activeSub.sampleMarkdown,
              },
            }));
          }
          const localSnap: AppliedComponentSnapshot = {
            snapshotId: `local-${Math.random().toString(36).slice(2, 9)}`,
            sourceItemId: null,
            sourceScopeType: "local",
            sourceVersion: 1,
            name: payload.name,
            category: payload.category,
            rootNode: cloneComponentNode(payload.rootNode, false),
            appliedAt: new Date().toISOString(),
          };
          applyMaterializedSnapshotToEditor(localSnap, "insert-below");
        }}
      />

      <TeamManagerDialog
        open={teamDialogOpen}
        onClose={() => setTeamDialogOpen(false)}
        onChanged={() => void refreshLibraries()}
      />

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
        imageCount={pendingPublicImageCount}
        publishing={publishingImages}
        error={publishError}
        onConfirm={() => void executeCopyWithPublicImages()}
        onClose={() => {
          if (!publishingImages) setPublishDialogOpen(false);
        }}
      />
    </div>
  );
}
