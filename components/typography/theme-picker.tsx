"use client";

import { ExternalLink } from "lucide-react";
import {
  getSubTemplatesForTheme,
  TYPOGRAPHY_THEMES,
} from "@/lib/typography/catalog";
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
  styleOverrides,
  onSelectTheme,
  onSelectSubTemplate,
}: {
  activeThemeId: ThemeId;
  activeSubTemplateId: string;
  styleOverrides: Record<string, TemplateStyleConfig>;
  onSelectTheme: (themeId: ThemeId) => void;
  onSelectSubTemplate: (sub: TypographySubTemplate) => void;
}) {
  const activeTheme = TYPOGRAPHY_THEMES.find((t) => t.id === activeThemeId) ?? TYPOGRAPHY_THEMES[0];
  const subTemplates = getSubTemplatesForTheme(activeTheme.id);

  return (
    <div className="space-y-3">
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
          const isSelected = sub.id === activeSubTemplateId;
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
    </div>
  );
}
