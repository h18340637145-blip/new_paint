"use client";

import { useState } from "react";
import {
  Archive,
  ArchiveRestore,
  BookOpen,
  Copy,
  Download,
  ExternalLink,
  Pencil,
  Upload,
  Users,
} from "lucide-react";
import {
  getSubTemplatesForTheme,
  TYPOGRAPHY_THEMES,
} from "@/lib/typography/catalog";
import type { LibraryItemRecord } from "@/lib/typography/custom-tree";
import type {
  TemplateStyleConfig,
  ThemeId,
  TypographySubTemplate,
} from "@/lib/typography/types";

function SubTemplateMiniPreview({ style }: { style: TemplateStyleConfig }) {
  const { colors, heading, list, divider } = style;

  const headingPreview = () => {
    const label = "章节标题";
    if (heading.style === "numbered") {
      return (
        <div className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: colors.textColor }}>
          <span
            className="rounded px-1 py-0.5 text-[9px] font-bold text-white"
            style={{ backgroundColor: colors.primaryColor }}
          >
            01
          </span>
          <span>{label}</span>
        </div>
      );
    }
    if (heading.style === "bar") {
      return (
        <div
          className="pl-1.5 text-[11px] font-semibold"
          style={{ borderLeft: `3px solid ${colors.primaryColor}`, color: colors.textColor }}
        >
          {label}
        </div>
      );
    }
    if (heading.style === "band") {
      return (
        <div
          className="inline-block rounded-r px-1.5 py-0.5 text-[11px] font-semibold"
          style={{
            backgroundColor: colors.quoteBgColor,
            borderLeft: `3px solid ${colors.primaryColor}`,
            color: colors.textColor,
          }}
        >
          {label}
        </div>
      );
    }
    if (heading.style === "underline") {
      return (
        <div
          className="inline-block pb-0.5 text-[11px] font-semibold"
          style={{ borderBottom: `2px solid ${colors.primaryColor}`, color: colors.primaryColor }}
        >
          {label}
        </div>
      );
    }
    if (heading.style === "pill") {
      return (
        <span
          className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
          style={{ backgroundColor: colors.primaryColor }}
        >
          {label}
        </span>
      );
    }
    if (heading.style === "corner-tl") {
      return (
        <span
          className="inline-block px-1.5 py-0.5 text-[11px] font-semibold"
          style={{
            borderTop: `2px solid ${colors.primaryColor}`,
            borderLeft: `2px solid ${colors.primaryColor}`,
            color: colors.primaryColor,
          }}
        >
          {label}
        </span>
      );
    }
    if (heading.style === "corner-bl") {
      return (
        <span
          className="inline-block px-1.5 py-0.5 text-[11px] font-semibold"
          style={{
            borderBottom: `2px solid ${colors.primaryColor}`,
            borderLeft: `2px solid ${colors.accentColor}`,
            color: colors.primaryColor,
          }}
        >
          {label}
        </span>
      );
    }
    return (
      <div
        className={`text-[11px] font-semibold ${heading.align === "center" ? "text-center" : ""}`}
        style={{ color: colors.primaryColor }}
      >
        {label}
      </div>
    );
  };

  const marker =
    list.unorderedStyle === "check"
      ? "✓"
      : list.unorderedStyle === "dash"
        ? "—"
        : list.unorderedStyle === "square"
          ? "▪"
          : "•";

  return (
    <div
      className="mt-2 space-y-1.5 rounded-lg border p-2.5 text-[10px] leading-tight"
      style={{ backgroundColor: colors.bgColor, borderColor: colors.borderColor }}
      aria-hidden="true"
    >
      {headingPreview()}
      <p style={{ color: colors.textColor }}>
        正文文字 <strong style={{ color: colors.accentColor }}>强调重点</strong>
      </p>
      <div className="flex items-center gap-1" style={{ color: colors.textColor }}>
        <span style={{ color: colors.accentColor, fontWeight: 700 }}>{marker}</span>
        <span className="opacity-80">列表条目</span>
      </div>
      <div className="pt-0.5">
        {divider.style === "dots" ? (
          <p className="text-center text-[9px] tracking-[4px]" style={{ color: divider.color }}>
            •••
          </p>
        ) : divider.style === "blank" ? (
          <div className="h-1.5" />
        ) : (
          <div
            className="mx-auto"
            style={{
              width: divider.style === "short" ? "32%" : "100%",
              borderTop: `1px ${divider.style === "dashed" ? "dashed" : "solid"} ${divider.color}`,
            }}
          />
        )}
      </div>
    </div>
  );
}

export function ThemePicker({
  activeThemeId,
  activeSubTemplateId,
  activeLibraryTemplateId,
  styleOverrides,
  personalTemplates = [],
  teamTemplates = [],
  incomingInviteCount = 0,
  showArchived = false,
  onToggleShowArchived,
  onSelectTheme,
  onSelectSubTemplate,
  onApplyLibraryTemplate,
  onLoadLibraryTemplateSample,
  onInsertLibraryTemplate,
  onOpenImportTemplate,
  onEditLibraryItem,
  onDuplicateLibraryItem,
  onToggleArchiveItem,
  onOpenTeamManager,
}: {
  activeThemeId: ThemeId;
  activeSubTemplateId: string;
  activeLibraryTemplateId?: string | null;
  styleOverrides: Record<string, TemplateStyleConfig>;
  personalTemplates?: LibraryItemRecord[];
  teamTemplates?: LibraryItemRecord[];
  incomingInviteCount?: number;
  showArchived?: boolean;
  onToggleShowArchived?: () => void;
  onSelectTheme: (themeId: ThemeId) => void;
  onSelectSubTemplate: (sub: TypographySubTemplate) => void;
  onApplyLibraryTemplate?: (item: LibraryItemRecord) => void;
  onLoadLibraryTemplateSample?: (item: LibraryItemRecord) => void;
  onInsertLibraryTemplate?: (item: LibraryItemRecord) => void;
  onOpenImportTemplate?: () => void;
  onEditLibraryItem?: (item: LibraryItemRecord) => void;
  onDuplicateLibraryItem?: (item: LibraryItemRecord) => void;
  onToggleArchiveItem?: (item: LibraryItemRecord) => void;
  onOpenTeamManager?: () => void;
}) {
  const [sourceTab, setSourceTab] = useState<"builtin" | "personal" | "team">("builtin");
  const activeTheme = TYPOGRAPHY_THEMES.find((t) => t.id === activeThemeId) ?? TYPOGRAPHY_THEMES[0];
  const subTemplates = getSubTemplatesForTheme(activeTheme.id);
  const displayedLibraryTemplates = sourceTab === "personal" ? personalTemplates : teamTemplates;

  return (
    <div className="space-y-3">
      {/* 顶层来源切换 + 导入模板入口 + 团队管理 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-neutral-200 bg-neutral-100/80 p-1" role="tablist" aria-label="模板库来源">
          <button
            type="button"
            role="tab"
            aria-selected={sourceTab === "builtin"}
            onClick={() => setSourceTab("builtin")}
            className={`min-h-8 rounded-lg px-3 py-1 text-xs font-medium transition ${
              sourceTab === "builtin"
                ? "bg-white text-neutral-950 shadow-sm"
                : "text-neutral-600 hover:text-neutral-950"
            }`}
          >
            系统精选模板
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={sourceTab === "personal"}
            onClick={() => setSourceTab("personal")}
            className={`min-h-8 rounded-lg px-3 py-1 text-xs font-medium transition ${
              sourceTab === "personal"
                ? "bg-white text-neutral-950 shadow-sm"
                : "text-neutral-600 hover:text-neutral-950"
            }`}
          >
            个人库模板 ({personalTemplates.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={sourceTab === "team"}
            onClick={() => setSourceTab("team")}
            className={`min-h-8 rounded-lg px-3 py-1 text-xs font-medium transition ${
              sourceTab === "team"
                ? "bg-white text-neutral-950 shadow-sm"
                : "text-neutral-600 hover:text-neutral-950"
            }`}
          >
            团队库模板 ({teamTemplates.length})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {sourceTab !== "builtin" && onToggleShowArchived && (
            <button
              type="button"
              onClick={onToggleShowArchived}
              className={`inline-flex min-h-9 items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                showArchived
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
              }`}
            >
              <Archive size={13} />
              {showArchived ? "隐藏归档" : "显示已归档"}
            </button>
          )}

          {onOpenTeamManager && (
            <button
              type="button"
              onClick={onOpenTeamManager}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
            >
              <Users size={13} />
              <span>团队与邀请</span>
              {incomingInviteCount > 0 && (
                <span className="rounded-full bg-emerald-700 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {incomingInviteCount}
                </span>
              )}
            </button>
          )}

          {onOpenImportTemplate && (
            <button
              type="button"
              onClick={onOpenImportTemplate}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-emerald-900 px-3.5 py-1 text-xs font-semibold text-white shadow-sm hover:bg-emerald-950"
            >
              <Upload size={13} />
              导入模板
            </button>
          )}
        </div>
      </div>

      {sourceTab === "builtin" ? (
        <>
          {/* 一级：主题分类 */}
          <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="排版主题分类">
            {TYPOGRAPHY_THEMES.map((theme) => {
              const isSelected = theme.id === activeTheme.id;
              return (
                <button
                  key={theme.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => onSelectTheme(theme.id)}
                  className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
                    isSelected
                      ? "border-neutral-950 bg-neutral-950 text-white"
                      : "border-neutral-200 bg-neutral-50 text-neutral-700 hover:border-neutral-300 hover:text-neutral-950"
                  }`}
                >
                  <span>{theme.name}</span>
                  <span className={`text-[10px] ${isSelected ? "text-neutral-300" : "text-neutral-400"}`}>
                    {theme.palettes.length}色
                  </span>
                </button>
              );
            })}
            <span className="ml-auto hidden text-xs text-neutral-500 lg:inline">{activeTheme.summary}</span>
          </div>

          {/* 二级：子模板卡片 + 小预览 */}
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {subTemplates.map((sub) => {
              const isSelected = !activeLibraryTemplateId && sub.id === activeSubTemplateId;
              const previewStyle = styleOverrides[sub.id] ?? sub.defaultStyle;
              return (
                <div
                  key={sub.id}
                  className={`group flex flex-col justify-between rounded-xl border p-3 transition ${
                    isSelected
                      ? "border-neutral-950 bg-neutral-50 ring-1 ring-neutral-950"
                      : "border-neutral-200 bg-white hover:border-neutral-300"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelectSubTemplate(sub)}
                    className="w-full text-left focus:outline-none"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-neutral-950">
                        <span
                          aria-hidden="true"
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: previewStyle.colors.primaryColor }}
                        />
                        {sub.name}
                      </span>
                      {isSelected && (
                        <span className="rounded bg-neutral-950 px-1.5 py-0.5 text-[10px] font-medium text-white">
                          当前
                        </span>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11px] text-neutral-500">{sub.description}</p>
                    <SubTemplateMiniPreview style={previewStyle} />
                  </button>

                  {sub.sourceArticleUrl && (
                    <a
                      href={sub.sourceArticleUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-neutral-500 hover:text-neutral-950 hover:underline"
                    >
                      <span>样本溯源：{sub.sourceArticleTitle?.slice(0, 14)}…</span>
                      <ExternalLink size={10} aria-hidden="true" />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </>
      ) : displayedLibraryTemplates.length === 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-neutral-200 bg-neutral-50/70 px-4 py-5 text-xs text-neutral-600">
          <span>
            {sourceTab === "personal"
              ? "个人库暂无导入模板。支持从公众号文章、秀米、.html 文件或项目导出的 .json 一键导入。"
              : "团队库暂无共享模板。团队所有者与编辑者可将导入模板保存到团队库供全员复用。"}
          </span>
          {onOpenImportTemplate && (
            <button
              type="button"
              onClick={onOpenImportTemplate}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-neutral-900 bg-white px-3 py-1 font-semibold text-neutral-950 hover:bg-neutral-100"
            >
              <Upload size={13} />
              立即导入模板
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {displayedLibraryTemplates.map((tpl) => {
            const isSelected = activeLibraryTemplateId === tpl.id;
            const previewStyle =
              tpl.templateStyle ?? getSubTemplatesForTheme(TYPOGRAPHY_THEMES[0].id)[0].defaultStyle;
            return (
              <div
                key={tpl.id}
                className={`flex flex-col justify-between rounded-xl border p-3 transition ${
                  isSelected
                    ? "border-emerald-900 bg-emerald-50/30 ring-1 ring-emerald-900"
                    : tpl.archived
                      ? "border-neutral-200 bg-neutral-50 opacity-75"
                      : "border-neutral-200 bg-white hover:border-neutral-300"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onApplyLibraryTemplate?.(tpl)}
                  className="w-full text-left focus:outline-none"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-semibold text-neutral-950">{tpl.name}</span>
                    <span className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600">
                      v{tpl.version}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-1 text-[11px] text-neutral-500">
                    {tpl.teamName ? `${tpl.teamName} · ` : ""}
                    {tpl.summary || "点击应用整套排版样式"}
                  </p>
                  <SubTemplateMiniPreview style={previewStyle} />
                </button>

                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-1 border-t border-neutral-100 pt-2 text-[11px]">
                  {onInsertLibraryTemplate && (
                    <button
                      type="button"
                      onClick={() => onInsertLibraryTemplate(tpl)}
                      className="rounded-md bg-emerald-50 px-2 py-1 font-medium text-emerald-900 hover:bg-emerald-100"
                    >
                      插入完整模板
                    </button>
                  )}
                  {tpl.sampleMarkdown && onLoadLibraryTemplateSample ? (
                    <button
                      type="button"
                      onClick={() => onLoadLibraryTemplateSample(tpl)}
                      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium text-emerald-800 hover:bg-emerald-50"
                    >
                      <BookOpen size={11} />
                      加载示例
                    </button>
                  ) : null}

                  <div className="flex items-center gap-1">
                    {tpl.canEdit && onEditLibraryItem && (
                      <button
                        type="button"
                        title="拆装与编辑模板"
                        aria-label={`编辑模板 ${tpl.name}`}
                        onClick={() => onEditLibraryItem(tpl)}
                        className="rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950"
                      >
                        <Pencil size={12} />
                      </button>
                    )}
                    {onDuplicateLibraryItem && (
                      <button
                        type="button"
                        title="复制到个人库"
                        aria-label={`复制模板 ${tpl.name} 到个人库`}
                        onClick={() => onDuplicateLibraryItem(tpl)}
                        className="rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950"
                      >
                        <Copy size={12} />
                      </button>
                    )}
                    <a
                      href={`/api/library/items/${encodeURIComponent(tpl.id)}?export=json`}
                      title="导出版本化 .json"
                      aria-label={`导出模板 ${tpl.name} JSON`}
                      className="rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950"
                    >
                      <Download size={12} />
                    </a>
                    {tpl.canEdit && onToggleArchiveItem && (
                      <button
                        type="button"
                        title={tpl.archived ? "取消归档" : "归档"}
                        aria-label={`${tpl.archived ? "取消归档" : "归档"} ${tpl.name}`}
                        onClick={() => onToggleArchiveItem(tpl)}
                        className="rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950"
                      >
                        {tpl.archived ? <ArchiveRestore size={12} /> : <Archive size={12} />}
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
  );
}
