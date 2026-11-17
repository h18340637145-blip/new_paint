import { requireStudioMember, studioAdmin, StudioError } from "@/lib/studio/auth";
import { readProject, uuidPattern } from "@/lib/studio/projects";
import { parseSkill } from "@/lib/studio/skills";

const summary = "id,name,description";

async function handle(request: Request) {
  try {
    const { supabase, userId } = await requireStudioMember();
    const url = new URL(request.url);
    const projectId = url.searchParams.get("projectId") ?? "";
    if (!await readProject(supabase, projectId)) throw new StudioError("找不到项目。", 404);
    const scoped = supabase.from("studio_skills").select(summary)
      .eq("project_id", projectId).eq("owner_id", userId);
    if (request.method === "GET") {
      const { data, error } = await scoped.order("name");
      if (error) throw new StudioError("无法读取技能列表。", 503);
      return Response.json({ skills: data });
    }
    const admin = studioAdmin();
    if (request.method === "DELETE") {
      const id = url.searchParams.get("id") ?? "";
      if (!uuidPattern.test(id)) throw new StudioError("无效的技能编号。");
      const { data, error } = await admin.from("studio_skills").delete()
        .eq("id", id).eq("project_id", projectId).eq("owner_id", userId).select("id").maybeSingle();
      if (error) throw new StudioError("无法移除技能。", 503);
      if (!data) throw new StudioError("找不到技能。", 404);
      return Response.json({ ok: true });
    }
    if (!request.headers.get("content-type")?.startsWith("application/json")) {
      throw new StudioError("请求格式无效。", 415);
    }
    const payload = await request.json().catch(() => null);
    if (payload?.filename !== "SKILL.md" || typeof payload.source !== "string") {
      throw new StudioError("请选择名为 SKILL.md 的技能文件。");
    }
    const skill = parseSkill(payload.source);
    const { data, error } = await admin.from("studio_skills")
      .insert({ ...skill, project_id: projectId, owner_id: userId }).select(summary).single();
    if (error?.code === "23505") throw new StudioError("当前项目已存在同名技能。请先移除旧版本。", 409);
    if (error) throw new StudioError("无法保存技能。", 503);
    return Response.json({ skill: data }, { status: 201 });
  } catch (error) {
    const failure = error instanceof StudioError ? error : new StudioError("技能服务暂不可用。", 503);
    return Response.json({ error: failure.message }, { status: failure.status });
  }
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
