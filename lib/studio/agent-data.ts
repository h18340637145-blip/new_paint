import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { StudioError } from "./auth";
import type { StudioAgentEvent, StudioAgentTurn, StudioAttachment } from "./agent-events";
import { signImage } from "./storage";

export interface AgentAssetRow {
  id: string;
  path: string;
  filename: string | null;
  kind: StudioAttachment["kind"];
}

export async function readAgentAssets(db: SupabaseClient, projectId: string, ids: string[]) {
  if (!ids.length) return [];
  const { data, error } = await db.from("studio_assets").select("id,path,filename,kind")
    .eq("project_id", projectId).in("id", [...new Set(ids)]).returns<AgentAssetRow[]>();
  if (error) throw new StudioError("无法读取项目附件。", 503);
  return data;
}

export async function describeAttachment(db: SupabaseClient, projectId: string, asset: AgentAssetRow): Promise<StudioAttachment> {
  const { id, kind, filename, path } = asset;
  return { id, kind, filename: filename || (kind === "markdown" ? "Markdown 附件" : "项目图片"), url: kind === "markdown" ? `/api/studio/attachment?projectId=${projectId}&id=${id}` : await signImage(db, path) };
}

export async function readAgentTurns(db: SupabaseClient, projectId: string): Promise<StudioAgentTurn[]> {
  const { data, error } = await db.from("studio_agent_turns")
    .select("id,prompt,attachment_ids,events,status,created_at").eq("project_id", projectId)
    .order("created_at", { ascending: false }).limit(100).returns<{
      id: string; prompt: string; attachment_ids: string[]; events: StudioAgentEvent[];
      status: StudioAgentTurn["status"]; created_at: string;
    }[]>();
  if (error) throw new StudioError("无法读取 Agent 对话。", 503);
  const assets = await readAgentAssets(db, projectId, data.flatMap((turn) => turn.attachment_ids));
  const attachments = new Map(await Promise.all(assets.map(async (asset) =>
    [asset.id, await describeAttachment(db, projectId, asset)] as const)));
  return data.reverse().map((turn) => ({
    id: turn.id, prompt: turn.prompt, status: turn.status, createdAt: turn.created_at, events: turn.events,
    attachments: turn.attachment_ids.flatMap((id) => {
      const asset = attachments.get(id);
      return asset ? [asset] : [];
    }),
  }));
}

export async function readPlacedNodes(db: SupabaseClient, projectId: string) {
  const { data, error } = await db.from("studio_canvas_nodes")
    .select("id,asset_id,position_x,position_y,width").eq("project_id", projectId)
    .order("created_at").returns<{ id: string; asset_id: string; position_x: number; position_y: number; width: number | null }[]>();
  if (error) throw new StudioError("无法读取画布素材。", 503);
  const assets = await readAgentAssets(db, projectId, data.map((node) => node.asset_id));
  const attachments = new Map(await Promise.all(assets.filter((asset) => asset.kind !== "markdown")
    .map(async (asset) => [asset.id, await describeAttachment(db, projectId, asset)] as const)));
  return data.flatMap((node) => {
    const asset = attachments.get(node.asset_id);
    return asset ? [{ id: node.id, x: node.position_x, y: node.position_y, width: node.width, asset }] : [];
  });
}
