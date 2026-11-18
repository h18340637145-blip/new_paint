"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
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
  Table2,
  Upload,
} from "lucide-react";
import { StylePanel } from "@/components/typography/style-panel";
import { ThemePicker } from "@/components/typography/theme-picker";
import {
  cloneStyleConfig,
  countArticleStats,
  createDefaultPersistedState,
  getSubTemplate,
  getSubTemplatesForTheme,
  migratePersistedState,
  renderWechatHtml,
  TYPOGRAPHY_STORAGE_KEY,
  TYPOGRAPHY_SUBTEMPLATES,
} from "@/lib/typography/templates";
import type {
  ColorPalette,
  TemplateStyleConfig,
  ThemeId,
  TypographyPersistedState,
  TypographySubTemplate,
} from "@/lib/typography/types";

export function TypographyWorkbench() {
  const [state, setState] = useState<TypographyPersistedState>(() => createDefaultPersistedState());
  const [selectedThemeId, setSelectedThemeId] = useState<ThemeId>(TYPOGRAPHY_SUBTEMPLATES[0].themeId);
  const [showStylePanel, setShowStylePanel] = useState(true);
  const [previewDevice, setPreviewDevice] = useState<"mobile" | "desktop">("mobile");
  const [confirmLoadSample, setConfirmLoadSample] = useState(false);
  const [copied, setCopied] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [copyError, setCopyError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const raw = window.localStorage.getItem(TYPOGRAPHY_STORAGE_KEY);
    if (!raw) return;
    const migrated = migratePersistedState(raw);
    setState(migrated);
    setSelectedThemeId(getSubTemplate(migrated.activeSubTemplateId).themeId);
  }, []);

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

  function flashStatus(msg: string) {
    setStatusMessage(msg);
    window.setTimeout(() => {
      setStatusMessage((curr) => (curr === msg ? "" : curr));
    }, 2400);
  }

  const activeSub = getSubTemplate(state.activeSubTemplateId);
  const activeStyle = state.styleOverrides[activeSub.id] ?? activeSub.defaultStyle;

  function handleSelectTheme(themeId: ThemeId) {
    setSelectedThemeId(themeId);
    const firstSub = getSubTemplatesForTheme(themeId)[0];
    if (firstSub && firstSub.id !== state.activeSubTemplateId) {
      commitState((prev) => ({ ...prev, activeSubTemplateId: firstSub.id }));
      setConfirmLoadSample(false);
    }
  }

  function handleSelectSubTemplate(sub: TypographySubTemplate) {
    setSelectedThemeId(sub.themeId);
    commitState((prev) => ({ ...prev, activeSubTemplateId: sub.id }));
    setConfirmLoadSample(false);
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

  function updateActiveStyle(updater: (prev: TemplateStyleConfig) => TemplateStyleConfig) {
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

  function handleResetTemplateDefault() {
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
    const isUneditedSample = !state.hasEditedContent || trimmed.length === 0 || state.content === activeSub.sampleMarkdown;
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
    });
  }

  function exportMarkdown() {
    const blob = new Blob([state.content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${activeSub.name}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importMarkdown(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const text = await file.text();
    handleContentChange(text);
    flashStatus(`已导入 ${file.name}`);
  }

  const previewHtml = useMemo(
    () => renderWechatHtml(state.content, activeStyle),
    [state.content, activeStyle],
  );
  const stats = useMemo(() => countArticleStats(state.content), [state.content]);

  async function copyForWechat() {
    setCopyError("");
    try {
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        const item = new ClipboardItem({
          "text/html": new Blob([previewHtml], { type: "text/html" }),
          "text/plain": new Blob([state.content], { type: "text/plain" }),
        });
        await navigator.clipboard.write([item]);
      } else {
        await navigator.clipboard.writeText(previewHtml);
      }
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

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50 text-neutral-950">
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <div className="flex flex-wrap items-center gap-2.5">
            <Link href="/" className="text-sm font-medium text-neutral-600 hover:text-neutral-950 hover:underline">
              ← 首页
            </Link>
            <span className="text-neutral-300" aria-hidden="true">/</span>
            <Link href="/protected" className="text-sm font-medium text-neutral-600 hover:text-neutral-950 hover:underline">
              工作台
            </Link>
            <span className="text-neutral-300" aria-hidden="true">/</span>
            <h1 className="text-base font-semibold text-neutral-950">公众号排版</h1>
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
              onClick={() => void copyForWechat()}
              className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-neutral-950 px-3.5 py-1 text-xs font-medium text-white shadow-sm transition hover:bg-neutral-800"
            >
              {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
              {copied ? "已复制富文本" : "一键复制到公众号"}
            </button>
          </div>
        </div>
      </header>

      {confirmLoadSample && (
        <div
          role="alertdialog"
          aria-labelledby="confirm-sample-title"
          className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-950 sm:px-6"
        >
          <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-2">
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
          <div className="mx-auto max-w-[1600px] space-y-3 px-4 py-3.5 sm:px-6">
            <ThemePicker
              activeThemeId={selectedThemeId}
              activeSubTemplateId={activeSub.id}
              styleOverrides={state.styleOverrides}
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

      <main className="mx-auto grid w-full max-w-[1600px] flex-1 gap-4 p-4 sm:p-5 lg:grid-cols-12">
        {/* 左侧：Markdown 工具栏 + 编辑器 */}
        <section aria-label="左侧 Markdown 编辑区" className="flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm lg:col-span-6">
          <div className="flex flex-wrap items-center gap-1 border-b border-neutral-100 bg-neutral-50/70 px-3 py-2">
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
            <span className="ml-auto text-[11px] text-neutral-400">切换模板仅改样式，草稿自动保存</span>
          </div>

          <textarea
            ref={textareaRef}
            aria-label="Markdown 正文编辑器"
            value={state.content}
            onChange={(e) => handleContentChange(e.target.value)}
            className="min-h-[540px] w-full flex-1 resize-none border-0 bg-white p-4 font-mono text-sm leading-relaxed text-neutral-900 focus:outline-none"
          />
        </section>

        {/* 右侧：微信公众号实时预览 */}
        <section aria-label="右侧公众号预览区" className="flex flex-col items-center overflow-auto rounded-2xl border border-neutral-200 bg-neutral-100/80 p-4 sm:p-6 lg:col-span-6">
          <div
            className={`w-full overflow-hidden border border-neutral-300 bg-white shadow-xl transition-[max-width] duration-200 ${
              previewDevice === "mobile" ? "max-w-[390px] rounded-[28px]" : "max-w-[677px] rounded-xl"
            }`}
          >
            <div className="flex items-center justify-between border-b border-neutral-100 bg-neutral-50 px-5 py-3 text-xs text-neutral-500">
              <span className="font-medium text-neutral-900">创作工作台 · 公众号预览</span>
              <span>{activeSub.name}</span>
            </div>
            <div className="min-h-[540px]" dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </div>
        </section>
      </main>
    </div>
  );
}
