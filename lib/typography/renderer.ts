import type { TemplateStyleConfig } from "./types";

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

function safeColor(raw: string, fallback: string) {
  const trimmed = raw.trim();
  if (
    /^#[0-9a-fA-F]{3,8}$/.test(trimmed)
    || /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/.test(trimmed)
  ) {
    return trimmed;
  }
  return fallback;
}

function sanitizeStyle(style: TemplateStyleConfig): TemplateStyleConfig {
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

function renderImageBlock(alt: string, src: string, style: TemplateStyleConfig) {
  const cleanSrc = safeUrl(src);
  const { image, colors } = style;
  const wrapperStyle = `margin:${image.spacing}px 0;text-align:${image.align};line-height:0;`;

  if (image.style === "full") {
    return `<section style="${wrapperStyle}"><img src="${cleanSrc}" alt="${alt}" style="display:inline-block;width:100%;max-width:100%;height:auto;border-radius:${image.borderRadius}px;vertical-align:middle;" /></section>`;
  }
  if (image.style === "padded") {
    return `<section style="${wrapperStyle}"><span style="display:inline-block;width:${image.maxWidth}%;max-width:100%;padding:10px;background:${colors.quoteBgColor};border-radius:${image.borderRadius + 4}px;box-sizing:border-box;"><img src="${cleanSrc}" alt="${alt}" style="display:block;width:100%;max-width:100%;height:auto;border-radius:${image.borderRadius}px;" /></span></section>`;
  }
  if (image.style === "bordered") {
    return `<section style="${wrapperStyle}"><img src="${cleanSrc}" alt="${alt}" style="display:inline-block;width:${image.maxWidth}%;max-width:100%;height:auto;border-radius:${image.borderRadius}px;border:1px solid ${colors.borderColor};padding:4px;background:${colors.bgColor};box-sizing:border-box;vertical-align:middle;" /></section>`;
  }
  const radius = Math.max(8, image.borderRadius);
  return `<section style="${wrapperStyle}"><img src="${cleanSrc}" alt="${alt}" style="display:inline-block;width:${image.maxWidth}%;max-width:100%;height:auto;border-radius:${radius}px;vertical-align:middle;" /></section>`;
}

function formatInline(raw: string, style: TemplateStyleConfig) {
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

function renderHeading(
  level: 1 | 2 | 3,
  text: string,
  style: TemplateStyleConfig,
  h2Counter: { count: number },
) {
  const { heading, paragraph, colors } = style;
  const content = formatInline(text, style);

  if (level === 1) {
    return `<h1 style="font-size:${heading.fontSize + 4}px;font-weight:${heading.fontWeight};line-height:1.45;letter-spacing:${paragraph.letterSpacing}px;color:${colors.primaryColor};text-align:${heading.align};margin:0 0 ${heading.marginBottom + 6}px 0;">${content}</h1>`;
  }

  if (level === 3) {
    return `<h3 style="font-size:${Math.max(paragraph.fontSize, heading.fontSize - 2)}px;font-weight:${heading.fontWeight};line-height:1.55;letter-spacing:${paragraph.letterSpacing}px;color:${colors.accentColor};text-align:${heading.align};margin:${Math.max(12, Math.round(heading.marginTop * 0.75))}px 0 ${Math.max(8, Math.round(heading.marginBottom * 0.65))}px 0;">${content}</h3>`;
  }

  const base = `margin:${heading.marginTop}px 0 ${heading.marginBottom}px 0;font-size:${heading.fontSize}px;font-weight:${heading.fontWeight};line-height:1.45;letter-spacing:${paragraph.letterSpacing}px;text-align:${heading.align};`;

  switch (heading.style) {
    case "plain":
      return `<h2 style="${base}color:${colors.primaryColor};">${content}</h2>`;
    case "bar":
      return `<h2 style="${base}color:${colors.textColor};border-left:4px solid ${colors.primaryColor};padding-left:12px;">${content}</h2>`;
    case "numbered": {
      h2Counter.count += 1;
      const badge = String(h2Counter.count).padStart(2, "0");
      return `<h2 style="${base}color:${colors.textColor};"><span style="display:inline-block;margin-right:8px;padding:1px 8px;border-radius:6px;background:${colors.primaryColor};color:#ffffff;font-size:${Math.max(12, heading.fontSize - 4)}px;font-weight:700;vertical-align:middle;">${badge}</span><span style="vertical-align:middle;">${content}</span></h2>`;
    }
    case "band":
      return `<h2 style="${base}color:${colors.textColor};"><span style="display:inline-block;background:${colors.quoteBgColor};border-left:4px solid ${colors.primaryColor};padding:6px 14px;border-radius:0 8px 8px 0;">${content}</span></h2>`;
    case "underline":
      return `<h2 style="${base}color:${colors.primaryColor};border-bottom:2px solid ${colors.primaryColor};padding-bottom:6px;">${content}</h2>`;
    case "pill":
      return `<h2 style="${base}"><span style="display:inline-block;background:${colors.primaryColor};color:#ffffff;padding:5px 14px;border-radius:999px;">${content}</span></h2>`;
    case "corner-tl":
      return `<h2 style="${base}color:${colors.primaryColor};"><span style="display:inline-block;border-top:2px solid ${colors.primaryColor};border-left:2px solid ${colors.primaryColor};padding:6px 12px;">${content}</span></h2>`;
    case "corner-bl":
      return `<h2 style="${base}color:${colors.primaryColor};"><span style="display:inline-block;border-bottom:2px solid ${colors.primaryColor};border-left:2px solid ${colors.accentColor};padding:6px 12px;">${content}</span></h2>`;
  }
}

function renderDivider(style: TemplateStyleConfig) {
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

function renderListBlock(
  type: "ul" | "ol",
  items: string[],
  style: TemplateStyleConfig,
) {
  const { list, paragraph, colors } = style;
  const baseText = `color:${colors.textColor};font-size:${paragraph.fontSize}px;line-height:${paragraph.lineHeight};letter-spacing:${paragraph.letterSpacing}px;`;

  if (type === "ul") {
    const isCustomMarker = list.unorderedStyle === "dash" || list.unorderedStyle === "check";
    const listType = isCustomMarker ? "none" : list.unorderedStyle;
    const paddingLeft = isCustomMarker ? Math.max(8, list.indent - 10) : list.indent;
    const markerChar = list.unorderedStyle === "check" ? "✓" : "—";
    const lis = items
      .map((item, idx) => {
        const mb = idx === items.length - 1 ? 0 : list.itemSpacing;
        const prefix = isCustomMarker
          ? `<span style="display:inline-block;min-width:18px;font-weight:700;color:${colors.accentColor};">${markerChar}</span>`
          : "";
        return `<li style="margin-bottom:${mb}px;text-align:${paragraph.textAlign};">${prefix}${formatInline(item, style)}</li>`;
      })
      .join("");
    return `<ul style="list-style-type:${listType};padding-left:${paddingLeft}px;margin:${paragraph.marginTop}px 0 ${paragraph.marginBottom}px 0;${baseText}">${lis}</ul>`;
  }

  const isLeadingZero = list.orderedStyle === "leading-zero";
  const listType = isLeadingZero ? "none" : "decimal";
  const paddingLeft = isLeadingZero ? Math.max(8, list.indent - 10) : list.indent;
  const lis = items
    .map((item, idx) => {
      const mb = idx === items.length - 1 ? 0 : list.itemSpacing;
      const prefix = isLeadingZero
        ? `<span style="display:inline-block;min-width:26px;font-weight:700;color:${colors.primaryColor};">${String(idx + 1).padStart(2, "0")}.</span>`
        : "";
      return `<li style="margin-bottom:${mb}px;text-align:${paragraph.textAlign};">${prefix}${formatInline(item, style)}</li>`;
    })
    .join("");
  return `<ol style="list-style-type:${listType};padding-left:${paddingLeft}px;margin:${paragraph.marginTop}px 0 ${paragraph.marginBottom}px 0;${baseText}">${lis}</ol>`;
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
        `<th style="padding:8px 12px;text-align:left;font-weight:600;color:${colors.primaryColor};background:${colors.quoteBgColor};border:1px solid ${colors.borderColor};">${formatInline(cell, style)}</th>`,
    )
    .join("");
  const trs = bodyRows
    .map(
      (row) =>
        `<tr>${row
          .map(
            (cell) =>
              `<td style="padding:8px 12px;color:${colors.textColor};border:1px solid ${colors.borderColor};">${formatInline(cell, style)}</td>`,
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
    blocks.push(renderListBlock(listType, listItems, style));
    listType = null;
    listItems = [];
  };

  const flushTable = () => {
    if (tableRows.length === 0) return;
    blocks.push(renderTable(tableRows, style));
    tableRows = [];
  };

  const { colors, paragraph } = style;

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
      blocks.push(renderDivider(style));
      continue;
    }

    const standaloneImg = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(trimmed);
    if (standaloneImg) {
      flushList();
      blocks.push(renderImageBlock(escapeHtml(standaloneImg[1]), standaloneImg[2], style));
      continue;
    }

    const headingMatch = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      flushList();
      const level = headingMatch[1].length as 1 | 2 | 3;
      blocks.push(renderHeading(level, headingMatch[2], style, h2Counter));
      continue;
    }

    const quoteMatch = /^>\s*(.+)$/.exec(trimmed);
    if (quoteMatch) {
      flushList();
      blocks.push(
        `<blockquote style="margin:${paragraph.marginTop}px 0 ${paragraph.marginBottom}px 0;padding:14px 16px;background:${colors.quoteBgColor};border-left:4px solid ${colors.accentColor};border-radius:0 8px 8px 0;color:${colors.textColor};font-size:${Math.max(14, paragraph.fontSize - 1)}px;line-height:${paragraph.lineHeight};letter-spacing:${paragraph.letterSpacing}px;text-align:${paragraph.textAlign};">${formatInline(quoteMatch[1], style)}</blockquote>`,
      );
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
    blocks.push(
      `<p style="margin:${paragraph.marginTop}px 0 ${paragraph.marginBottom}px 0;color:${colors.textColor};font-size:${paragraph.fontSize}px;line-height:${paragraph.lineHeight};letter-spacing:${paragraph.letterSpacing}px;text-align:${paragraph.textAlign};">${formatInline(trimmed, style)}</p>`,
    );
  }
  flushList();
  flushTable();
  if (inCode && codeLines.length > 0) {
    blocks.push(renderCodeBlock(codeLines.join("\n"), codeLang, style));
  }

  return `<section style="background:${colors.bgColor};color:${colors.textColor};padding:24px 18px;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif;">${blocks.join("")}</section>`;
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
