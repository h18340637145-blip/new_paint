"use client";

import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Columns2,
  CreditCard,
  Eraser,
  Image as ImageIcon,
  Layers,
  Plus,
  Type,
  Wand2,
} from "lucide-react";
import {
  escapeHtml,
  getXiumiPreset,
  renderXiumiPresetHtml,
  safeUrl,
  sanitizeStyle,
  XIUMI_CATEGORIES,
  XIUMI_PRESETS,
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
  onApplyToRegion: (preset: XiumiPreset) => void;
  onInsertBlock: (preset: XiumiPreset) => void;
  onClearRegionPreset?: () => void;
}

export function XiumiDrawer({
  style,
  targetLabel,
  activePresetId,
  onApplyToRegion,
  onInsertBlock,
  onClearRegionPreset,
}: XiumiDrawerProps) {
  const [open, setOpen] = useState(true);
  const [activeCategory, setActiveCategory] = useState<XiumiCategory>("heading");

  const cleanStyle = useMemo(() => sanitizeStyle(style), [style]);
  const presets = useMemo(
    () => XIUMI_PRESETS.filter((p) => p.category === activeCategory),
    [activeCategory],
  );
  const currentPreset = getXiumiPreset(activePresetId);

  function handleCategoryClick(cat: XiumiCategory) {
    if (open && activeCategory === cat) {
      setOpen(false);
      return;
    }
    setActiveCategory(cat);
    setOpen(true);
  }

  return (
    <aside
      aria-label="图文组件抽屉栏"
      className="w-full shrink-0 lg:sticky lg:top-[68px] lg:w-auto lg:self-start"
    >
      <div className="flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm lg:flex-row">
        {/* 左侧分类窄轨（秀米式图标导航） */}
        <div
          role="tablist"
          aria-label="图文模板分类"
          className="flex items-center gap-1 overflow-x-auto border-b border-neutral-100 bg-neutral-50/90 p-1.5 lg:w-[58px] lg:flex-col lg:border-r lg:border-b-0 lg:py-2.5"
        >
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? "收起图文组件抽屉" : "展开图文组件抽屉"}
            title={open ? "收起组件抽屉" : "展开组件抽屉"}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-neutral-500 transition hover:bg-white hover:text-neutral-950 lg:mb-1"
          >
            {open ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>

          {XIUMI_CATEGORIES.map((cat) => {
            const Icon = CATEGORY_ICONS[cat.id];
            const isSelected = open && activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => handleCategoryClick(cat.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium transition lg:w-full lg:flex-col lg:gap-1 lg:px-1 lg:py-2 ${
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

        {/* 展开的组件模板列表面板 */}
        {open && (
          <div className="flex w-full flex-col bg-white lg:w-[268px] lg:max-h-[calc(100dvh-88px)]">
            <div className="border-b border-neutral-100 px-3.5 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-neutral-900">
                  {XIUMI_CATEGORIES.find((c) => c.id === activeCategory)?.label}模板
                </span>
                <span className="text-[11px] text-neutral-400">点击卡片套用到区域</span>
              </div>
              <div className="mt-1.5 rounded-lg bg-neutral-50 px-2.5 py-1.5 text-[11px] text-neutral-600">
                <div className="truncate">
                  目标区域：<strong className="font-medium text-neutral-900">{targetLabel}</strong>
                </div>
                {currentPreset && onClearRegionPreset && (
                  <div className="mt-1 flex items-center justify-between gap-1 border-t border-neutral-200/70 pt-1">
                    <span className="truncate text-[10px] text-emerald-700">
                      当前组件：{currentPreset.name}
                    </span>
                    <button
                      type="button"
                      onClick={onClearRegionPreset}
                      className="inline-flex shrink-0 items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium text-neutral-600 hover:bg-neutral-200/60 hover:text-neutral-950"
                    >
                      <Eraser size={10} />
                      还原默认
                    </button>
                  </div>
                )}
              </div>
            </div>

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
                      <div className="pointer-events-none max-h-28 overflow-hidden rounded-lg bg-white p-2 ring-1 ring-neutral-100">
                        <div
                          className="origin-top-left scale-[0.78] w-[128%]"
                          dangerouslySetInnerHTML={{ __html: miniHtml }}
                        />
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-1">
                        <span className="text-xs font-semibold text-neutral-900">{preset.name}</span>
                        <span className="rounded bg-neutral-900 px-1.5 py-0.5 text-[10px] font-medium text-white opacity-90 group-hover:opacity-100">
                          {isApplied ? "已应用" : "套用区域"}
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-[11px] text-neutral-500">{preset.summary}</p>
                    </button>

                    <div className="flex items-center justify-end border-t border-neutral-100 bg-white px-2.5 py-1">
                      <button
                        type="button"
                        onClick={() => onInsertBlock(preset)}
                        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950"
                      >
                        <Plus size={11} />
                        插入新块
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
