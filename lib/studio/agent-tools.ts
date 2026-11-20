import "server-only";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreativePlanProposal, CreativePlanStep } from "./agent-events";
import { describeImageWithZhipuVision } from "./agent-model";
import { StudioError } from "./auth";
import { ensureSubmissions, startPending } from "./generation";
import {
  maxPromptLength,
  promptBounds,
  supportedRatios,
  supportedResolutions,
  type GenerationConfig,
  type Model,
  type Resolution,
} from "./models";
import { bucket, uuidPattern } from "./projects";
import { detectImageMime } from "./storage";

type Project = { id: string; owner_id: string; title: string };

const assetIdSchema = { type: "string", description: "项目素材的 UUID" };
const noParameters = { type: "object", properties: {}, additionalProperties: false };
const assetParameters = {
  type: "object",
  properties: { assetId: assetIdSchema },
  required: ["assetId"],
  additionalProperties: false,
};

const AGENT_IMAGE_MODELS = ["seedream-5-5", "nano-banana-2", "gpt-image-2"] as const;
type AgentImageModel = (typeof AGENT_IMAGE_MODELS)[number];

function resolveAgentImageConfig(
  rawModel: unknown,
  rawAspectRatio: unknown,
  rawResolution?: unknown,
): GenerationConfig {
  const model: AgentImageModel =
    typeof rawModel === "string" && (AGENT_IMAGE_MODELS as readonly string[]).includes(rawModel)
      ? (rawModel as AgentImageModel)
      : "seedream-5-5";

  const allowedRes = supportedResolutions(model);
  const defaultRes: Resolution = model === "seedream-5-5" ? "2K" : "1K";
  const resolution: Resolution =
    typeof rawResolution === "string" && (allowedRes as readonly string[]).includes(rawResolution)
      ? (rawResolution as Resolution)
      : defaultRes;

  const ratios = supportedRatios(model, resolution);
  const defaultRatio = model === "seedream-5-5" ? "16:9" : "1:1";
  const aspectRatio =
    typeof rawAspectRatio === "string" && ratios.includes(rawAspectRatio)
      ? rawAspectRatio
      : defaultRatio;

  return { model, resolution, aspectRatio, count: 1 };
}

export function createStudioTools(
  database: SupabaseClient,
  project: Project,
  options?: {
    cover?: { style: string; onSubmit: () => void };
    supportsDirectVision?: boolean;
  },
): AgentTool[] {
  const cover = options?.cover;
  const supportsDirectVision = options?.supportsDirectVision ?? false;
  let coverSubmitted = false;
  const inspected = new Set<string>();

  function parseId(input: unknown, label = "无效的编号。") {
    if (typeof input !== "string" || !uuidPattern.test(input)) throw new Error(label);
    return input;
  }

  async function imageAsset(id: string) {
    const { data, error } = await database
      .from("studio_assets")
      .select("id,path,kind,filename")
      .eq("project_id", project.id)
      .eq("id", id)
      .in("kind", ["reference", "generated"])
      .maybeSingle();
    if (error || !data) throw new Error("该图片不在当前项目中。");
    return data;
  }

  async function computeCanvasBottomY(): Promise<number> {
    const [placedRes, jobsRes, textRes] = await Promise.all([
      database.from("studio_canvas_nodes").select("position_y").eq("project_id", project.id),
      database
        .from("studio_jobs")
        .select("position_y")
        .eq("project_id", project.id)
        .eq("canvas_hidden", false),
      database.from("studio_article_text_nodes").select("position_y").eq("project_id", project.id),
    ]);
    const ys = [
      ...(placedRes.data ?? []).map((r) => Number(r.position_y) || 0),
      ...(jobsRes.data ?? []).map((r) => Number(r.position_y) || 0),
      ...(textRes.data ?? []).map((r) => Number(r.position_y) || 0),
    ];
    if (ys.length === 0) return 100;
    return Math.max(...ys) + 340;
  }

  function json(value: unknown) {
    return { content: [{ type: "text" as const, text: JSON.stringify(value) }], details: value };
  }

  const baseTools: AgentTool[] = [
    {
      name: "list_assets",
      label: "列出项目素材",
      description: "列出当前项目的图片和 Markdown 资料及对应编号。",
      parameters: noParameters,
      execute: async () => {
        const { data, error } = await database
          .from("studio_assets")
          .select("id,filename,kind")
          .eq("project_id", project.id)
          .order("created_at", { ascending: false })
          .limit(100);
        if (error) throw new Error("无法读取项目素材。");
        return json(data);
      },
    },
    {
      name: "view_image",
      label: "查看图片",
      description: "读取真实图片以识别主体、风格、色调及构图。在使用参考图进行图生图前必须先调用此工具查看。",
      parameters: assetParameters,
      execute: async (_, raw) => {
        const id = parseId((raw as { assetId?: unknown })?.assetId, "无效的素材编号。");
        const asset = await imageAsset(id);
        const { data, error } = await database.storage.from(bucket).download(asset.path);
        if (error || !data || data.size > 50 * 1024 * 1024) throw new Error("无法读取该项目图片。");
        const bytes = new Uint8Array(await data.arrayBuffer());
        const mimeType = detectImageMime(bytes);
        if (!mimeType) throw new Error("无法识别图片格式。");
        inspected.add(id);

        if (supportsDirectVision) {
          return {
            content: [{ type: "image" as const, mimeType, data: Buffer.from(bytes).toString("base64") }],
            details: { assetId: id, filename: asset.filename, mimeType },
          };
        }

        const description = await describeImageWithZhipuVision(bytes, mimeType, asset.filename);
        return json({
          assetId: id,
          filename: asset.filename,
          mimeType,
          visualDescription: description,
        });
      },
    },
    {
      name: "read_canvas",
      label: "读取当前画布",
      description: "取得当前画布中的文案节点、图片节点、坐标及有向连线。",
      parameters: noParameters,
      execute: async () => {
        const [nodes, jobs, texts, edges] = await Promise.all([
          database
            .from("studio_canvas_nodes")
            .select("id,asset_id,position_x,position_y,width")
            .eq("project_id", project.id),
          database
            .from("studio_jobs")
            .select("id,asset_id,status,position_x,position_y,canvas_width")
            .eq("project_id", project.id)
            .eq("canvas_hidden", false),
          database
            .from("studio_article_text_nodes")
            .select("id,content,role,position_x,position_y,width")
            .eq("project_id", project.id)
            .order("created_at", { ascending: true }),
          database
            .from("studio_article_edges")
            .select("id,source_node_id,target_node_id")
            .eq("project_id", project.id)
            .order("created_at", { ascending: true }),
        ]);
        if (nodes.error || jobs.error) throw new Error("无法读取画布。");
        return json({
          placedImages: nodes.data ?? [],
          generatedImages: jobs.data ?? [],
          textNodes: texts.data ?? [],
          edges: edges.data ?? [],
        });
      },
    },
    {
      name: "generate_image",
      label: "生成单张图片",
      description: cover
        ? `一次生成四张「${cover.style}」宽幅公众号封面。提供四条各自完整且构图不同的提示词。`
        : "单独提交一张配图生成任务（默认使用 Seedream 5.5，也可按用户要求选 nano-banana-2 或 gpt-image-2）。若需同时生成整套文案+配图并自动连线，请优先使用 compose_canvas_flow。",
      executionMode: "sequential",
      parameters: cover
        ? {
            type: "object",
            additionalProperties: false,
            required: ["prompts", "referenceIds"],
            properties: {
              prompts: { type: "array", minItems: 4, maxItems: 4, items: { type: "string" } },
              referenceIds: { type: "array", items: assetIdSchema, maxItems: 16 },
            },
          }
        : {
            type: "object",
            additionalProperties: false,
            required: ["prompt", "referenceIds"],
            properties: {
              prompt: { type: "string", description: "完整详细的画面描述提示词（至少 5 个字符）" },
              referenceIds: { type: "array", items: assetIdSchema, maxItems: 4 },
              model: { type: "string", enum: ["seedream-5-5", "nano-banana-2", "gpt-image-2"] },
              aspectRatio: {
                type: "string",
                enum: ["auto", "1:1", "4:3", "3:4", "3:2", "2:3", "16:9", "9:16"],
              },
              resolution: { type: "string", enum: ["1K", "1.5K", "2K"] },
            },
          },
      execute: async (_, raw) => {
        const value = raw as {
          prompt?: unknown;
          prompts?: unknown;
          referenceIds?: unknown;
          model?: unknown;
          aspectRatio?: unknown;
          resolution?: unknown;
        };

        if (cover) {
          const inputs = value?.prompts;
          if (
            !Array.isArray(inputs)
            || inputs.length !== 4
            || !inputs.every((input) => typeof input === "string" && input.trim() && input.trim().length <= maxPromptLength)
            || new Set(inputs.map((input: string) => input.trim())).size !== inputs.length
            || !Array.isArray(value?.referenceIds)
            || value.referenceIds.length > 16
          ) {
            throw new Error("请提供四条不重复的有效提示词和参考图列表。");
          }
          const orderedReferenceIds = value.referenceIds.map((item) => parseId(item, "无效的素材编号。"));
          if (orderedReferenceIds.some((id) => !inspected.has(id))) {
            throw new Error("请先使用 view_image 逐一查看参考图。");
          }
          if (coverSubmitted) throw new Error("本轮封面任务已提交，请查看任务状态。");

          const prompts = inputs.map((input: string) => input.trim());
          const submissions = prompts.map((prompt: string) => ({
            id: crypto.randomUUID(),
            prompt,
            referenceId: null,
            orderedReferenceIds,
            config: { model: "gpt-image-2-5-flare" as Model, count: 1, resolution: "1K" as Resolution, aspectRatio: "16:9" },
          }));
          await ensureSubmissions(database, project, submissions);
          coverSubmitted = true;
          cover.onSubmit();

          const results = await Promise.allSettled(
            submissions.map(async ({ id }) => {
              await startPending(database, project, id);
              const { data, error } = await database
                .from("studio_jobs")
                .select("id,status,error_message")
                .eq("project_id", project.id)
                .eq("submission_id", id)
                .single();
              if (error || !data) throw new Error("任务已记录，但暂时无法读取提交状态。");
              if (data.status === "failed" || data.status === "unknown") {
                throw new Error(data.error_message || "任务暂未成功提交。");
              }
              return { submissionId: id, jobNodeId: data.id, model: "GPT Image 2.5 Flare", status: data.status };
            }),
          );
          return json(
            results.map((result, index) =>
              result.status === "fulfilled"
                ? { cover: index + 1, ...result.value }
                : { cover: index + 1, status: "failed", error: result.reason instanceof Error ? result.reason.message : "提交失败。" },
            ),
          );
        }

        const promptText = typeof value?.prompt === "string" ? value.prompt.trim() : "";
        const config = resolveAgentImageConfig(value?.model, value?.aspectRatio, value?.resolution);
        const bounds = promptBounds(config.model);
        if (promptText.length < bounds.min || promptText.length > bounds.max) {
          throw new Error(`生图提示词长度需在 ${bounds.min}–${bounds.max} 个字符之间。`);
        }
        const refList = Array.isArray(value?.referenceIds)
          ? value.referenceIds.map((item) => parseId(item, "无效的素材编号。"))
          : [];
        if (refList.some((id) => !inspected.has(id))) {
          throw new Error("使用参考图前请先调用 view_image 查看该图片。");
        }

        const subId = crypto.randomUUID();
        await ensureSubmissions(database, project, [
          {
            id: subId,
            prompt: promptText,
            config,
            referenceId: refList[0] ?? null,
          },
        ]);
        await startPending(database, project, subId);
        const { data, error } = await database
          .from("studio_jobs")
          .select("id,status,error_message")
          .eq("project_id", project.id)
          .eq("submission_id", subId)
          .single();
        if (error || !data) throw new Error("任务已记录，但暂时无法读取提交状态。");
        if (data.status === "failed" || data.status === "unknown") {
          throw new Error(data.error_message || "生图任务暂未成功提交。");
        }
        return json({
          submissionId: subId,
          jobNodeId: data.id,
          model: config.model,
          aspectRatio: config.aspectRatio,
          resolution: config.resolution,
          status: data.status,
        });
      },
    },
    {
      name: "place_asset",
      label: "将已有素材放到画布",
      description: "把当前项目的已有图片素材放置到画布节点。",
      parameters: assetParameters,
      execute: async (_, raw) => {
        const id = parseId((raw as { assetId?: unknown })?.assetId, "无效的素材编号。");
        await imageAsset(id);
        const nodeId = crypto.randomUUID();
        const baseY = await computeCanvasBottomY();
        const { error } = await database.from("studio_canvas_nodes").insert({
          id: nodeId,
          project_id: project.id,
          asset_id: id,
          position_x: 100,
          position_y: baseY,
        });
        if (error) throw new Error("无法放置画布节点。");
        return json({ nodeId, assetId: id });
      },
    },
  ];

  if (cover) {
    return baseTools;
  }

  const creativeTools: AgentTool[] = [
    {
      name: "propose_creative_plan",
      label: "输出创意分镜提案",
      description:
        "在【聊创意/给建议阶段】（用户尚未明确确认执行前）调用此工具，向用户展示结构化的画布图文创意方案与串联顺序。此工具不会改动画布或消耗生图额度。",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["title", "summary", "recommendedModel", "steps"],
        properties: {
          title: { type: "string", description: "创意主题或推文暂定标题" },
          summary: { type: "string", description: "核心创意切入点、受众与叙事节奏简述" },
          recommendedModel: {
            type: "string",
            enum: ["seedream-5-5", "nano-banana-2", "gpt-image-2"],
            description: "建议使用的生图模型，默认填 seedream-5-5",
          },
          steps: {
            type: "array",
            minItems: 2,
            maxItems: 12,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["kind", "brief"],
              properties: {
                kind: { type: "string", enum: ["text", "image"] },
                role: { type: "string", enum: ["material", "verbatim", "requirement"] },
                brief: { type: "string", description: "该节点计划生成的文案要点或画面构图简述" },
              },
            },
          },
        },
      },
      execute: async (_, raw) => {
        const input = raw as {
          title?: unknown;
          summary?: unknown;
          recommendedModel?: unknown;
          steps?: Array<{ kind?: unknown; role?: unknown; brief?: unknown }>;
        };
        const title = typeof input?.title === "string" && input.title.trim() ? input.title.trim().slice(0, 120) : "画布创意图文方案";
        const summary = typeof input?.summary === "string" ? input.summary.trim().slice(0, 500) : "";
        const recommendedModel: AgentImageModel =
          typeof input?.recommendedModel === "string"
          && (AGENT_IMAGE_MODELS as readonly string[]).includes(input.recommendedModel)
            ? (input.recommendedModel as AgentImageModel)
            : "seedream-5-5";
        const rawSteps = Array.isArray(input?.steps) ? input.steps.slice(0, 12) : [];
        const steps: CreativePlanStep[] = rawSteps
          .map((s, idx): CreativePlanStep | null => {
            const kind = s?.kind === "image" ? "image" : s?.kind === "text" ? "text" : null;
            const brief = typeof s?.brief === "string" ? s.brief.trim() : "";
            if (!kind || !brief) return null;
            const role =
              kind === "text" && (s?.role === "material" || s?.role === "verbatim" || s?.role === "requirement")
                ? s.role
                : kind === "text"
                  ? "material"
                  : undefined;
            return { order: idx + 1, kind, ...(role ? { role } : {}), brief };
          })
          .filter((x): x is CreativePlanStep => x !== null);

        if (steps.length === 0) {
          throw new Error("创意提案至少需要包含 1 个有效步骤。");
        }

        const proposal: CreativePlanProposal = {
          title,
          summary,
          recommendedModel,
          steps,
        };
        return json(proposal);
      },
    },
    {
      name: "compose_canvas_flow",
      label: "在画布自动生成图文并连线",
      description:
        "仅在【用户已认同创意方案或明确要求生成到画布】时调用！一次性在画布上按叙事顺序创建文案节点、提交配图生成（默认 Seedream 5.5）或复用已有图片，并自动建立有向顺序连线（#1 -> #2 -> #3...）。",
      executionMode: "sequential",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["items"],
        properties: {
          connectInOrder: {
            type: "boolean",
            description: "是否按 items 数组顺序自动用有向连线串联所有节点，默认 true",
          },
          items: {
            type: "array",
            minItems: 1,
            maxItems: 12,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["kind"],
              properties: {
                kind: {
                  type: "string",
                  enum: ["text", "generate_image", "existing_image"],
                },
                role: {
                  type: "string",
                  enum: ["material", "verbatim", "requirement"],
                  description: "当 kind='text' 时的节点用途，默认 'material'（创作素材/段落文案）",
                },
                content: {
                  type: "string",
                  description: "当 kind='text' 时写入画布节点的完整文案内容",
                },
                prompt: {
                  type: "string",
                  description: "当 kind='generate_image' 时的详细生图提示词（至少 6 个字符，包含主体、构图、光线与风格）",
                },
                model: {
                  type: "string",
                  enum: ["seedream-5-5", "nano-banana-2", "gpt-image-2"],
                  description: "当 kind='generate_image' 时的生图模型，默认 'seedream-5-5'",
                },
                aspectRatio: {
                  type: "string",
                  enum: ["1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3"],
                  description: "当 kind='generate_image' 时的宽高比，公众号横图推荐 16:9 或 4:3",
                },
                resolution: {
                  type: "string",
                  enum: ["1K", "1.5K", "2K"],
                },
                referenceAssetId: {
                  type: "string",
                  description: "可选：用于图生图的项目参考图 assetId（须先调用 view_image 查看）",
                },
                nodeOrAssetId: {
                  type: "string",
                  description: "当 kind='existing_image' 时，已有画布节点 ID 或项目图片 assetId",
                },
              },
            },
          },
        },
      },
      execute: async (_, raw) => {
        const payload = raw as {
          connectInOrder?: unknown;
          items?: Array<Record<string, unknown>>;
        };
        const rawItems = Array.isArray(payload?.items) ? payload.items : [];
        if (rawItems.length === 0 || rawItems.length > 12) {
          throw new Error("每次编排节点数量需在 1–12 个之间。");
        }
        const imageGenCount = rawItems.filter((it) => it?.kind === "generate_image").length;
        if (imageGenCount > 6) {
          throw new Error("单次自动编排最多同时生成 6 张配图。");
        }

        const connectInOrder = payload?.connectInOrder !== false;
        const baseY = await computeCanvasBottomY();
        const nowIso = new Date().toISOString();

        interface PlannedStep {
          index: number;
          x: number;
          y: number;
          kind: "text" | "generate_image" | "existing_image";
          role?: "material" | "verbatim" | "requirement";
          content?: string;
          prompt?: string;
          config?: GenerationConfig;
          referenceId?: string | null;
          nodeOrAssetId?: string;
        }

        const planned: PlannedStep[] = [];
        for (let i = 0; i < rawItems.length; i += 1) {
          const item = rawItems[i];
          const kind = item?.kind;
          const col = i % 3;
          const row = Math.floor(i / 3);
          const x = 100 + col * 380;
          const y = baseY + row * 340;

          if (kind === "text") {
            const content = typeof item.content === "string" ? item.content.trim() : "";
            if (!content || content.length > maxPromptLength) {
              throw new Error(`第 ${i + 1} 个文案节点内容不能为空。`);
            }
            const role =
              item.role === "verbatim" || item.role === "requirement" ? item.role : "material";
            planned.push({ index: i, x, y, kind: "text", role, content });
          } else if (kind === "generate_image") {
            const promptText = typeof item.prompt === "string" ? item.prompt.trim() : "";
            const config = resolveAgentImageConfig(item.model, item.aspectRatio, item.resolution);
            const bounds = promptBounds(config.model);
            if (promptText.length < bounds.min || promptText.length > bounds.max) {
              throw new Error(`第 ${i + 1} 个配图提示词长度需在 ${bounds.min}–${bounds.max} 个字符之间。`);
            }
            let referenceId: string | null = null;
            if (typeof item.referenceAssetId === "string" && item.referenceAssetId.trim()) {
              referenceId = parseId(item.referenceAssetId.trim(), "无效的参考图编号。");
              if (!inspected.has(referenceId)) {
                throw new Error("使用参考图前请先调用 view_image 查看该图片。");
              }
              await imageAsset(referenceId);
            }
            planned.push({ index: i, x, y, kind: "generate_image", prompt: promptText, config, referenceId });
          } else if (kind === "existing_image") {
            const targetId = parseId(item.nodeOrAssetId, `第 ${i + 1} 个图片节点的编号无效。`);
            planned.push({ index: i, x, y, kind: "existing_image", nodeOrAssetId: targetId });
          } else {
            throw new Error(`第 ${i + 1} 个节点的 kind 无效。`);
          }
        }

        // 1. Create all text nodes first
        const orderedNodeIds: Array<string | null> = new Array(planned.length).fill(null);
        const createdTextRows = planned
          .filter((p) => p.kind === "text")
          .map((p) => {
            const id = crypto.randomUUID();
            orderedNodeIds[p.index] = id;
            return {
              id,
              project_id: project.id,
              content: p.content!,
              role: p.role!,
              position_x: p.x,
              position_y: p.y,
              width: 310,
              created_at: nowIso,
              updated_at: nowIso,
            };
          });

        if (createdTextRows.length > 0) {
          const { error: textErr } = await database
            .from("studio_article_text_nodes")
            .insert(createdTextRows);
          if (textErr) throw new Error("保存画布文案节点失败。");
        }

        // 2. Resolve or place existing image nodes
        for (const p of planned) {
          if (p.kind !== "existing_image" || !p.nodeOrAssetId) continue;
          const candidateId = p.nodeOrAssetId;

          const [{ data: existingPlaced }, { data: existingJob }] = await Promise.all([
            database
              .from("studio_canvas_nodes")
              .select("id")
              .eq("project_id", project.id)
              .eq("id", candidateId)
              .maybeSingle(),
            database
              .from("studio_jobs")
              .select("id")
              .eq("project_id", project.id)
              .eq("id", candidateId)
              .eq("canvas_hidden", false)
              .maybeSingle(),
          ]);

          if (existingPlaced) {
            orderedNodeIds[p.index] = existingPlaced.id;
          } else if (existingJob) {
            orderedNodeIds[p.index] = existingJob.id;
          } else {
            await imageAsset(candidateId);
            const newNodeId = crypto.randomUUID();
            const { error: placeErr } = await database.from("studio_canvas_nodes").insert({
              id: newNodeId,
              project_id: project.id,
              asset_id: candidateId,
              position_x: p.x,
              position_y: p.y,
              width: 310,
            });
            if (placeErr) throw new Error("放置项目已有图片失败。");
            orderedNodeIds[p.index] = newNodeId;
          }
        }

        // 3. Submit new image generation tasks in one batch (with graceful quota fallback)
        const genPlans = planned.filter((p) => p.kind === "generate_image");
        let imageQuotaWarning: string | null = null;
        const submittedJobs: Array<{ submissionId: string; jobNodeId: string; model: string; status: string }> = [];

        if (genPlans.length > 0) {
          const subInputs = genPlans.map((p) => ({
            plan: p,
            submissionId: crypto.randomUUID(),
          }));

          try {
            await ensureSubmissions(
              database,
              project,
              subInputs.map(({ plan, submissionId }) => ({
                id: submissionId,
                prompt: plan.prompt!,
                config: plan.config!,
                referenceId: plan.referenceId ?? null,
              })),
            );

            // Position each created job onto its planned grid coordinate and start Kie.ai tasks
            await Promise.all(
              subInputs.map(async ({ plan, submissionId }) => {
                const { data: jobRow } = await database
                  .from("studio_jobs")
                  .select("id")
                  .eq("project_id", project.id)
                  .eq("submission_id", submissionId)
                  .single();

                if (jobRow?.id) {
                  orderedNodeIds[plan.index] = jobRow.id;
                  await database
                    .from("studio_jobs")
                    .update({ position_x: plan.x, position_y: plan.y, canvas_width: 310 })
                    .eq("id", jobRow.id)
                    .eq("project_id", project.id);
                }

                await startPending(database, project, submissionId);
                const { data: updatedJob } = await database
                  .from("studio_jobs")
                  .select("id,status")
                  .eq("project_id", project.id)
                  .eq("submission_id", submissionId)
                  .maybeSingle();

                if (updatedJob) {
                  submittedJobs.push({
                    submissionId,
                    jobNodeId: updatedJob.id,
                    model: plan.config!.model,
                    status: updatedJob.status,
                  });
                }
              }),
            );
          } catch (err) {
            if (err instanceof StudioError && err.status === 429) {
              imageQuotaWarning = err.message;
            } else {
              throw err instanceof Error ? err : new Error("提交画布配图任务失败。");
            }
          }
        }

        // 4. Connect all created/resolved nodes in narrative sequence
        const finalNodeIds = orderedNodeIds.filter((id): id is string => Boolean(id));
        const uniqueNodeIds = [...new Set(finalNodeIds)];
        let createdEdgeCount = 0;

        if (connectInOrder && uniqueNodeIds.length >= 2) {
          // Clear any prior edges touching these nodes to guarantee a clean linear chain without branches
          await Promise.all([
            database
              .from("studio_article_edges")
              .delete()
              .eq("project_id", project.id)
              .in("source_node_id", uniqueNodeIds),
            database
              .from("studio_article_edges")
              .delete()
              .eq("project_id", project.id)
              .in("target_node_id", uniqueNodeIds),
          ]);

          const edgeRows = [];
          for (let i = 0; i < uniqueNodeIds.length - 1; i += 1) {
            edgeRows.push({
              project_id: project.id,
              source_node_id: uniqueNodeIds[i],
              target_node_id: uniqueNodeIds[i + 1],
            });
          }

          const { error: edgeErr } = await database.from("studio_article_edges").insert(edgeRows);
          if (edgeErr) throw new Error("自动建立画布有向连线失败。");
          createdEdgeCount = edgeRows.length;
        }

        await database
          .from("studio_projects")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", project.id);

        return json({
          ok: true,
          textNodesCreated: createdTextRows.length,
          imageTasksSubmitted: submittedJobs,
          orderedNodeIds: uniqueNodeIds,
          edgesCreated: createdEdgeCount,
          ...(imageQuotaWarning ? { warning: imageQuotaWarning } : {}),
        });
      },
    },
    {
      name: "upsert_text_node",
      label: "新增或修改画布文案节点",
      description: "单独新增或修改画布上的某一个文案节点（需要用户已同意修改画布时调用）。",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["content"],
        properties: {
          nodeId: { type: "string", description: "可选：已有文案节点 UUID；不传则新建节点" },
          content: { type: "string", description: "文案内容" },
          role: { type: "string", enum: ["material", "verbatim", "requirement"] },
        },
      },
      execute: async (_, raw) => {
        const input = raw as { nodeId?: unknown; content?: unknown; role?: unknown };
        const content = typeof input?.content === "string" ? input.content.trim() : "";
        if (!content || content.length > maxPromptLength) {
          throw new Error("文案内容不能为空且不能超过 20,000 字。");
        }
        const role =
          input?.role === "verbatim" || input?.role === "requirement" ? input.role : "material";

        if (typeof input?.nodeId === "string" && input.nodeId.trim()) {
          const id = parseId(input.nodeId.trim(), "无效的文案节点编号。");
          const { data, error } = await database
            .from("studio_article_text_nodes")
            .update({ content, role, updated_at: new Date().toISOString() })
            .eq("project_id", project.id)
            .eq("id", id)
            .select("id")
            .maybeSingle();
          if (error || !data) throw new Error("找不到要修改的文案节点。");
          return json({ nodeId: id, updated: true, role });
        }

        const id = crypto.randomUUID();
        const baseY = await computeCanvasBottomY();
        const { error } = await database.from("studio_article_text_nodes").insert({
          id,
          project_id: project.id,
          content,
          role,
          position_x: 100,
          position_y: baseY,
          width: 310,
        });
        if (error) throw new Error("创建文案节点失败。");
        return json({ nodeId: id, created: true, role });
      },
    },
    {
      name: "connect_canvas_nodes",
      label: "重新连接画布节点顺序",
      description: "按给定的节点 ID 顺序，将画布上的文案节点和图片节点串联成一条单向顺序链（#1 -> #2 -> #3...）。",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["orderedNodeIds"],
        properties: {
          orderedNodeIds: {
            type: "array",
            minItems: 2,
            maxItems: 30,
            items: { type: "string", description: "画布上的文案节点 ID 或图片节点 ID" },
          },
          replaceAllProjectEdges: {
            type: "boolean",
            description: "是否先清空当前项目旧连线再按新顺序重连，默认 true",
          },
        },
      },
      execute: async (_, raw) => {
        const input = raw as { orderedNodeIds?: unknown; replaceAllProjectEdges?: unknown };
        if (!Array.isArray(input?.orderedNodeIds) || input.orderedNodeIds.length < 2) {
          throw new Error("至少需要 2 个节点才能建立连线。");
        }
        const ids = input.orderedNodeIds.map((item) => parseId(item, "节点编号无效。"));
        if (new Set(ids).size !== ids.length) {
          throw new Error("连线序列中不能包含重复节点（避免形成环路）。");
        }

        const [texts, placed, jobs] = await Promise.all([
          database.from("studio_article_text_nodes").select("id").eq("project_id", project.id).in("id", ids),
          database.from("studio_canvas_nodes").select("id").eq("project_id", project.id).in("id", ids),
          database
            .from("studio_jobs")
            .select("id")
            .eq("project_id", project.id)
            .eq("canvas_hidden", false)
            .in("id", ids),
        ]);
        const validIds = new Set<string>([
          ...(texts.data ?? []).map((r) => String(r.id)),
          ...(placed.data ?? []).map((r) => String(r.id)),
          ...(jobs.data ?? []).map((r) => String(r.id)),
        ]);
        const missing = ids.filter((id) => !validIds.has(id));
        if (missing.length > 0) {
          throw new Error(`部分节点不在当前画布中：${missing.join(", ")}`);
        }

        if (input.replaceAllProjectEdges !== false) {
          await database.from("studio_article_edges").delete().eq("project_id", project.id);
        } else {
          await Promise.all([
            database.from("studio_article_edges").delete().eq("project_id", project.id).in("source_node_id", ids),
            database.from("studio_article_edges").delete().eq("project_id", project.id).in("target_node_id", ids),
          ]);
        }

        const edgeRows = [];
        for (let i = 0; i < ids.length - 1; i += 1) {
          edgeRows.push({
            project_id: project.id,
            source_node_id: ids[i],
            target_node_id: ids[i + 1],
          });
        }
        const { error } = await database.from("studio_article_edges").insert(edgeRows);
        if (error) throw new Error("写入节点连线失败。");
        return json({ ok: true, orderedNodeIds: ids, edgesCreated: edgeRows.length });
      },
    },
  ];

  return [...baseTools, ...creativeTools];
}
