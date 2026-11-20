import { cloneStyleConfig, TYPOGRAPHY_SUBTEMPLATES } from "./catalog";
import {
  collectPendingExternalImages,
  createBlankComponentByCategory,
  sanitizeBoxShadow,
  sanitizeBoxStyle,
  sanitizeCssColor,
  sanitizeCssGradient,
  validateComponentNode,
  type BorderSidesKind,
  type ComponentBoxStyle,
  type ComponentImageRef,
  type ComponentNode,
  type ComponentTypographyStyle,
  type LibraryAssetCategory,
  type LibraryItemKind,
  type PortableEmbeddedMedia,
  type PortableLibraryExportV1,
} from "./custom-tree";
import { sanitizeStyle } from "./renderer";
import { normalizeRuns, runsToPlainText, type TextRun, type TextRunStyle } from "./structured";
import type { HeadingStyleKind, TemplateStyleConfig } from "./types";

export type IgnoredItemKind =
  | "script"
  | "event-attribute"
  | "dangerous-url"
  | "embedded-page"
  | "stylesheet"
  | "svg-animation"
  | "unsupported-element"
  | "unsupported-style";

export interface ImportIgnoredEntry {
  kind: IgnoredItemKind;
  detail: string;
}

export interface PendingExternalImageEntry {
  nodeId: string;
  originalUrl: string;
  alt: string;
}

export interface ParsedImportResult {
  sourceFormat: "html" | "json";
  suggestedName: string;
  kind: LibraryItemKind;
  suggestedCategory: LibraryAssetCategory;
  rootNode: ComponentNode;
  templateStyle: TemplateStyleConfig;
  sampleMarkdown: string;
  ignoredItems: ImportIgnoredEntry[];
  pendingExternalImages: PendingExternalImageEntry[];
  portableMedia: PortableEmbeddedMedia[];
}

interface HtmlElementAst {
  kind: "element";
  tag: string;
  attrs: Record<string, string>;
  children: HtmlAstNode[];
}

interface HtmlTextAst {
  kind: "text";
  text: string;
}

type HtmlAstNode = HtmlElementAst | HtmlTextAst;

const VOID_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

const EMBEDDED_OR_FORM_TAGS = new Set([
  "iframe",
  "object",
  "embed",
  "applet",
  "frame",
  "frameset",
  "form",
  "input",
  "button",
  "select",
  "textarea",
  "video",
  "audio",
  "canvas",
  "foreignobject",
]);

const SVG_ANIMATION_TAGS = new Set([
  "animate",
  "animatetransform",
  "animatemotion",
  "animatecolor",
  "set",
  "mpath",
]);

const SAFE_SVG_TAGS = new Set([
  "svg",
  "g",
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "defs",
  "lineargradient",
  "radialgradient",
  "stop",
  "clippath",
]);

const SAFE_SVG_ATTR_MAP: Record<string, string> = {
  viewbox: "viewBox",
  preserveaspectratio: "preserveAspectRatio",
  gradientunits: "gradientUnits",
  gradienttransform: "gradientTransform",
  clippathunits: "clipPathUnits",
  spreadmethod: "spreadMethod",
  width: "width",
  height: "height",
  x: "x",
  y: "y",
  x1: "x1",
  y1: "y1",
  x2: "x2",
  y2: "y2",
  cx: "cx",
  cy: "cy",
  r: "r",
  rx: "rx",
  ry: "ry",
  d: "d",
  points: "points",
  fill: "fill",
  "fill-opacity": "fill-opacity",
  "fill-rule": "fill-rule",
  stroke: "stroke",
  "stroke-width": "stroke-width",
  "stroke-linecap": "stroke-linecap",
  "stroke-linejoin": "stroke-linejoin",
  "stroke-dasharray": "stroke-dasharray",
  "stroke-dashoffset": "stroke-dashoffset",
  "stroke-miterlimit": "stroke-miterlimit",
  "stroke-opacity": "stroke-opacity",
  opacity: "opacity",
  transform: "transform",
  offset: "offset",
  "stop-color": "stop-color",
  "stop-opacity": "stop-opacity",
  id: "id",
  "clip-path": "clip-path",
};

const ALLOWED_STRUCTURAL_TAGS = new Set([
  "section",
  "div",
  "article",
  "main",
  "header",
  "footer",
  "aside",
  "blockquote",
  "figure",
  "figcaption",
  "ul",
  "ol",
  "li",
  "table",
  "thead",
  "tbody",
  "tr",
  "td",
  "th",
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "span",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "a",
  "br",
  "hr",
  "img",
  ...SAFE_SVG_TAGS,
]);

const ALLOWED_STYLE_PROPS = new Set([
  "display",
  "flex-direction",
  "flex-flow",
  "flex",
  "flex-grow",
  "flex-shrink",
  "flex-basis",
  "align-self",
  "width",
  "min-width",
  "max-width",
  "height",
  "min-height",
  "position",
  "top",
  "right",
  "bottom",
  "left",
  "z-index",
  "background",
  "background-color",
  "background-image",
  "background-size",
  "background-repeat",
  "background-position",
  "box-shadow",
  "opacity",
  "transform",
  "gap",
  "column-gap",
  "row-gap",
  "align-items",
  "justify-content",
  "padding",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "margin",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "color",
  "border",
  "border-top",
  "border-right",
  "border-bottom",
  "border-left",
  "border-width",
  "border-top-width",
  "border-right-width",
  "border-bottom-width",
  "border-left-width",
  "border-style",
  "border-top-style",
  "border-right-style",
  "border-bottom-style",
  "border-left-style",
  "border-color",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "border-radius",
  "font-size",
  "font-weight",
  "font-style",
  "font-family",
  "line-height",
  "letter-spacing",
  "text-align",
  "box-sizing",
  "vertical-align",
  "object-fit",
]);

function decodeHtmlEntities(raw: string): string {
  return raw
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
    })
    .replace(/&#(\d+);/g, (_m, dec) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
    });
}

function escapeXmlAttr(raw: string): string {
  return raw
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function encodeUtf8Base64(text: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(text, "utf8").toString("base64");
  }
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function makeId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function pushUniqueIgnored(list: ImportIgnoredEntry[], kind: IgnoredItemKind, detail: string) {
  if (list.length >= 60) return;
  if (!list.some((item) => item.kind === kind && item.detail === detail)) {
    list.push({ kind, detail });
  }
}

function isDangerousUrlValue(val: string): boolean {
  const normalized = val.replace(/[\u0000-\u0020]+/g, "").toLowerCase();
  return (
    normalized.startsWith("javascript:")
    || normalized.startsWith("vbscript:")
    || normalized.startsWith("data:text/html")
    || normalized.startsWith("data:application/")
    || normalized.startsWith("data:image/svg")
  );
}

function parseAttributes(attrSource: string, tag: string, ignored: ImportIgnoredEntry[]): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrRegex = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match: RegExpExecArray | null;
  while ((match = attrRegex.exec(attrSource)) !== null) {
    const name = match[1].toLowerCase();
    const rawVal = decodeHtmlEntities(match[2] ?? match[3] ?? match[4] ?? "");
    if (name.startsWith("on")) {
      pushUniqueIgnored(ignored, "event-attribute", `已拦截并移除 <${tag}> 上的事件属性 ${name}`);
      continue;
    }
    if (
      (name === "href" || name === "src" || name === "data-src" || name === "xlink:href" || name === "action")
      && isDangerousUrlValue(rawVal)
    ) {
      pushUniqueIgnored(ignored, "dangerous-url", `已拦截 <${tag}> 中的危险地址（${name}=${rawVal.slice(0, 32)}）`);
      continue;
    }
    if (name === "srcdoc") {
      pushUniqueIgnored(ignored, "embedded-page", `已拦截 <${tag}> 的内嵌页面属性 srcdoc`);
      continue;
    }
    attrs[name] = rawVal;
  }
  return attrs;
}

/**
 * 纯函数 HTML 词法与语法扫描器（绝不在浏览器或服务端执行不受信任脚本）
 */
function tokenizeAndParseHtml(rawHtml: string, ignored: ImportIgnoredEntry[]): HtmlAstNode[] {
  let cleaned = rawHtml
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!DOCTYPE[^>]*>/gi, "");

  cleaned = cleaned.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, () => {
    pushUniqueIgnored(ignored, "script", "已拦截并移除 <script> 脚本块");
    return "";
  });
  cleaned = cleaned.replace(/<script\b[^>]*\/?>/gi, () => {
    pushUniqueIgnored(ignored, "script", "已拦截并移除未闭合 <script> 标签");
    return "";
  });

  cleaned = cleaned.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_full, cssBody: string) => {
    if (/@import/i.test(cssBody)) {
      pushUniqueIgnored(ignored, "stylesheet", "已拦截样式表中的外部 @import 引用");
    }
    pushUniqueIgnored(ignored, "stylesheet", "已忽略 <style> 样式表（仅保留白名单内联样式）");
    return "";
  });

  const root: HtmlElementAst = { kind: "element", tag: "root", attrs: {}, children: [] };
  const stack: HtmlElementAst[] = [root];
  const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9:-]*)(\s[^>]*)?\s*\/?>/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let skippedSubtreeTag: string | null = null;
  let skippedDepth = 0;

  while ((match = tagRegex.exec(cleaned)) !== null) {
    const fullTag = match[0];
    const rawTag = match[1].toLowerCase();
    const tag = rawTag.includes(":") ? rawTag.split(":").pop()! : rawTag;
    const attrPart = match[2] ?? "";
    const isClosing = fullTag.startsWith("</");
    const isSelfClosing = fullTag.endsWith("/>") || VOID_TAGS.has(tag);

    if (!skippedSubtreeTag && match.index > lastIndex) {
      const textChunk = decodeHtmlEntities(cleaned.slice(lastIndex, match.index));
      if (textChunk) {
        stack[stack.length - 1].children.push({ kind: "text", text: textChunk });
      }
    }
    lastIndex = tagRegex.lastIndex;

    if (skippedSubtreeTag) {
      if (SVG_ANIMATION_TAGS.has(tag) && !isClosing) {
        pushUniqueIgnored(ignored, "svg-animation", `已拦截导入的 SVG 动画标签 <${tag}>`);
      }
      if (tag === skippedSubtreeTag) {
        if (isClosing) {
          skippedDepth -= 1;
          if (skippedDepth <= 0) {
            skippedSubtreeTag = null;
            skippedDepth = 0;
          }
        } else if (!isSelfClosing) {
          skippedDepth += 1;
        }
      }
      continue;
    }

    if (tag === "html" || tag === "body" || tag === "meta" || tag === "title" || tag === "head") {
      if (tag === "title" && !isClosing && !isSelfClosing) {
        skippedSubtreeTag = "title";
        skippedDepth = 1;
      }
      continue;
    }

    if (tag === "link") {
      const linkAttrs = parseAttributes(attrPart, tag, ignored);
      if ((linkAttrs.rel ?? "").toLowerCase().includes("stylesheet") || linkAttrs.href) {
        pushUniqueIgnored(
          ignored,
          "stylesheet",
          `已忽略第三方样式表或外部资源链接 <link href="${(linkAttrs.href ?? "").slice(0, 40)}">`,
        );
      }
      continue;
    }

    if (SVG_ANIMATION_TAGS.has(tag)) {
      pushUniqueIgnored(ignored, "svg-animation", `已拦截导入的 SVG 动画标签 <${tag}>`);
      if (!isClosing && !isSelfClosing) {
        skippedSubtreeTag = tag;
        skippedDepth = 1;
      }
      continue;
    }

    if (EMBEDDED_OR_FORM_TAGS.has(tag)) {
      if (!isClosing) {
        parseAttributes(attrPart, tag, ignored);
        pushUniqueIgnored(ignored, "embedded-page", `已拦截并忽略嵌入/表单元素 <${tag}>`);
        if (!isSelfClosing) {
          skippedSubtreeTag = tag;
          skippedDepth = 1;
        }
      }
      continue;
    }

    const insideSvg = stack.some((s) => s.tag === "svg");
    if (insideSvg && !SAFE_SVG_TAGS.has(tag)) {
      if (!isClosing && !isSelfClosing) {
        skippedSubtreeTag = tag;
        skippedDepth = 1;
      }
      continue;
    }

    if (!ALLOWED_STRUCTURAL_TAGS.has(tag)) {
      if (!isClosing) {
        parseAttributes(attrPart, tag, ignored);
        pushUniqueIgnored(ignored, "unsupported-element", `已忽略非受控标签 <${tag}>（保留其内部可读文本）`);
      }
      continue;
    }

    if (isClosing) {
      for (let i = stack.length - 1; i >= 1; i -= 1) {
        if (stack[i].tag === tag) {
          stack.length = i;
          break;
        }
      }
      continue;
    }

    const attrs = parseAttributes(attrPart, tag, ignored);
    const el: HtmlElementAst = { kind: "element", tag, attrs, children: [] };
    stack[stack.length - 1].children.push(el);
    if (!isSelfClosing) {
      stack.push(el);
    }
  }

  if (!skippedSubtreeTag && lastIndex < cleaned.length) {
    const tail = decodeHtmlEntities(cleaned.slice(lastIndex));
    if (tail) {
      root.children.push({ kind: "text", text: tail });
    }
  }

  return root.children;
}

/**
 * 将静态 SVG AST 清洗并序列化为只读安全图形（剔除脚本、事件、外链与动画）
 */
function serializeSafeStaticSvg(svgEl: HtmlElementAst): string | null {
  let shapeCount = 0;

  function renderSvgNode(el: HtmlElementAst, depth: number): string {
    if (depth > 8 || !SAFE_SVG_TAGS.has(el.tag)) return "";
    if (
      el.tag === "path"
      || el.tag === "rect"
      || el.tag === "circle"
      || el.tag === "ellipse"
      || el.tag === "line"
      || el.tag === "polyline"
      || el.tag === "polygon"
    ) {
      shapeCount += 1;
    }

    const canonicalTag =
      el.tag === "lineargradient"
        ? "linearGradient"
        : el.tag === "radialgradient"
          ? "radialGradient"
          : el.tag === "clippath"
            ? "clipPath"
            : el.tag;

    const attrParts: string[] = [];
    if (canonicalTag === "svg") {
      attrParts.push('xmlns="http://www.w3.org/2000/svg"');
    }

    for (const [rawKey, rawVal] of Object.entries(el.attrs)) {
      const mapped = SAFE_SVG_ATTR_MAP[rawKey];
      if (!mapped) continue;
      const val = rawVal.trim();
      if (!val || val.length > 8000) continue;
      if (/javascript:|vbscript:|expression\s*\(|data:/i.test(val)) continue;
      if (/url\s*\(/i.test(val) && !/^url\(\s*#[a-zA-Z0-9_-]+\s*\)$/i.test(val)) continue;
      attrParts.push(`${mapped}="${escapeXmlAttr(val)}"`);
    }

    // 保留 SVG 节点内联 style 中的安全填充与描边属性
    if (el.attrs.style) {
      const safeSvgCss: string[] = [];
      for (const decl of el.attrs.style.split(";")) {
        const idx = decl.indexOf(":");
        if (idx <= 0) continue;
        const p = decl.slice(0, idx).trim().toLowerCase();
        const v = decl.slice(idx + 1).trim();
        if (
          (p === "fill" || p === "stroke")
          && (v === "none" || sanitizeCssColor(v) || /^url\(\s*#[a-zA-Z0-9_-]+\s*\)$/i.test(v))
        ) {
          safeSvgCss.push(`${p}:${v}`);
        } else if (
          (p === "opacity" || p === "fill-opacity" || p === "stroke-opacity" || p === "stroke-width")
          && /^[0-9.]+(?:px)?$/.test(v)
        ) {
          safeSvgCss.push(`${p}:${v}`);
        }
      }
      if (safeSvgCss.length > 0) {
        attrParts.push(`style="${escapeXmlAttr(safeSvgCss.join(";"))}"`);
      }
    }

    const inner = el.children
      .filter((c): c is HtmlElementAst => c.kind === "element")
      .map((c) => renderSvgNode(c, depth + 1))
      .join("");

    return inner
      ? `<${canonicalTag} ${attrParts.join(" ")}>${inner}</${canonicalTag}>`
      : `<${canonicalTag} ${attrParts.join(" ")} />`;
  }

  const xml = renderSvgNode(svgEl, 0);
  if (!xml || shapeCount === 0) return null;
  return `data:image/svg+xml;base64,${encodeUtf8Base64(xml)}`;
}

function parseStyleMap(rawStyle: string | undefined, ignored: ImportIgnoredEntry[]): Record<string, string> {
  const map: Record<string, string> = {};
  if (!rawStyle) return map;
  const declarations = rawStyle.match(/(?:[^;()"']|\([^)]*\)|"[^"]*"|'[^']*')+/g) ?? [];
  for (const decl of declarations) {
    const colonIdx = decl.indexOf(":");
    if (colonIdx <= 0) continue;
    const prop = decl.slice(0, colonIdx).trim().toLowerCase();
    const val = decl.slice(colonIdx + 1).trim();
    if (!prop || !val) continue;

    if (/expression\s*\(|javascript:|vbscript:|data:text\/html/i.test(val)) {
      pushUniqueIgnored(ignored, "dangerous-url", `已拦截样式属性 ${prop} 中的危险表达式`);
      continue;
    }
    if (/url\s*\(/i.test(val) && prop !== "background-image" && prop !== "background") {
      pushUniqueIgnored(ignored, "unsupported-style", `已忽略样式背景资源 ${prop}: url(...)`);
      continue;
    }
    if (prop === "position" && !/^(?:static|relative|absolute)$/i.test(val)) {
      pushUniqueIgnored(ignored, "unsupported-style", `已忽略不受控的动态/定位样式 position: ${val.slice(0, 20)}`);
      continue;
    }
    if (!ALLOWED_STYLE_PROPS.has(prop)) {
      if (prop === "animation" || prop === "transition") {
        pushUniqueIgnored(ignored, "unsupported-style", `已忽略不受控的动态/定位样式 ${prop}`);
      }
      continue;
    }
    map[prop] = val;
  }
  return map;
}

function parsePx(val: string | undefined, emBasePx = 16): number | undefined {
  if (!val) return undefined;
  const trimmed = val.trim();
  if (trimmed === "0") return 0;
  const m = /^(-?\d+(?:\.\d+)?)\s*px$/i.exec(trimmed);
  if (m) return Math.round(Number(m[1]) * 100) / 100;
  const rem = /^(-?\d+(?:\.\d+)?)\s*rem$/i.exec(trimmed);
  if (rem) return Math.round(Number(rem[1]) * 16 * 100) / 100;
  const em = /^(-?\d+(?:\.\d+)?)\s*em$/i.exec(trimmed);
  if (em) return Math.round(Number(em[1]) * emBasePx * 100) / 100;
  const pt = /^(-?\d+(?:\.\d+)?)\s*pt$/i.exec(trimmed);
  if (pt) return Math.round(Number(pt[1]) * (4 / 3) * 100) / 100;
  const plain = /^(-?\d+(?:\.\d+)?)$/.exec(trimmed);
  if (plain) return Number(plain[1]);
  return undefined;
}

function parsePercent(val: string | undefined): number | undefined {
  if (!val) return undefined;
  const m = /^(-?\d+(?:\.\d+)?)\s*%$/.exec(val.trim());
  return m ? Number(m[1]) : undefined;
}

function importLength(value: string | undefined, emBasePx = 16): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim().toLowerCase();
  if (trimmed === "auto" || trimmed === "none" || trimmed === "initial") return undefined;
  const percent = parsePercent(value);
  if (percent !== undefined) return `${percent}%`;
  const pixels = parsePx(value, emBasePx);
  if (pixels !== undefined) return `${pixels}px`;
  return undefined;
}

/**
 * 拆分 CSS 1~4 值简写属性（保留 rgb(...) 等括号内的空格）
 */
function splitCssTokens(val: string | undefined): string[] {
  if (!val) return [];
  return val.trim().match(/[^\s()]+(?:\([^)]*\))?/g) ?? [];
}

function expandFourSideTokens(val: string | undefined): [string, string, string, string] | null {
  const tokens = splitCssTokens(val);
  if (tokens.length === 0) return null;
  if (tokens.length === 1) return [tokens[0], tokens[0], tokens[0], tokens[0]];
  if (tokens.length === 2) return [tokens[0], tokens[1], tokens[0], tokens[1]];
  if (tokens.length === 3) return [tokens[0], tokens[1], tokens[2], tokens[1]];
  return [tokens[0], tokens[1], tokens[2], tokens[3]];
}

interface ParsedBorderSide {
  width: number;
  style: "solid" | "dashed" | "dotted" | "double";
  color?: string;
}

function parseBorderShorthand(val: string | undefined, emBasePx = 16): ParsedBorderSide | null {
  if (!val || /\b(?:none|hidden)\b/i.test(val)) return null;
  const tokens = splitCssTokens(val);
  let width: number | undefined;
  let style: ParsedBorderSide["style"] = "solid";
  let color: string | undefined;

  for (const t of tokens) {
    const lower = t.toLowerCase();
    if (lower === "solid" || lower === "dashed" || lower === "dotted" || lower === "double") {
      style = lower;
      continue;
    }
    if (lower === "thin") {
      width = 1;
      continue;
    }
    if (lower === "medium") {
      width = 2;
      continue;
    }
    if (lower === "thick") {
      width = 4;
      continue;
    }
    const px = parsePx(t, emBasePx);
    if (px !== undefined && /[a-z]/i.test(t)) {
      width = px;
      continue;
    }
    const col = sanitizeCssColor(t);
    if (col) {
      color = col;
    }
  }

  if (width !== undefined && width <= 0) return null;
  return {
    width: Math.max(1, Math.min(24, Math.round((width ?? 1) * 10) / 10)),
    style,
    color,
  };
}

function extractGradientSubstring(raw: string | undefined): string | undefined {
  if (!raw || !/gradient\s*\(/i.test(raw)) return undefined;
  const startMatch = /(?:repeating-)?(?:linear|radial)-gradient\s*\(/i.exec(raw);
  if (!startMatch) return undefined;
  const startIdx = startMatch.index;
  let depth = 0;
  for (let i = startIdx; i < raw.length; i += 1) {
    if (raw[i] === "(") depth += 1;
    else if (raw[i] === ")") {
      depth -= 1;
      if (depth === 0) {
        return sanitizeCssGradient(raw.slice(startIdx, i + 1));
      }
    }
  }
  return undefined;
}

function extractBoxStyle(
  styles: Record<string, string>,
  emBasePx: number,
): ComponentBoxStyle {
  const box: ComponentBoxStyle = {};

  box.width = importLength(styles.width, emBasePx);
  box.height = importLength(styles.height, emBasePx);
  box.minHeight = importLength(styles["min-height"], emBasePx);

  if (styles.position === "relative" || styles.position === "absolute") {
    box.position = styles.position;
    for (const side of ["top", "right", "bottom", "left"] as const) {
      box[side] = importLength(styles[side], emBasePx);
    }
    if (/^-?\d+$/.test(styles["z-index"] ?? "")) box.zIndex = Number(styles["z-index"]);
  }

  if (styles.transform) {
    const tf = styles.transform;
    const rot = /rotate(?:Z)?\(\s*(-?\d+(?:\.\d+)?)deg\s*\)/i.exec(tf);
    if (rot) box.rotation = Number(rot[1]);
    if (/rotateY\(\s*180deg\s*\)|scaleX\(\s*-1\s*\)/i.test(tf)) box.flipX = true;
    if (/rotateX\(\s*180deg\s*\)|scaleY\(\s*-1\s*\)/i.test(tf)) box.flipY = true;
  }

  if (styles.opacity !== undefined) {
    const op = Number.parseFloat(styles.opacity);
    if (Number.isFinite(op) && op >= 0 && op < 1) box.opacity = op;
  }

  const disp = (styles.display ?? "").trim().toLowerCase();
  if (
    (disp === "inline-block" || disp === "inline-flex")
    && (!styles.width || styles.width.trim().toLowerCase() === "auto" || styles.width.includes("fit-content"))
  ) {
    box.intrinsicWidth = true;
  }

  const alignSelf = (styles["align-self"] ?? "").trim().toLowerCase();
  if (
    alignSelf === "center"
    || alignSelf === "flex-start"
    || alignSelf === "flex-end"
    || alignSelf === "stretch"
  ) {
    box.alignSelf = alignSelf;
  }

  if (styles.flex) {
    if (/^0(?:\s|$)/.test(styles.flex) || styles.flex === "none") box.intrinsicWidth = true;
    const flexNum = Number.parseFloat(styles.flex.trim().split(/\s+/)[0]);
    if (Number.isFinite(flexNum) && flexNum > 0) {
      box.widthFlex = Math.max(1, Math.min(12, Math.round(flexNum <= 1 ? flexNum * 12 : flexNum)));
    }
  } else if (styles["flex-grow"]) {
    const fg = Number.parseFloat(styles["flex-grow"]);
    if (fg === 0) box.intrinsicWidth = true;
    else if (Number.isFinite(fg) && fg > 0) box.widthFlex = Math.max(1, Math.min(12, Math.round(fg * 6)));
  }

  const padSides = expandFourSideTokens(styles.padding);
  if (padSides) {
    box.paddingTop = parsePx(padSides[0], emBasePx) ?? box.paddingTop;
    box.paddingRight = parsePx(padSides[1], emBasePx) ?? box.paddingRight;
    box.paddingBottom = parsePx(padSides[2], emBasePx) ?? box.paddingBottom;
    box.paddingLeft = parsePx(padSides[3], emBasePx) ?? box.paddingLeft;
  }
  const pt = parsePx(styles["padding-top"], emBasePx);
  if (pt !== undefined) box.paddingTop = pt;
  const pr = parsePx(styles["padding-right"], emBasePx);
  if (pr !== undefined) box.paddingRight = pr;
  const pb = parsePx(styles["padding-bottom"], emBasePx);
  if (pb !== undefined) box.paddingBottom = pb;
  const pl = parsePx(styles["padding-left"], emBasePx);
  if (pl !== undefined) box.paddingLeft = pl;

  const marSides = expandFourSideTokens(styles.margin);
  let mlRaw: string | undefined;
  let mrRaw: string | undefined;
  if (marSides) {
    box.marginTop = parsePx(marSides[0], emBasePx) ?? box.marginTop;
    mrRaw = marSides[1];
    box.marginBottom = parsePx(marSides[2], emBasePx) ?? box.marginBottom;
    mlRaw = marSides[3];
    if (mrRaw.toLowerCase() !== "auto") box.marginRight = parsePx(mrRaw, emBasePx);
    if (mlRaw.toLowerCase() !== "auto") box.marginLeft = parsePx(mlRaw, emBasePx);
  }
  if (styles["margin-left"]) mlRaw = styles["margin-left"].trim();
  if (styles["margin-right"]) mrRaw = styles["margin-right"].trim();
  if (mlRaw && mlRaw.toLowerCase() !== "auto") box.marginLeft = parsePx(mlRaw, emBasePx) ?? box.marginLeft;
  if (mrRaw && mrRaw.toLowerCase() !== "auto") box.marginRight = parsePx(mrRaw, emBasePx) ?? box.marginRight;
  if (mlRaw?.toLowerCase() === "auto" && mrRaw?.toLowerCase() === "auto") {
    box.marginAutoX = true;
  }
  const mt = parsePx(styles["margin-top"], emBasePx);
  if (mt !== undefined) box.marginTop = mt;
  const mb = parsePx(styles["margin-bottom"], emBasePx);
  if (mb !== undefined) box.marginBottom = mb;

  // 背景色与渐变同时提取（秀米大量标题底条使用 linear-gradient 半截高亮）
  const bgCombined = styles["background-image"]
    ? `${styles["background-color"] ?? ""} ${styles.background ?? ""} ${styles["background-image"]}`
    : `${styles["background-color"] ?? ""} ${styles.background ?? ""}`;

  const grad =
    extractGradientSubstring(styles["background-image"])
    ?? extractGradientSubstring(styles.background);
  if (grad) {
    box.backgroundGradient = grad;
  }

  const bgColorSource = styles["background-color"] ?? (!grad && !/url\s*\(/i.test(styles.background ?? "") ? styles.background : undefined);
  if (bgColorSource) {
    const colorMatch = /(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\))/i.exec(bgColorSource);
    const cleanBg = sanitizeCssColor(colorMatch ? colorMatch[1] : bgColorSource);
    if (cleanBg && cleanBg !== "transparent") {
      box.backgroundColor = cleanBg;
    }
  } else if (bgCombined) {
    // 若 background 同时写了颜色与 url(...)，仍保留底色
    const stripped = (styles.background ?? "").replace(/url\([^)]*\)/gi, "").replace(/(?:repeating-)?(?:linear|radial)-gradient\([\s\S]*\)/gi, "");
    const cm = /(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\))/i.exec(stripped);
    if (cm) {
      const cb = sanitizeCssColor(cm[1]);
      if (cb && cb !== "transparent") box.backgroundColor = cb;
    }
  }

  if (styles["box-shadow"]) {
    const cleanShadow = sanitizeBoxShadow(styles["box-shadow"]);
    if (cleanShadow) box.boxShadow = cleanShadow;
  }

  // 解析简写与四边独立边框属性（秀米常见 border-width: 0px 0px 4px; border-style: solid; border-color: ...）
  const sideMap: Record<"top" | "right" | "bottom" | "left", ParsedBorderSide | null> = {
    top: null,
    right: null,
    bottom: null,
    left: null,
  };

  const bAll = parseBorderShorthand(styles.border, emBasePx);
  if (bAll) {
    sideMap.top = { ...bAll };
    sideMap.right = { ...bAll };
    sideMap.bottom = { ...bAll };
    sideMap.left = { ...bAll };
  }

  const bwFour = expandFourSideTokens(styles["border-width"]);
  const bsFour = expandFourSideTokens(styles["border-style"]);
  const bcFour = expandFourSideTokens(styles["border-color"]);

  (["top", "right", "bottom", "left"] as const).forEach((side, idx) => {
    const shorthandSide = parseBorderShorthand(styles[`border-${side}`], emBasePx);
    if (shorthandSide) {
      sideMap[side] = shorthandSide;
    } else if (styles[`border-${side}`] && /\bnone\b/i.test(styles[`border-${side}`])) {
      sideMap[side] = null;
    }

    const wToken = styles[`border-${side}-width`] ?? bwFour?.[idx];
    const sToken = styles[`border-${side}-style`] ?? bsFour?.[idx];
    const cToken = styles[`border-${side}-color`] ?? bcFour?.[idx];

    if (wToken || sToken || cToken) {
      const sLower = (sToken ?? sideMap[side]?.style ?? (wToken ? "solid" : "none")).toLowerCase();
      if (sLower === "none" || sLower === "hidden") {
        sideMap[side] = null;
        return;
      }
      const wVal = wToken !== undefined ? parsePx(wToken, emBasePx) : sideMap[side]?.width ?? 1;
      if (wVal === undefined || wVal <= 0) {
        if (wToken !== undefined) sideMap[side] = null;
        return;
      }
      const validStyle: ParsedBorderSide["style"] =
        sLower === "dashed" || sLower === "dotted" || sLower === "double" ? sLower : "solid";
      const validCol = sanitizeCssColor(cToken) ?? sideMap[side]?.color;
      sideMap[side] = {
        width: Math.max(1, Math.min(24, Math.round(wVal * 10) / 10)),
        style: validStyle,
        color: validCol,
      };
    }
  });

  const activeSides = (["top", "right", "bottom", "left"] as const).filter((s) => sideMap[s] !== null);
  if (activeSides.length > 0) {
    const first = sideMap[activeSides[0]]!;
    const allUniform = activeSides.every(
      (s) =>
        sideMap[s]!.width === first.width
        && sideMap[s]!.style === first.style
        && (sideMap[s]!.color ?? "") === (first.color ?? ""),
    );

    let mappedSides: BorderSidesKind | null = null;
    if (allUniform) {
      const key = activeSides.join(",");
      if (key === "top,right,bottom,left") mappedSides = "all";
      else if (key === "left") mappedSides = "left";
      else if (key === "bottom") mappedSides = "bottom";
      else if (key === "top") mappedSides = "top";
      else if (key === "right") mappedSides = "right";
      else if (key === "top,bottom") mappedSides = "top-bottom";
      else if (key === "top,left") mappedSides = "left-top";
      else if (key === "top,right") mappedSides = "top-right";
    }

    if (mappedSides) {
      box.borderWidth = first.width;
      box.borderStyle = first.style;
      box.borderSides = mappedSides;
      if (first.color) box.borderColor = first.color;
    } else {
      for (const s of activeSides) {
        const info = sideMap[s]!;
        const decl = `${info.width}px ${info.style} ${info.color ?? "#d4d4d4"}`;
        if (s === "top") box.borderTopDecl = decl;
        if (s === "right") box.borderRightDecl = decl;
        if (s === "bottom") box.borderBottomDecl = decl;
        if (s === "left") box.borderLeftDecl = decl;
      }
    }
  }

  const br = parsePx(styles["border-radius"], emBasePx);
  if (br !== undefined && !styles["border-radius"]?.trim().includes(" ")) {
    box.borderRadius = Math.max(0, Math.min(999, br));
  } else if (styles["border-radius"]) {
    const radii = styles["border-radius"]
      .trim()
      .split(/\s+/)
      .map((r) => importLength(r, emBasePx));
    if (radii.every((radius) => radius !== undefined)) box.cornerRadii = radii.join(" ");
  }

  if (
    styles["object-fit"] === "contain"
    || styles["object-fit"] === "cover"
    || styles["object-fit"] === "fill"
  ) {
    box.objectFit = styles["object-fit"];
  }

  return sanitizeBoxStyle(box);
}

function resolveElementFontSizePx(rawFontSize: string | undefined, parentEmBasePx: number): number | undefined {
  if (!rawFontSize) return undefined;
  const pct = parsePercent(rawFontSize);
  if (pct !== undefined) {
    if (pct === 100) return undefined;
    return Math.max(11, Math.min(42, Math.round((parentEmBasePx * pct) / 100)));
  }
  const px = parsePx(rawFontSize, parentEmBasePx);
  if (px !== undefined && px >= 11 && px <= 42) {
    return Math.round(px);
  }
  return undefined;
}

function extractTypographyStyle(
  styles: Record<string, string>,
  parentEmBasePx: number,
): { typography: ComponentTypographyStyle; nextEmBasePx: number } {
  const out: ComponentTypographyStyle = {};
  const fs = resolveElementFontSizePx(styles["font-size"], parentEmBasePx);
  if (fs !== undefined) out.fontSize = fs;
  const emBase = fs ?? parentEmBasePx;

  const fw = styles["font-weight"];
  if (fw) {
    if (fw === "bold" || fw === "bolder" || Number(fw) >= 650) out.fontWeight = 700;
    else if (Number(fw) >= 550) out.fontWeight = 600;
    else if (fw === "normal" || fw === "lighter" || Number(fw) <= 450) out.fontWeight = 400;
  }
  const ff = (styles["font-family"] ?? "").toLowerCase();
  if (ff.includes("mono") || ff.includes("consolas") || ff.includes("menlo")) {
    out.fontFamily = "mono";
  } else if (ff.includes("song") || ff.includes("serif") || ff.includes("kai") || ff.includes("ming")) {
    out.fontFamily = "serif";
  }
  if (styles["line-height"]) {
    const rawLh = styles["line-height"].trim();
    const pxLh = parsePx(rawLh, emBase);
    if (pxLh && /(?:px|em|rem|pt)$/i.test(rawLh)) {
      out.lineHeight = Math.max(1.1, Math.min(2.6, Math.round((pxLh / emBase) * 100) / 100));
    } else {
      const pctLh = parsePercent(rawLh);
      if (pctLh !== undefined) {
        out.lineHeight = Math.max(1.1, Math.min(2.6, Math.round(pctLh) / 100));
      } else {
        const ratio = Number.parseFloat(rawLh);
        if (Number.isFinite(ratio) && ratio >= 1.0 && ratio <= 2.6) {
          out.lineHeight = Math.round(Math.max(1.1, ratio) * 100) / 100;
        }
      }
    }
  }
  const ls = parsePx(styles["letter-spacing"], emBase);
  if (ls !== undefined && ls >= 0 && ls <= 8) out.letterSpacing = Math.min(6, ls);
  const ta = styles["text-align"];
  if (ta === "left" || ta === "center" || ta === "right" || ta === "justify") {
    out.textAlign = ta;
  }
  const col = sanitizeCssColor(styles.color);
  if (col && col !== "transparent" && col !== "inherit") out.color = col;
  return { typography: out, nextEmBasePx: emBase };
}

function hasVisualBoxDecoration(box: ComponentBoxStyle): boolean {
  return Boolean(
    box.backgroundColor
      || box.backgroundGradient
      || box.boxShadow
      || (box.borderWidth && box.borderWidth > 0)
      || box.borderTopDecl
      || box.borderRightDecl
      || box.borderBottomDecl
      || box.borderLeftDecl
      || box.borderRadius
      || box.cornerRadii
      || box.width
      || box.height
      || box.minHeight
      || box.position
      || box.rotation
      || box.flipX
      || box.flipY
      || box.opacity !== undefined
      || box.intrinsicWidth
      || box.marginAutoX
      || box.marginLeft
      || box.marginRight
      || box.paddingTop
      || box.paddingRight
      || box.paddingBottom
      || box.paddingLeft,
  );
}

const BLOCK_LIKE_TAGS = new Set([
  "section",
  "div",
  "article",
  "main",
  "header",
  "footer",
  "aside",
  "blockquote",
  "figure",
  "figcaption",
  "ul",
  "ol",
  "li",
  "table",
  "thead",
  "tbody",
  "tr",
  "td",
  "th",
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "img",
  "svg",
]);

function requiresComponent(el: HtmlElementAst, ignored: ImportIgnoredEntry[], emBasePx = 16): boolean {
  if (BLOCK_LIKE_TAGS.has(el.tag)) return true;
  const styles = parseStyleMap(el.attrs.style, ignored);
  return (
    hasVisualBoxDecoration(extractBoxStyle(styles, emBasePx))
    || /url\s*\(/i.test(styles["background-image"] ?? styles.background ?? "")
    || ["flex", "inline-flex", "inline-block", "block"].includes(styles.display)
    || el.children.some((child) => child.kind === "element" && requiresComponent(child, ignored, emBasePx))
  );
}

function extractBackgroundImageInfo(
  styles: Record<string, string>,
  ignored: ImportIgnoredEntry[],
): { imageRef: ComponentImageRef; objectFit: "contain" | "cover" | "fill" } | null {
  const background = styles["background-image"] ?? styles.background ?? "";
  const match = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s)"']+))\s*\)/i.exec(background);
  if (!match) return null;
  const bgSize = (styles["background-size"] ?? "").toLowerCase();
  const objectFit: "contain" | "cover" | "fill" = bgSize.includes("cover")
    ? "cover"
    : bgSize === "100% 100%"
      ? "fill"
      : "contain";
  return {
    imageRef: classifyImageSrc(match[1] ?? match[2] ?? match[3], ignored),
    objectFit,
  };
}

function collectInlineRuns(
  nodes: HtmlAstNode[],
  inheritedStyle: TextRunStyle | undefined,
  ignored: ImportIgnoredEntry[],
  emBasePx = 16,
): TextRun[] {
  const runs: TextRun[] = [];
  for (const node of nodes) {
    if (node.kind === "text") {
      const normalized = node.text.replace(/[ \t\r\n]+/g, " ");
      if (normalized) {
        runs.push(inheritedStyle ? { text: normalized, style: { ...inheritedStyle } } : { text: normalized });
      }
      continue;
    }
    if (node.tag === "br") {
      runs.push({ text: "\n" });
      continue;
    }
    const styles = parseStyleMap(node.attrs.style, ignored);
    const nextStyle: TextRunStyle = { ...(inheritedStyle ?? {}) };
    if (
      node.tag === "strong"
      || node.tag === "b"
      || styles["font-weight"] === "bold"
      || Number(styles["font-weight"]) >= 600
    ) {
      nextStyle.bold = true;
    }
    if (node.tag === "em" || node.tag === "i" || styles["font-style"] === "italic") {
      nextStyle.italic = true;
    }
    const fs = resolveElementFontSizePx(styles["font-size"], emBasePx);
    if (fs && fs >= 11 && fs <= 36) nextStyle.fontSize = fs;
    const col = sanitizeCssColor(styles.color);
    if (col && col !== "transparent" && col !== "inherit") nextStyle.color = col;
    const ff = (styles["font-family"] ?? "").toLowerCase();
    if (ff.includes("mono")) nextStyle.fontFamily = "mono";
    else if (ff.includes("serif") || ff.includes("song")) nextStyle.fontFamily = "serif";

    const cleanStyle = Object.keys(nextStyle).length > 0 ? nextStyle : undefined;
    runs.push(...collectInlineRuns(node.children, cleanStyle, ignored, fs ?? emBasePx));
  }

  const merged = normalizeRuns(runs);
  if (merged.length > 0) {
    merged[0] = { ...merged[0], text: merged[0].text.replace(/^[ \t]+/, "") };
    const last = merged.length - 1;
    merged[last] = { ...merged[last], text: merged[last].text.replace(/[ \t]+$/, "") };
  }
  return normalizeRuns(merged);
}

function classifyImageSrc(rawSrc: string | undefined, ignored: ImportIgnoredEntry[]): ComponentImageRef {
  if (!rawSrc || !rawSrc.trim()) return { kind: "placeholder" };
  const src = rawSrc.trim();
  if (isDangerousUrlValue(src)) {
    pushUniqueIgnored(ignored, "dangerous-url", `已拦截图片危险地址 ${src.slice(0, 36)}`);
    return { kind: "placeholder" };
  }
  if (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=\s]+$/i.test(src) && src.length <= 4_200_000) {
    return { kind: "inline-data", dataUrl: src.replace(/\s+/g, "") };
  }
  if (/^data:/i.test(src)) {
    pushUniqueIgnored(ignored, "unsupported-element", "已忽略不支持的内嵌图片格式（仅允许 PNG/JPEG/WebP 位图）");
    return { kind: "placeholder" };
  }
  const normalizedExternal = src.startsWith("//") ? `https:${src}` : src;
  if (/^https?:\/\//i.test(normalizedExternal)) {
    return { kind: "missing-external", originalUrl: normalizedExternal.slice(0, 500) };
  }
  return { kind: "missing-external", originalUrl: src.slice(0, 500) };
}

function isThinDividerElement(
  el: HtmlElementAst,
  styles: Record<string, string>,
  emBasePx: number,
): boolean {
  if (el.tag === "hr") return true;
  const hasAnyContent = el.children.some(
    (c) => (c.kind === "text" && c.text.trim().length > 0) || c.kind === "element",
  );
  if (hasAnyContent) return false;
  const h = parsePx(styles.height, emBasePx);
  const w = parsePx(styles.width, emBasePx);
  // 排除小圆点/小方块装饰图标（例如 width: 6px; height: 6px），仅转换横向线条
  if (w !== undefined && w <= 16 && h !== undefined && h <= 16) return false;
  if (h !== undefined && h >= 1 && h <= 6 && (styles.background || styles["background-color"])) {
    return true;
  }
  if (
    (styles["border-top"] || styles["border-bottom"] || styles["border-top-width"] || styles["border-bottom-width"])
    && (h === undefined || h <= 4)
    && !styles["border-left"]
    && !styles["border-right"]
    && !styles["border-left-width"]
    && !styles["border-right-width"]
  ) {
    return true;
  }
  return false;
}

function mergeCollapsedWrapperIntoChild(
  wrapperBox: ComponentBoxStyle,
  wrapperTextAlign: ComponentTypographyStyle["textAlign"],
  child: ComponentNode,
): ComponentNode {
  const mergedBox: ComponentBoxStyle = {
    ...child.boxStyle,
    marginTop:
      child.boxStyle.marginTop !== undefined || wrapperBox.marginTop !== undefined
        ? (child.boxStyle.marginTop ?? 0) + (wrapperBox.marginTop ?? 0)
        : undefined,
    marginBottom:
      child.boxStyle.marginBottom !== undefined || wrapperBox.marginBottom !== undefined
        ? (child.boxStyle.marginBottom ?? 0) + (wrapperBox.marginBottom ?? 0)
        : undefined,
    marginLeft: child.boxStyle.marginLeft ?? wrapperBox.marginLeft,
    marginRight: child.boxStyle.marginRight ?? wrapperBox.marginRight,
    marginAutoX:
      child.boxStyle.marginAutoX
      ?? wrapperBox.marginAutoX
      ?? (wrapperTextAlign === "center" && Boolean(child.boxStyle.intrinsicWidth || child.boxStyle.width)
        ? true
        : undefined),
    alignSelf:
      child.boxStyle.alignSelf
      ?? wrapperBox.alignSelf
      ?? (wrapperTextAlign === "center" && Boolean(child.boxStyle.intrinsicWidth || child.boxStyle.width)
        ? "center"
        : undefined),
    widthFlex: child.boxStyle.widthFlex ?? wrapperBox.widthFlex,
    intrinsicWidth: child.boxStyle.intrinsicWidth ?? wrapperBox.intrinsicWidth,
    width: child.boxStyle.width ?? wrapperBox.width,
    height: child.boxStyle.height ?? wrapperBox.height,
    position: child.boxStyle.position ?? wrapperBox.position,
    top: child.boxStyle.top ?? wrapperBox.top,
    right: child.boxStyle.right ?? wrapperBox.right,
    bottom: child.boxStyle.bottom ?? wrapperBox.bottom,
    left: child.boxStyle.left ?? wrapperBox.left,
    zIndex: child.boxStyle.zIndex ?? wrapperBox.zIndex,
    rotation: child.boxStyle.rotation ?? wrapperBox.rotation,
    flipX: Boolean(child.boxStyle.flipX) !== Boolean(wrapperBox.flipX) ? true : undefined,
    flipY: Boolean(child.boxStyle.flipY) !== Boolean(wrapperBox.flipY) ? true : undefined,
    opacity: child.boxStyle.opacity ?? wrapperBox.opacity,
  };
  return {
    ...child,
    boxStyle: sanitizeBoxStyle(mergedBox),
  };
}

function convertAstToComponents(
  nodes: HtmlAstNode[],
  ignored: ImportIgnoredEntry[],
  inherited: ComponentTypographyStyle = {},
  emBasePx = 16,
): ComponentNode[] {
  const out: ComponentNode[] = [];
  let inlineBuffer: HtmlAstNode[] = [];

  const flushInlineBuffer = () => {
    if (inlineBuffer.length === 0) return;
    const runs = collectInlineRuns(inlineBuffer, undefined, ignored, emBasePx);
    inlineBuffer = [];
    if (runsToPlainText(runs).trim().length > 0) {
      out.push({
        id: makeId("txt"),
        type: "text",
        runs,
        textStyle: inherited,
        boxStyle: {},
      });
    }
  };

  for (const node of nodes) {
    if (node.kind === "text") {
      if (node.text.trim()) inlineBuffer.push(node);
      continue;
    }

    if (!requiresComponent(node, ignored, emBasePx)) {
      inlineBuffer.push(node);
      continue;
    }

    flushInlineBuffer();
    const styles = parseStyleMap(node.attrs.style, ignored);
    const { typography: ownTextStyle, nextEmBasePx } = extractTypographyStyle(styles, emBasePx);
    const textStyle: ComponentTypographyStyle = { ...inherited, ...ownTextStyle };
    const boxStyle = extractBoxStyle(styles, nextEmBasePx);
    const bgImgInfo = extractBackgroundImageInfo(styles, ignored);

    if (styles.position && styles.position !== "static" && !boxStyle.position) {
      pushUniqueIgnored(ignored, "unsupported-style", `已忽略不支持的定位方式 ${styles.position}`);
    }

    // 1. 静态内联 <svg> 装饰与图标转换
    if (node.tag === "svg") {
      const svgDataUrl = serializeSafeStaticSvg(node);
      if (svgDataUrl) {
        const svgWidth =
          boxStyle.width
          ?? importLength(node.attrs.width, nextEmBasePx)
          ?? (styles.width ? undefined : "32px");
        const svgHeight = boxStyle.height ?? importLength(node.attrs.height, nextEmBasePx);
        out.push({
          id: makeId("svg"),
          type: "image",
          imageRef: { kind: "inline-svg", svgDataUrl },
          alt: "SVG 装饰图形",
          maxWidthPercent: 100,
          boxStyle: sanitizeBoxStyle({
            ...boxStyle,
            width: svgWidth,
            height: svgHeight,
            intrinsicWidth: true,
            objectFit: "contain",
          }),
        });
      }
      continue;
    }

    // 2. 分割线识别
    if (!bgImgInfo && isThinDividerElement(node, styles, nextEmBasePx)) {
      const bTop = parseBorderShorthand(styles["border-top"] ?? styles["border-bottom"], nextEmBasePx);
      const widthPct = parsePercent(styles.width) ?? 100;
      const bgCol = boxStyle.backgroundColor ?? boxStyle.borderColor ?? bTop?.color ?? "#d4d4d4";
      out.push({
        id: makeId("div"),
        type: "divider",
        dividerStyle:
          boxStyle.borderStyle === "dashed" || bTop?.style === "dashed"
            ? "dashed"
            : boxStyle.borderStyle === "dotted" || bTop?.style === "dotted"
              ? "dotted"
              : widthPct <= 45
                ? "short"
                : "solid",
        widthPercent: Math.max(10, Math.min(100, Math.round(widthPct))),
        thickness: Math.max(
          1,
          Math.min(6, boxStyle.borderWidth ?? bTop?.width ?? parsePx(styles.height, nextEmBasePx) ?? 1),
        ),
        color: bgCol,
        boxStyle: sanitizeBoxStyle({
          ...boxStyle,
          backgroundColor: undefined,
          height: undefined,
          borderWidth: undefined,
          borderTopDecl: undefined,
          borderBottomDecl: undefined,
          marginTop: boxStyle.marginTop ?? (boxStyle.position ? 0 : 12),
          marginBottom: boxStyle.marginBottom ?? (boxStyle.position ? 0 : 12),
        }),
      });
      continue;
    }

    // 3. <img> 图片节点
    if (node.tag === "img") {
      const rawSrc = node.attrs.src || node.attrs["data-src"];
      const imageBoxStyle: ComponentBoxStyle = {
        ...boxStyle,
        width: boxStyle.width ?? importLength(node.attrs.width, nextEmBasePx),
        height: boxStyle.height ?? importLength(node.attrs.height, nextEmBasePx),
      };
      const widthPct = imageBoxStyle.width ? 100 : parsePercent(styles["max-width"]) ?? 100;
      out.push({
        id: makeId("img"),
        type: "image",
        imageRef: classifyImageSrc(rawSrc, ignored),
        alt: (node.attrs.alt || node.attrs["data-caption"] || "导入配图").trim().slice(0, 160),
        maxWidthPercent: Math.max(20, Math.min(100, Math.round(widthPct))),
        boxStyle: sanitizeBoxStyle(imageBoxStyle),
      });
      continue;
    }

    const hasElementChildren = node.children.some(
      (child) => child.kind === "element" && requiresComponent(child, ignored, nextEmBasePx),
    );
    const directRuns = !hasElementChildren
      ? collectInlineRuns(node.children, undefined, ignored, nextEmBasePx)
      : [];
    const directPlain = !hasElementChildren ? runsToPlainText(directRuns).trim() : "";

    // 4. 纯背景图装饰块（秀米常用空 section + width/height + background-image 绘制枫叶/角标/图标）
    if (bgImgInfo && !hasElementChildren && !directPlain) {
      out.push({
        id: makeId("img"),
        type: "image",
        imageRef: bgImgInfo.imageRef,
        alt: "背景装饰素材",
        maxWidthPercent: 100,
        boxStyle: sanitizeBoxStyle({
          ...boxStyle,
          width: boxStyle.width ?? "48px",
          objectFit: bgImgInfo.objectFit,
          intrinsicWidth: boxStyle.intrinsicWidth ?? Boolean(boxStyle.width),
        }),
      });
      continue;
    }

    // 5. 无块级子节点的纯标题 / 文本 / 几何色块
    if (!hasElementChildren && !bgImgInfo) {
      if (!directPlain) {
        if (hasVisualBoxDecoration(boxStyle)) {
          out.push({
            id: makeId("ctn"),
            type: "container",
            direction: "vertical",
            gap: 0,
            label: "装饰色块",
            boxStyle,
            children: [],
          });
        }
        continue;
      }

      if (/^h[1-6]$/.test(node.tag)) {
        const rawLevel = Number(node.tag[1]);
        const level: 1 | 2 | 3 = rawLevel <= 1 ? 1 : rawLevel === 2 ? 2 : 3;
        out.push({
          id: makeId("hdg"),
          type: "heading",
          level,
          runs: directRuns,
          textStyle,
          boxStyle,
        });
        continue;
      }

      const prefixedRuns =
        node.tag === "li"
          ? normalizeRuns([{ text: "• ", style: { bold: true } }, ...directRuns])
          : directRuns;

      const isLikelyHeading =
        directPlain.length <= 28
        && ((textStyle.fontSize !== undefined && textStyle.fontSize >= 17)
          || ((textStyle.fontWeight === 700 || prefixedRuns.every((r) => !r.text.trim() || r.style?.bold))
            && hasVisualBoxDecoration(boxStyle)));

      if (isLikelyHeading) {
        out.push({
          id: makeId("hdg"),
          type: "heading",
          level: 2,
          runs: prefixedRuns,
          textStyle,
          boxStyle,
        });
      } else {
        out.push({
          id: makeId("txt"),
          type: "text",
          runs: prefixedRuns,
          textStyle,
          boxStyle:
            node.tag === "blockquote" && !boxStyle.borderWidth && !boxStyle.borderLeftDecl
              ? sanitizeBoxStyle({
                  ...boxStyle,
                  paddingTop: boxStyle.paddingTop ?? 12,
                  paddingRight: boxStyle.paddingRight ?? 14,
                  paddingBottom: boxStyle.paddingBottom ?? 12,
                  paddingLeft: boxStyle.paddingLeft ?? 14,
                  backgroundColor: boxStyle.backgroundColor ?? "#f5f5f4",
                  borderWidth: 4,
                  borderStyle: "solid",
                  borderSides: "left",
                  borderColor: boxStyle.borderColor ?? "#164b3e",
                })
              : boxStyle,
        });
      }
      continue;
    }

    // 6. 递归转换容器及其子节点
    const childComponents = convertAstToComponents(node.children, ignored, textStyle, nextEmBasePx);
    if (/^h[1-6]$/.test(node.tag)) {
      const level = node.tag === "h1" ? 1 : node.tag === "h2" ? 2 : 3;
      const textIndex = childComponents.findIndex((child) => child.type === "text");
      const text = childComponents[textIndex];
      if (text?.type === "text") {
        childComponents[textIndex] = { ...text, type: "heading", level, slotRole: undefined };
      }
    }

    if (bgImgInfo) {
      const bgOverlayNode: ComponentNode = {
        id: makeId("img"),
        type: "image",
        imageRef: bgImgInfo.imageRef,
        alt: "容器背景装饰图",
        maxWidthPercent: 100,
        boxStyle: sanitizeBoxStyle({
          position: "absolute",
          left: "0px",
          top: "0px",
          width: "100%",
          height: "100%",
          zIndex: 0,
          objectFit: bgImgInfo.objectFit,
        }),
      };
      for (const child of childComponents) {
        child.boxStyle.position ??= "relative";
        child.boxStyle.zIndex ??= 1;
      }
      childComponents.unshift(bgOverlayNode);
    }

    if (childComponents.length === 0) continue;

    const inlineBoxes = node.children.filter((child): child is HtmlElementAst => child.kind === "element");
    const usesInlineLayout =
      inlineBoxes.length > 1
      && node.children.every((child) =>
        child.kind === "text"
          ? !child.text.trim()
          : ["inline-block", "inline-flex"].includes(parseStyleMap(child.attrs.style, ignored).display)
            || child.tag === "img"
            || child.tag === "svg"
            || child.tag === "span",
      );
    const flexDirection = styles["flex-direction"] ?? styles["flex-flow"]?.split(/\s+/)[0];
    const flexLayout = styles.display === "flex" || styles.display === "inline-flex";
    const isHorizontal =
      node.tag === "tr" || (flexLayout ? !flexDirection?.startsWith("column") : usesInlineLayout);
    const gap =
      parsePx(styles.gap ?? styles["column-gap"] ?? styles["row-gap"], nextEmBasePx)
      ?? (isHorizontal ? 0 : 0);

    // 若父级在纵向流中写了 text-align: center 且子项为 inline-block 紧凑盒，保持水平居中而非强制拉伸 100%
    const rawAlign = styles["align-items"];
    const alignItems: "stretch" | "center" | "flex-start" | "flex-end" =
      rawAlign === "center" || rawAlign === "flex-start" || rawAlign === "flex-end"
        ? rawAlign
        : !isHorizontal
            && textStyle.textAlign === "center"
            && childComponents.some((c) => c.boxStyle.intrinsicWidth || Boolean(c.boxStyle.width))
          ? "center"
          : isHorizontal && usesInlineLayout
            ? "center"
            : "stretch";

    const rawJustify = styles["justify-content"] ?? (isHorizontal ? textStyle.textAlign : undefined);
    const justifyContent: "flex-start" | "center" | "flex-end" | "space-between" | undefined =
      rawJustify === "center"
      || rawJustify === "flex-start"
      || rawJustify === "flex-end"
      || rawJustify === "space-between"
        ? rawJustify
        : rawJustify === "right"
          ? "flex-end"
          : rawJustify === "left"
            ? "flex-start"
            : undefined;

    // 折叠无视觉装饰的单子节点冗余包装层，但完整保留外边距、居中对齐与尺寸属性
    if (
      childComponents.length === 1
      && !isHorizontal
      && !hasVisualBoxDecoration(boxStyle)
    ) {
      out.push(mergeCollapsedWrapperIntoChild(boxStyle, textStyle.textAlign, childComponents[0]));
      continue;
    }

    out.push({
      id: makeId("ctn"),
      type: "container",
      label: isHorizontal ? "横向组合" : "纵向容器",
      direction: isHorizontal ? "horizontal" : "vertical",
      gap: Math.max(0, Math.min(40, Math.round(gap))),
      alignItems,
      justifyContent,
      boxStyle,
      children: childComponents,
    });
  }

  flushInlineBuffer();
  return out;
}

function isDecorativeOrnamentImage(node: Extract<ComponentNode, { type: "image" }>): boolean {
  if (node.imageRef.kind === "inline-svg") return true;
  if (node.boxStyle.position === "absolute") return true;
  if (node.alt.includes("装饰")) return true;
  if (node.boxStyle.width) {
    const px = parsePx(node.boxStyle.width, 16);
    if (px !== undefined && px <= 130) return true;
    const pct = parsePercent(node.boxStyle.width);
    if (pct !== undefined && pct <= 35) return true;
  }
  return false;
}

function inferAssetCategory(root: ComponentNode): LibraryAssetCategory {
  let headingCount = 0;
  let textCount = 0;
  let totalTextLen = 0;
  let contentImageCount = 0;
  let dividerCount = 0;

  function count(n: ComponentNode) {
    if (n.type === "heading") {
      headingCount += 1;
      totalTextLen += runsToPlainText(n.runs).trim().length;
    } else if (n.type === "text") {
      textCount += 1;
      totalTextLen += runsToPlainText(n.runs).trim().length;
    } else if (n.type === "image") {
      if (!isDecorativeOrnamentImage(n)) contentImageCount += 1;
    } else if (n.type === "divider") {
      dividerCount += 1;
    } else {
      n.children.forEach(count);
    }
  }
  count(root);

  if (dividerCount >= 1 && headingCount === 0 && textCount === 0 && contentImageCount === 0) {
    return "divider";
  }
  if (contentImageCount >= 1 && headingCount === 0 && textCount <= 1 && totalTextLen <= 40) {
    return "image-border";
  }
  if (
    contentImageCount === 0
    && headingCount + textCount >= 1
    && headingCount + textCount <= 3
    && totalTextLen <= 32
  ) {
    return "heading-border";
  }
  return "card";
}

function annotateDefaultSlots(node: ComponentNode, category: LibraryAssetCategory): ComponentNode {
  let contentMarked = false;
  let imageMarked = false;

  function walk(n: ComponentNode): ComponentNode {
    if (category === "image-border" && n.type === "image" && !isDecorativeOrnamentImage(n) && !imageMarked) {
      imageMarked = true;
      return { ...n, slotRole: "image" };
    }
    if (category === "heading-border" && (n.type === "heading" || n.type === "text") && !contentMarked) {
      contentMarked = true;
      return { ...n, slotRole: "content" };
    }
    if (category === "card" && n.type === "text" && !contentMarked) {
      contentMarked = true;
      return { ...n, slotRole: "content" };
    }
    if (n.type === "container") {
      return { ...n, children: n.children.map(walk) };
    }
    return n;
  }

  return walk(node);
}

function deriveTemplateStyleAndMarkdown(root: ComponentNode): {
  style: TemplateStyleConfig;
  sampleMarkdown: string;
  firstTitle: string;
} {
  const base = cloneStyleConfig(TYPOGRAPHY_SUBTEMPLATES[0].defaultStyle);
  let foundPrimary: string | undefined;
  let foundText: string | undefined;
  let foundQuoteBg: string | undefined;
  let foundHeadingSize: number | undefined;
  let foundHeadingStyle: HeadingStyleKind | undefined;
  let foundBodySize: number | undefined;
  let foundLineHeight: number | undefined;
  let foundImgRadius: number | undefined;
  let firstTitle = "";
  const mdBlocks: string[] = [];

  function walk(n: ComponentNode, parentBox?: ComponentBoxStyle) {
    if (n.type === "container") {
      if (!foundQuoteBg && n.boxStyle.backgroundColor && n.boxStyle.backgroundColor.toLowerCase() !== "#ffffff") {
        foundQuoteBg = n.boxStyle.backgroundColor;
      }
      if (!foundPrimary && n.boxStyle.borderColor && (n.boxStyle.borderWidth ?? 0) >= 2) {
        foundPrimary = n.boxStyle.borderColor;
      }
      n.children.forEach((c) => walk(c, n.boxStyle));
      return;
    }

    if (n.type === "heading") {
      const txt = runsToPlainText(n.runs).trim();
      if (txt) {
        if (!firstTitle) firstTitle = txt;
        mdBlocks.push(`${"#".repeat(n.level)} ${txt}`);
      }
      if (!foundPrimary && n.textStyle.color) foundPrimary = n.textStyle.color;
      if (!foundPrimary && n.boxStyle.borderColor) foundPrimary = n.boxStyle.borderColor;
      if (!foundHeadingSize && n.textStyle.fontSize && n.level === 2) foundHeadingSize = n.textStyle.fontSize;
      if (!foundHeadingStyle) {
        const sides = n.boxStyle.borderSides ?? parentBox?.borderSides;
        const hasBg = Boolean(n.boxStyle.backgroundColor || parentBox?.backgroundColor);
        if ((n.boxStyle.borderRadius ?? parentBox?.borderRadius ?? 0) >= 20 && hasBg) {
          foundHeadingStyle = "pill";
        } else if (sides === "left" && hasBg) {
          foundHeadingStyle = "band";
        } else if (sides === "left") {
          foundHeadingStyle = "bar";
        } else if (sides === "bottom") {
          foundHeadingStyle = "underline";
        } else if (sides === "left-top") {
          foundHeadingStyle = "corner-tl";
        }
      }
      return;
    }

    if (n.type === "text") {
      const txt = runsToPlainText(n.runs).trim();
      if (txt) {
        if (!firstTitle && txt.length <= 24) firstTitle = txt;
        mdBlocks.push(parentBox?.borderSides === "left" ? `> ${txt.replace(/\n+/g, " ")}` : txt);
      }
      if (!foundText && n.textStyle.color) foundText = n.textStyle.color;
      if (!foundBodySize && n.textStyle.fontSize) foundBodySize = n.textStyle.fontSize;
      if (!foundLineHeight && n.textStyle.lineHeight) foundLineHeight = n.textStyle.lineHeight;
      return;
    }

    if (n.type === "image") {
      if (!isDecorativeOrnamentImage(n)) {
        mdBlocks.push(`![${n.alt || "示例配图"}](/images/cover-example.jpg)`);
        if (foundImgRadius === undefined && n.boxStyle.borderRadius !== undefined) {
          foundImgRadius = n.boxStyle.borderRadius;
        }
      }
      return;
    }

    if (n.type === "divider") {
      mdBlocks.push("---");
      base.divider.color = n.color;
      if (n.dividerStyle === "dashed") base.divider.style = "dashed";
      else if (n.dividerStyle === "short") base.divider.style = "short";
    }
  }

  walk(root);

  if (foundPrimary) {
    base.colors.primaryColor = foundPrimary;
    base.colors.accentColor = foundPrimary;
  }
  if (foundText) base.colors.textColor = foundText;
  if (foundQuoteBg) base.colors.quoteBgColor = foundQuoteBg;
  if (foundHeadingSize) base.heading.fontSize = Math.max(15, Math.min(26, foundHeadingSize));
  if (foundHeadingStyle) base.heading.style = foundHeadingStyle;
  if (foundBodySize) base.paragraph.fontSize = Math.max(13, Math.min(20, foundBodySize));
  if (foundLineHeight) base.paragraph.lineHeight = foundLineHeight;
  if (foundImgRadius !== undefined) {
    base.image.borderRadius = Math.max(0, Math.min(28, foundImgRadius));
    if (foundImgRadius >= 8) base.image.style = "rounded";
  }

  const sampleMarkdown =
    mdBlocks.length > 0
      ? mdBlocks.join("\n\n")
      : "# 导入模板示例标题\n\n## 第一节重点\n\n在此输入公众号正文内容，模板样式已就绪。";

  return {
    style: sanitizeStyle(base),
    sampleMarkdown,
    firstTitle,
  };
}

/**
 * 统一解析富文本 HTML、`.html` 文件内容或版本化 `.json` 导出包
 */
export function parseImportInput(params: {
  raw: string;
  format?: "auto" | "html" | "json";
  targetKind: LibraryItemKind;
  preferredCategory?: LibraryAssetCategory;
  fallbackName?: string;
}): ParsedImportResult {
  const trimmed = params.raw.trim();
  const ignoredItems: ImportIgnoredEntry[] = [];

  if (!trimmed) {
    const cat =
      params.targetKind === "template"
        ? "template"
        : params.preferredCategory && params.preferredCategory !== "template"
          ? params.preferredCategory
          : "card";
    const blankRoot = createBlankComponentByCategory(cat);
    const derived = deriveTemplateStyleAndMarkdown(blankRoot);
    return {
      sourceFormat: "html",
      suggestedName: params.fallbackName || (params.targetKind === "template" ? "新建导入模板" : "新建导入素材"),
      kind: params.targetKind,
      suggestedCategory: cat,
      rootNode: blankRoot,
      templateStyle: derived.style,
      sampleMarkdown: derived.sampleMarkdown,
      ignoredItems,
      pendingExternalImages: [],
      portableMedia: [],
    };
  }

  const isJson =
    params.format === "json"
    || (params.format !== "html" && trimmed.startsWith("{") && trimmed.includes('"new-paint-library-v1"'));

  if (isJson) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new Error("JSON 文件格式无效，请确认是本项目导出的 .json 文件。");
    }
    const pkg = parsed as Partial<PortableLibraryExportV1>;
    if (!pkg || typeof pkg !== "object" || pkg.schemaVersion !== "new-paint-library-v1" || !pkg.item) {
      throw new Error("不支持的 JSON 版本，仅支持导入本项目导出的版本化 .json 文件（new-paint-library-v1）。");
    }

    const rootNode = validateComponentNode(pkg.item.rootNode);
    const portableMedia: PortableEmbeddedMedia[] = [];
    if (Array.isArray(pkg.portableMedia)) {
      for (const m of pkg.portableMedia.slice(0, 24)) {
        if (
          m
          && typeof m === "object"
          && typeof m.mediaId === "string"
          && (m.mimeType === "image/png" || m.mimeType === "image/jpeg" || m.mimeType === "image/webp")
          && typeof m.base64Data === "string"
          && /^[A-Za-z0-9+/=\s]+$/.test(m.base64Data)
          && m.base64Data.length <= 8_000_000
        ) {
          portableMedia.push({
            mediaId: m.mediaId,
            mimeType: m.mimeType,
            filename: typeof m.filename === "string" ? m.filename.slice(0, 120) : undefined,
            base64Data: m.base64Data.replace(/\s+/g, ""),
          });
        }
      }
    }

    const kind: LibraryItemKind =
      pkg.item.kind === "template" || pkg.item.kind === "asset" ? pkg.item.kind : params.targetKind;
    const rawCat = pkg.item.category;
    const suggestedCategory: LibraryAssetCategory =
      kind === "template"
        ? "template"
        : rawCat === "card"
          || rawCat === "divider"
          || rawCat === "image-border"
          || rawCat === "heading-border"
          ? rawCat
          : inferAssetCategory(rootNode);

    const derived = deriveTemplateStyleAndMarkdown(rootNode);
    const templateStyle =
      pkg.item.templateStyle && typeof pkg.item.templateStyle === "object"
        ? sanitizeStyle({ ...derived.style, ...pkg.item.templateStyle })
        : derived.style;
    const sampleMarkdown =
      typeof pkg.item.sampleMarkdown === "string" && pkg.item.sampleMarkdown.trim()
        ? pkg.item.sampleMarkdown.slice(0, 20000)
        : derived.sampleMarkdown;

    return {
      sourceFormat: "json",
      suggestedName:
        typeof pkg.item.name === "string" && pkg.item.name.trim()
          ? pkg.item.name.trim().slice(0, 60)
          : params.fallbackName || "导入组件",
      kind,
      suggestedCategory,
      rootNode,
      templateStyle,
      sampleMarkdown,
      ignoredItems,
      pendingExternalImages: collectPendingExternalImages(rootNode),
      portableMedia,
    };
  }

  // 解析 HTML / 粘贴的公众号或秀米富文本
  const ast = tokenizeAndParseHtml(trimmed, ignoredItems);
  const converted = convertAstToComponents(ast, ignoredItems);

  let rootContainer: ComponentNode;
  if (converted.length === 0) {
    throw new Error("未找到可编辑元素。请复制秀米中的模板富文本，或导入带内联样式的 HTML。");
  } else if (
    converted.length === 1
    && converted[0].type === "container"
    && !converted[0].boxStyle.intrinsicWidth
    && !converted[0].boxStyle.width
  ) {
    rootContainer = {
      ...converted[0],
      boxStyle: {
        ...converted[0].boxStyle,
        marginTop: converted[0].boxStyle.marginTop ?? 12,
        marginBottom: converted[0].boxStyle.marginBottom ?? 12,
      },
    };
  } else {
    // 若单个组件是紧凑盒（inline-block / 指定宽度），保留外层居中容器使其不被强制撑满 100%
    const shouldCenterSingle =
      converted.length === 1 && Boolean(converted[0].boxStyle.intrinsicWidth || converted[0].boxStyle.marginAutoX);
    rootContainer = {
      id: makeId("root"),
      type: "container",
      label: "导入根容器",
      direction: "vertical",
      gap: 8,
      alignItems: shouldCenterSingle ? "center" : "stretch",
      boxStyle: { marginTop: 12, marginBottom: 12 },
      children: converted,
    };
  }

  const inferred = inferAssetCategory(rootContainer);
  const suggestedCategory: LibraryAssetCategory =
    params.targetKind === "template"
      ? "template"
      : params.preferredCategory && params.preferredCategory !== "template"
        ? params.preferredCategory
        : inferred;

  const annotatedRoot = validateComponentNode(
    suggestedCategory === "template"
      ? rootContainer
      : annotateDefaultSlots(rootContainer, suggestedCategory),
  );
  const derived = deriveTemplateStyleAndMarkdown(annotatedRoot);
  const defaultTitle =
    params.fallbackName
    || (derived.firstTitle ? derived.firstTitle.slice(0, 24) : "")
    || (params.targetKind === "template" ? "导入公众号模板" : "导入图文素材");

  return {
    sourceFormat: "html",
    suggestedName: defaultTitle,
    kind: params.targetKind,
    suggestedCategory,
    rootNode: annotatedRoot,
    templateStyle: derived.style,
    sampleMarkdown: derived.sampleMarkdown,
    ignoredItems,
    pendingExternalImages: collectPendingExternalImages(annotatedRoot),
    portableMedia: [],
  };
}
