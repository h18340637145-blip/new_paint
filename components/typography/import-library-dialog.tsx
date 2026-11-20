"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardPaste,
  Download,
  FileCode2,
  FileJson,
  LogIn,
  RefreshCw,
  Save,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";
import { ComponentTreeEditor } from "./component-tree-editor";
import {
  collectPendingExternalImages,
  createBlankComponentByCategory,
  LIBRARY_CATEGORY_LABELS,
  type ComponentNode,
  type ImportIgnoredEntry,
  type LibraryAssetCategory,
  type LibraryItemKind,
  type LibraryItemRecord,
  type LibraryScopeType,
  type ParsedImportResult,
  type PortableEmbeddedMedia,
  type TeamMemberRole,
} from "@/lib/typography/templates";
import type { TemplateStyleConfig } from "@/lib/typography/types";

export const PENDING_ANON_IMPORT_KEY = "new_paint_pending_library_import_v1";

export interface EditableTeamOption {
  id: string;
  name: string;
  myRole: TeamMemberRole;
}

export interface ImportLibraryDialogProps {
  open: boolean;
  mode: "import" | "edit";
  initialKind: LibraryItemKind;
  editingItem?: LibraryItemRecord | null;
  authenticated: boolean;
  teams: EditableTeamOption[];
  activeBaseStyle: TemplateStyleConfig;
  resumeDraft?: {
    kind: LibraryItemKind;
    category: LibraryAssetCategory;
    name: string;
    summary: string;
    rootNode: ComponentNode;
    templateStyle: TemplateStyleConfig;
    sampleMarkdown: string;
  } | null;
  onClose: () => void;
  onSaved: (item: LibraryItemRecord) => void;
  onApplyLocalAnonymous?: (payload: {
    kind: LibraryItemKind;
    category: LibraryAssetCategory;
    name: string;
    rootNode: ComponentNode;
    templateStyle: TemplateStyleConfig;
    sampleMarkdown: string;
  }) => void;
}

export function ImportLibraryDialog({
  open,
  mode,
  initialKind,
  editingItem,
  authenticated,
  teams,
  activeBaseStyle,
  resumeDraft,
  onClose,
  onSaved,
  onApplyLocalAnonymous,
}: ImportLibraryDialogProps) {
  const writableTeams = useMemo(
    () => teams.filter((t) => t.myRole === "owner" || t.myRole === "editor"),
    [teams],
  );

  const [step, setStep] = useState<"input" | "editor">(mode === "edit" || Boolean(resumeDraft) ? "editor" : "input");
  const [rawInput, setRawInput] = useState("");
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState("");
  const [conflictItemId, setConflictItemId] = useState<string | null>(null);

  const [kind, setKind] = useState<LibraryItemKind>(initialKind);
  const [category, setCategory] = useState<LibraryAssetCategory>(
    initialKind === "template" ? "template" : "card",
  );
  const [scopeType, setScopeType] = useState<LibraryScopeType>("personal");
  const [selectedTeamId, setSelectedTeamId] = useState<string>(writableTeams[0]?.id ?? "");
  const [name, setName] = useState("");
  const [summary, setSummary] = useState("");
  const [rootNode, setRootNode] = useState<ComponentNode>(() =>
    createBlankComponentByCategory(initialKind === "template" ? "template" : "card"),
  );
  const [templateStyle, setTemplateStyle] = useState<TemplateStyleConfig>(activeBaseStyle);
  const [sampleMarkdown, setSampleMarkdown] = useState("");
  const [includeSampleContent, setIncludeSampleContent] = useState(true);
  const [expectedVersion, setExpectedVersion] = useState(1);
  const [ignoredItems, setIgnoredItems] = useState<ImportIgnoredEntry[]>([]);
  const [portableMedia, setPortableMedia] = useState<PortableEmbeddedMedia[]>([]);
  const [saving, setSaving] = useState(false);
  const [plainOnlyNotice, setPlainOnlyNotice] = useState("");
  const [localizingMedia, setLocalizingMedia] = useState(false);
  const [localizeMessage, setLocalizeMessage] = useState("");

  const htmlFileRef = useRef<HTMLInputElement>(null);
  const jsonFileRef = useRef<HTMLInputElement>(null);
  const windowPasteHandlerRef = useRef<((dt: DataTransfer) => Promise<void>) | null>(null);

  useEffect(() => {
    if (!open) return;
    setError("");
    setConflictItemId(null);
    setPlainOnlyNotice("");
    setLocalizeMessage("");

    if (mode === "edit" && editingItem) {
      setStep("editor");
      setKind(editingItem.kind);
      setCategory(editingItem.category);
      setScopeType(editingItem.scopeType);
      setSelectedTeamId(editingItem.teamId ?? writableTeams[0]?.id ?? "");
      setName(editingItem.name);
      setSummary(editingItem.summary);
      setRootNode(editingItem.rootNode);
      setTemplateStyle(editingItem.templateStyle ?? activeBaseStyle);
      setSampleMarkdown(editingItem.sampleMarkdown ?? "");
      setIncludeSampleContent(Boolean(editingItem.sampleMarkdown));
      setExpectedVersion(editingItem.version);
      setIgnoredItems([]);
      setPortableMedia([]);
      return;
    }

    if (resumeDraft) {
      setStep("editor");
      setKind(resumeDraft.kind);
      setCategory(resumeDraft.category);
      setScopeType("personal");
      setName(resumeDraft.name);
      setSummary(resumeDraft.summary);
      setRootNode(resumeDraft.rootNode);
      setTemplateStyle(resumeDraft.templateStyle);
      setSampleMarkdown(resumeDraft.sampleMarkdown);
      setIncludeSampleContent(Boolean(resumeDraft.sampleMarkdown));
      setIgnoredItems([]);
      setPortableMedia([]);
      return;
    }

    setStep("input");
    setRawInput("");
    setKind(initialKind);
    const defaultCat = initialKind === "template" ? "template" : "card";
    setCategory(defaultCat);
    setScopeType("personal");
    setSelectedTeamId(writableTeams[0]?.id ?? "");
    setName(initialKind === "template" ? "导入公众号模板" : "导入图文素材");
    setSummary("");
    setRootNode(createBlankComponentByCategory(defaultCat));
    setTemplateStyle(activeBaseStyle);
    setSampleMarkdown("");
    setIncludeSampleContent(true);
    setIgnoredItems([]);
    setPortableMedia([]);
  }, [open, mode, initialKind, editingItem, resumeDraft, activeBaseStyle, writableTeams]);

  const livePendingImages = useMemo(() => collectPendingExternalImages(rootNode), [rootNode]);

  // 弹窗停留在导入源步骤时，直接按 Ctrl+V / ⌘V 即可捕获系统剪贴板富文本，无需先手动聚焦感应框
  useEffect(() => {
    if (!open || step !== "input") return;
    const onWindowPaste = (e: ClipboardEvent) => {
      if (e.defaultPrevented || !e.clipboardData) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      e.preventDefault();
      void windowPasteHandlerRef.current?.(e.clipboardData);
    };
    window.addEventListener("paste", onWindowPaste);
    return () => window.removeEventListener("paste", onWindowPaste);
  }, [open, step]);

  async function runServerPreviewParse(
    raw: string,
    format: "auto" | "html" | "json",
    fallbackName?: string,
  ) {
    setParsing(true);
    setError("");
    setPlainOnlyNotice("");
    setLocalizeMessage("");
    try {
      const res = await fetch("/api/library/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "preview-import",
          raw,
          format,
          targetKind: initialKind,
          fallbackName,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.parsed) {
        throw new Error(data.error || "解析导入内容失败。");
      }
      const parsed = data.parsed as ParsedImportResult;
      setKind(parsed.kind);
      setCategory(parsed.suggestedCategory);
      setName(parsed.suggestedName);
      setRootNode(parsed.rootNode);
      setTemplateStyle(parsed.templateStyle);
      setSampleMarkdown(parsed.sampleMarkdown);
      setIgnoredItems(parsed.ignoredItems);
      setPortableMedia(parsed.portableMedia);
      setStep("editor");
    } catch (err) {
      setError(err instanceof Error ? err.message : "解析失败，请检查内容格式。");
    } finally {
      setParsing(false);
    }
  }

  async function processClipboardDataTransfer(dt: DataTransfer) {
    setError("");
    setPlainOnlyNotice("");

    const html = dt.getData("text/html");
    if (html && /<[a-z][\s\S]*>/i.test(html)) {
      setRawInput(html);
      await runServerPreviewParse(html, "html");
      return;
    }

    // 检查剪贴板中的位图文件（直接截图或复制单张装饰图粘贴）
    const imageFiles = Array.from(dt.files).filter((f) =>
      /^image\/(png|jpeg|webp)$/i.test(f.type),
    );
    if (imageFiles.length > 0) {
      const dataUrls = await Promise.all(
        imageFiles.slice(0, 4).map(
          (file) =>
            new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result ?? ""));
              reader.onerror = () => reject(new Error("读取粘贴图片失败。"));
              reader.readAsDataURL(file);
            }),
        ),
      );
      const htmlSnippet = dataUrls
        .map((url, idx) => `<section style="padding:8px;"><img src="${url}" alt="粘贴图片${idx + 1}" style="border-radius:10px;" /></section>`)
        .join("");
      setRawInput(htmlSnippet);
      await runServerPreviewParse(htmlSnippet, "html", "粘贴图片素材");
      return;
    }

    const plain = dt.getData("text/plain");
    if (!plain || !plain.trim()) {
      setError("剪贴板中未检测到富文本或图片。若从秀米复制，请在秀米顶部点击「导出 → 继续用复制粘贴」后再粘贴。");
      return;
    }

    setRawInput(plain);
    const trimmed = plain.trim();
    if (trimmed.startsWith("{") || /<[a-z][\s\S]*>/i.test(trimmed)) {
      await runServerPreviewParse(plain, "auto");
      return;
    }

    // 剪贴板中仅有纯文本、没有任何 HTML 标签：给出秀米富文本复制指引，防止误导入丢失格式
    const snippet = trimmed.replace(/\s+/g, " ").slice(0, 28);
    setPlainOnlyNotice(snippet || "纯文本");
  }

  windowPasteHandlerRef.current = processClipboardDataTransfer;

  if (!open) return null;

  async function handleRichPasteZone(e: React.ClipboardEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    await processClipboardDataTransfer(e.clipboardData);
  }

  async function handleReadClipboardButton() {
    setError("");
    setPlainOnlyNotice("");
    if (!navigator.clipboard) {
      setError("当前浏览器环境不支持直接读取剪贴板，请直接按 Ctrl+V / ⌘V 粘贴。");
      return;
    }
    try {
      if (typeof navigator.clipboard.read === "function") {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          if (item.types.includes("text/html")) {
            const blob = await item.getType("text/html");
            const html = await blob.text();
            if (html && /<[a-z][\s\S]*>/i.test(html)) {
              setRawInput(html);
              await runServerPreviewParse(html, "html");
              return;
            }
          }
          const imgType = item.types.find((t) => /^image\/(png|jpeg|webp)$/i.test(t));
          if (imgType) {
            const blob = await item.getType(imgType);
            const dataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result ?? ""));
              reader.onerror = () => reject(new Error("读取剪贴板图片失败。"));
              reader.readAsDataURL(blob);
            });
            const htmlSnippet = `<section style="padding:8px;"><img src="${dataUrl}" alt="剪贴板图片" /></section>`;
            setRawInput(htmlSnippet);
            await runServerPreviewParse(htmlSnippet, "html", "粘贴图片素材");
            return;
          }
        }
      }
      const plain = await navigator.clipboard.readText();
      if (!plain || !plain.trim()) {
        setError("剪贴板为空。请先在秀米顶部点击「导出 → 继续用复制粘贴」，或在公众号文章中复制内容。");
        return;
      }
      setRawInput(plain);
      const trimmed = plain.trim();
      if (trimmed.startsWith("{") || /<[a-z][\s\S]*>/i.test(trimmed)) {
        await runServerPreviewParse(plain, "auto");
        return;
      }
      setPlainOnlyNotice(trimmed.replace(/\s+/g, " ").slice(0, 28) || "纯文本");
    } catch {
      setError("浏览器请求剪贴板权限被拒绝，请直接按键盘 Ctrl+V / ⌘V 粘贴。");
    }
  }

  async function handleLocalizeExternalImages() {
    if (livePendingImages.length === 0 || localizingMedia) return;
    setLocalizingMedia(true);
    setError("");
    setLocalizeMessage("");
    try {
      const res = await fetch("/api/library/localize-media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rootNode,
          scopeType,
          teamId: scopeType === "team" ? selectedTeamId : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.rootNode) {
        throw new Error(data.error || "外链装饰图转存失败。");
      }
      setRootNode(data.rootNode as ComponentNode);
      if (data.localizedCount > 0) {
        setLocalizeMessage(
          data.remainingCount > 0
            ? `已转存 ${data.localizedCount} 张图片，仍有 ${data.remainingCount} 张受防盗链限制需手动上传替换。`
            : `已将全部 ${data.localizedCount} 张外部装饰图片转存为私有素材。`,
        );
      } else {
        setError("未能自动拉取该外链图片（可能受源站防盗链限制），请选中图片节点点击「上传更换图片」。");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "外链图片转存失败。");
    } finally {
      setLocalizingMedia(false);
    }
  }

  async function handleFileUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    expectedFormat: "html" | "json",
  ) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setError("文件体积不能超过 8 MB。");
      return;
    }
    const text = await file.text();
    const baseName = file.name.replace(/\.(html?|json)$/i, "");
    setRawInput(text);
    await runServerPreviewParse(text, expectedFormat, baseName);
  }

  async function handleSaveToCloud(saveAsCopy = false) {
    if (!authenticated) {
      try {
        window.sessionStorage.setItem(
          PENDING_ANON_IMPORT_KEY,
          JSON.stringify({
            kind,
            category: kind === "template" ? "template" : category,
            name: name.trim() || "导入项目",
            summary,
            rootNode,
            templateStyle,
            sampleMarkdown: includeSampleContent ? sampleMarkdown : "",
          }),
        );
      } catch {
        // 忽略存储配额异常
      }
      window.location.href = `/auth/login?next=${encodeURIComponent("/typography?resumeImport=1")}`;
      return;
    }

    if (scopeType === "team" && !selectedTeamId) {
      setError("请先选择一个拥有编辑权限的团队，或改为保存到个人库。");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const isUpdatingExisting = mode === "edit" && editingItem && !saveAsCopy;
      const endpoint = isUpdatingExisting
        ? `/api/library/items/${encodeURIComponent(editingItem.id)}`
        : "/api/library/items";
      const method = isUpdatingExisting ? "PATCH" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(isUpdatingExisting
            ? { expectedVersion }
            : {
                scopeType,
                teamId: scopeType === "team" ? selectedTeamId : null,
                kind,
                portableMedia,
              }),
          localizeExternalImages: true,
          category: kind === "template" ? "template" : category,
          name: saveAsCopy ? `${name.trim() || "未命名"}（副本）` : name.trim() || "未命名条目",
          summary: summary.trim(),
          rootNode,
          templateStyle,
          sampleMarkdown: kind === "template" && includeSampleContent ? sampleMarkdown : null,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && editingItem) {
        setConflictItemId(editingItem.id);
        setError(data.error || "检测到其他成员或页面已更新此条目。");
        return;
      }
      if (!res.ok || !data.item) {
        throw new Error(data.error || "保存失败，请稍后重试。");
      }

      window.sessionStorage.removeItem(PENDING_ANON_IMPORT_KEY);
      onSaved(data.item as LibraryItemRecord);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败。");
    } finally {
      setSaving(false);
    }
  }

  async function handleReloadLatestOnConflict() {
    if (!conflictItemId) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/library/items/${encodeURIComponent(conflictItemId)}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.item) {
        throw new Error(data.error || "加载最新版本失败。");
      }
      const latest = data.item as LibraryItemRecord;
      setName(latest.name);
      setSummary(latest.summary);
      setCategory(latest.category);
      setRootNode(latest.rootNode);
      if (latest.templateStyle) setTemplateStyle(latest.templateStyle);
      setSampleMarkdown(latest.sampleMarkdown ?? "");
      setExpectedVersion(latest.version);
      setConflictItemId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载最新版本失败。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-library-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 sm:p-5"
    >
      <div className="flex max-h-[94dvh] w-full max-w-[1220px] flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50 text-neutral-900 shadow-2xl [color-scheme:light]">
        {/* 弹窗头部 */}
        <div className="flex items-center justify-between gap-3 border-b border-neutral-200 bg-white px-5 py-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="import-library-dialog-title" className="text-base font-semibold text-neutral-950">
              {mode === "edit"
                ? `编辑${editingItem?.kind === "template" ? "模板" : "素材"}：${editingItem?.name ?? ""}`
                : initialKind === "template"
                  ? "导入公众号模板并可视化拆装"
                  : "导入图文素材并可视化拆装"}
            </h2>
            {mode === "import" && step === "editor" && (
              <button
                type="button"
                onClick={() => setStep("input")}
                className="rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
              >
                ← 重新选择导入源
              </button>
            )}
          </div>
          <button
            type="button"
            aria-label="关闭弹窗"
            onClick={onClose}
            className="inline-flex size-9 items-center justify-center rounded-xl text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950"
          >
            <X size={18} />
          </button>
        </div>

        {/* 主体区 */}
        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
          {error && (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800"
            >
              <span>{error}</span>
              {conflictItemId && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleReloadLatestOnConflict()}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-300 bg-white px-2.5 py-1 font-medium text-red-900 hover:bg-red-100"
                  >
                    <RefreshCw size={12} />
                    刷新加载最新
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSaveToCloud(true)}
                    className="inline-flex items-center gap-1 rounded-lg bg-red-800 px-2.5 py-1 font-medium text-white hover:bg-red-900"
                  >
                    复制为新项保存
                  </button>
                </div>
              )}
            </div>
          )}

          {step === "input" ? (
            <div className="space-y-4">
              {plainOnlyNotice && (
                <div
                  role="alert"
                  className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-950"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 font-semibold text-amber-950">
                        <AlertTriangle size={15} className="shrink-0 text-amber-700" />
                        <span>
                          检测到剪贴板中仅有纯文字「{plainOnlyNotice}」，未包含秀米 / 公众号的排版样式代码
                        </span>
                      </div>
                      <ol className="list-decimal space-y-1 pl-5 text-[11px] leading-relaxed text-amber-900">
                        <li>
                          若从<strong>秀米</strong>复制：在秀米画布直接选中组件按 Ctrl+C / ⌘C 只会存入秀米内部剪贴板，不会把样式写入系统剪贴板。请点击秀米顶部工具栏的
                          <strong>「导出 → 继续用复制粘贴」</strong>（或点<strong>「预览」</strong>后框选卡片复制）。
                        </li>
                        <li>
                          复制完成后，回到本弹窗直接按 <strong>⌘V / Ctrl+V</strong>，或点击下方<strong>「一键读取剪贴板富文本」</strong>，即可完整导入底色、边框、枫叶与装饰图形。
                        </li>
                      </ol>
                    </div>
                    <button
                      type="button"
                      onClick={() => void runServerPreviewParse(rawInput, "auto")}
                      className="shrink-0 rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-100"
                    >
                      仍仅按纯文字导入 →
                    </button>
                  </div>
                </div>
              )}

              <div className="grid gap-4 lg:grid-cols-12">
                <input
                  ref={htmlFileRef}
                  type="file"
                  accept=".html,.htm,text/html"
                  onChange={(e) => void handleFileUpload(e, "html")}
                  hidden
                />
                <input
                  ref={jsonFileRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={(e) => void handleFileUpload(e, "json")}
                  hidden
                />

                {/* 方式一：直接粘贴公众号/秀米富文本 */}
                <div className="flex flex-col justify-between rounded-2xl border border-neutral-200 bg-white p-5 lg:col-span-5">
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                        <ClipboardPaste size={13} />
                        方式一 · 粘贴公众号或秀米富文本
                      </div>
                      <button
                        type="button"
                        disabled={parsing}
                        onClick={() => void handleReadClipboardButton()}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-800 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-900 disabled:opacity-50"
                      >
                        <ClipboardPaste size={12} />
                        一键读取剪贴板富文本
                      </button>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-neutral-600">
                      在公众号文章中框选复制，或在秀米顶部点击<strong>「导出 → 继续用复制粘贴」</strong>后，直接在本窗口按{" "}
                      <kbd className="rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-mono text-[11px]">
                        ⌘V / Ctrl+V
                      </kbd>{" "}
                      即可把底色、边框、渐变与装饰图标一起导入。
                    </p>

                    <div
                      tabIndex={0}
                      contentEditable
                      suppressContentEditableWarning
                      role="textbox"
                      aria-label="富文本粘贴感应区"
                      onBeforeInput={(e) => e.preventDefault()}
                      onPaste={(e) => void handleRichPasteZone(e)}
                      className="mt-4 flex min-h-[156px] cursor-text flex-col items-center justify-center rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-50/70 p-4 text-center text-xs text-neutral-600 caret-transparent transition hover:border-emerald-700/60 focus:border-emerald-800 focus:bg-emerald-50/30 focus:outline-none"
                    >
                      <ClipboardPaste size={24} className="mb-2 text-neutral-400" />
                      <span className="font-semibold text-neutral-900">
                        直接按 Ctrl+V / ⌘V 或右键「粘贴」富文本与图片
                      </span>
                      <span className="mt-1 text-[11px] text-neutral-500">
                        自动识别剪贴板 HTML 排版结构、边框、颜色、SVG 与装饰图片
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2.5 border-t border-neutral-100 pt-4">
                    <button
                      type="button"
                      onClick={() => htmlFileRef.current?.click()}
                      className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-100"
                    >
                      <FileCode2 size={15} />
                      上传 .html 文件
                    </button>
                    <button
                      type="button"
                      onClick={() => jsonFileRef.current?.click()}
                      className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-100"
                    >
                      <FileJson size={15} />
                      导入项目 .json
                    </button>
                  </div>
                </div>

                {/* 方式二：粘贴原始 HTML 代码或从空白新建 */}
                <div className="flex flex-col justify-between rounded-2xl border border-neutral-200 bg-white p-5 lg:col-span-7">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-neutral-900">
                        或粘贴 HTML 源码 / 项目导出 JSON（在此处直接粘贴富文本同样保留样式）
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setStep("editor");
                        }}
                        className="text-xs font-medium text-emerald-800 underline hover:text-emerald-950"
                      >
                        跳过导入，从空白组件开始搭建 →
                      </button>
                    </div>
                    <textarea
                      rows={8}
                      aria-label="HTML 或 JSON 源码输入框"
                      placeholder="在此粘贴秀米/公众号富文本、<section style=&quot;...&quot;>...</section> 源码或导出的 JSON 内容…"
                      value={rawInput}
                      onPaste={(e) => {
                        const html = e.clipboardData.getData("text/html");
                        const plain = e.clipboardData.getData("text/plain");
                        // 若剪贴板携带富文本 HTML（而纯文本只是文字而非 HTML/JSON 源码），优先拦截并提取 HTML，防止 textarea 丢弃全部排版样式
                        if (
                          html
                          && /<[a-z][\s\S]*>/i.test(html)
                          && !plain.trim().startsWith("<")
                          && !plain.trim().startsWith("{")
                        ) {
                          e.preventDefault();
                          e.stopPropagation();
                          setPlainOnlyNotice("");
                          setRawInput(html);
                          void runServerPreviewParse(html, "html");
                        }
                      }}
                      onChange={(e) => {
                        setRawInput(e.target.value);
                        if (plainOnlyNotice) setPlainOnlyNotice("");
                      }}
                      className="mt-2.5 w-full rounded-xl border border-neutral-200 bg-neutral-50/50 p-3 font-mono text-xs leading-relaxed text-neutral-900 focus:border-neutral-400 focus:bg-white focus:outline-none"
                    />
                  </div>

                  <div className="mt-3 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      disabled={parsing || !rawInput.trim()}
                      onClick={() => {
                        const trimmed = rawInput.trim();
                        if (!trimmed.startsWith("{") && !/<[a-z][\s\S]*>/i.test(trimmed) && !plainOnlyNotice) {
                          setPlainOnlyNotice(trimmed.replace(/\s+/g, " ").slice(0, 28) || "纯文本");
                          return;
                        }
                        void runServerPreviewParse(rawInput, "auto");
                      }}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-neutral-950 px-4 py-2 text-xs font-semibold text-white hover:bg-neutral-800 disabled:opacity-40"
                    >
                      <Sparkles size={14} />
                      {parsing ? "安全校验与解析中…" : "解析并进入可视化拆装预览"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* 导入安全与待补素材报告栏 */}
              {(ignoredItems.length > 0 || livePendingImages.length > 0) && (
                <div className="grid gap-3 md:grid-cols-2">
                  {ignoredItems.length > 0 && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-3 text-xs text-amber-950">
                      <div className="flex items-center gap-1.5 font-semibold">
                        <ShieldAlert size={14} className="text-amber-700" />
                        <span>安全边界报告：已自动忽略或拦截 {ignoredItems.length} 项非受控内容</span>
                      </div>
                      <ul className="mt-1.5 max-h-24 list-disc space-y-0.5 overflow-y-auto pl-5 text-[11px] text-amber-900">
                        {ignoredItems.map((it, idx) => (
                          <li key={idx}>{it.detail}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {livePendingImages.length > 0 && (
                    <div className="rounded-xl border border-sky-200 bg-sky-50/90 p-3 text-xs text-sky-950">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 font-semibold">
                          <AlertTriangle size={14} className="text-sky-700" />
                          <span>检测到 {livePendingImages.length} 张外部链接装饰/配图</span>
                        </div>
                        <button
                          type="button"
                          disabled={localizingMedia}
                          onClick={() => void handleLocalizeExternalImages()}
                          className="inline-flex items-center gap-1 rounded-lg bg-sky-800 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-sky-900 disabled:opacity-50"
                        >
                          <Download size={12} />
                          {localizingMedia ? "转存中…" : "一键转存为私有素材"}
                        </button>
                      </div>
                      <p className="mt-1 text-[11px] text-sky-900">
                        预览已实时展示原装饰图；保存时会自动尝试转存为私有文件，也可点右侧按钮立即转存或手动「上传更换图片」。
                      </p>
                    </div>
                  )}
                </div>
              )}

              {localizeMessage && (
                <div className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50/90 px-3.5 py-2 text-xs text-emerald-900">
                  <CheckCircle2 size={14} className="text-emerald-700" />
                  <span>{localizeMessage}</span>
                </div>
              )}

              {ignoredItems.length === 0 && livePendingImages.length === 0 && mode === "import" && (
                <div className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50/80 px-3.5 py-2 text-xs text-emerald-900">
                  <CheckCircle2 size={14} className="text-emerald-700" />
                  <span>结构通过服务端白名单安全校验，未发现脚本、危险属性或待补外链图片。</span>
                </div>
              )}

              {/* 元信息设置栏：名称、分类、保存位置（个人库 / 团队库） */}
              <div className="grid gap-3 rounded-xl border border-neutral-200 bg-white p-3.5 text-xs sm:grid-cols-2 lg:grid-cols-12">
                <label className="space-y-1 lg:col-span-3">
                  <span className="font-medium text-neutral-700">名称</span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="输入模板或素材名称"
                    className="w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-neutral-900 focus:border-neutral-400 focus:outline-none"
                  />
                </label>

                <label className="space-y-1 lg:col-span-2">
                  <span className="font-medium text-neutral-700">类型与分类</span>
                  <select
                    value={kind === "template" ? "template" : category}
                    disabled={mode === "edit" && editingItem?.kind === "template"}
                    onChange={(e) => {
                      const val = e.target.value as LibraryAssetCategory;
                      if (val === "template") {
                        setKind("template");
                        setCategory("template");
                      } else {
                        setKind("asset");
                        setCategory(val);
                      }
                    }}
                    className="w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-neutral-900"
                  >
                    <option value="template">{LIBRARY_CATEGORY_LABELS.template}</option>
                    <option value="heading-border">{LIBRARY_CATEGORY_LABELS["heading-border"]}</option>
                    <option value="card">{LIBRARY_CATEGORY_LABELS.card}</option>
                    <option value="image-border">{LIBRARY_CATEGORY_LABELS["image-border"]}</option>
                    <option value="divider">{LIBRARY_CATEGORY_LABELS.divider}</option>
                  </select>
                </label>

                <label className="space-y-1 lg:col-span-3">
                  <span className="font-medium text-neutral-700">保存位置</span>
                  <select
                    disabled={mode === "edit"}
                    value={scopeType === "personal" ? "personal" : `team:${selectedTeamId}`}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "personal") {
                        setScopeType("personal");
                      } else if (val.startsWith("team:")) {
                        setScopeType("team");
                        setSelectedTeamId(val.slice(5));
                      }
                    }}
                    className="w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-neutral-900 disabled:bg-neutral-50"
                  >
                    <option value="personal">个人库（仅自己可见）</option>
                    {writableTeams.map((t) => (
                      <option key={t.id} value={`team:${t.id}`}>
                        团队库 · {t.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1 lg:col-span-4">
                  <span className="font-medium text-neutral-700">用途备注（可选）</span>
                  <input
                    type="text"
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="例如：深度长文章节导语卡 / 封面图边框"
                    className="w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-neutral-900 focus:border-neutral-400 focus:outline-none"
                  />
                </label>

                {kind === "template" && (
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-2.5 lg:col-span-12">
                    <label className="inline-flex items-center gap-2 text-neutral-700">
                      <input
                        type="checkbox"
                        checked={includeSampleContent}
                        onChange={(e) => setIncludeSampleContent(e.target.checked)}
                      />
                      <span>同时保存提取的模板示例内容（应用模板时默认仅改样式，可手动显式加载示例）</span>
                    </label>
                    <div className="flex items-center gap-3 text-[11px] text-neutral-500">
                      <span>主色：{templateStyle.colors.primaryColor}</span>
                      <span>字号：{templateStyle.paragraph.fontSize}px</span>
                      <span>标题风格：{templateStyle.heading.style}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* 与层级编辑完全共用同一套受控组件树控件 */}
              <ComponentTreeEditor
                rootNode={rootNode}
                baseStyle={templateStyle}
                authenticated={authenticated}
                scopeType={scopeType}
                teamId={scopeType === "team" ? selectedTeamId : null}
                onChangeRoot={setRootNode}
              />
            </>
          )}
        </div>

        {/* 底部操作栏 */}
        {step === "editor" && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 bg-white px-5 py-3">
            <div className="text-xs text-neutral-500">
              {authenticated
                ? mode === "edit"
                  ? `当前版本 v${expectedVersion} · 保存时自动校验并发版本`
                  : "保存后可在个人库或团队库随时复用、复制与导出版本化 JSON"
                : "当前未登录：您可以先在本地预览应用，或登录后保存到私有云端库"}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="min-h-10 rounded-xl border border-neutral-200 bg-white px-3.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
              >
                取消
              </button>

              {!authenticated && onApplyLocalAnonymous && (
                <button
                  type="button"
                  onClick={() => {
                    onApplyLocalAnonymous({
                      kind,
                      category: kind === "template" ? "template" : category,
                      name: name.trim() || "本地预览导入项",
                      rootNode,
                      templateStyle,
                      sampleMarkdown: includeSampleContent ? sampleMarkdown : "",
                    });
                    onClose();
                  }}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-neutral-900 bg-white px-4 py-1.5 text-xs font-semibold text-neutral-950 hover:bg-neutral-100"
                >
                  先应用到当前页面预览
                </button>
              )}

              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSaveToCloud(false)}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-neutral-950 px-4 py-1.5 text-xs font-semibold text-white hover:bg-neutral-800 disabled:opacity-50"
              >
                {authenticated ? <Save size={14} /> : <LogIn size={14} />}
                {saving
                  ? "保存中…"
                  : authenticated
                    ? mode === "edit"
                      ? "保存更改"
                      : scopeType === "team"
                        ? "保存到团队库"
                        : "保存到个人库"
                    : "登录后保存到云端"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
