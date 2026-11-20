"use client";

import { useMemo, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  ChevronLeft,
  ChevronRight,
  Columns2,
  Copy,
  CreditCard,
  Download,
  Eraser,
  FolderHeart,
  Image as ImageIcon,
  Layers,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Type,
  Upload,
  Users,
  Wand2,
  X,
} from "lucide-react";
import {
  escapeHtml,
  getXiumiPreset,
  LIBRARY_CATEGORY_LABELS,
  renderComponentTreeHtml,
  renderXiumiPresetHtml,
  safeUrl,
  sanitizeStyle,
  XIUMI_CATEGORIES,
  XIUMI_PRESETS,
  type ComponentImageRef,
  type LibraryAssetCategory,
  type LibraryItemRecord,
  type XiumiCategory,
  type XiumiPreset,
} from "@/lib/typography/templates";
import type { TemplateStyleConfig } from "@/lib/typography/types";

const CATEGORY_ICONS: Record<XiumiCategory, typeof Type> = {
  heading: Type,
  card: CreditCard,
  image: ImageIcon,
  layout: Columns2,
  svg: Wand2,
  widget: Layers,
};

export interface XiumiDrawerProps {
  style: TemplateStyleConfig;
  targetLabel: string;
  activePresetId?: string;
  activeCustomSnapshot?: {
    name: string;
    sourceItemId: string | null;
    sourceVersion: number;
  } | null;
  latestItemVersions?: Record<string, number>;
  personalAssets?: LibraryItemRecord[];
  teamAssets?: LibraryItemRecord[];
  showArchived?: boolean;
  onToggleShowArchived?: () => void;
  onApplyToRegion: (preset: XiumiPreset) => void;
  onInsertBlock: (preset: XiumiPreset) => void;
  onApplyLibraryAsset?: (item: LibraryItemRecord, mode: "apply-region" | "insert-below") => void;
  onReapplyUpdatedSnapshot?: () => void;
  onEditAppliedComponent?: () => void;
  onOpenImportAsset?: () => void;
  onEditLibraryItem?: (item: LibraryItemRecord) => void;
  onDuplicateLibraryItem?: (item: LibraryItemRecord) => void;
  onToggleArchiveItem?: (item: LibraryItemRecord) => void;
  onOpenTeamManager?: () => void;
  onClearRegionPreset?: () => void;
}

export function XiumiDrawer({
  style,
  targetLabel,
  activePresetId,
  activeCustomSnapshot,
  latestItemVersions = {},
  personalAssets = [],
  teamAssets = [],
  showArchived = false,
  onToggleShowArchived,
  onApplyToRegion,
  onInsertBlock,
  onApplyLibraryAsset,
  onReapplyUpdatedSnapshot,
  onEditAppliedComponent,
  onOpenImportAsset,
  onEditLibraryItem,
  onDuplicateLibraryItem,
  onToggleArchiveItem,
  onOpenTeamManager,
  onClearRegionPreset,
}: XiumiDrawerProps) {
  const [open, setOpen] = useState(true);
  const [libraryTab, setLibraryTab] = useState<"builtin" | "personal" | "team">("builtin");
  const [activeCategory, setActiveCategory] = useState<XiumiCategory>("heading");
  const [customFilterCat, setCustomFilterCat] = useState<"all" | Exclude<LibraryAssetCategory, "template">>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const cleanStyle = useMemo(() => sanitizeStyle(style), [style]);
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const presets = useMemo(() => {
    const base = normalizedQuery
      ? XIUMI_PRESETS.filter(
          (p) =>
            p.name.toLowerCase().includes(normalizedQuery)
            || p.summary.toLowerCase().includes(normalizedQuery),
        )
      : XIUMI_PRESETS.filter((p) => p.category === activeCategory);
    return base;
  }, [activeCategory, normalizedQuery]);

  const currentPreset = getXiumiPreset(activePresetId);

  const displayedCustomAssets = useMemo(() => {
    const raw = libraryTab === "personal" ? personalAssets : teamAssets;
    const catFiltered = customFilterCat === "all" ? raw : raw.filter((item) => item.category === customFilterCat);
    if (!normalizedQuery) return catFiltered;
    return catFiltered.filter(
      (item) =>
        item.name.toLowerCase().includes(normalizedQuery)
        || item.summary.toLowerCase().includes(normalizedQuery),
    );
  }, [libraryTab, personalAssets, teamAssets, customFilterCat, normalizedQuery]);

  const latestSourceVersion =
    activeCustomSnapshot?.sourceItemId
      ? latestItemVersions[activeCustomSnapshot.sourceItemId]
      : undefined;
  const hasNewerLibraryVersion =
    latestSourceVersion !== undefined
    && activeCustomSnapshot !== null
    && activeCustomSnapshot !== undefined
    && latestSourceVersion > activeCustomSnapshot.sourceVersion;

  function handleCategoryClick(cat: XiumiCategory) {
    setLibraryTab("builtin");
    if (open && libraryTab === "builtin" && activeCategory === cat) {
      setOpen(false);
      return;
    }
    setActiveCategory(cat);
    setOpen(true);
  }

  return (
    <aside
      aria-label="素材库与图文组件抽屉栏"
      className="w-full shrink-0 lg:sticky lg:top-[68px] lg:w-auto lg:self-start"
    >
      <div className="flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm lg:flex-row">
        {/* 左侧分类窄轨（个人库 / 团队库 / 系统六类组件） */}
        <div
          role="tablist"
          aria-label="素材库与组件分类"
          className="flex items-center gap-1 overflow-x-auto border-b border-neutral-100 bg-neutral-50/90 p-1.5 lg:w-[64px] lg:flex-col lg:border-r lg:border-b-0 lg:py-2.5"
        >
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? "收起素材库抽屉" : "展开素材库抽屉"}
            title={open ? "收起素材抽屉" : "展开素材抽屉"}
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-neutral-500 transition hover:bg-white hover:text-neutral-950 lg:mb-1"
          >
            {open ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={open && libraryTab === "personal"}
            onClick={() => {
              setLibraryTab("personal");
              setOpen(true);
            }}
            className={`flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium transition lg:w-full lg:flex-col lg:justify-center lg:gap-1 lg:px-1 lg:py-2 ${
              open && libraryTab === "personal"
                ? "bg-emerald-900 text-white shadow-sm"
                : "text-neutral-700 hover:bg-white hover:text-neutral-950"
            }`}
          >
            <FolderHeart size={15} aria-hidden="true" />
            <span className="text-[11px] leading-none">个人库</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={open && libraryTab === "team"}
            onClick={() => {
              setLibraryTab("team");
              setOpen(true);
            }}
            className={`flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium transition lg:w-full lg:flex-col lg:justify-center lg:gap-1 lg:px-1 lg:py-2 ${
              open && libraryTab === "team"
                ? "bg-emerald-900 text-white shadow-sm"
                : "text-neutral-700 hover:bg-white hover:text-neutral-950"
            }`}
          >
            <Users size={15} aria-hidden="true" />
            <span className="text-[11px] leading-none">团队库</span>
          </button>

          <div className="hidden h-px w-8 bg-neutral-200 lg:my-1 lg:block" aria-hidden="true" />

          {XIUMI_CATEGORIES.map((cat) => {
            const Icon = CATEGORY_ICONS[cat.id];
            const isSelected = open && libraryTab === "builtin" && activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => handleCategoryClick(cat.id)}
                className={`flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium transition lg:w-full lg:flex-col lg:justify-center lg:gap-1 lg:px-1 lg:py-2 ${
                  isSelected
                    ? "bg-neutral-950 text-white shadow-sm"
                    : "text-neutral-600 hover:bg-white hover:text-neutral-950"
                }`}
              >
                <Icon size={15} aria-hidden="true" />
                <span className="text-[11px] leading-none">{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* 展开的组件与素材面板 */}
        {open && (
          <div className="flex w-full flex-col bg-white lg:w-[284px] lg:max-h-[calc(100dvh-88px)]">
            <div className="border-b border-neutral-100 px-3.5 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-neutral-900">
                  {libraryTab === "personal"
                    ? `个人素材库 (${personalAssets.length})`
                    : libraryTab === "team"
                      ? `团队素材库 (${teamAssets.length})`
                      : `${XIUMI_CATEGORIES.find((c) => c.id === activeCategory)?.label}预置`}
                </span>
                {onOpenImportAsset && (
                  <button
                    type="button"
                    onClick={onOpenImportAsset}
                    className="inline-flex min-h-7 items-center gap-1 rounded-lg bg-emerald-900 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-950"
                  >
                    <Upload size={11} />
                    导入素材
                  </button>
                )}
              </div>

              <div className="mt-2 relative flex items-center">
                <Search size={13} className="pointer-events-none absolute left-2.5 text-neutral-400" aria-hidden="true" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={libraryTab === "builtin" ? "搜索标题、卡片、分割线…" : "搜索素材名称或备注…"}
                  aria-label="搜索排版素材"
                  className="w-full rounded-lg border border-neutral-200 bg-neutral-50/70 py-1.5 pl-7 pr-7 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-[#164b3e] focus:bg-white focus:outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    aria-label="清空搜索词"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 rounded p-0.5 text-neutral-400 hover:text-neutral-700"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              <div className="mt-2 rounded-lg bg-neutral-50 px-2.5 py-1.5 text-[11px] text-neutral-600">
                <div className="truncate">
                  作用于：<strong className="font-medium text-neutral-900">{targetLabel}</strong>
                </div>
                {(currentPreset || activeCustomSnapshot) && onClearRegionPreset && (
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-1 border-t border-neutral-200/70 pt-1">
                    <span className="truncate text-[10px] text-emerald-800">
                      当前：{activeCustomSnapshot ? `${activeCustomSnapshot.name} (v${activeCustomSnapshot.sourceVersion})` : currentPreset?.name}
                    </span>
                    <div className="flex items-center gap-1">
                      {onEditAppliedComponent && (
                        <button type="button" onClick={onEditAppliedComponent} className="rounded px-1.5 py-1 font-medium text-emerald-800 hover:bg-emerald-100">
                          编辑当前组件
                        </button>
                      )}
                      {hasNewerLibraryVersion && onReapplyUpdatedSnapshot && (
                        <button
                          type="button"
                          onClick={onReapplyUpdatedSnapshot}
                          className="inline-flex items-center gap-0.5 rounded bg-emerald-800 px-1.5 py-0.5 text-[10px] font-semibold text-white hover:bg-emerald-900"
                        >
                          <RefreshCw size={9} />
                          升至 v{latestSourceVersion}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={onClearRegionPreset}
                        className="inline-flex shrink-0 items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium text-neutral-600 hover:bg-neutral-200/60 hover:text-neutral-950"
                      >
                        <Eraser size={10} />
                        还原
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {libraryTab !== "builtin" && (
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  {(
                    [
                      { id: "all", label: "全部" },
                      { id: "heading-border", label: "标题边框" },
                      { id: "card", label: "卡片" },
                      { id: "image-border", label: "图片边框" },
                      { id: "divider", label: "分割线" },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setCustomFilterCat(f.id)}
                      className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
                        customFilterCat === f.id
                          ? "bg-neutral-900 text-white"
                          : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                  {onToggleShowArchived && (
                    <button
                      type="button"
                      onClick={onToggleShowArchived}
                      title={showArchived ? "隐藏已归档" : "查看已归档"}
                      className={`ml-auto rounded-md px-1.5 py-0.5 text-[10px] ${
                        showArchived ? "bg-neutral-900 text-white" : "text-neutral-500 hover:bg-neutral-100"
                      }`}
                    >
                      {showArchived ? "含归档" : "归档"}
                    </button>
                  )}
                </div>
              )}
            </div>

            {libraryTab === "builtin" ? (
              <div className="grid gap-2.5 overflow-y-auto p-3 sm:grid-cols-2 lg:grid-cols-1">
                {presets.map((preset) => {
                  const miniHtml =
                    renderXiumiPresetHtml(
                      preset.id,
                      {
                        innerHtml: "",
                        rawText: preset.sampleText,
                        imageSrc: "/images/cover-example.jpg",
                        imageAlt: preset.name,
                        imageCaption: preset.name,
                        badgeIndex: 1,
                      },
                      cleanStyle,
                      escapeHtml,
                      safeUrl,
                    ) ?? "";
                  const isApplied = activePresetId === preset.id;

                  return (
                    <div
                      key={preset.id}
                      className={`group flex flex-col overflow-hidden rounded-xl border transition ${
                        isApplied
                          ? "border-neutral-950 ring-1 ring-neutral-950"
                          : "border-neutral-200 hover:border-neutral-400"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onApplyToRegion(preset)}
                        className="w-full bg-neutral-50/50 p-2.5 text-left transition group-hover:bg-white"
                      >
                        <div className="pointer-events-none flex min-h-14 max-h-28 items-center justify-center overflow-hidden rounded-lg bg-white p-2.5 ring-1 ring-neutral-100">
                          <div
                            className="w-[116%] shrink-0 origin-center scale-[0.86]"
                            dangerouslySetInnerHTML={{ __html: miniHtml }}
                          />
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-1">
                          <span className="text-xs font-semibold text-neutral-900">{preset.name}</span>
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium text-white ${
                            isApplied ? "bg-[#164b3e]" : "bg-neutral-900 opacity-85 group-hover:opacity-100"
                          }`}>
                            {isApplied ? "已应用" : "套用到当前段"}
                          </span>
                        </div>
                        <p className="mt-0.5 line-clamp-1 text-[11px] text-neutral-500">{preset.summary}</p>
                      </button>

                      <div className="flex items-center justify-end border-t border-neutral-100 bg-white px-2.5 py-1">
                        <button
                          type="button"
                          onClick={() => onInsertBlock(preset)}
                          className="inline-flex min-h-7 items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950"
                        >
                          <Plus size={11} />
                          插入到下方
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : displayedCustomAssets.length === 0 ? (
              <div className="space-y-3 p-4 text-center text-xs text-neutral-500">
                <p>
                  {libraryTab === "personal"
                    ? "暂无个人导入素材。可从公众号、秀米复制单个卡片/标题边框/图片边框/分割线粘贴导入。"
                    : "暂无团队共享素材。可加入或创建团队与同事共享统一排版组件。"}
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {onOpenImportAsset && (
                    <button
                      type="button"
                      onClick={onOpenImportAsset}
                      className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-neutral-900 px-3 py-1 font-semibold text-white hover:bg-neutral-800"
                    >
                      <Upload size={12} />
                      导入素材
                    </button>
                  )}
                  {libraryTab === "team" && onOpenTeamManager && (
                    <button
                      type="button"
                      onClick={onOpenTeamManager}
                      className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-neutral-200 bg-white px-3 py-1 font-medium text-neutral-700 hover:bg-neutral-50"
                    >
                      <Users size={12} />
                      管理团队
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid gap-2.5 overflow-y-auto p-3 sm:grid-cols-2 lg:grid-cols-1">
                {displayedCustomAssets.map((item) => {
                  const resolveMiniImg = (ref: ComponentImageRef) => {
                    if (ref.kind === "library-media") return `/api/library/media/${encodeURIComponent(ref.mediaId)}`;
                    if (ref.kind === "inline-data") return escapeHtml(ref.dataUrl);
                    if (ref.kind === "inline-svg") return escapeHtml(ref.svgDataUrl);
                    return "/images/cover-example.jpg";
                  };
                  const miniHtml = renderComponentTreeHtml(
                    item.rootNode,
                    cleanStyle,
                    escapeHtml,
                    resolveMiniImg,
                    { imageSrc: item.category === "image-border" ? "/images/cover-example.jpg" : undefined },
                  );
                  const canWrapTarget =
                    item.category === "heading-border"
                    || item.category === "image-border"
                    || item.category === "card";

                  return (
                    <div
                      key={item.id}
                      className={`group flex flex-col overflow-hidden rounded-xl border transition ${
                        item.archived
                          ? "border-neutral-200 bg-neutral-50 opacity-75"
                          : "border-neutral-200 bg-white hover:border-neutral-400"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          onApplyLibraryAsset?.(
                            item,
                            canWrapTarget ? "apply-region" : "insert-below",
                          )
                        }
                        className="w-full bg-neutral-50/40 p-2.5 text-left transition group-hover:bg-white"
                      >
                        <div className="pointer-events-none flex min-h-14 max-h-28 items-center justify-center overflow-hidden rounded-lg bg-white p-2.5 ring-1 ring-neutral-100">
                          <div
                            className="w-[116%] shrink-0 origin-center scale-[0.86]"
                            dangerouslySetInnerHTML={{ __html: miniHtml }}
                          />
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-1">
                          <span className="truncate text-xs font-semibold text-neutral-900">{item.name}</span>
                          <span className="shrink-0 rounded bg-[#164b3e] px-1.5 py-0.5 text-[10px] font-medium text-white">
                            {canWrapTarget ? "套用到当前段" : "插入"}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-[10px] text-neutral-500">
                          {LIBRARY_CATEGORY_LABELS[item.category]} · v{item.version}
                          {item.teamName ? ` · ${item.teamName}` : ""}
                        </p>
                      </button>

                      <div className="flex items-center justify-between border-t border-neutral-100 bg-white px-2.5 py-1 text-[11px]">
                        <button
                          type="button"
                          onClick={() => onApplyLibraryAsset?.(item, "insert-below")}
                          className="inline-flex min-h-7 items-center gap-0.5 rounded px-1.5 py-0.5 font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950"
                        >
                          <Plus size={11} />
                          插入到下方
                        </button>

                        <div className="flex items-center gap-0.5">
                          {item.canEdit && onEditLibraryItem && (
                            <button
                              type="button"
                              title="可视化拆装与编辑"
                              aria-label={`编辑素材 ${item.name}`}
                              onClick={() => onEditLibraryItem(item)}
                              className="rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950"
                            >
                              <Pencil size={11} />
                            </button>
                          )}
                          {onDuplicateLibraryItem && (
                            <button
                              type="button"
                              title="复制到个人库"
                              aria-label={`复制素材 ${item.name} 到个人库`}
                              onClick={() => onDuplicateLibraryItem(item)}
                              className="rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950"
                            >
                              <Copy size={11} />
                            </button>
                          )}
                          <a
                            href={`/api/library/items/${encodeURIComponent(item.id)}?export=json`}
                            title="导出版本化 .json"
                            aria-label={`导出素材 ${item.name} JSON`}
                            className="rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950"
                          >
                            <Download size={11} />
                          </a>
                          {item.canEdit && onToggleArchiveItem && (
                            <button
                              type="button"
                              title={item.archived ? "取消归档" : "归档"}
                              aria-label={`${item.archived ? "取消归档" : "归档"} ${item.name}`}
                              onClick={() => onToggleArchiveItem(item)}
                              className="rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950"
                            >
                              {item.archived ? <ArchiveRestore size={11} /> : <Archive size={11} />}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
