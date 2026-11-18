import { FONT_FAMILY_STACK, type DocumentTextStyle, type StructuredArticleDraft, type TextRun } from "./structured";
import type { TemplateStyleConfig } from "./types";

const DEFAULT_WECHAT_FONT =
  "-apple-system,BlinkMacSystemFont,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif";

export function escapeHtml(raw: string) {
  return raw
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function safeUrl(raw: string) {
  const trimmed = raw.trim();
  if (/^https?:\/\//i.test(trimmed) || (trimmed.startsWith("/") && !trimmed.startsWith("//"))) {
    return escapeHtml(trimmed);
  }
  return "#";
}

export function safeColor(raw: string, fallback: string) {
  const trimmed = raw.trim();
  if (
    /^#[0-9a-fA-F]{3,8}$/.test(trimmed)
    || /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/.test(trimmed)
  ) {
    return trimmed;
  }
  return fallback;
}

export function sanitizeStyle(style: TemplateStyleConfig): TemplateStyleConfig {
  return {
    ...style,
    colors: {
      primaryColor: safeColor(style.colors.primaryColor, "#171717"),
      accentColor: safeColor(style.colors.accentColor, "#525252"),
      textColor: safeColor(style.colors.textColor, "#262626"),
      bgColor: safeColor(style.colors.bgColor, "#ffffff"),
      borderColor: safeColor(style.colors.borderColor, "#d4d4d4"),
      quoteBgColor: safeColor(style.colors.quoteBgColor, "#f5f5f5"),
    },
    divider: {
      ...style.divider,
      color: safeColor(style.divider.color, "#d4d4d4"),
    },
  };
}

export function renderImageHtml(
  escapedAlt: string,
  rawSrc: string,
  style: TemplateStyleConfig,
  escapedCaption?: string,
) {
  const cleanSrc = safeUrl(rawSrc);
  const { image, colors, paragraph } = style;
  const wrapperStyle = `margin:${image.spacing}px 0;text-align:${image.align};line-height:0;`;
  const captionHtml = escapedCaption
    ? `<p style="margin:8px 0 0 0;font-size:${Math.max(12, paragraph.fontSize - 3)}px;line-height:1.5;color:#8c8c8c;text-align:${image.align};">${escapedCaption}</p>`
    : "";

  if (image.style === "full") {
    return `<section style="${wrapperStyle}"><img src="${cleanSrc}" alt="${escapedAlt}" style="display:inline-block;width:100%;max-width:100%;height:auto;border-radius:${image.borderRadius}px;vertical-align:middle;" />${captionHtml}</section>`;
  }
  if (image.style === "padded") {
    return `<section style="${wrapperStyle}"><span style="display:inline-block;width:${image.maxWidth}%;max-width:100%;padding:10px;background:${colors.quoteBgColor};border-radius:${image.borderRadius + 4}px;box-sizing:border-box;"><img src="${cleanSrc}" alt="${escapedAlt}" style="display:block;width:100%;max-width:100%;height:auto;border-radius:${image.borderRadius}px;" /></span>${captionHtml}</section>`;
  }
  if (image.style === "bordered") {
    return `<section style="${wrapperStyle}"><img src="${cleanSrc}" alt="${escapedAlt}" style="display:inline-block;width:${image.maxWidth}%;max-width:100%;height:auto;border-radius:${image.borderRadius}px;border:1px solid ${colors.borderColor};padding:4px;background:${colors.bgColor};box-sizing:border-box;vertical-align:middle;" />${captionHtml}</section>`;
  }
  const radius = Math.max(8, image.borderRadius);
  return `<section style="${wrapperStyle}"><img src="${cleanSrc}" alt="${escapedAlt}" style="display:inline-block;width:${image.maxWidth}%;max-width:100%;height:auto;border-radius:${radius}px;vertical-align:middle;" />${captionHtml}</section>`;
}

export function renderHeadingHtml(
  level: 1 | 2 | 3,
  innerHtml: string,
  style: TemplateStyleConfig,
  h2Counter: { count: number },
) {
  const { heading, paragraph, colors } = style;

  if (level === 1) {
    return `<h1 style="font-size:${heading.fontSize + 4}px;font-weight:${heading.fontWeight};line-height:1.45;letter-spacing:${paragraph.letterSpacing}px;color:${colors.primaryColor};text-align:${heading.align};margin:0 0 ${heading.marginBottom + 6}px 0;">${innerHtml}</h1>`;
  }

  if (level === 3) {
    return `<h3 style="font-size:${Math.max(paragraph.fontSize, heading.fontSize - 2)}px;font-weight:${heading.fontWeight};line-height:1.55;letter-spacing:${paragraph.letterSpacing}px;color:${colors.accentColor};text-align:${heading.align};margin:${Math.max(12, Math.round(heading.marginTop * 0.75))}px 0 ${Math.max(8, Math.round(heading.marginBottom * 0.65))}px 0;">${innerHtml}</h3>`;
  }

  const base = `margin:${heading.marginTop}px 0 ${heading.marginBottom}px 0;font-size:${heading.fontSize}px;font-weight:${heading.fontWeight};line-height:1.45;letter-spacing:${paragraph.letterSpacing}px;text-align:${heading.align};`;

  switch (heading.style) {
    case "plain":
      return `<h2 style="${base}color:${colors.primaryColor};">${innerHtml}</h2>`;
    case "bar":
      return `<h2 style="${base}color:${colors.textColor};border-left:4px solid ${colors.primaryColor};padding-left:12px;">${innerHtml}</h2>`;
    case "numbered": {
      h2Counter.count += 1;
      const badge = String(h2Counter.count).padStart(2, "0");
      return `<h2 style="${base}color:${colors.textColor};"><span style="display:inline-block;margin-right:8px;padding:1px 8px;border-radius:6px;background:${colors.primaryColor};color:#ffffff;font-size:${Math.max(12, heading.fontSize - 4)}px;font-weight:700;vertical-align:middle;">${badge}</span><span style="vertical-align:middle;">${innerHtml}</span></h2>`;
    }
    case "band":
      return `<h2 style="${base}color:${colors.textColor};"><span style="display:inline-block;background:${colors.quoteBgColor};border-left:4px solid ${colors.primaryColor};padding:6px 14px;border-radius:0 8px 8px 0;">${innerHtml}</span></h2>`;
    case "underline":
      return `<h2 style="${base}color:${colors.primaryColor};border-bottom:2px solid ${colors.primaryColor};padding-bottom:6px;">${innerHtml}</h2>`;
    case "pill":
      return `<h2 style="${base}"><span style="display:inline-block;background:${colors.primaryColor};color:#ffffff;padding:5px 14px;border-radius:999px;">${innerHtml}</span></h2>`;
    case "corner-tl":
      return `<h2 style="${base}color:${colors.primaryColor};"><span style="display:inline-block;border-top:2px solid ${colors.primaryColor};border-left:2px solid ${colors.primaryColor};padding:6px 12px;">${innerHtml}</span></h2>`;
    case "corner-bl":
      return `<h2 style="${base}color:${colors.primaryColor};"><span style="display:inline-block;border-bottom:2px solid ${colors.primaryColor};border-left:2px solid ${colors.accentColor};padding:6px 12px;">${innerHtml}</span></h2>`;
  }
}

export function renderDividerHtml(style: TemplateStyleConfig) {
  const { divider } = style;
  const wrap = `margin:${divider.spacing}px 0;text-align:center;`;
  switch (divider.style) {
    case "solid":
      return `<section style="${wrap}"><div style="width:${divider.widthPercent}%;height:1px;background:${divider.color};margin:0 auto;"></div></section>`;
    case "dashed":
      return `<section style="${wrap}"><div style="width:${divider.widthPercent}%;border-top:1px dashed ${divider.color};margin:0 auto;"></div></section>`;
    case "short":
      return `<section style="${wrap}"><div style="width:${Math.min(divider.widthPercent, 36)}%;height:2px;background:${divider.color};margin:0 auto;border-radius:999px;"></div></section>`;
    case "dots":
      return `<section style="${wrap}"><p style="width:${divider.widthPercent}%;margin:0 auto;letter-spacing:10px;color:${divider.color};font-size:14px;line-height:1;">•••</p></section>`;
    case "blank":
      return `<section style="margin:${divider.spacing}px 0;height:${Math.max(12, Math.round(divider.spacing * 0.5))}px;"></section>`;
  }
}

export function renderListItemsHtml(
  type: "ul" | "ol",
  renderedItems: string[],
  style: TemplateStyleConfig,
) {
  const { list, paragraph, colors } = style;
  const baseText = `color:${colors.textColor};font-size:${paragraph.fontSize}px;line-height:${paragraph.lineHeight};letter-spacing:${paragraph.letterSpacing}px;`;

  if (type === "ul") {
    const isCustomMarker = list.unorderedStyle === "dash" || list.unorderedStyle === "check";
    const listType = isCustomMarker ? "none" : list.unorderedStyle;
    const paddingLeft = isCustomMarker ? Math.max(8, list.indent - 10) : list.indent;
    const markerChar = list.unorderedStyle === "check" ? "✓" : "—";
    const lis = renderedItems
      .map((itemHtml, idx) => {
        const mb = idx === renderedItems.length - 1 ? 0 : list.itemSpacing;
        const prefix = isCustomMarker
          ? `<span style="display:inline-block;min-width:18px;font-weight:700;color:${colors.accentColor};">${markerChar}</span>`
          : "";
        return `<li style="margin-bottom:${mb}px;text-align:${paragraph.textAlign};">${prefix}${itemHtml}</li>`;
      })
      .join("");
    return `<ul style="list-style-type:${listType};padding-left:${paddingLeft}px;margin:${paragraph.marginTop}px 0 ${paragraph.marginBottom}px 0;${baseText}">${lis}</ul>`;
  }

  const isLeadingZero = list.orderedStyle === "leading-zero";
  const listType = isLeadingZero ? "none" : "decimal";
  const paddingLeft = isLeadingZero ? Math.max(8, list.indent - 10) : list.indent;
  const lis = renderedItems
    .map((itemHtml, idx) => {
      const mb = idx === renderedItems.length - 1 ? 0 : list.itemSpacing;
      const prefix = isLeadingZero
        ? `<span style="display:inline-block;min-width:26px;font-weight:700;color:${colors.primaryColor};">${String(idx + 1).padStart(2, "0")}.</span>`
        : "";
      return `<li style="margin-bottom:${mb}px;text-align:${paragraph.textAlign};">${prefix}${itemHtml}</li>`;
    })
    .join("");
  return `<ol style="list-style-type:${listType};padding-left:${paddingLeft}px;margin:${paragraph.marginTop}px 0 ${paragraph.marginBottom}px 0;${baseText}">${lis}</ol>`;
}

export function renderBlockquoteHtml(innerHtml: string, style: TemplateStyleConfig) {
  const { colors, paragraph } = style;
  return `<blockquote style="margin:${paragraph.marginTop}px 0 ${paragraph.marginBottom}px 0;padding:14px 16px;background:${colors.quoteBgColor};border-left:4px solid ${colors.accentColor};border-radius:0 8px 8px 0;color:${colors.textColor};font-size:${Math.max(14, paragraph.fontSize - 1)}px;line-height:${paragraph.lineHeight};letter-spacing:${paragraph.letterSpacing}px;text-align:${paragraph.textAlign};">${innerHtml}</blockquote>`;
}

export function renderParagraphHtml(innerHtml: string, style: TemplateStyleConfig) {
  const { colors, paragraph } = style;
  return `<p style="margin:${paragraph.marginTop}px 0 ${paragraph.marginBottom}px 0;color:${colors.textColor};font-size:${paragraph.fontSize}px;line-height:${paragraph.lineHeight};letter-spacing:${paragraph.letterSpacing}px;text-align:${paragraph.textAlign};">${innerHtml}</p>`;
}

function formatInlineMarkdown(raw: string, style: TemplateStyleConfig) {
  const { colors } = style;
  let html = escapeHtml(raw);
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt, src) => {
    const cleanSrc = safeUrl(src);
    return `<img src="${cleanSrc}" alt="${alt}" style="display:inline-block;max-width:${style.image.maxWidth}%;height:auto;border-radius:${style.image.borderRadius}px;vertical-align:middle;" />`;
  });
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, text, href) => {
    const cleanHref = safeUrl(href);
    return `<a href="${cleanHref}" style="color:${colors.primaryColor};text-decoration:underline;text-underline-offset:3px;">${text}</a>`;
  });
  html = html.replace(
    /\*\*([^*]+)\*\*/g,
    `<strong style="font-weight:700;color:${colors.accentColor};">$1</strong>`,
  );
  html = html.replace(/\*([^*]+)\*/g, `<em style="font-style:italic;">$1</em>`);
  html = html.replace(
    /`([^`]+)`/g,
    `<code style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:0.88em;background:${colors.quoteBgColor};color:${colors.primaryColor};padding:2px 6px;border-radius:4px;">$1</code>`,
  );
  return html;
}

function renderCodeBlock(code: string, lang: string, style: TemplateStyleConfig) {
  const escaped = escapeHtml(code);
  const label = lang ? `<span style="font-size:11px;color:#a3a3a3;margin-left:auto;">${escapeHtml(lang)}</span>` : "";
  return `<section style="margin:${style.paragraph.marginTop}px 0 ${style.paragraph.marginBottom}px 0;border-radius:10px;overflow:hidden;background:#1e1e1e;box-shadow:0 4px 12px rgba(0,0,0,0.08);">
    <div style="display:flex;align-items:center;gap:6px;padding:10px 14px;background:#262626;">
      <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#ff5f56;"></span>
      <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#ffbd2e;"></span>
      <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#27c93f;"></span>
      ${label}
    </div>
    <pre style="margin:0;padding:14px 16px;overflow-x:auto;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px;line-height:1.65;color:#e5e5e5;white-space:pre;"><code>${escaped}</code></pre>
  </section>`;
}

function renderTable(rows: string[][], style: TemplateStyleConfig) {
  if (rows.length === 0) return "";
  const { colors, paragraph } = style;
  const [header, ...bodyRows] = rows;
  const ths = header
    .map(
      (cell) =>
        `<th style="padding:8px 12px;text-align:left;font-weight:600;color:${colors.primaryColor};background:${colors.quoteBgColor};border:1px solid ${colors.borderColor};">${formatInlineMarkdown(cell, style)}</th>`,
    )
    .join("");
  const trs = bodyRows
    .map(
      (row) =>
        `<tr>${row
          .map(
            (cell) =>
              `<td style="padding:8px 12px;color:${colors.textColor};border:1px solid ${colors.borderColor};">${formatInlineMarkdown(cell, style)}</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");
  return `<table style="width:100%;border-collapse:collapse;margin:${paragraph.marginTop}px 0 ${paragraph.marginBottom}px 0;font-size:${Math.max(13, paragraph.fontSize - 1)}px;line-height:1.6;"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
}

export function renderWechatHtml(markdown: string, rawStyle: TemplateStyleConfig) {
  const style = sanitizeStyle(rawStyle);
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks: string[] = [];
  const h2Counter = { count: 0 };
  let listType: "ul" | "ol" | null = null;
  let listItems: string[] = [];
  let inCode = false;
  let codeLang = "";
  let codeLines: string[] = [];
  let tableRows: string[][] = [];

  const flushList = () => {
    if (!listType || listItems.length === 0) return;
    blocks.push(
      renderListItemsHtml(
        listType,
        listItems.map((item) => formatInlineMarkdown(item, style)),
        style,
      ),
    );
    listType = null;
    listItems = [];
  };

  const flushTable = () => {
    if (tableRows.length === 0) return;
    blocks.push(renderTable(tableRows, style));
    tableRows = [];
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    if (trimmed.startsWith("```")) {
      flushList();
      flushTable();
      if (!inCode) {
        inCode = true;
        codeLang = trimmed.slice(3).trim();
        codeLines = [];
      } else {
        blocks.push(renderCodeBlock(codeLines.join("\n"), codeLang, style));
        inCode = false;
        codeLang = "";
        codeLines = [];
      }
      continue;
    }

    if (inCode) {
      codeLines.push(rawLine);
      continue;
    }

    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      flushList();
      const cells = trimmed.slice(1, -1).split("|").map((c) => c.trim());
      if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue;
      tableRows.push(cells);
      continue;
    }
    flushTable();

    if (!trimmed) {
      flushList();
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      flushList();
      blocks.push(renderDividerHtml(style));
      continue;
    }

    const standaloneImg = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(trimmed);
    if (standaloneImg) {
      flushList();
      blocks.push(renderImageHtml(escapeHtml(standaloneImg[1]), standaloneImg[2], style));
      continue;
    }

    const headingMatch = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      flushList();
      const level = headingMatch[1].length as 1 | 2 | 3;
      blocks.push(renderHeadingHtml(level, formatInlineMarkdown(headingMatch[2], style), style, h2Counter));
      continue;
    }

    const quoteMatch = /^>\s*(.+)$/.exec(trimmed);
    if (quoteMatch) {
      flushList();
      blocks.push(renderBlockquoteHtml(formatInlineMarkdown(quoteMatch[1], style), style));
      continue;
    }

    const ulMatch = /^[-*]\s+(.+)$/.exec(trimmed);
    if (ulMatch) {
      if (listType !== "ul") {
        flushList();
        listType = "ul";
      }
      listItems.push(ulMatch[1]);
      continue;
    }

    const olMatch = /^\d+\.\s+(.+)$/.exec(trimmed);
    if (olMatch) {
      if (listType !== "ol") {
        flushList();
        listType = "ol";
      }
      listItems.push(olMatch[1]);
      continue;
    }

    flushList();
    blocks.push(renderParagraphHtml(formatInlineMarkdown(trimmed, style), style));
  }
  flushList();
  flushTable();
  if (inCode && codeLines.length > 0) {
    blocks.push(renderCodeBlock(codeLines.join("\n"), codeLang, style));
  }

  return `<section style="background:${style.colors.bgColor};color:${style.colors.textColor};padding:24px 18px;font-family:${DEFAULT_WECHAT_FONT};">${blocks.join("")}</section>`;
}

/**
 * Renders `TextRun[]` honoring the 3-tier cascade:
 * 1. Template default (`style`) -> 2. Document override (`docStyle`) -> 3. Local run override (`run.style`).
 */
function renderRunsHtml(
  runs: TextRun[],
  style: TemplateStyleConfig,
  docStyle: DocumentTextStyle,
  isHeading = false,
): string {
  return runs
    .map((run) => {
      if (!run.text) return "";
      const escaped = escapeHtml(run.text).replaceAll("\n", "<br />");
      const css: string[] = [];

      const fontSize = run.style?.fontSize;
      if (typeof fontSize === "number" && fontSize >= 10 && fontSize <= 42) {
        css.push(`font-size:${fontSize}px`);
      }

      const family = run.style?.fontFamily;
      if (family && FONT_FAMILY_STACK[family]) {
        css.push(`font-family:${FONT_FAMILY_STACK[family]}`);
      }

      if (run.style?.bold !== undefined) {
        css.push(`font-weight:${run.style.bold ? 700 : 400}`);
      } else if (!isHeading && docStyle.bold !== undefined && docStyle.bold !== null) {
        css.push(`font-weight:${docStyle.bold ? 700 : 400}`);
      }

      if (run.style?.italic !== undefined) {
        css.push(`font-style:${run.style.italic ? "italic" : "normal"}`);
      } else if (docStyle.italic !== undefined && docStyle.italic !== null) {
        css.push(`font-style:${docStyle.italic ? "italic" : "normal"}`);
      }

      if (run.style?.color) {
        css.push(`color:${safeColor(run.style.color, style.colors.textColor)}`);
      }

      return css.length > 0 ? `<span style="${css.join(";")};">${escaped}</span>` : escaped;
    })
    .join("");
}

/**
 * Shared renderer for StructuredArticleDraft (used identically by Preview and Copy-to-WeChat).
 */
export function renderStructuredArticleHtml(
  draft: Pick<StructuredArticleDraft, "title" | "templateStyle" | "documentStyle" | "blocks">,
  imageUrls: Record<string, string>,
): string {
  const baseStyle = sanitizeStyle(draft.templateStyle);
  const doc = draft.documentStyle ?? {};

  // Tier 1 (templateStyle) -> Tier 2 (documentStyle)
  const effectiveStyle: TemplateStyleConfig = {
    ...baseStyle,
    colors: {
      ...baseStyle.colors,
      textColor: doc.color ? safeColor(doc.color, baseStyle.colors.textColor) : baseStyle.colors.textColor,
    },
    paragraph: {
      ...baseStyle.paragraph,
      fontSize:
        typeof doc.fontSize === "number" && doc.fontSize >= 12 && doc.fontSize <= 24
          ? doc.fontSize
          : baseStyle.paragraph.fontSize,
    },
  };

  const rootFont =
    doc.fontFamily && doc.fontFamily !== "default"
      ? FONT_FAMILY_STACK[doc.fontFamily]
      : DEFAULT_WECHAT_FONT;

  const h2Counter = { count: 0 };
  const htmlBlocks: string[] = [];

  if (draft.title.trim()) {
    htmlBlocks.push(renderHeadingHtml(1, escapeHtml(draft.title.trim()), effectiveStyle, h2Counter));
  }

  for (const block of draft.blocks) {
    if (block.type === "heading") {
      const inner = renderRunsHtml(block.runs, effectiveStyle, doc, true);
      if (inner.trim()) {
        htmlBlocks.push(renderHeadingHtml(block.level, inner, effectiveStyle, h2Counter));
      }
    } else if (block.type === "paragraph") {
      const inner = renderRunsHtml(block.runs, effectiveStyle, doc, false);
      if (inner.trim()) {
        htmlBlocks.push(renderParagraphHtml(inner, effectiveStyle));
      }
    } else if (block.type === "blockquote") {
      const inner = renderRunsHtml(block.runs, effectiveStyle, doc, false);
      if (inner.trim()) {
        htmlBlocks.push(renderBlockquoteHtml(inner, effectiveStyle));
      }
    } else if (block.type === "list") {
      const items = block.items
        .map((item) => renderRunsHtml(item.runs, effectiveStyle, doc, false))
        .filter((s) => s.trim().length > 0);
      if (items.length > 0) {
        htmlBlocks.push(renderListItemsHtml(block.ordered ? "ol" : "ul", items, effectiveStyle));
      }
    } else if (block.type === "image") {
      const src = imageUrls[block.assetId] ?? "";
      if (src) {
        htmlBlocks.push(
          renderImageHtml(
            escapeHtml(block.alt || "文章配图"),
            src,
            effectiveStyle,
            block.caption ? escapeHtml(block.caption) : undefined,
          ),
        );
      }
    } else if (block.type === "divider") {
      htmlBlocks.push(renderDividerHtml(effectiveStyle));
    }
  }

  return `<section style="background:${effectiveStyle.colors.bgColor};color:${effectiveStyle.colors.textColor};padding:24px 18px;font-family:${rootFont};">${htmlBlocks.join("")}</section>`;
}

export function countArticleStats(markdown: string) {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#>*`~\-|]/g, " ")
    .trim();
  const cjk = (plain.match(/[\u4e00-\u9fa5]/g) ?? []).length;
  const words = (plain.replace(/[\u4e00-\u9fa5]/g, " ").match(/[A-Za-z0-9_]+/g) ?? []).length;
  const total = cjk + words;
  const minutes = Math.max(1, Math.ceil(total / 350));
  return { total, minutes };
}
