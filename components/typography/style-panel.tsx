"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { getThemeById } from "@/lib/typography/catalog";
import type {
  ColorPalette,
  DividerStyleKind,
  HeadingStyleKind,
  ImageStyleKind,
  OrderedListStyle,
  TemplateStyleConfig,
  ThemeId,
  UnorderedListStyle,
} from "@/lib/typography/types";

type StyleTab = "colors" | "paragraph" | "heading" | "list" | "image" | "divider";

const STYLE_TABS: { id: StyleTab; label: string }[] = [
  { id: "colors", label: "配色" },
  { id: "heading", label: "标题" },
  { id: "paragraph", label: "正文" },
  { id: "list", label: "列表" },
  { id: "image", label: "图片" },
  { id: "divider", label: "分割线" },
];

const COLOR_FIELDS: {
  key: keyof TemplateStyleConfig["colors"];
  label: string;
}[] = [
  { key: "primaryColor", label: "主色" },
  { key: "accentColor", label: "强调色" },
  { key: "textColor", label: "正文色" },
  { key: "bgColor", label: "背景色" },
  { key: "borderColor", label: "边框色" },
  { key: "quoteBgColor", label: "引用底色" },
];

function NumberSelect({
  label,
  value,
  options,
  unit = "",
  onChange,
}: {
  label: string;
  value: number;
  options: number[];
  unit?: string;
  onChange: (next: number) => void;
}) {
  return (
    <label className="inline-flex items-center gap-1.5 text-xs text-neutral-600">
      <span className="shrink-0">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="min-h-8 rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs text-neutral-950"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
            {unit}
          </option>
        ))}
      </select>
    </label>
  );
}

export function StylePanel({
  themeId,
  style,
  onSelectPalette,
  onUpdateStyle,
  onResetDefault,
}: {
  themeId: ThemeId;
  style: TemplateStyleConfig;
  onSelectPalette: (palette: ColorPalette) => void;
  onUpdateStyle: (updater: (prev: TemplateStyleConfig) => TemplateStyleConfig) => void;
  onResetDefault: () => void;
}) {
  const [activeTab, setActiveTab] = useState<StyleTab>("colors");
  const theme = getThemeById(themeId);

  return (
    <div className="space-y-3 border-t border-neutral-100 pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="局部样式设置分组">
          {STYLE_TABS.map((tab) => {
            const active = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.id)}
                className={`min-h-8 rounded-lg px-3 py-1 text-xs font-medium transition ${
                  active
                    ? "bg-neutral-950 text-white"
                    : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onResetDefault}
          className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50"
        >
          <RotateCcw size={12} aria-hidden="true" />
          恢复模板默认
        </button>
      </div>

      {activeTab === "colors" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-neutral-600">预设配色（{theme.name}）：</span>
            {theme.palettes.map((palette) => {
              const isSelected = style.paletteId === palette.id;
              return (
                <button
                  key={palette.id}
                  type="button"
                  onClick={() => onSelectPalette(palette)}
                  className={`inline-flex min-h-8 items-center gap-2 rounded-full border px-3 py-1 text-xs transition ${
                    isSelected
                      ? "border-neutral-950 bg-neutral-950 text-white"
                      : "border-neutral-200 bg-white text-neutral-800 hover:border-neutral-300"
                  }`}
                >
                  <span className="flex items-center -space-x-1" aria-hidden="true">
                    <span
                      className="size-3 rounded-full border border-white"
                      style={{ backgroundColor: palette.primaryColor }}
                    />
                    <span
                      className="size-3 rounded-full border border-white"
                      style={{ backgroundColor: palette.accentColor }}
                    />
                  </span>
                  <span>{palette.name}</span>
                </button>
              );
            })}
          </div>

          <div className="grid gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
            {COLOR_FIELDS.map(({ key, label }) => {
              const val = style.colors[key];
              return (
                <label
                  key={key}
                  className="flex items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-neutral-50/70 px-2.5 py-1.5 text-xs"
                >
                  <span className="shrink-0 text-neutral-600">{label}</span>
                  <span className="flex items-center gap-1.5">
                    <input
                      type="color"
                      aria-label={`${label}选择器`}
                      value={/^#[0-9a-fA-F]{6}$/.test(val) ? val : "#171717"}
                      onChange={(e) => {
                        const nextHex = e.target.value;
                        onUpdateStyle((prev) => ({
                          ...prev,
                          paletteId: "custom",
                          colors: { ...prev.colors, [key]: nextHex },
                          divider:
                            key === "primaryColor" && prev.divider.color === prev.colors.primaryColor
                              ? { ...prev.divider, color: nextHex }
                              : prev.divider,
                        }));
                      }}
                      className="size-6 cursor-pointer rounded border-0 bg-transparent p-0"
                    />
                    <input
                      type="text"
                      aria-label={`${label}色值`}
                      value={val}
                      onChange={(e) => {
                        const nextVal = e.target.value;
                        onUpdateStyle((prev) => ({
                          ...prev,
                          paletteId: "custom",
                          colors: { ...prev.colors, [key]: nextVal },
                        }));
                      }}
                      className="w-16 rounded border border-neutral-200 bg-white px-1.5 py-0.5 font-mono text-[11px] text-neutral-900"
                    />
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === "heading" && (
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-1.5 text-xs text-neutral-600">
            <span>样式</span>
            <select
              value={style.heading.style}
              onChange={(e) =>
                onUpdateStyle((prev) => ({
                  ...prev,
                  heading: { ...prev.heading, style: e.target.value as HeadingStyleKind },
                }))
              }
              className="min-h-8 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs text-neutral-950"
            >
              <option value="plain">纯文字</option>
              <option value="bar">左竖线</option>
              <option value="numbered">编号（01）</option>
              <option value="band">底色条</option>
              <option value="underline">下划线</option>
              <option value="pill">胶囊标签</option>
              <option value="corner-tl">左上直角框</option>
              <option value="corner-bl">左下直角框</option>
            </select>
          </label>

          <NumberSelect
            label="字号"
            value={style.heading.fontSize}
            options={[16, 17, 18, 19, 20, 22, 24]}
            unit="px"
            onChange={(fontSize) =>
              onUpdateStyle((prev) => ({ ...prev, heading: { ...prev.heading, fontSize } }))
            }
          />

          <label className="inline-flex items-center gap-1.5 text-xs text-neutral-600">
            <span>字重</span>
            <select
              value={style.heading.fontWeight}
              onChange={(e) =>
                onUpdateStyle((prev) => ({
                  ...prev,
                  heading: { ...prev.heading, fontWeight: Number(e.target.value) as 400 | 600 | 700 },
                }))
              }
              className="min-h-8 rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs text-neutral-950"
            >
              <option value={400}>常规 400</option>
              <option value={600}>半粗 600</option>
              <option value={700}>加粗 700</option>
            </select>
          </label>

          <label className="inline-flex items-center gap-1.5 text-xs text-neutral-600">
            <span>对齐</span>
            <select
              value={style.heading.align}
              onChange={(e) =>
                onUpdateStyle((prev) => ({
                  ...prev,
                  heading: { ...prev.heading, align: e.target.value as "left" | "center" },
                }))
              }
              className="min-h-8 rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs text-neutral-950"
            >
              <option value="left">左对齐</option>
              <option value="center">居中</option>
            </select>
          </label>

          <NumberSelect
            label="段前距"
            value={style.heading.marginTop}
            options={[12, 16, 20, 24, 26, 28, 30, 36]}
            unit="px"
            onChange={(marginTop) =>
              onUpdateStyle((prev) => ({ ...prev, heading: { ...prev.heading, marginTop } }))
            }
          />

          <NumberSelect
            label="段后距"
            value={style.heading.marginBottom}
            options={[8, 10, 12, 14, 16, 20]}
            unit="px"
            onChange={(marginBottom) =>
              onUpdateStyle((prev) => ({ ...prev, heading: { ...prev.heading, marginBottom } }))
            }
          />
        </div>
      )}

      {activeTab === "paragraph" && (
        <div className="flex flex-wrap items-center gap-3">
          <NumberSelect
            label="字号"
            value={style.paragraph.fontSize}
            options={[14, 15, 16, 17, 18]}
            unit="px"
            onChange={(fontSize) =>
              onUpdateStyle((prev) => ({ ...prev, paragraph: { ...prev.paragraph, fontSize } }))
            }
          />
          <NumberSelect
            label="行高"
            value={style.paragraph.lineHeight}
            options={[1.6, 1.75, 1.85, 1.9, 2, 2.2]}
            onChange={(lineHeight) =>
              onUpdateStyle((prev) => ({ ...prev, paragraph: { ...prev.paragraph, lineHeight } }))
            }
          />
          <NumberSelect
            label="字间距"
            value={style.paragraph.letterSpacing}
            options={[0, 0.5, 0.6, 0.8, 1, 1.5, 2]}
            unit="px"
            onChange={(letterSpacing) =>
              onUpdateStyle((prev) => ({ ...prev, paragraph: { ...prev.paragraph, letterSpacing } }))
            }
          />
          <NumberSelect
            label="段前距"
            value={style.paragraph.marginTop}
            options={[0, 4, 8, 12, 16]}
            unit="px"
            onChange={(marginTop) =>
              onUpdateStyle((prev) => ({ ...prev, paragraph: { ...prev.paragraph, marginTop } }))
            }
          />
          <NumberSelect
            label="段后距"
            value={style.paragraph.marginBottom}
            options={[10, 12, 14, 15, 16, 18, 20, 24]}
            unit="px"
            onChange={(marginBottom) =>
              onUpdateStyle((prev) => ({ ...prev, paragraph: { ...prev.paragraph, marginBottom } }))
            }
          />
          <label className="inline-flex items-center gap-1.5 text-xs text-neutral-600">
            <span>对齐</span>
            <select
              value={style.paragraph.textAlign}
              onChange={(e) =>
                onUpdateStyle((prev) => ({
                  ...prev,
                  paragraph: { ...prev.paragraph, textAlign: e.target.value as "justify" | "left" },
                }))
              }
              className="min-h-8 rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs text-neutral-950"
            >
              <option value="justify">两端对齐</option>
              <option value="left">左对齐</option>
            </select>
          </label>
        </div>
      )}

      {activeTab === "list" && (
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-1.5 text-xs text-neutral-600">
            <span>无序符号</span>
            <select
              value={style.list.unorderedStyle}
              onChange={(e) =>
                onUpdateStyle((prev) => ({
                  ...prev,
                  list: { ...prev.list, unorderedStyle: e.target.value as UnorderedListStyle },
                }))
              }
              className="min-h-8 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs text-neutral-950"
            >
              <option value="disc">圆点（•）</option>
              <option value="square">方块（▪）</option>
              <option value="dash">短横线（—）</option>
              <option value="check">勾选标记（✓）</option>
            </select>
          </label>

          <label className="inline-flex items-center gap-1.5 text-xs text-neutral-600">
            <span>有序编号</span>
            <select
              value={style.list.orderedStyle}
              onChange={(e) =>
                onUpdateStyle((prev) => ({
                  ...prev,
                  list: { ...prev.list, orderedStyle: e.target.value as OrderedListStyle },
                }))
              }
              className="min-h-8 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs text-neutral-950"
            >
              <option value="decimal">普通数字（1.）</option>
              <option value="leading-zero">两位编号（01.）</option>
            </select>
          </label>

          <NumberSelect
            label="缩进"
            value={style.list.indent}
            options={[12, 16, 20, 22, 24, 28, 32]}
            unit="px"
            onChange={(indent) =>
              onUpdateStyle((prev) => ({ ...prev, list: { ...prev.list, indent } }))
            }
          />

          <NumberSelect
            label="项间距"
            value={style.list.itemSpacing}
            options={[4, 6, 8, 10, 12, 16]}
            unit="px"
            onChange={(itemSpacing) =>
              onUpdateStyle((prev) => ({ ...prev, list: { ...prev.list, itemSpacing } }))
            }
          />
        </div>
      )}

      {activeTab === "image" && (
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-1.5 text-xs text-neutral-600">
            <span>图片样式</span>
            <select
              value={style.image.style}
              onChange={(e) =>
                onUpdateStyle((prev) => ({
                  ...prev,
                  image: { ...prev.image, style: e.target.value as ImageStyleKind },
                }))
              }
              className="min-h-8 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs text-neutral-950"
            >
              <option value="full">通栏</option>
              <option value="padded">留白</option>
              <option value="rounded">圆角</option>
              <option value="bordered">细边框</option>
            </select>
          </label>

          <label className="inline-flex items-center gap-1.5 text-xs text-neutral-600">
            <span>对齐</span>
            <select
              value={style.image.align}
              onChange={(e) =>
                onUpdateStyle((prev) => ({
                  ...prev,
                  image: { ...prev.image, align: e.target.value as "left" | "center" | "right" },
                }))
              }
              className="min-h-8 rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs text-neutral-950"
            >
              <option value="left">左对齐</option>
              <option value="center">居中</option>
              <option value="right">右对齐</option>
            </select>
          </label>

          <NumberSelect
            label="最大宽度"
            value={style.image.maxWidth}
            options={[60, 75, 85, 92, 94, 96, 100]}
            unit="%"
            onChange={(maxWidth) =>
              onUpdateStyle((prev) => ({ ...prev, image: { ...prev.image, maxWidth } }))
            }
          />

          <NumberSelect
            label="圆角"
            value={style.image.borderRadius}
            options={[0, 4, 6, 8, 10, 12, 14, 18, 24]}
            unit="px"
            onChange={(borderRadius) =>
              onUpdateStyle((prev) => ({ ...prev, image: { ...prev.image, borderRadius } }))
            }
          />

          <NumberSelect
            label="上下间距"
            value={style.image.spacing}
            options={[8, 12, 14, 16, 18, 20, 22, 28, 36]}
            unit="px"
            onChange={(spacing) =>
              onUpdateStyle((prev) => ({ ...prev, image: { ...prev.image, spacing } }))
            }
          />
        </div>
      )}

      {activeTab === "divider" && (
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-1.5 text-xs text-neutral-600">
            <span>分割线样式</span>
            <select
              value={style.divider.style}
              onChange={(e) =>
                onUpdateStyle((prev) => ({
                  ...prev,
                  divider: { ...prev.divider, style: e.target.value as DividerStyleKind },
                }))
              }
              className="min-h-8 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs text-neutral-950"
            >
              <option value="solid">细实线</option>
              <option value="dashed">虚线</option>
              <option value="short">短线</option>
              <option value="dots">点阵</option>
              <option value="blank">留白</option>
            </select>
          </label>

          <NumberSelect
            label="宽度"
            value={style.divider.widthPercent}
            options={[20, 28, 35, 50, 60, 85, 90, 100]}
            unit="%"
            onChange={(widthPercent) =>
              onUpdateStyle((prev) => ({ ...prev, divider: { ...prev.divider, widthPercent } }))
            }
          />

          <label className="inline-flex items-center gap-1.5 text-xs text-neutral-600">
            <span>颜色</span>
            <input
              type="color"
              aria-label="分割线颜色选择器"
              value={/^#[0-9a-fA-F]{6}$/.test(style.divider.color) ? style.divider.color : "#d4d4d8"}
              onChange={(e) =>
                onUpdateStyle((prev) => ({
                  ...prev,
                  divider: { ...prev.divider, color: e.target.value },
                }))
              }
              className="size-6 cursor-pointer rounded border-0 bg-transparent p-0"
            />
            <input
              type="text"
              aria-label="分割线色值"
              value={style.divider.color}
              onChange={(e) =>
                onUpdateStyle((prev) => ({
                  ...prev,
                  divider: { ...prev.divider, color: e.target.value },
                }))
              }
              className="w-16 rounded border border-neutral-200 bg-white px-1.5 py-0.5 font-mono text-[11px] text-neutral-900"
            />
          </label>

          <NumberSelect
            label="上下间距"
            value={style.divider.spacing}
            options={[12, 16, 20, 22, 24, 26, 28, 36, 48]}
            unit="px"
            onChange={(spacing) =>
              onUpdateStyle((prev) => ({ ...prev, divider: { ...prev.divider, spacing } }))
            }
          />
        </div>
      )}
    </div>
  );
}
