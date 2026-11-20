import {
  FONT_FAMILY_STACK,
  normalizeRuns,
  plainToRuns,
  runsToPlainText,
  type FontFamilyChoice,
  type TextRun,
} from "./structured";
import type { TemplateStyleConfig } from "./types";

export type LibraryScopeType = "personal" | "team";
export type LibraryItemKind = "template" | "asset";
export type LibraryAssetCategory =
  | "template"
  | "card"
  | "divider"
  | "image-border"
  | "heading-border";

export type TeamMemberRole = "owner" | "editor" | "member";

export const LIBRARY_CATEGORY_LABELS: Record<LibraryAssetCategory, string> = {
  template: "整篇模板",
  "heading-border": "标题边框",
  card: "图文卡片",
  "image-border": "图片边框",
  divider: "分割线",
};

export type BorderSidesKind = "all" | "left" | "bottom" | "top-bottom" | "left-top" | "top-right" | "top" | "right";

export interface ComponentBoxStyle {
  width?: string;
  height?: string;
  minHeight?: string;
  position?: "relative" | "absolute";
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
  zIndex?: number;
  rotation?: number;
  flipX?: boolean;
  flipY?: boolean;
  opacity?: number;
  /** 父容器为横向排列时的相对列宽权重（1 ~ 12） */
  widthFlex?: number;
  intrinsicWidth?: boolean;
  alignSelf?: "auto" | "center" | "flex-start" | "flex-end" | "stretch";
  marginAutoX?: boolean;
  marginLeft?: number;
  marginRight?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  marginTop?: number;
  marginBottom?: number;
  backgroundColor?: string;
  backgroundGradient?: string;
  boxShadow?: string;
  borderWidth?: number;
  borderStyle?: "none" | "solid" | "dashed" | "dotted" | "double";
  borderSides?: BorderSidesKind;
  borderColor?: string;
  borderTopDecl?: string;
  borderRightDecl?: string;
  borderBottomDecl?: string;
  borderLeftDecl?: string;
  borderRadius?: number;
  cornerRadii?: string;
  objectFit?: "contain" | "cover" | "fill";
}

export interface ComponentTypographyStyle {
  fontSize?: number;
  fontWeight?: 400 | 600 | 700;
  fontFamily?: FontFamilyChoice;
  lineHeight?: number;
  letterSpacing?: number;
  textAlign?: "left" | "center" | "right" | "justify";
  color?: string;
}

export type ComponentImageRef =
  | { kind: "library-media"; mediaId: string }
  | { kind: "project-asset"; assetId: string }
  | { kind: "inline-data"; dataUrl: string }
  | { kind: "inline-svg"; svgDataUrl: string }
  | { kind: "missing-external"; originalUrl: string }
  | { kind: "placeholder" };

export type ComponentNode =
  | {
      id: string;
      type: "container";
      label?: string;
      direction: "vertical" | "horizontal";
      gap: number;
      alignItems?: "stretch" | "center" | "flex-start" | "flex-end";
      justifyContent?: "flex-start" | "center" | "flex-end" | "space-between";
      boxStyle: ComponentBoxStyle;
      children: ComponentNode[];
    }
  | {
      id: string;
      type: "heading";
      level: 1 | 2 | 3;
      runs: TextRun[];
      slotRole?: "content";
      textStyle: ComponentTypographyStyle;
      boxStyle: ComponentBoxStyle;
    }
  | {
      id: string;
      type: "text";
      runs: TextRun[];
      slotRole?: "content" | "caption";
      textStyle: ComponentTypographyStyle;
      boxStyle: ComponentBoxStyle;
    }
  | {
      id: string;
      type: "image";
      imageRef: ComponentImageRef;
      alt: string;
      caption?: string;
      slotRole?: "image";
      maxWidthPercent?: number;
      boxStyle: ComponentBoxStyle;
    }
  | {
      id: string;
      type: "divider";
      dividerStyle: "solid" | "dashed" | "dotted" | "short";
      widthPercent: number;
      thickness: number;
      color: string;
      boxStyle: ComponentBoxStyle;
    };

/**
 * 应用到稿件内的组件快照（与原库条目解耦，刷新后恢复，且支持对比版本号提示手动重新应用）
 */
export interface AppliedComponentSnapshot {
  snapshotId: string;
  sourceItemId: string | null;
  sourceScopeType: LibraryScopeType | "local";
  sourceTeamId?: string | null;
  sourceVersion: number;
  name: string;
  category: LibraryAssetCategory;
  rootNode: ComponentNode;
  appliedAt: string;
}

export interface PortableEmbeddedMedia {
  mediaId: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  filename?: string;
  base64Data: string;
}

export interface PortableLibraryExportV1 {
  schemaVersion: "new-paint-library-v1";
  exportedAt: string;
  item: {
    name: string;
    kind: LibraryItemKind;
    category: LibraryAssetCategory;
    summary: string;
    rootNode: ComponentNode;
    templateStyle?: TemplateStyleConfig | null;
    sampleMarkdown?: string | null;
  };
  portableMedia: PortableEmbeddedMedia[];
}

export interface LibraryItemRecord {
  id: string;
  scopeType: LibraryScopeType;
  ownerId: string | null;
  teamId: string | null;
  teamName?: string | null;
  kind: LibraryItemKind;
  category: LibraryAssetCategory;
  name: string;
  summary: string;
  rootNode: ComponentNode;
  templateStyle: TemplateStyleConfig | null;
  sampleMarkdown: string | null;
  archived: boolean;
  version: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  canEdit?: boolean;
}

const SAFE_COLOR_RE =
  /^(#[0-9a-fA-F]{3,8}|rgba?\(\s*\d{1,3}%?\s*(?:,\s*|\s+)\d{1,3}%?\s*(?:,\s*|\s+)\d{1,3}%?(?:\s*(?:,|\/)\s*\d*\.?\d+%?)?\s*\)|hsla?\(\s*-?\d*\.?\d+(?:deg|rad|turn)?\s*(?:,\s*|\s+)\d*\.?\d+%\s*(?:,\s*|\s+)\d*\.?\d+%(?:\s*(?:,|\/)\s*\d*\.?\d+%?)?\s*\)|transparent|currentColor|white|black|inherit)$/i;
const SAFE_DATA_IMAGE_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=\s]+$/i;
const SAFE_DATA_SVG_RE = /^data:image\/svg\+xml;base64,[A-Za-z0-9+/=\s]+$/i;
const SAFE_ID_RE = /^[a-zA-Z0-9_-]{1,80}$/;

function clampNum(val: unknown, min: number, max: number, fallback?: number): number | undefined {
  if (typeof val !== "number" || !Number.isFinite(val)) return fallback;
  return Math.min(max, Math.max(min, Math.round(val * 100) / 100));
}

export function sanitizeCssColor(val: unknown, fallback?: string): string | undefined {
  if (typeof val !== "string") return fallback;
  const trimmed = val.trim();
  if (!trimmed) return fallback;
  return SAFE_COLOR_RE.test(trimmed) ? trimmed : fallback;
}

export function sanitizeCssGradient(val: unknown): string | undefined {
  if (typeof val !== "string") return undefined;
  const trimmed = val.trim();
  if (!trimmed || trimmed.length > 600) return undefined;
  if (/url\s*\(|expression\s*\(|javascript:|vbscript:|[;<>\\]/i.test(trimmed)) return undefined;
  if (!/^(?:repeating-)?(?:linear|radial)-gradient\([\s\S]+\)$/i.test(trimmed)) return undefined;
  if (!/^[-a-zA-Z0-9#(),.%\s/]+$/.test(trimmed)) return undefined;
  return trimmed;
}

export function sanitizeBoxShadow(val: unknown): string | undefined {
  if (typeof val !== "string") return undefined;
  const trimmed = val.trim();
  if (!trimmed || trimmed === "none" || trimmed.length > 400) return undefined;
  if (/url\s*\(|expression\s*\(|javascript:|vbscript:|[;<>\\]/i.test(trimmed)) return undefined;
  if (!/^[-a-zA-Z0-9#(),.%\s/]+$/.test(trimmed)) return undefined;
  return trimmed;
}

function sanitizeBorderSideDecl(val: unknown): string | undefined {
  if (typeof val !== "string") return undefined;
  const trimmed = val.trim();
  if (!trimmed || trimmed.length > 120) return undefined;
  const m = /^(\d{1,2}(?:\.\d{1,2})?)px\s+(solid|dashed|dotted|double)\s+(.+)$/i.exec(trimmed);
  if (!m) return undefined;
  const w = Number(m[1]);
  const c = sanitizeCssColor(m[3]);
  if (!Number.isFinite(w) || w <= 0 || w > 24 || !c) return undefined;
  return `${w}px ${m[2].toLowerCase()} ${c}`;
}

function cleanId(val: unknown, fallbackPrefix = "node"): string {
  if (typeof val === "string" && SAFE_ID_RE.test(val.trim())) {
    return val.trim();
  }
  return `${fallbackPrefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function cssLength(value: unknown, allowNegative: boolean): string | undefined {
  if (typeof value !== "string") return undefined;
  const match = /^(-?\d{1,4}(?:\.\d{1,3})?)(px|%)$/.exec(value);
  if (!match) return undefined;
  const number = Number(match[1]);
  const limit = match[2] === "%" ? 100 : 1600;
  return number <= limit && number >= (allowNegative ? -limit : 0)
    ? `${number}${match[2]}`
    : undefined;
}

export function sanitizeBoxStyle(raw: unknown): ComponentBoxStyle {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: ComponentBoxStyle = {};
  for (const key of ["width", "height", "minHeight", "top", "right", "bottom", "left"] as const) {
    const length = cssLength(obj[key], key !== "width" && key !== "height" && key !== "minHeight");
    if (length !== undefined) out[key] = length;
  }
  if (obj.position === "absolute" || obj.position === "relative") out.position = obj.position;
  const zIndex = clampNum(obj.zIndex, 0, 20);
  if (zIndex !== undefined) out.zIndex = Math.round(zIndex);
  const rotation = clampNum(obj.rotation, -360, 360);
  if (rotation !== undefined) out.rotation = rotation;
  if (obj.flipX === true) out.flipX = true;
  if (obj.flipY === true) out.flipY = true;
  const opacity = clampNum(obj.opacity, 0, 1);
  if (opacity !== undefined && opacity < 1) out.opacity = opacity;
  if (obj.intrinsicWidth === true) out.intrinsicWidth = true;
  if (
    obj.alignSelf === "auto"
    || obj.alignSelf === "center"
    || obj.alignSelf === "flex-start"
    || obj.alignSelf === "flex-end"
    || obj.alignSelf === "stretch"
  ) {
    out.alignSelf = obj.alignSelf;
  }
  if (obj.marginAutoX === true) out.marginAutoX = true;
  const ml = clampNum(obj.marginLeft, -240, 240);
  const mr = clampNum(obj.marginRight, -240, 240);
  if (ml !== undefined) out.marginLeft = ml;
  if (mr !== undefined) out.marginRight = mr;
  const wf = clampNum(obj.widthFlex, 1, 12);
  if (wf !== undefined) out.widthFlex = wf;
  const pt = clampNum(obj.paddingTop, 0, 160);
  if (pt !== undefined) out.paddingTop = pt;
  const pr = clampNum(obj.paddingRight, 0, 160);
  if (pr !== undefined) out.paddingRight = pr;
  const pb = clampNum(obj.paddingBottom, 0, 160);
  if (pb !== undefined) out.paddingBottom = pb;
  const pl = clampNum(obj.paddingLeft, 0, 160);
  if (pl !== undefined) out.paddingLeft = pl;
  const mt = clampNum(obj.marginTop, -240, 240);
  if (mt !== undefined) out.marginTop = mt;
  const mb = clampNum(obj.marginBottom, -240, 240);
  if (mb !== undefined) out.marginBottom = mb;

  const bg = sanitizeCssColor(obj.backgroundColor);
  if (bg) out.backgroundColor = bg;
  const grad = sanitizeCssGradient(obj.backgroundGradient);
  if (grad) out.backgroundGradient = grad;
  const shadow = sanitizeBoxShadow(obj.boxShadow);
  if (shadow) out.boxShadow = shadow;

  const bw = clampNum(obj.borderWidth, 0, 24);
  if (bw !== undefined) out.borderWidth = bw;

  if (
    obj.borderStyle === "none"
    || obj.borderStyle === "solid"
    || obj.borderStyle === "dashed"
    || obj.borderStyle === "dotted"
    || obj.borderStyle === "double"
  ) {
    out.borderStyle = obj.borderStyle;
  }
  if (
    obj.borderSides === "all"
    || obj.borderSides === "left"
    || obj.borderSides === "bottom"
    || obj.borderSides === "top-bottom"
    || obj.borderSides === "left-top"
    || obj.borderSides === "top-right"
    || obj.borderSides === "top"
    || obj.borderSides === "right"
  ) {
    out.borderSides = obj.borderSides;
  }
  const bc = sanitizeCssColor(obj.borderColor);
  if (bc) out.borderColor = bc;

  const btDecl = sanitizeBorderSideDecl(obj.borderTopDecl);
  if (btDecl) out.borderTopDecl = btDecl;
  const brDecl = sanitizeBorderSideDecl(obj.borderRightDecl);
  if (brDecl) out.borderRightDecl = brDecl;
  const bbDecl = sanitizeBorderSideDecl(obj.borderBottomDecl);
  if (bbDecl) out.borderBottomDecl = bbDecl;
  const blDecl = sanitizeBorderSideDecl(obj.borderLeftDecl);
  if (blDecl) out.borderLeftDecl = blDecl;

  if (typeof obj.cornerRadii === "string") {
    const tokens = obj.cornerRadii.trim().split(/\s+/);
    const radii = tokens.map((value) => cssLength(value === "0" ? "0px" : value, false));
    if (radii.length <= 4 && radii.every((value) => value !== undefined)) {
      out.cornerRadii = radii.join(" ");
    }
  }
  const br = clampNum(obj.borderRadius, 0, 999);
  if (br !== undefined) out.borderRadius = br;

  if (obj.objectFit === "contain" || obj.objectFit === "cover" || obj.objectFit === "fill") {
    out.objectFit = obj.objectFit;
  }

  return out;
}

export function sanitizeTypographyStyle(raw: unknown): ComponentTypographyStyle {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: ComponentTypographyStyle = {};
  const fs = clampNum(obj.fontSize, 11, 36);
  if (fs !== undefined) out.fontSize = fs;
  if (obj.fontWeight === 400 || obj.fontWeight === 600 || obj.fontWeight === 700) {
    out.fontWeight = obj.fontWeight;
  }
  if (
    obj.fontFamily === "default"
    || obj.fontFamily === "sans"
    || obj.fontFamily === "serif"
    || obj.fontFamily === "mono"
  ) {
    out.fontFamily = obj.fontFamily;
  }
  const lh = clampNum(obj.lineHeight, 1.1, 2.6);
  if (lh !== undefined) out.lineHeight = lh;
  const ls = clampNum(obj.letterSpacing, 0, 6);
  if (ls !== undefined) out.letterSpacing = ls;
  if (
    obj.textAlign === "left"
    || obj.textAlign === "center"
    || obj.textAlign === "right"
    || obj.textAlign === "justify"
  ) {
    out.textAlign = obj.textAlign;
  }
  const col = sanitizeCssColor(obj.color);
  if (col) out.color = col;
  return out;
}

function sanitizeRuns(raw: unknown, fallbackText = ""): TextRun[] {
  if (!Array.isArray(raw)) return plainToRuns(fallbackText);
  const runs: TextRun[] = [];
  for (const item of raw.slice(0, 60)) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    if (typeof r.text !== "string") continue;
    const text = r.text.slice(0, 4000);
    const rawStyle = (r.style && typeof r.style === "object" ? r.style : null) as Record<string, unknown> | null;
    if (!rawStyle) {
      runs.push({ text });
      continue;
    }
    const style: TextRun["style"] = {};
    const fs = clampNum(rawStyle.fontSize, 10, 42);
    if (fs !== undefined) style.fontSize = fs;
    if (rawStyle.fontFamily === "sans" || rawStyle.fontFamily === "serif" || rawStyle.fontFamily === "mono") {
      style.fontFamily = rawStyle.fontFamily;
    }
    if (typeof rawStyle.bold === "boolean") style.bold = rawStyle.bold;
    if (typeof rawStyle.italic === "boolean") style.italic = rawStyle.italic;
    const col = sanitizeCssColor(rawStyle.color);
    if (col && col !== "transparent") style.color = col;
    runs.push(Object.keys(style).length > 0 ? { text, style } : { text });
  }
  return normalizeRuns(runs.length > 0 ? runs : plainToRuns(fallbackText));
}

function sanitizeImageRef(raw: unknown): ComponentImageRef {
  if (!raw || typeof raw !== "object") return { kind: "placeholder" };
  const obj = raw as Record<string, unknown>;
  if (obj.kind === "library-media" && typeof obj.mediaId === "string" && SAFE_ID_RE.test(obj.mediaId)) {
    return { kind: "library-media", mediaId: obj.mediaId };
  }
  if (obj.kind === "project-asset" && typeof obj.assetId === "string" && SAFE_ID_RE.test(obj.assetId)) {
    return { kind: "project-asset", assetId: obj.assetId };
  }
  if (
    obj.kind === "inline-data"
    && typeof obj.dataUrl === "string"
    && obj.dataUrl.length <= 4_200_000
    && SAFE_DATA_IMAGE_RE.test(obj.dataUrl)
  ) {
    return { kind: "inline-data", dataUrl: obj.dataUrl.replace(/\s+/g, "") };
  }
  if (
    obj.kind === "inline-svg"
    && typeof obj.svgDataUrl === "string"
    && obj.svgDataUrl.length <= 500_000
    && SAFE_DATA_SVG_RE.test(obj.svgDataUrl)
  ) {
    return { kind: "inline-svg", svgDataUrl: obj.svgDataUrl.replace(/\s+/g, "") };
  }
  if (obj.kind === "missing-external" && typeof obj.originalUrl === "string") {
    return { kind: "missing-external", originalUrl: obj.originalUrl.slice(0, 500) };
  }
  return { kind: "placeholder" };
}

/**
 * 服务端与客户端共用的受控组件树白名单校验器（限制深度 <= 6，总节点 <= 120）
 */
export function validateComponentNode(raw: unknown): ComponentNode {
  let nodeCount = 0;

  function walk(input: unknown, depth: number): ComponentNode {
    nodeCount += 1;
    if (nodeCount > 120 || depth > 6 || !input || typeof input !== "object") {
      return {
        id: cleanId(undefined, "txt"),
        type: "text",
        runs: plainToRuns("内容节点"),
        textStyle: {},
        boxStyle: {},
      };
    }

    const obj = input as Record<string, unknown>;
    const id = cleanId(obj.id);
    const boxStyle = sanitizeBoxStyle(obj.boxStyle);

    if (obj.type === "container") {
      const direction = obj.direction === "horizontal" ? "horizontal" : "vertical";
      const gap = clampNum(obj.gap, 0, 40, 10) ?? 10;
      const alignItems =
        obj.alignItems === "center" || obj.alignItems === "flex-start" || obj.alignItems === "flex-end" || obj.alignItems === "stretch"
          ? obj.alignItems
          : "stretch";
      const justifyContent =
        obj.justifyContent === "center" || obj.justifyContent === "flex-start"
          || obj.justifyContent === "flex-end" || obj.justifyContent === "space-between"
          ? obj.justifyContent
          : undefined;
      const rawChildren = Array.isArray(obj.children) ? obj.children.slice(0, 24) : [];
      const children = rawChildren.map((child) => walk(child, depth + 1));
      return {
        id,
        type: "container",
        label: typeof obj.label === "string" ? obj.label.trim().slice(0, 40) : undefined,
        direction,
        gap,
        alignItems,
        boxStyle,
        justifyContent,
        children,
      };
    }

    if (obj.type === "heading") {
      const level = obj.level === 1 || obj.level === 2 || obj.level === 3 ? obj.level : 2;
      return {
        id,
        type: "heading",
        level,
        runs: sanitizeRuns(obj.runs, "章节标题"),
        slotRole: obj.slotRole === "content" ? "content" : undefined,
        textStyle: sanitizeTypographyStyle(obj.textStyle),
        boxStyle,
      };
    }

    if (obj.type === "image") {
      return {
        id,
        type: "image",
        imageRef: sanitizeImageRef(obj.imageRef),
        alt: typeof obj.alt === "string" ? obj.alt.trim().slice(0, 160) : "图文配图",
        caption: typeof obj.caption === "string" ? obj.caption.trim().slice(0, 200) : undefined,
        slotRole: obj.slotRole === "image" ? "image" : undefined,
        maxWidthPercent: clampNum(obj.maxWidthPercent, 20, 100, 100),
        boxStyle,
      };
    }

    if (obj.type === "divider") {
      const dividerStyle =
        obj.dividerStyle === "dashed"
        || obj.dividerStyle === "dotted"
        || obj.dividerStyle === "short"
        || obj.dividerStyle === "solid"
          ? obj.dividerStyle
          : "solid";
      return {
        id,
        type: "divider",
        dividerStyle,
        widthPercent: clampNum(obj.widthPercent, 10, 100, 100) ?? 100,
        thickness: clampNum(obj.thickness, 1, 6, 1) ?? 1,
        color: sanitizeCssColor(obj.color, "#d4d4d4") ?? "#d4d4d4",
        boxStyle,
      };
    }

    return {
      id,
      type: "text",
      runs: sanitizeRuns(obj.runs, ""),
      slotRole: obj.slotRole === "content" || obj.slotRole === "caption" ? obj.slotRole : undefined,
      textStyle: sanitizeTypographyStyle(obj.textStyle),
      boxStyle,
    };
  }

  const validated = walk(raw, 0);
  if (validated.type === "container") return validated;
  return {
    id: cleanId(undefined, "root"),
    type: "container",
    label: "根容器",
    direction: "vertical",
    gap: 10,
    alignItems: "stretch",
    boxStyle: { marginTop: 12, marginBottom: 12 },
    children: [validated],
  };
}

export function validateAppliedSnapshot(raw: unknown): AppliedComponentSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const cat = obj.category;
  const validCategory: LibraryAssetCategory =
    cat === "template"
    || cat === "card"
    || cat === "divider"
    || cat === "image-border"
    || cat === "heading-border"
      ? cat
      : "card";
  return {
    snapshotId: cleanId(obj.snapshotId, "snap"),
    sourceItemId: typeof obj.sourceItemId === "string" && obj.sourceItemId ? obj.sourceItemId : null,
    sourceScopeType:
      obj.sourceScopeType === "personal" || obj.sourceScopeType === "team" ? obj.sourceScopeType : "local",
    sourceTeamId: typeof obj.sourceTeamId === "string" ? obj.sourceTeamId : null,
    sourceVersion: typeof obj.sourceVersion === "number" && obj.sourceVersion >= 1 ? Math.floor(obj.sourceVersion) : 1,
    name: typeof obj.name === "string" && obj.name.trim() ? obj.name.trim().slice(0, 80) : "导入组件",
    category: validCategory,
    rootNode: validateComponentNode(obj.rootNode),
    appliedAt: typeof obj.appliedAt === "string" ? obj.appliedAt : new Date().toISOString(),
  };
}

/**
 * 深拷贝组件子树并重新生成节点 ID
 */
export function cloneComponentNode(node: ComponentNode, regenerateIds = true): ComponentNode {
  const nextId = regenerateIds ? cleanId(undefined, node.type.slice(0, 3)) : node.id;
  if (node.type === "container") {
    return {
      ...node,
      id: nextId,
      boxStyle: { ...node.boxStyle },
      children: node.children.map((c) => cloneComponentNode(c, regenerateIds)),
    };
  }
  if (node.type === "heading" || node.type === "text") {
    return {
      ...node,
      id: nextId,
      runs: node.runs.map((r) => ({ text: r.text, ...(r.style ? { style: { ...r.style } } : {}) })),
      textStyle: { ...node.textStyle },
      boxStyle: { ...node.boxStyle },
    };
  }
  if (node.type === "image") {
    return {
      ...node,
      id: nextId,
      imageRef: { ...node.imageRef },
      boxStyle: { ...node.boxStyle },
    };
  }
  return {
    ...node,
    id: nextId,
    boxStyle: { ...node.boxStyle },
  };
}

export function createDefaultNode(kind: ComponentNode["type"]): ComponentNode {
  const id = cleanId(undefined, kind.slice(0, 3));
  switch (kind) {
    case "container":
      return {
        id,
        type: "container",
        label: "双栏容器",
        direction: "horizontal",
        gap: 12,
        alignItems: "stretch",
        boxStyle: {
          paddingTop: 12,
          paddingRight: 12,
          paddingBottom: 12,
          paddingLeft: 12,
          backgroundColor: "#f7f7f6",
          borderRadius: 10,
        },
        children: [
          {
            id: cleanId(undefined, "txt"),
            type: "text",
            runs: plainToRuns("左栏内容"),
            textStyle: { fontSize: 14, lineHeight: 1.7 },
            boxStyle: { widthFlex: 6 },
          },
          {
            id: cleanId(undefined, "txt"),
            type: "text",
            runs: plainToRuns("右栏内容"),
            textStyle: { fontSize: 14, lineHeight: 1.7 },
            boxStyle: { widthFlex: 6 },
          },
        ],
      };
    case "heading":
      return {
        id,
        type: "heading",
        level: 2,
        runs: plainToRuns("重点小标题"),
        slotRole: "content",
        textStyle: { fontSize: 18, fontWeight: 700 },
        boxStyle: {
          borderWidth: 4,
          borderStyle: "solid",
          borderSides: "left",
          borderColor: "#164b3e",
          paddingLeft: 10,
        },
      };
    case "image":
      return {
        id,
        type: "image",
        imageRef: { kind: "placeholder" },
        alt: "配图",
        slotRole: "image",
        maxWidthPercent: 100,
        boxStyle: { borderRadius: 10 },
      };
    case "divider":
      return {
        id,
        type: "divider",
        dividerStyle: "solid",
        widthPercent: 100,
        thickness: 1,
        color: "#d4d4d4",
        boxStyle: { marginTop: 12, marginBottom: 12 },
      };
    default:
      return {
        id,
        type: "text",
        runs: plainToRuns("在此编辑段落文字"),
        slotRole: "content",
        textStyle: { fontSize: 15, lineHeight: 1.8 },
        boxStyle: {},
      };
  }
}

export function createBlankComponentByCategory(category: LibraryAssetCategory): ComponentNode {
  if (category === "heading-border") {
    return {
      id: cleanId(undefined, "root"),
      type: "container",
      label: "标题边框容器",
      direction: "horizontal",
      gap: 10,
      alignItems: "center",
      boxStyle: {
        marginTop: 18,
        marginBottom: 12,
        paddingTop: 8,
        paddingRight: 14,
        paddingBottom: 8,
        paddingLeft: 14,
        backgroundColor: "#f3f6f4",
        borderWidth: 4,
        borderStyle: "solid",
        borderSides: "left",
        borderColor: "#164b3e",
        borderRadius: 8,
      },
      children: [
        {
          id: cleanId(undefined, "hdg"),
          type: "heading",
          level: 2,
          runs: plainToRuns("在此输入章节标题"),
          slotRole: "content",
          textStyle: { fontSize: 18, fontWeight: 700, color: "#164b3e" },
          boxStyle: { widthFlex: 12 },
        },
      ],
    };
  }
  if (category === "image-border") {
    return {
      id: cleanId(undefined, "root"),
      type: "container",
      label: "图片边框容器",
      direction: "vertical",
      gap: 8,
      alignItems: "center",
      boxStyle: {
        marginTop: 16,
        marginBottom: 16,
        paddingTop: 10,
        paddingRight: 10,
        paddingBottom: 12,
        paddingLeft: 10,
        backgroundColor: "#f7f6f3",
        borderWidth: 1,
        borderStyle: "solid",
        borderSides: "all",
        borderColor: "#dedad2",
        borderRadius: 12,
      },
      children: [
        {
          id: cleanId(undefined, "img"),
          type: "image",
          imageRef: { kind: "placeholder" },
          alt: "示例配图",
          caption: "配图图注说明",
          slotRole: "image",
          maxWidthPercent: 100,
          boxStyle: { borderRadius: 8 },
        },
      ],
    };
  }
  if (category === "divider") {
    return {
      id: cleanId(undefined, "root"),
      type: "container",
      label: "分割线容器",
      direction: "vertical",
      gap: 4,
      alignItems: "center",
      boxStyle: { marginTop: 20, marginBottom: 20 },
      children: [
        {
          id: cleanId(undefined, "div"),
          type: "divider",
          dividerStyle: "short",
          widthPercent: 36,
          thickness: 2,
          color: "#164b3e",
          boxStyle: {},
        },
      ],
    };
  }
  return {
    id: cleanId(undefined, "root"),
    type: "container",
    label: "图文卡片容器",
    direction: "vertical",
    gap: 10,
    alignItems: "stretch",
    boxStyle: {
      marginTop: 16,
      marginBottom: 16,
      paddingTop: 16,
      paddingRight: 18,
      paddingBottom: 16,
      paddingLeft: 18,
      backgroundColor: "#f7f6f3",
      borderWidth: 1,
      borderStyle: "solid",
      borderSides: "all",
      borderColor: "#e2ded5",
      borderRadius: 12,
    },
    children: [
      {
        id: cleanId(undefined, "hdg"),
        type: "heading",
        level: 3,
        runs: plainToRuns("核心要点提示"),
        textStyle: { fontSize: 16, fontWeight: 700, color: "#164b3e" },
        boxStyle: {},
      },
      {
        id: cleanId(undefined, "txt"),
        type: "text",
        runs: plainToRuns("在这里编写卡片正文内容，可在右侧实时查看公众号排版效果。"),
        slotRole: "content",
        textStyle: { fontSize: 15, lineHeight: 1.8, color: "#262624" },
        boxStyle: {},
      },
    ],
  };
}

export function findNodeById(root: ComponentNode, targetId: string): ComponentNode | null {
  if (root.id === targetId) return root;
  if (root.type === "container") {
    for (const child of root.children) {
      const found = findNodeById(child, targetId);
      if (found) return found;
    }
  }
  return null;
}

export function updateNodeById(
  root: ComponentNode,
  targetId: string,
  updater: (node: ComponentNode) => ComponentNode,
): ComponentNode {
  if (root.id === targetId) {
    return updater(root);
  }
  if (root.type === "container") {
    return {
      ...root,
      children: root.children.map((child) => updateNodeById(child, targetId, updater)),
    };
  }
  return root;
}

export function insertChildNode(
  root: ComponentNode,
  parentOrTargetId: string,
  newNode: ComponentNode,
): ComponentNode {
  if (root.id === parentOrTargetId && root.type === "container") {
    return { ...root, children: [...root.children, newNode] };
  }
  if (root.type === "container") {
    const directIdx = root.children.findIndex((c) => c.id === parentOrTargetId);
    if (directIdx !== -1 && root.children[directIdx].type !== "container") {
      const next = [...root.children];
      next.splice(directIdx + 1, 0, newNode);
      return { ...root, children: next };
    }
    return {
      ...root,
      children: root.children.map((c) => insertChildNode(c, parentOrTargetId, newNode)),
    };
  }
  return root;
}

export function removeNodeById(root: ComponentNode, targetId: string): ComponentNode {
  if (root.id === targetId || root.type !== "container") return root;
  const filtered = root.children
    .filter((c) => c.id !== targetId)
    .map((c) => removeNodeById(c, targetId));
  return {
    ...root,
    children:
      filtered.length > 0
        ? filtered
        : [
            {
              id: cleanId(undefined, "txt"),
              type: "text",
              runs: plainToRuns("空容器占位文字"),
              textStyle: { fontSize: 14 },
              boxStyle: {},
            },
          ],
  };
}

export function duplicateNodeById(root: ComponentNode, targetId: string): {
  nextRoot: ComponentNode;
  duplicatedId: string | null;
} {
  let duplicatedId: string | null = null;
  function walk(node: ComponentNode): ComponentNode {
    if (node.type !== "container") return node;
    const idx = node.children.findIndex((c) => c.id === targetId);
    if (idx !== -1) {
      const copy = cloneComponentNode(node.children[idx], true);
      duplicatedId = copy.id;
      const next = [...node.children];
      next.splice(idx + 1, 0, copy);
      return { ...node, children: next };
    }
    return { ...node, children: node.children.map(walk) };
  }
  return { nextRoot: walk(root), duplicatedId };
}

/**
 * 容器内同级排序（支持按钮上下移动及拖拽放置到指定索引）
 */
export function reorderSiblingNode(
  root: ComponentNode,
  targetId: string,
  toIndexOrDelta: { kind: "delta"; delta: -1 | 1 } | { kind: "index"; toIndex: number },
): ComponentNode {
  if (root.type !== "container") return root;
  const idx = root.children.findIndex((c) => c.id === targetId);
  if (idx !== -1) {
    const nextIndex =
      toIndexOrDelta.kind === "delta"
        ? idx + toIndexOrDelta.delta
        : Math.max(0, Math.min(root.children.length - 1, toIndexOrDelta.toIndex));
    if (nextIndex < 0 || nextIndex >= root.children.length || nextIndex === idx) return root;
    const next = [...root.children];
    const [moved] = next.splice(idx, 1);
    next.splice(nextIndex, 0, moved);
    return { ...root, children: next };
  }
  return {
    ...root,
    children: root.children.map((c) => reorderSiblingNode(c, targetId, toIndexOrDelta)),
  };
}

export function collectLibraryMediaIds(node: ComponentNode): string[] {
  const set = new Set<string>();
  function walk(n: ComponentNode) {
    if (n.type === "image" && n.imageRef.kind === "library-media") {
      set.add(n.imageRef.mediaId);
    } else if (n.type === "container") {
      n.children.forEach(walk);
    }
  }
  walk(node);
  return Array.from(set);
}

export function collectProjectAssetIdsFromTree(node: ComponentNode): string[] {
  const set = new Set<string>();
  function walk(n: ComponentNode) {
    if (n.type === "image" && n.imageRef.kind === "project-asset") {
      set.add(n.imageRef.assetId);
    } else if (n.type === "container") {
      n.children.forEach(walk);
    }
  }
  walk(node);
  return Array.from(set);
}

export function collectPendingExternalImages(
  node: ComponentNode,
): Array<{ nodeId: string; originalUrl: string; alt: string }> {
  const list: Array<{ nodeId: string; originalUrl: string; alt: string }> = [];
  function walk(n: ComponentNode) {
    if (n.type === "image" && n.imageRef.kind === "missing-external") {
      list.push({ nodeId: n.id, originalUrl: n.imageRef.originalUrl, alt: n.alt });
    } else if (n.type === "container") {
      n.children.forEach(walk);
    }
  }
  walk(node);
  return list;
}

export function remapComponentImages(
  node: ComponentNode,
  mapper: (ref: ComponentImageRef, nodeId: string) => ComponentImageRef,
): ComponentNode {
  if (node.type === "image") {
    return { ...node, imageRef: mapper(node.imageRef, node.id) };
  }
  if (node.type === "container") {
    return { ...node, children: node.children.map((c) => remapComponentImages(c, mapper)) };
  }
  return node;
}

export function extractPlainTextFromTree(node: ComponentNode): string {
  const parts: string[] = [];
  function walk(n: ComponentNode) {
    if (n.type === "heading" || n.type === "text") {
      const txt = runsToPlainText(n.runs).trim();
      if (txt) parts.push(txt);
    } else if (n.type === "container") {
      n.children.forEach(walk);
    } else if (n.type === "divider") {
      parts.push("---");
    }
  }
  walk(node);
  return parts.join("\n");
}

function findPrimaryContentNodeId(root: ComponentNode): string | null {
  let explicitId: string | null = null;
  let firstTextId: string | null = null;
  function walk(n: ComponentNode) {
    if (explicitId) return;
    if ((n.type === "heading" || n.type === "text") && n.slotRole === "content") {
      explicitId = n.id;
      return;
    }
    if ((n.type === "heading" || n.type === "text") && !firstTextId) {
      firstTextId = n.id;
    }
    if (n.type === "container") {
      n.children.forEach(walk);
    }
  }
  walk(root);
  return explicitId ?? firstTextId;
}

function findPrimaryImageNodeId(root: ComponentNode): string | null {
  let explicitId: string | null = null;
  let firstImgId: string | null = null;
  function walk(n: ComponentNode) {
    if (explicitId) return;
    if (n.type === "image" && n.slotRole === "image") {
      explicitId = n.id;
      return;
    }
    if (n.type === "image" && n.boxStyle.position !== "absolute" && !firstImgId) {
      firstImgId = n.id;
    }
    if (n.type === "container") {
      n.children.forEach(walk);
    }
  }
  walk(root);
  return explicitId ?? firstImgId;
}

function renderBoxCss(box: ComponentBoxStyle, inHorizontalParent: boolean): string {
  const css: string[] = ["box-sizing:border-box"];
  if (box.width) {
    css.push(`width:${box.width}`, "max-width:100%");
  } else if (!inHorizontalParent && box.intrinsicWidth && box.position !== "absolute") {
    css.push("width:fit-content", "max-width:100%");
  }
  if (box.height) css.push(`height:${box.height}`);
  if (box.minHeight) css.push(`min-height:${box.minHeight}`);
  if (box.position) {
    css.push(`position:${box.position}`);
    for (const side of ["top", "right", "bottom", "left"] as const) {
      if (box[side]) css.push(`${side}:${box[side]}`);
    }
    if (box.zIndex !== undefined) css.push(`z-index:${box.zIndex}`);
  }

  const transforms: string[] = [];
  if (box.rotation) transforms.push(`rotate(${box.rotation}deg)`);
  if (box.flipX) transforms.push("scaleX(-1)");
  if (box.flipY) transforms.push("scaleY(-1)");
  if (transforms.length > 0) css.push(`transform:${transforms.join(" ")}`);

  if (box.opacity !== undefined && box.opacity < 1) {
    css.push(`opacity:${box.opacity}`);
  }
  if (box.alignSelf) {
    css.push(`align-self:${box.alignSelf}`);
  }

  if (inHorizontalParent && box.position !== "absolute") {
    const flex = box.widthFlex ?? 1;
    css.push(
      box.intrinsicWidth
        ? "flex:0 0 auto"
        : box.width && box.widthFlex === undefined
          ? "flex:0 1 auto"
          : `flex:${flex} ${flex} 0%`,
      "min-width:0",
    );
  }

  if (box.marginAutoX) {
    css.push("margin-left:auto", "margin-right:auto");
  } else {
    if (box.marginLeft !== undefined) css.push(`margin-left:${box.marginLeft}px`);
    if (box.marginRight !== undefined) css.push(`margin-right:${box.marginRight}px`);
  }
  if (box.marginTop !== undefined) css.push(`margin-top:${box.marginTop}px`);
  if (box.marginBottom !== undefined) css.push(`margin-bottom:${box.marginBottom}px`);
  if (box.paddingTop !== undefined) css.push(`padding-top:${box.paddingTop}px`);
  if (box.paddingRight !== undefined) css.push(`padding-right:${box.paddingRight}px`);
  if (box.paddingBottom !== undefined) css.push(`padding-bottom:${box.paddingBottom}px`);
  if (box.paddingLeft !== undefined) css.push(`padding-left:${box.paddingLeft}px`);

  if (box.backgroundColor) css.push(`background-color:${box.backgroundColor}`);
  if (box.backgroundGradient) css.push(`background-image:${box.backgroundGradient}`);
  if (box.boxShadow) css.push(`box-shadow:${box.boxShadow}`);

  const hasPerSideOverride = Boolean(
    box.borderTopDecl || box.borderRightDecl || box.borderBottomDecl || box.borderLeftDecl,
  );
  const bw = box.borderWidth ?? 0;
  const bs = box.borderStyle ?? "solid";
  const bc = box.borderColor ?? "#d4d4d4";

  if (bw > 0 && bs !== "none") {
    const side = box.borderSides ?? "all";
    const decl = `${bw}px ${bs} ${bc}`;
    if (side === "left") {
      css.push(`border-left:${decl}`);
    } else if (side === "bottom") {
      css.push(`border-bottom:${decl}`);
    } else if (side === "top" || side === "right") {
      css.push(`border-${side}:${decl}`);
    } else if (side === "top-right") {
      css.push(`border-top:${decl}`, `border-right:${decl}`);
    } else if (side === "top-bottom") {
      css.push(`border-top:${decl}`, `border-bottom:${decl}`);
    } else if (side === "left-top") {
      css.push(`border-left:${decl}`, `border-top:${decl}`);
    } else {
      css.push(`border:${decl}`);
    }
  } else if (hasPerSideOverride) {
    if (box.borderTopDecl) css.push(`border-top:${box.borderTopDecl}`);
    if (box.borderRightDecl) css.push(`border-right:${box.borderRightDecl}`);
    if (box.borderBottomDecl) css.push(`border-bottom:${box.borderBottomDecl}`);
    if (box.borderLeftDecl) css.push(`border-left:${box.borderLeftDecl}`);
  }

  if (box.cornerRadii) {
    css.push(`border-radius:${box.cornerRadii}`);
  } else if (box.borderRadius !== undefined) {
    css.push(`border-radius:${box.borderRadius}px`);
  }
  return css.join(";");
}

function renderNodeRunsHtml(
  runs: TextRun[],
  fallbackColor: string,
  escapeFn: (s: string) => string,
): string {
  return runs
    .map((r) => {
      if (!r.text) return "";
      const escaped = escapeFn(r.text).replaceAll("\n", "<br />");
      const css: string[] = [];
      if (r.style?.fontSize) css.push(`font-size:${r.style.fontSize}px`);
      if (r.style?.fontFamily && FONT_FAMILY_STACK[r.style.fontFamily]) {
        css.push(`font-family:${FONT_FAMILY_STACK[r.style.fontFamily]}`);
      }
      if (r.style?.bold !== undefined) css.push(`font-weight:${r.style.bold ? 700 : 400}`);
      if (r.style?.italic !== undefined) css.push(`font-style:${r.style.italic ? "italic" : "normal"}`);
      if (r.style?.color) css.push(`color:${sanitizeCssColor(r.style.color, fallbackColor) ?? fallbackColor}`);
      return css.length > 0 ? `<span style="${css.join(";")};">${escaped}</span>` : escaped;
    })
    .join("");
}

export interface ComponentRenderSlotOverride {
  /** 套用到标题/段落块时保留的原块内联富文本 HTML */
  contentHtml?: string;
  /** 套用到图片块时保留的原图地址与说明 */
  imageSrc?: string;
  imageAlt?: string;
  imageCaption?: string;
  /** 导出到公众号剪贴板时设为 true（不输出未替换占位框） */
  forExport?: boolean;
  /** 编辑器内高亮当前选中节点 */
  selectedNodeId?: string | null;
}

/**
 * 预览与复制共用的受控组件树微信内联 HTML 渲染器
 */
export function renderComponentTreeHtml(
  rootNode: ComponentNode,
  baseStyle: TemplateStyleConfig,
  escapeFn: (raw: string) => string,
  resolveImageUrl: (ref: ComponentImageRef) => string,
  slotOverride?: ComponentRenderSlotOverride,
): string {
  const primaryContentId = slotOverride?.contentHtml ? findPrimaryContentNodeId(rootNode) : null;
  const primaryImageId = slotOverride?.imageSrc ? findPrimaryImageNodeId(rootNode) : null;

  function renderNode(node: ComponentNode, inHorizontalParent: boolean): string {
    const selectedRing =
      slotOverride?.selectedNodeId && slotOverride.selectedNodeId === node.id
        ? ";outline:2px solid #164b3e;outline-offset:2px"
        : "";
    const dataAttr = slotOverride?.selectedNodeId !== undefined
      ? ` data-tree-node-id="${escapeFn(node.id)}"`
      : "";
    const boxCss = renderBoxCss(node.boxStyle, inHorizontalParent) + selectedRing;

    if (node.type === "container") {
      const containerCss: string[] = [boxCss];
      if (node === rootNode) containerCss.push("isolation:isolate");
      if (!node.boxStyle.position && node.children.some((child) => child.boxStyle.position === "absolute")) {
        containerCss.push("position:relative");
      }
      if (node.justifyContent) containerCss.push(`justify-content:${node.justifyContent}`);
      if (node.direction === "horizontal") {
        containerCss.push(
          "display:flex",
          "flex-direction:row",
          `gap:${node.gap}px`,
          `align-items:${node.alignItems ?? "stretch"}`,
        );
      } else {
        containerCss.push("display:flex", "flex-direction:column", `gap:${node.gap}px`);
        if (node.alignItems && node.alignItems !== "stretch") containerCss.push(`align-items:${node.alignItems}`);
      }
      const childrenHtml = node.children
        .map((c) => renderNode(c, node.direction === "horizontal"))
        .join("");
      return `<section${dataAttr} style="${containerCss.filter(Boolean).join(";")};">${childrenHtml}</section>`;
    }

    if (node.type === "heading" || node.type === "text") {
      const isHeading = node.type === "heading";
      const tag = isHeading ? `h${node.level}` : "p";
      const t = node.textStyle;
      const defaultSize = isHeading
        ? node.level === 1
          ? baseStyle.heading.fontSize + 4
          : node.level === 3
            ? Math.max(14, baseStyle.heading.fontSize - 2)
            : baseStyle.heading.fontSize
        : baseStyle.paragraph.fontSize;
      const defaultColor = isHeading ? baseStyle.colors.primaryColor : baseStyle.colors.textColor;
      const color = t.color ?? defaultColor;
      const fontCss: string[] = [
        "margin:0",
        boxCss,
        `font-size:${t.fontSize ?? defaultSize}px`,
        `font-weight:${t.fontWeight ?? (isHeading ? baseStyle.heading.fontWeight : 400)}`,
        `line-height:${t.lineHeight ?? (isHeading ? 1.45 : baseStyle.paragraph.lineHeight)}`,
        `letter-spacing:${t.letterSpacing ?? baseStyle.paragraph.letterSpacing}px`,
        `text-align:${t.textAlign ?? (isHeading ? baseStyle.heading.align : baseStyle.paragraph.textAlign)}`,
        `color:${color}`,
      ];
      if (t.fontFamily && t.fontFamily !== "default" && FONT_FAMILY_STACK[t.fontFamily]) {
        fontCss.push(`font-family:${FONT_FAMILY_STACK[t.fontFamily]}`);
      }
      const inner =
        primaryContentId === node.id && slotOverride?.contentHtml !== undefined
          ? slotOverride.contentHtml
          : renderNodeRunsHtml(node.runs, color, escapeFn);
      return `<${tag}${dataAttr} style="${fontCss.filter(Boolean).join(";")};">${inner}</${tag}>`;
    }

    if (node.type === "image") {
      const useSlot = primaryImageId === node.id && Boolean(slotOverride?.imageSrc);
      let resolvedSrc = useSlot ? (slotOverride?.imageSrc ?? "") : resolveImageUrl(node.imageRef);
      if (!resolvedSrc && !useSlot) {
        if (node.imageRef.kind === "inline-svg") {
          resolvedSrc = escapeFn(node.imageRef.svgDataUrl);
        } else if (
          node.imageRef.kind === "missing-external"
          && !slotOverride?.forExport
          && /^https?:\/\//i.test(node.imageRef.originalUrl.trim())
        ) {
          resolvedSrc = escapeFn(node.imageRef.originalUrl.trim());
        }
      }
      const altText = escapeFn(useSlot ? (slotOverride?.imageAlt ?? node.alt) : node.alt);
      const captionText = useSlot ? slotOverride?.imageCaption : node.caption;
      const maxW = node.maxWidthPercent ?? 100;
      const radius = node.boxStyle.borderRadius ?? 0;

      if (!resolvedSrc) {
        if (slotOverride?.forExport) return "";
        const hint =
          node.imageRef.kind === "missing-external"
            ? "外部图片待上传替换"
            : "配图插槽（套用到图片块时自动填入原图，或点击更换图片）";
        if (node.imageRef.kind === "missing-external" && (node.boxStyle.width || node.boxStyle.position === "absolute")) {
          return `<section${dataAttr} title="${escapeFn(hint)}" style="${boxCss};min-height:20px;text-align:center;background:#f5f4f0;border:1px dashed #c7c2b8;border-radius:4px;color:#6e6a63;font-size:12px;line-height:18px;">▧</section>`;
        }
        return `<section${dataAttr} style="${boxCss};padding:18px 12px;text-align:center;background:#f5f4f0;border:1px dashed #c7c2b8;border-radius:${Math.max(8, radius)}px;color:#6e6a63;font-size:12px;line-height:1.5;">${escapeFn(hint)}</section>`;
      }

      const captionHtml = captionText
        ? `<p style="margin:6px 0 0 0;font-size:12px;line-height:1.5;color:#78756f;text-align:center;">${escapeFn(captionText)}</p>`
        : "";
      const fitCss = node.boxStyle.objectFit ? `object-fit:${node.boxStyle.objectFit};` : "";
      const referrerAttr =
        node.imageRef.kind === "missing-external" && !useSlot ? ' referrerpolicy="no-referrer"' : "";
      return `<section${dataAttr} style="${boxCss};text-align:center;line-height:0;"><img src="${resolvedSrc}" alt="${altText}"${referrerAttr} style="display:inline-block;width:${maxW}%;max-width:100%;height:${node.boxStyle.height ? "100%" : "auto"};${fitCss}border-radius:${node.boxStyle.cornerRadii ?? `${radius}px`};vertical-align:middle;" />${captionHtml}</section>`;
    }

    const lineW = node.dividerStyle === "short" ? Math.min(node.widthPercent, 36) : node.widthPercent;
    const borderType =
      node.dividerStyle === "dashed"
        ? "dashed"
        : node.dividerStyle === "dotted"
          ? "dotted"
          : "solid";
    return `<section${dataAttr} style="${boxCss};text-align:center;"><div style="width:${lineW}%;margin:0 auto;border-top:${node.thickness}px ${borderType} ${node.color};"></div></section>`;
  }

  return renderNode(rootNode, false);
}
