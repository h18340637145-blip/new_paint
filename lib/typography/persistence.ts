import { cloneStyleConfig, getSubTemplate, resolveSubTemplateId, TYPOGRAPHY_SUBTEMPLATES } from "./catalog";
import { validateAppliedSnapshot, type AppliedComponentSnapshot } from "./custom-tree";
import type {
  AppliedLibraryTemplateMeta,
  HeadingStyleKind,
  TemplateStyleConfig,
  TypographyPersistedState,
} from "./types";

export const TYPOGRAPHY_STORAGE_KEY = "new_paint_typography_templates_v1";

function mapLegacyHeadingStyle(raw: unknown, fallback: HeadingStyleKind): HeadingStyleKind {
  if (raw === "minimal") return "plain";
  if (raw === "highlight") return "band";
  if (
    raw === "plain"
    || raw === "bar"
    || raw === "numbered"
    || raw === "band"
    || raw === "underline"
    || raw === "pill"
    || raw === "corner-tl"
    || raw === "corner-bl"
  ) {
    return raw;
  }
  return fallback;
}

function asNumber(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

function asColor(value: unknown, fallback: string): string {
  return typeof value === "string" && /^#[0-9a-fA-F]{3,8}$/.test(value.trim())
    ? value.trim()
    : fallback;
}

function mergeStyleOverride(base: TemplateStyleConfig, raw: Record<string, unknown>): TemplateStyleConfig {
  const next = cloneStyleConfig(base);
  const rawColors = (typeof raw.colors === "object" && raw.colors ? raw.colors : {}) as Record<string, unknown>;
  const rawHeading = (typeof raw.heading === "object" && raw.heading ? raw.heading : {}) as Record<string, unknown>;
  const rawParagraph = (typeof raw.paragraph === "object" && raw.paragraph ? raw.paragraph : {}) as Record<string, unknown>;
  const rawList = (typeof raw.list === "object" && raw.list ? raw.list : {}) as Record<string, unknown>;
  const rawImage = (typeof raw.image === "object" && raw.image ? raw.image : {}) as Record<string, unknown>;
  const rawDivider = (typeof raw.divider === "object" && raw.divider ? raw.divider : {}) as Record<string, unknown>;

  if (typeof raw.paletteId === "string" && raw.paletteId) {
    next.paletteId = raw.paletteId;
  }

  // Support both v2 nested colors and v1 flat accentColor/bgColor/textColor/quoteBgColor
  next.colors = {
    primaryColor: asColor(rawColors.primaryColor ?? raw.accentColor, next.colors.primaryColor),
    accentColor: asColor(rawColors.accentColor ?? raw.accentColor, next.colors.accentColor),
    textColor: asColor(rawColors.textColor ?? raw.textColor, next.colors.textColor),
    bgColor: asColor(rawColors.bgColor ?? raw.bgColor, next.colors.bgColor),
    borderColor: asColor(rawColors.borderColor, next.colors.borderColor),
    quoteBgColor: asColor(rawColors.quoteBgColor ?? raw.quoteBgColor, next.colors.quoteBgColor),
  };

  next.heading = {
    style: mapLegacyHeadingStyle(rawHeading.style ?? raw.headingStyle, next.heading.style),
    fontSize: asNumber(rawHeading.fontSize, 15, 28, next.heading.fontSize),
    fontWeight:
      rawHeading.fontWeight === 400 || rawHeading.fontWeight === 600 || rawHeading.fontWeight === 700
        ? rawHeading.fontWeight
        : next.heading.fontWeight,
    align: rawHeading.align === "left" || rawHeading.align === "center" ? rawHeading.align : next.heading.align,
    marginTop: asNumber(rawHeading.marginTop, 8, 48, next.heading.marginTop),
    marginBottom: asNumber(rawHeading.marginBottom, 4, 32, next.heading.marginBottom),
  };

  next.paragraph = {
    fontSize: asNumber(rawParagraph.fontSize ?? raw.fontSize, 13, 20, next.paragraph.fontSize),
    lineHeight: asNumber(rawParagraph.lineHeight ?? raw.lineHeight, 1.4, 2.4, next.paragraph.lineHeight),
    letterSpacing: asNumber(rawParagraph.letterSpacing ?? raw.letterSpacing, 0, 3, next.paragraph.letterSpacing),
    marginTop: asNumber(rawParagraph.marginTop, 0, 24, next.paragraph.marginTop),
    marginBottom: asNumber(
      rawParagraph.marginBottom ?? raw.paragraphSpacing,
      6,
      36,
      next.paragraph.marginBottom,
    ),
    textAlign:
      rawParagraph.textAlign === "left" || rawParagraph.textAlign === "justify"
        ? rawParagraph.textAlign
        : next.paragraph.textAlign,
  };

  next.list = {
    unorderedStyle:
      rawList.unorderedStyle === "disc"
      || rawList.unorderedStyle === "square"
      || rawList.unorderedStyle === "dash"
      || rawList.unorderedStyle === "check"
        ? rawList.unorderedStyle
        : next.list.unorderedStyle,
    orderedStyle:
      rawList.orderedStyle === "decimal" || rawList.orderedStyle === "leading-zero"
        ? rawList.orderedStyle
        : next.list.orderedStyle,
    indent: asNumber(rawList.indent, 8, 40, next.list.indent),
    itemSpacing: asNumber(rawList.itemSpacing, 2, 20, next.list.itemSpacing),
  };

  next.image = {
    style:
      rawImage.style === "full"
      || rawImage.style === "padded"
      || rawImage.style === "rounded"
      || rawImage.style === "bordered"
        ? rawImage.style
        : next.image.style,
    align:
      rawImage.align === "left" || rawImage.align === "center" || rawImage.align === "right"
        ? rawImage.align
        : next.image.align,
    maxWidth: asNumber(rawImage.maxWidth, 50, 100, next.image.maxWidth),
    borderRadius: asNumber(rawImage.borderRadius, 0, 28, next.image.borderRadius),
    spacing: asNumber(rawImage.spacing, 4, 40, next.image.spacing),
  };

  next.divider = {
    style:
      rawDivider.style === "solid"
      || rawDivider.style === "dashed"
      || rawDivider.style === "short"
      || rawDivider.style === "dots"
      || rawDivider.style === "blank"
        ? rawDivider.style
        : next.divider.style,
    widthPercent: asNumber(rawDivider.widthPercent, 10, 100, next.divider.widthPercent),
    color: asColor(rawDivider.color, next.divider.color),
    spacing: asNumber(rawDivider.spacing, 8, 56, next.divider.spacing),
  };

  return next;
}

export function createDefaultPersistedState(): TypographyPersistedState {
  const initial = TYPOGRAPHY_SUBTEMPLATES[0];
  return {
    version: 2,
    activeSubTemplateId: initial.id,
    content: initial.sampleMarkdown,
    hasEditedContent: false,
    styleOverrides: {},
    drafts: {},
  };
}

export function migratePersistedState(rawJson: string | null): TypographyPersistedState {
  const fallback = createDefaultPersistedState();
  if (!rawJson) return fallback;

  try {
    const parsed = JSON.parse(rawJson) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return fallback;

    const styleOverrides: Record<string, TemplateStyleConfig> = {};
    const drafts: Record<string, string> = {};

    // Migrate v1 drafts
    if (parsed.drafts && typeof parsed.drafts === "object") {
      for (const [rawId, val] of Object.entries(parsed.drafts as Record<string, unknown>)) {
        if (typeof val === "string") {
          drafts[resolveSubTemplateId(rawId)] = val;
        }
      }
    }

    // Migrate v1 customTemplates
    if (parsed.customTemplates && typeof parsed.customTemplates === "object") {
      for (const [rawId, rawTpl] of Object.entries(parsed.customTemplates as Record<string, unknown>)) {
        if (rawTpl && typeof rawTpl === "object") {
          const resolvedId = resolveSubTemplateId(rawId);
          const base = getSubTemplate(resolvedId).defaultStyle;
          styleOverrides[resolvedId] = mergeStyleOverride(base, rawTpl as Record<string, unknown>);
        }
      }
    }

    // Migrate v2 styleOverrides
    if (parsed.styleOverrides && typeof parsed.styleOverrides === "object") {
      for (const [rawId, rawStyle] of Object.entries(parsed.styleOverrides as Record<string, unknown>)) {
        if (rawStyle && typeof rawStyle === "object") {
          const resolvedId = resolveSubTemplateId(rawId);
          const base = getSubTemplate(resolvedId).defaultStyle;
          styleOverrides[resolvedId] = mergeStyleOverride(base, rawStyle as Record<string, unknown>);
        }
      }
    }

    const activeSubTemplateId = resolveSubTemplateId(
      typeof parsed.activeSubTemplateId === "string"
        ? parsed.activeSubTemplateId
        : Object.keys(drafts)[0] ?? Object.keys(styleOverrides)[0],
    );
    const activeSub = getSubTemplate(activeSubTemplateId);
    const v1Draft = drafts[activeSubTemplateId];
    const content =
      typeof parsed.content === "string"
        ? parsed.content
        : typeof v1Draft === "string"
          ? v1Draft
          : activeSub.sampleMarkdown;

    const hasEditedContent =
      typeof parsed.hasEditedContent === "boolean"
        ? parsed.hasEditedContent
        : typeof v1Draft === "string" && v1Draft !== activeSub.sampleMarkdown;

    const appliedSnapshots: Record<string, AppliedComponentSnapshot> = {};
    if (parsed.appliedSnapshots && typeof parsed.appliedSnapshots === "object") {
      for (const [key, rawSnap] of Object.entries(parsed.appliedSnapshots as Record<string, unknown>)) {
        const validated = validateAppliedSnapshot(rawSnap);
        if (validated) {
          appliedSnapshots[key] = validated;
        }
      }
    }

    let activeLibraryTemplate: AppliedLibraryTemplateMeta | null = null;
    if (parsed.activeLibraryTemplate && typeof parsed.activeLibraryTemplate === "object") {
      const tpl = parsed.activeLibraryTemplate as Record<string, unknown>;
      if (typeof tpl.name === "string" && tpl.style && typeof tpl.style === "object") {
        activeLibraryTemplate = {
          itemId: typeof tpl.itemId === "string" ? tpl.itemId : null,
          name: tpl.name.slice(0, 80),
          version: typeof tpl.version === "number" && tpl.version >= 1 ? Math.floor(tpl.version) : 1,
          style: mergeStyleOverride(activeSub.defaultStyle, tpl.style as Record<string, unknown>),
          sampleMarkdown:
            typeof tpl.sampleMarkdown === "string" ? tpl.sampleMarkdown : activeSub.sampleMarkdown,
        };
      }
    }

    return {
      version: 2,
      activeSubTemplateId,
      content,
      hasEditedContent,
      styleOverrides,
      drafts,
      appliedSnapshots,
      activeLibraryTemplate,
    };
  } catch {
    return fallback;
  }
}
