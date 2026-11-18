import "server-only";
import sharp from "sharp";
import { StudioError } from "@/lib/studio/errors";
import type { SnapshotOrderedNode } from "@/lib/studio/article-graph";
import { plainToRuns, type StructuredArticleBlock } from "./structured";

const QWEN_ENDPOINT =
  process.env.QWEN_BASE_URL?.replace(/\/+$/, "")
  || "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";

export interface PreparedSnapshotImage {
  nodeId: string;
  assetId: string;
  dataUrl: string;
  filename?: string;
}

export interface QwenGeneratedArticle {
  title: string;
  blocks: StructuredArticleBlock[];
  warnings: string[];
}

export async function downscaleImageForVision(rawBuffer: ArrayBuffer): Promise<string> {
  const resized = await sharp(Buffer.from(rawBuffer))
    .rotate()
    .resize({ width: 768, height: 768, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 78 })
    .toBuffer();
  return `data:image/jpeg;base64,${resized.toString("base64")}`;
}

const ARTICLE_JSON_SCHEMA = {
  name: "structured_wechat_article",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["title", "blocks", "warnings"],
    properties: {
      title: { type: "string" },
      warnings: {
        type: "array",
        items: { type: "string" },
      },
      blocks: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["type", "sourceNodeId", "level", "text", "ordered", "items", "assetId", "alt", "caption"],
          properties: {
            type: {
              type: "string",
              enum: ["heading", "paragraph", "blockquote", "list", "image", "divider", "verbatim"],
            },
            sourceNodeId: { type: "string" },
            level: { type: "integer", enum: [1, 2, 3] },
            text: { type: "string" },
            ordered: { type: "boolean" },
            items: { type: "array", items: { type: "string" } },
            assetId: { type: "string" },
            alt: { type: "string" },
            caption: { type: "string" },
          },
        },
      },
    },
  },
};

interface RawQwenBlock {
  type?: unknown;
  sourceNodeId?: unknown;
  level?: unknown;
  text?: unknown;
  ordered?: unknown;
  items?: unknown;
  assetId?: unknown;
  alt?: unknown;
  caption?: unknown;
}

export function parseQwenJsonPayload(rawContent: string): {
  title?: unknown;
  blocks?: unknown;
  warnings?: unknown;
} {
  const cleaned = rawContent
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const parsed: unknown = JSON.parse(cleaned);
  if (Array.isArray(parsed) && parsed.length > 0 && parsed[0] && typeof parsed[0] === "object") {
    return parsed[0] as Record<string, unknown>;
  }
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }
  throw new StudioError("模型返回的数据结构无效。", 502);
}

/**
 * Validates Qwen output against the immutable snapshot:
 * 1. Filters out invalid block types, foreign sourceNodeIds, and requirement-node leaks.
 * 2. Forces every `verbatim` snapshot node to use its exact snapshot text verbatim and in relative order.
 * 3. Forces image blocks to reference only snapshot image assets and preserves all snapshot images in order.
 */
export function finalizeQwenArticleOutput(
  raw: { title?: unknown; blocks?: unknown; warnings?: unknown },
  snapshotNodes: SnapshotOrderedNode[],
  fallbackTitle: string,
): QwenGeneratedArticle {
  const nodeById = new Map<string, SnapshotOrderedNode>();
  const requirementIds = new Set<string>();
  const verbatimNodes: SnapshotOrderedNode[] = [];
  const imageNodes: SnapshotOrderedNode[] = [];
  const validAssetNodeMap = new Map<string, SnapshotOrderedNode>();

  for (const n of snapshotNodes) {
    nodeById.set(n.nodeId, n);
    if (n.kind === "text" && n.role === "requirement") requirementIds.add(n.nodeId);
    if (n.kind === "text" && n.role === "verbatim") verbatimNodes.push(n);
    if (n.kind === "image" && n.assetId) {
      imageNodes.push(n);
      validAssetNodeMap.set(n.assetId, n);
    }
  }

  const title =
    typeof raw.title === "string" && raw.title.trim()
      ? raw.title.trim().slice(0, 160)
      : fallbackTitle;

  const warnings: string[] = Array.isArray(raw.warnings)
    ? raw.warnings
        .filter((w): w is string => typeof w === "string" && w.trim().length > 0)
        .map((w) => w.trim())
        .slice(0, 20)
    : [];

  const rawBlocks = Array.isArray(raw.blocks) ? (raw.blocks as RawQwenBlock[]) : [];
  const placedVerbatimIds = new Set<string>();
  const placedImageNodeIds = new Set<string>();
  const blocks: StructuredArticleBlock[] = [];

  function makeVerbatimBlocks(node: SnapshotOrderedNode): StructuredArticleBlock[] {
    const exactText = node.text ?? "";
    if (!exactText.trim()) return [];
    return [
      {
        id: crypto.randomUUID(),
        type: "paragraph",
        runs: plainToRuns(exactText),
        sourceNodeId: node.nodeId,
        verbatim: true,
      },
    ];
  }

  let nextVerbatimIdx = 0;
  let nextImageIdx = 0;

  for (const item of rawBlocks) {
    const bType = typeof item?.type === "string" ? item.type : "";
    const rawSourceId = typeof item?.sourceNodeId === "string" ? item.sourceNodeId.trim() : "";
    const sourceNode = rawSourceId && nodeById.has(rawSourceId) ? nodeById.get(rawSourceId) : undefined;

    // Never output a requirement node directly as content
    if (rawSourceId && requirementIds.has(rawSourceId)) {
      continue;
    }

    // If this block references a verbatim node OR has type === "verbatim", enforce exact snapshot order & text
    if (bType === "verbatim" || (sourceNode?.kind === "text" && sourceNode.role === "verbatim")) {
      const targetVerbatim = verbatimNodes[nextVerbatimIdx];
      if (targetVerbatim && !placedVerbatimIds.has(targetVerbatim.nodeId)) {
        placedVerbatimIds.add(targetVerbatim.nodeId);
        nextVerbatimIdx += 1;
        blocks.push(...makeVerbatimBlocks(targetVerbatim));
      }
      continue;
    }

    if (bType === "image") {
      // Enforce snapshot image order and asset ownership
      const expectedImageNode = imageNodes[nextImageIdx];
      if (!expectedImageNode || !expectedImageNode.assetId) continue;
      placedImageNodeIds.add(expectedImageNode.nodeId);
      nextImageIdx += 1;
      const alt =
        typeof item.alt === "string" && item.alt.trim()
          ? item.alt.trim().slice(0, 120)
          : expectedImageNode.filename || "文章配图";
      const caption =
        typeof item.caption === "string" && item.caption.trim()
          ? item.caption.trim().slice(0, 200)
          : undefined;
      blocks.push({
        id: crypto.randomUUID(),
        type: "image",
        assetId: expectedImageNode.assetId,
        alt,
        ...(caption ? { caption } : {}),
        sourceNodeId: expectedImageNode.nodeId,
      });
      continue;
    }

    if (bType === "divider") {
      blocks.push({ id: crypto.randomUUID(), type: "divider" });
      continue;
    }

    if (bType === "heading") {
      const text = typeof item.text === "string" ? item.text.trim() : "";
      if (!text) continue;
      const level = item.level === 1 || item.level === 2 || item.level === 3 ? item.level : 2;
      // Avoid duplicating H1 if identical to article title
      if (level === 1 && text === title) continue;
      blocks.push({
        id: crypto.randomUUID(),
        type: "heading",
        level: level === 1 ? 2 : level,
        runs: plainToRuns(text),
        ...(sourceNode ? { sourceNodeId: sourceNode.nodeId } : {}),
      });
      continue;
    }

    if (bType === "blockquote") {
      const text = typeof item.text === "string" ? item.text.trim() : "";
      if (!text) continue;
      blocks.push({
        id: crypto.randomUUID(),
        type: "blockquote",
        runs: plainToRuns(text),
        ...(sourceNode ? { sourceNodeId: sourceNode.nodeId } : {}),
      });
      continue;
    }

    if (bType === "list") {
      const rawItems = Array.isArray(item.items)
        ? item.items.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
        : [];
      if (rawItems.length === 0) continue;
      blocks.push({
        id: crypto.randomUUID(),
        type: "list",
        ordered: item.ordered === true,
        items: rawItems.map((txt) => ({
          id: crypto.randomUUID(),
          runs: plainToRuns(txt.trim()),
        })),
        ...(sourceNode ? { sourceNodeId: sourceNode.nodeId } : {}),
      });
      continue;
    }

    if (bType === "paragraph") {
      const text = typeof item.text === "string" ? item.text.trim() : "";
      if (!text) continue;
      blocks.push({
        id: crypto.randomUUID(),
        type: "paragraph",
        runs: plainToRuns(text),
        ...(sourceNode ? { sourceNodeId: sourceNode.nodeId } : {}),
      });
    }
  }

  // Deterministically insert any omitted verbatim or image nodes at their relative snapshot positions
  const remainingNodes = snapshotNodes.filter(
    (n) =>
      (n.kind === "text" && n.role === "verbatim" && !placedVerbatimIds.has(n.nodeId))
      || (n.kind === "image" && n.assetId && !placedImageNodeIds.has(n.nodeId)),
  );

  for (const missing of remainingNodes) {
    if (missing.kind === "text" && missing.role === "verbatim") {
      blocks.push(...makeVerbatimBlocks(missing));
    } else if (missing.kind === "image" && missing.assetId) {
      blocks.push({
        id: crypto.randomUUID(),
        type: "image",
        assetId: missing.assetId,
        alt: missing.filename || "文章配图",
        sourceNodeId: missing.nodeId,
      });
    }
  }

  if (blocks.length === 0) {
    throw new StudioError("模型未能生成有效文章内容，请检查素材后重试。", 502);
  }

  return { title, blocks, warnings };
}

export async function generateArticleWithQwen(
  snapshotNodes: SnapshotOrderedNode[],
  preparedImages: Map<string, PreparedSnapshotImage>,
  fallbackTitle: string,
): Promise<QwenGeneratedArticle> {
  const apiKey = process.env.QWEN_KEY?.trim();
  const model = process.env.QWEN_MODEL?.trim() || "qwen3.7-plus";
  if (!apiKey) {
    throw new StudioError("服务端尚未配置 QWEN_KEY。", 503);
  }

  const contentParts: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [];

  contentParts.push({
    type: "text",
    text: [
      "你是一位专业的微信公众号主编与排版撰稿人。请根据用户按顺序编排的画布节点（包含创作素材、写作要求、原文保留块及配图），扩写并组织成一篇结构清晰、文笔流畅的微信公众号文章。",
      "严格遵守以下规则：",
      "1. 节点类型说明：",
      "   - [写作要求 (requirement)]：仅作为文风、受众、结构、篇幅或口吻的指令遵循，绝不能把写作要求本身直接写进文章正文。",
      "   - [创作素材 (material)]：你的核心扩写依据，可提炼二级/三级小标题（heading）、正文段落（paragraph）、要点列表（list）与金句引用（blockquote），并在章节过渡处适当加入分割线（divider）。",
      "   - [原文保留 (verbatim)]：必须按该节点在序列中的相对位置输出一个 `type: \"verbatim\"` 且 `sourceNodeId` 为该节点 ID 的块，不要改写、拆分或遗漏。",
      "   - [配图 (image)]：仔细观察提供的真实图片画面内容，按图片节点的先后顺序在恰当段落位置输出 `type: \"image\"` 块，填入对应的 `sourceNodeId`、`assetId`、准确的 `alt` 描述及简短贴切的图注 `caption`。",
      "2. 事实核对与防幻觉守则：",
      "   - 严禁凭空捏造素材和图片中没有依据的具体人名、机构名、具体日期、统计数字或直接引语。",
      "   - 若行文涉及某个人名、日期、数据或引语缺乏明确依据，请用稳妥的泛化表述（或留出待填提示），并在 `warnings` 数组中明确列出提请用户核对的事项（例如：\"活动具体举办日期未在素材中提供，请核对\"）。",
      "3. JSON Schema 字段约定（每个 block 均需包含所有字段，不适用字段填默认值：`level` 填 2，`text` 填 \"\"，`ordered` 填 false，`items` 填 []，`assetId` 填 \"\"，`alt` 填 \"\"，`caption` 填 \"\"，`sourceNodeId` 填对应来源节点 ID 或 \"\"）。",
      "",
      "以下是按文章顺序排列的画布节点：",
    ].join("\n"),
  });

  for (const node of snapshotNodes) {
    if (node.kind === "text") {
      const roleTag =
        node.role === "requirement"
          ? "写作要求 (requirement)"
          : node.role === "verbatim"
            ? "原文保留 (verbatim)"
            : "创作素材 (material)";
      contentParts.push({
        type: "text",
        text: `\n--- 节点 #${node.order} [nodeId=${node.nodeId}] 类型：${roleTag} ---\n${node.text ?? ""}\n`,
      });
    } else if (node.kind === "image" && node.assetId) {
      const img = preparedImages.get(node.assetId);
      contentParts.push({
        type: "text",
        text: `\n--- 节点 #${node.order} [nodeId=${node.nodeId}] 类型：配图 (image) [assetId=${node.assetId}] ---`,
      });
      if (img) {
        contentParts.push({
          type: "image_url",
          image_url: { url: img.dataUrl },
        });
      }
    }
  }

  const response = await fetch(QWEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      enable_thinking: false,
      messages: [{ role: "user", content: contentParts }],
      response_format: {
        type: "json_schema",
        json_schema: ARTICLE_JSON_SCHEMA,
      },
    }),
    signal: AbortSignal.timeout(55_000),
    cache: "no-store",
  }).catch((err: unknown) => {
    const isTimeout = err instanceof Error && err.name === "TimeoutError";
    throw new StudioError(
      isTimeout ? "Qwen 生成超时，请点击重试。" : "无法连接 Qwen 生成服务，请稍后重试。",
      504,
    );
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("Qwen API error", response.status, detail.slice(0, 200));
    throw new StudioError(`Qwen 生成请求失败（HTTP ${response.status}），请重试。`, 502);
  }

  const body = (await response.json().catch(() => null)) as {
    choices?: Array<{ message?: { content?: string } }>;
  } | null;
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new StudioError("Qwen 返回了空内容，请重试。", 502);
  }

  const rawParsed = parseQwenJsonPayload(content);
  return finalizeQwenArticleOutput(rawParsed, snapshotNodes, fallbackTitle);
}
