import "server-only";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureSubmissions, startPending } from "./generation";
import { maxPromptLength } from "./models";
import { bucket, uuidPattern } from "./projects";
import { detectImageMime } from "./storage";

type Project = { id: string; owner_id: string; title: string };

const assetIdSchema = { type: "string", description: "项目素材的 UUID" };
const noParameters = { type: "object", properties: {}, additionalProperties: false };
const assetParameters = { type: "object", properties: { assetId: assetIdSchema }, required: ["assetId"], additionalProperties: false };

export function createStudioTools(database: SupabaseClient, project: Project, cover?: { style: string; onSubmit: () => void }): AgentTool[] {
  let coverSubmitted = false;
  const inspected = new Set<string>();

  function parseId(input: unknown) {
    if (typeof input !== "string" || !uuidPattern.test(input)) throw new Error("无效的素材编号。");
    return input;
  }

  async function imageAsset(id: string) {
    const { data, error } = await database.from("studio_assets").select("id,path,kind,filename")
      .eq("project_id", project.id).eq("id", id).in("kind", ["reference", "generated"]).maybeSingle();
    if (error || !data) throw new Error("该图片不在当前项目中。");
    return data;
  }

  function json(value: unknown) {
    return { content: [{ type: "text" as const, text: JSON.stringify(value) }], details: value };
  }

  return [
    {
      name: "list_assets", label: "列出项目素材", description: "列出当前项目的图片和 Markdown 资料及对应编号。",
      parameters: noParameters,
      execute: async () => {
        const { data, error } = await database.from("studio_assets").select("id,filename,kind")
          .eq("project_id", project.id).order("created_at", { ascending: false }).limit(100);
        if (error) throw new Error("无法读取项目素材。");
        return json(data);
      },
    },
    {
      name: "view_image", label: "查看图片", description: "读取真实图片以识别主体、风格及构图。在使用图片生图前必须查看。",
      parameters: assetParameters,
      execute: async (_, raw) => {
        const id = parseId((raw as { assetId?: unknown })?.assetId);
        const asset = await imageAsset(id);
        const { data, error } = await database.storage.from(bucket).download(asset.path);
        if (error || !data || data.size > 50 * 1024 * 1024) throw new Error("无法读取该项目图片。");
        const bytes = new Uint8Array(await data.arrayBuffer());
        const mimeType = detectImageMime(bytes);
        if (!mimeType) throw new Error("无法识别图片格式。");
        inspected.add(id);
        return {
          content: [{ type: "image" as const, mimeType, data: Buffer.from(bytes).toString("base64") }],
          details: { assetId: id, filename: asset.filename, mimeType },
        };
      },
    },
    {
      name: "generate_image", label: "生成图片", description: cover
        ? `一次生成四张「${cover.style}」宽幅公众号封面。提供四条各自完整且构图不同的提示词。`
        : "用 GPT Image 2.5 Flare 开始生图。按图一、图二的顺序传入已查看的参考图。没有参考图时传空数组。",
      executionMode: "sequential",
      parameters: cover ? {
        type: "object", additionalProperties: false, required: ["prompts", "referenceIds"],
        properties: {
          prompts: { type: "array", minItems: 4, maxItems: 4, items: { type: "string" } },
          referenceIds: { type: "array", items: assetIdSchema, maxItems: 16 },
        },
      } : {
        type: "object", additionalProperties: false, required: ["prompt", "referenceIds"],
        properties: {
          prompt: { type: "string" },
          referenceIds: { type: "array", items: assetIdSchema, maxItems: 16 },
          aspectRatio: { type: "string", enum: ["auto", "1:1", "3:2", "2:3", "16:9", "9:16"] },
        },
      },
      execute: async (_, raw) => {
        const value = raw as { prompt?: unknown; prompts?: unknown; referenceIds?: unknown; aspectRatio?: unknown };
        const inputs = cover ? value?.prompts : [value?.prompt];
        if (!Array.isArray(inputs) || inputs.length !== (cover ? 4 : 1)
          || !inputs.every((input) => typeof input === "string" && input.trim() && input.trim().length <= maxPromptLength)
          || new Set(inputs.map((input: string) => input.trim())).size !== inputs.length
          || !Array.isArray(value?.referenceIds) || value.referenceIds.length > 16) {
          throw new Error("请提供有效提示词和参考图列表。");
        }
        const orderedReferenceIds = value.referenceIds.map(parseId);
        if (orderedReferenceIds.some((id) => !inspected.has(id))) throw new Error("请先逐一查看参考图。");
        const choices = ["auto", "1:1", "3:2", "2:3", "16:9", "9:16"];
        const ratio = cover ? "16:9" : value.aspectRatio ?? "auto";
        if (typeof ratio !== "string" || !choices.includes(ratio)) throw new Error("不支持这个图片比例。");
        const aspectRatio = ratio;
        async function submit(id: string) {
          await startPending(database, project, id);
          const { data, error } = await database.from("studio_jobs").select("status,error_message")
            .eq("project_id", project.id).eq("submission_id", id).single();
          if (error || !data) throw new Error("任务已记录，但暂时无法读取提交状态。");
          if (data.status === "failed" || data.status === "unknown") throw new Error(data.error_message || "任务暂未成功提交。");
          return { submissionId: id, model: "GPT Image 2.5 Flare", status: data.status };
        }

        const prompts = inputs.map((input: string) => input.trim());
        if (cover && coverSubmitted) throw new Error("本轮封面任务已提交，请查看任务状态。");

        const submissions = prompts.map((prompt: string) => ({
          id: crypto.randomUUID(), prompt, referenceId: null, orderedReferenceIds,
          config: { model: "gpt-image-2-5-flare", count: 1, resolution: "1K", aspectRatio } as const,
        }));
        await ensureSubmissions(database, project, submissions);
        if (!cover) return json(await submit(submissions[0].id));
        coverSubmitted = true;
        cover.onSubmit();
        const results = await Promise.allSettled(submissions.map(({ id }) => submit(id)));
        return json(results.map((result, index) => result.status === "fulfilled"
          ? { cover: index + 1, ...result.value }
          : { cover: index + 1, status: "failed", error: result.reason instanceof Error ? result.reason.message : "提交失败。" }));
      },
    },
    {
      name: "place_asset", label: "将图片放到画布", description: "把当前项目的图片素材添加到画布。",
      parameters: assetParameters,
      execute: async (_, raw) => {
        const id = parseId((raw as { assetId?: unknown })?.assetId);
        await imageAsset(id);
        const nodeId = crypto.randomUUID();
        const { count } = await database.from("studio_canvas_nodes")
          .select("id", { count: "exact", head: true }).eq("project_id", project.id);
        const position = count ?? 0;
        const { error } = await database.from("studio_canvas_nodes").insert({
          id: nodeId, project_id: project.id, asset_id: id,
          position_x: 80 + position % 4 * 350, position_y: 80 + Math.floor(position / 4) * 350,
        });
        if (error) throw new Error("无法放置画布节点。");
        return json({ nodeId, assetId: id });
      },
    },
    {
      name: "read_canvas", label: "读取当前画布", description: "取得当前画布中的图片、节点及坐标。",
      parameters: noParameters,
      execute: async () => {
        const [nodes, jobs] = await Promise.all([
          database.from("studio_canvas_nodes").select("id,asset_id,position_x,position_y,width").eq("project_id", project.id),
          database.from("studio_jobs").select("id,asset_id,position_x,position_y,canvas_width")
            .eq("project_id", project.id).eq("status", "succeeded").eq("canvas_hidden", false),
        ]);
        if (nodes.error || jobs.error) throw new Error("无法读取画布。");
        return json([...nodes.data, ...jobs.data]);
      },
    },
  ];
}
