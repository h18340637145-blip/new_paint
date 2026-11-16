import { after, NextResponse } from "next/server";
import { requireStudioMember, studioAdmin, StudioError } from "@/lib/studio/auth";
import { ensureSubmission, readCanvas, refreshJobs, startPending } from "@/lib/studio/generation";
import { imageTypes, maxPromptLength, maxReferenceSize, validConfig } from "@/lib/studio/models";
import { bucket, readProject, uuidPattern } from "@/lib/studio/projects";
import { saveImage, signImage } from "@/lib/studio/storage";

export const maxDuration = 60;

function errorResponse(error: unknown) {
  if (error instanceof StudioError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error("工作台请求失败", error instanceof Error ? error.name : "未知错误");
  return NextResponse.json({ error: "操作失败，请稍后重试。" }, { status: 500 });
}

function requireUuid(input: unknown) {
  if (typeof input !== "string" || !uuidPattern.test(input)) throw new StudioError("无效的记录编号。");
  return input;
}

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await requireStudioMember();
    if (!request.headers.get("content-type")?.startsWith("application/json")) {
      throw new StudioError("请求格式无效。", 415);
    }
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") throw new StudioError("请求内容无效。");
    const projectId = requireUuid(body.projectId);
    const admin = studioAdmin();
    const action = body.action;

    let project = await readProject(supabase, projectId);
    if (!project && body.createProject === true && ["prepare-upload", "submit"].includes(action)) {
      const { error } = await admin.from("studio_projects")
        .upsert({ id: projectId, owner_id: userId }, { ignoreDuplicates: true });
      if (error) throw new StudioError("创建项目失败，请重试。", 503);
      project = await readProject(supabase, projectId);
    }
    if (!project) throw new StudioError("找不到项目。", 404);

    if (action === "prepare-upload") {
      const assetId = requireUuid(body.assetId);
      if (!imageTypes.includes(body.type) || typeof body.size !== "number"
        || body.size <= 0 || body.size > maxReferenceSize) {
        throw new StudioError("请选择不超过 10 MB 的 JPEG、PNG 或 WebP 图片。");
      }
      const path = `${userId}/${projectId}/${assetId}.upload`;
      const { data, error } = await admin.storage.from(bucket).createSignedUploadUrl(path, { upsert: true });
      if (error || !data?.token) throw new StudioError("无法准备上传，请重试。", 503);
      return NextResponse.json({ path, token: data.token });
    }

    if (action === "complete-upload") {
      const assetId = requireUuid(body.assetId);
      const path = `${userId}/${projectId}/${assetId}.upload`;
      const { data: existing, error: assetError } = await admin.from("studio_assets")
        .select("id,path").eq("id", assetId).eq("project_id", projectId)
        .eq("kind", "reference").maybeSingle();
      if (assetError) throw new StudioError("暂时无法检查参考图。", 503);
      let asset = existing;
      if (!existing) {
        const { data: uploaded, error } = await admin.storage.from(bucket).download(path);
        if (error || !uploaded) throw new StudioError("未找到上传的参考图，请重新上传。");
        if (!uploaded.size || uploaded.size > maxReferenceSize) {
          await admin.storage.from(bucket).remove([path]);
          throw new StudioError("参考图大小不能超过 10 MB。");
        }
        asset = await saveImage(admin, userId, projectId, assetId, "reference", await uploaded.arrayBuffer());
      }
      await admin.storage.from(bucket).remove([path]);
      if (!asset) throw new StudioError("参考图暂不可用。", 503);
      return NextResponse.json({ id: assetId, url: await signImage(supabase, asset.path) });
    }

    if (action === "submit") {
      const submissionId = requireUuid(body.submissionId);
      const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
      if (!prompt || prompt.length > maxPromptLength || !validConfig(body.config)) {
        throw new StudioError("请检查提示词和模型配置。");
      }
      const referenceId = body.referenceId == null ? null : requireUuid(body.referenceId);
      if (referenceId) {
        const { data: asset, error } = await supabase.from("studio_assets")
          .select("id").eq("id", referenceId).eq("project_id", projectId).maybeSingle();
        if (error || !asset) throw new StudioError("参考图已不可用。", 404);
      }
      await ensureSubmission(admin, project, { id: submissionId, prompt, config: body.config, referenceId });
      const activeProject = project;
      after(async () => {
        try {
          await startPending(admin, activeProject, submissionId);
        } catch {
          console.error("待提交的生图任务将在打开项目时恢复", submissionId);
        }
      });
      return NextResponse.json({ id: projectId }, { status: 202 });
    }

    if (action === "sync") {
      await Promise.all([startPending(admin, project), refreshJobs(admin, project)]);
      return NextResponse.json({ submissions: await readCanvas(supabase, projectId) });
    }

    if (action === "retry") {
      const jobId = requireUuid(body.jobId);
      const { data: job, error } = await supabase.from("studio_jobs")
        .select("id,submission_id,slot,attempt,status,position_x,position_y")
        .eq("id", jobId).eq("project_id", projectId).maybeSingle();
      if (error || !job || job.status !== "failed") throw new StudioError("该任务暂时无法重试。", 409);
      const { error: retryError } = await admin.from("studio_jobs").upsert({
        project_id: projectId, submission_id: job.submission_id, slot: job.slot,
        attempt: job.attempt + 1, position_x: job.position_x, position_y: job.position_y,
      }, { onConflict: "submission_id,slot,attempt", ignoreDuplicates: true });
      if (retryError) throw new StudioError("无法重试，请稍后再试。", 503);
      return NextResponse.json({ submissions: await readCanvas(supabase, projectId) });
    }

    if (action === "position") {
      const jobId = requireUuid(body.jobId);
      if (![body.x, body.y].every((value) => typeof value === "number" && Math.abs(value) <= 1_000_000)) {
        throw new StudioError("画布坐标无效。");
      }
      const { error } = await admin.from("studio_jobs")
        .update({ position_x: body.x, position_y: body.y })
        .eq("id", jobId).eq("project_id", projectId);
      if (error) throw new StudioError("保存画布位置失败。", 503);
      return NextResponse.json({ ok: true });
    }

    throw new StudioError("未知的工作台操作。");
  } catch (error) {
    return errorResponse(error);
  }
}
