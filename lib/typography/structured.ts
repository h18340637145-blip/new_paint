import {
  collectProjectAssetIdsFromTree,
  extractPlainTextFromTree,
  type AppliedComponentSnapshot,
} from "./custom-tree";
import type { AppliedLibraryTemplateMeta, TemplateStyleConfig } from "./types";

export type FontFamilyChoice = "default" | "sans" | "serif" | "mono";

export const FONT_FAMILY_STACK: Record<Exclude<FontFamilyChoice, "default">, string> = {
  sans: "-apple-system,BlinkMacSystemFont,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif",
  serif: "'Songti SC','STSong','Noto Serif CJK SC','Source Han Serif SC',Georgia,serif",
  mono: "ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace",
};

export interface DocumentTextStyle {
  fontSize?: number | null;
  fontFamily?: FontFamilyChoice;
  color?: string | null;
  bold?: boolean | null;
  italic?: boolean | null;
  appliedLibraryTemplate?: AppliedLibraryTemplateMeta | null;
}

export interface TextRunStyle {
  fontSize?: number;
  fontFamily?: Exclude<FontFamilyChoice, "default">;
  bold?: boolean;
  italic?: boolean;
  color?: string;
}

export interface TextRun {
  text: string;
  style?: TextRunStyle;
}

export interface StructuredListItem {
  id: string;
  runs: TextRun[];
}

export type StructuredArticleBlock =
  | {
      id: string;
      type: "heading";
      level: 1 | 2 | 3;
      runs: TextRun[];
      presetId?: string;
      customComponent?: AppliedComponentSnapshot;
      sourceNodeId?: string;
      verbatim?: boolean;
    }
  | {
      id: string;
      type: "paragraph";
      runs: TextRun[];
      presetId?: string;
      customComponent?: AppliedComponentSnapshot;
      sourceNodeId?: string;
      verbatim?: boolean;
    }
  | {
      id: string;
      type: "blockquote";
      runs: TextRun[];
      presetId?: string;
      customComponent?: AppliedComponentSnapshot;
      sourceNodeId?: string;
      verbatim?: boolean;
    }
  | {
      id: string;
      type: "list";
      ordered: boolean;
      items: StructuredListItem[];
      sourceNodeId?: string;
    }
  | {
      id: string;
      type: "image";
      assetId: string;
      alt: string;
      caption?: string;
      presetId?: string;
      customComponent?: AppliedComponentSnapshot;
      sourceNodeId?: string;
    }
  | {
      id: string;
      type: "preset";
      presetId: string;
      runs: TextRun[];
      sourceNodeId?: string;
    }
  | {
      id: string;
      type: "custom-component";
      snapshot: AppliedComponentSnapshot;
      runs?: TextRun[];
      sourceNodeId?: string;
    }
  | {
      id: string;
      type: "divider";
      customComponent?: AppliedComponentSnapshot;
    };

export interface StructuredArticleDraft {
  id: string;
  projectId: string;
  snapshotId: string;
  taskId: string | null;
  title: string;
  subTemplateId: string;
  templateStyle: TemplateStyleConfig;
  documentStyle: DocumentTextStyle;
  blocks: StructuredArticleBlock[];
  warnings: string[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export function plainToRuns(text: string): TextRun[] {
  return [{ text }];
}

export function runsToPlainText(runs: TextRun[]): string {
  return runs.map((r) => r.text).join("");
}

function cleanRunStyle(style?: TextRunStyle): TextRunStyle | undefined {
  if (!style) return undefined;
  const out: TextRunStyle = {};
  if (typeof style.fontSize === "number" && Number.isFinite(style.fontSize)) out.fontSize = style.fontSize;
  if (style.fontFamily === "sans" || style.fontFamily === "serif" || style.fontFamily === "mono") {
    out.fontFamily = style.fontFamily;
  }
  if (typeof style.bold === "boolean") out.bold = style.bold;
  if (typeof style.italic === "boolean") out.italic = style.italic;
  if (typeof style.color === "string" && style.color.trim()) out.color = style.color.trim();
  return Object.keys(out).length > 0 ? out : undefined;
}

function sameRunStyle(a?: TextRunStyle, b?: TextRunStyle): boolean {
  const ca = cleanRunStyle(a);
  const cb = cleanRunStyle(b);
  if (!ca && !cb) return true;
  if (!ca || !cb) return false;
  return (
    ca.fontSize === cb.fontSize
    && ca.fontFamily === cb.fontFamily
    && ca.bold === cb.bold
    && ca.italic === cb.italic
    && ca.color === cb.color
  );
}

export function normalizeRuns(runs: TextRun[]): TextRun[] {
  const merged: TextRun[] = [];
  for (const run of runs) {
    if (!run.text) continue;
    const cleaned = cleanRunStyle(run.style);
    const prev = merged[merged.length - 1];
    if (prev && sameRunStyle(prev.style, cleaned)) {
      prev.text += run.text;
    } else {
      merged.push(cleaned ? { text: run.text, style: cleaned } : { text: run.text });
    }
  }
  return merged.length > 0 ? merged : [{ text: "" }];
}

/**
 * Splits `runs` at `[start, end]` and applies `patch` (or clears local styles if `"clear"`).
 */
export function applyRunStyleRange(
  runs: TextRun[],
  start: number,
  end: number,
  patch: Partial<TextRunStyle> | "clear",
): TextRun[] {
  if (end <= start) return runs;
  const out: TextRun[] = [];
  let cursor = 0;

  for (const run of runs) {
    const runStart = cursor;
    const runEnd = cursor + run.text.length;
    cursor = runEnd;

    if (runEnd <= start || runStart >= end) {
      out.push(run);
      continue;
    }

    if (runStart < start) {
      out.push({ text: run.text.slice(0, start - runStart), style: run.style });
    }

    const midStart = Math.max(start, runStart) - runStart;
    const midEnd = Math.min(end, runEnd) - runStart;
    const midText = run.text.slice(midStart, midEnd);
    if (patch === "clear") {
      out.push({ text: midText });
    } else {
      const mergedStyle: TextRunStyle = { ...(run.style ?? {}) };
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined) {
          delete mergedStyle[k as keyof TextRunStyle];
        } else {
          (mergedStyle as Record<string, unknown>)[k] = v;
        }
      }
      out.push({ text: midText, style: cleanRunStyle(mergedStyle) });
    }

    if (runEnd > end) {
      out.push({ text: run.text.slice(end - runStart), style: run.style });
    }
  }

  return normalizeRuns(out);
}

/**
 * Updates plain text while preserving existing inline run styles outside the edited span.
 */
export function syncPlainTextIntoRuns(runs: TextRun[], nextPlain: string): TextRun[] {
  const prevPlain = runsToPlainText(runs);
  if (prevPlain === nextPlain) return runs;
  if (!nextPlain) return [{ text: "" }];
  if (!prevPlain) return [{ text: nextPlain, style: runs[0]?.style }];

  let prefix = 0;
  while (
    prefix < prevPlain.length
    && prefix < nextPlain.length
    && prevPlain[prefix] === nextPlain[prefix]
  ) {
    prefix += 1;
  }

  let prevSuffix = prevPlain.length;
  let nextSuffix = nextPlain.length;
  while (
    prevSuffix > prefix
    && nextSuffix > prefix
    && prevPlain[prevSuffix - 1] === nextPlain[nextSuffix - 1]
  ) {
    prevSuffix -= 1;
    nextSuffix -= 1;
  }

  // If both ends changed simultaneously (e.g. paste/replace), preserve any uniquely matching styled runs
  if (prefix === 0 && prevSuffix === prevPlain.length) {
    const styledRuns = runs.filter((r) => r.style && r.text.length >= 2);
    if (styledRuns.length > 0) {
      let result: TextRun[] = [{ text: nextPlain }];
      for (const sr of styledRuns) {
        const firstIdx = nextPlain.indexOf(sr.text);
        if (firstIdx >= 0 && nextPlain.indexOf(sr.text, firstIdx + 1) === -1 && sr.style) {
          result = applyRunStyleRange(result, firstIdx, firstIdx + sr.text.length, sr.style);
        }
      }
      return result;
    }
  }

  const inserted = nextPlain.slice(prefix, nextSuffix);
  const out: TextRun[] = [];
  let cursor = 0;
  let insertedPlaced = false;
  let inheritedStyle: TextRunStyle | undefined;

  for (const run of runs) {
    const runStart = cursor;
    const runEnd = cursor + run.text.length;
    cursor = runEnd;

    if (runStart <= prefix && prefix <= runEnd && inheritedStyle === undefined) {
      inheritedStyle = run.style;
    }

    if (runEnd <= prefix) {
      out.push(run);
      continue;
    }

    if (runStart < prefix) {
      out.push({ text: run.text.slice(0, prefix - runStart), style: run.style });
    }

    if (!insertedPlaced && inserted) {
      out.push({ text: inserted, style: inheritedStyle });
      insertedPlaced = true;
    }

    if (runEnd > prevSuffix) {
      const startOffset = Math.max(0, prevSuffix - runStart);
      out.push({ text: run.text.slice(startOffset), style: run.style });
    }
  }

  if (!insertedPlaced && inserted) {
    out.push({ text: inserted, style: inheritedStyle });
  }

  return normalizeRuns(out);
}

export function extractDraftImageAssetIds(blocks: StructuredArticleBlock[]): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  const addId = (id: string | undefined) => {
    if (id && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  };
  for (const block of blocks) {
    if (block.type === "image") {
      addId(block.assetId);
    }
    if ("customComponent" in block && block.customComponent) {
      for (const id of collectProjectAssetIdsFromTree(block.customComponent.rootNode)) {
        addId(id);
      }
    }
    if (block.type === "custom-component") {
      for (const id of collectProjectAssetIdsFromTree(block.snapshot.rootNode)) {
        addId(id);
      }
    }
  }
  return ids;
}

export function structuredDraftToPlainText(draft: Pick<StructuredArticleDraft, "title" | "blocks">): string {
  const parts: string[] = [];
  if (draft.title.trim()) parts.push(draft.title.trim());
  for (const block of draft.blocks) {
    if (
      block.type === "heading"
      || block.type === "paragraph"
      || block.type === "blockquote"
      || block.type === "preset"
    ) {
      const txt = runsToPlainText(block.runs).trim();
      if (txt) parts.push(txt);
    } else if (block.type === "custom-component") {
      const txt = block.runs
        ? runsToPlainText(block.runs).trim()
        : extractPlainTextFromTree(block.snapshot.rootNode).trim();
      if (txt) parts.push(txt);
    } else if (block.type === "list") {
      block.items.forEach((item, i) => {
        const txt = runsToPlainText(item.runs).trim();
        if (txt) parts.push(block.ordered ? `${i + 1}. ${txt}` : `- ${txt}`);
      });
    } else if (block.type === "divider") {
      parts.push("---");
    }
  }
  return parts.join("\n\n");
}
