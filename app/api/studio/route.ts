import { after, NextResponse } from "next/server";
import { requireStudioMember, studioAdmin, StudioError } from "@/lib/studio/auth";
import { ensureSubmission, readCanvas, refreshJobs, startPending } from "@/lib/studio/generation";
import { imageTypes, maxPromptLength, maxReferenceSize, validConfig } from "@/lib/studio/models";
import { bucket, readProject, uuidPattern } from "@/lib/studio/projects";
import { saveImage, signImage } from "@/lib/studio/storage";
import { attachmentFilename, markdownFilename, markdownMime, maxMarkdownBytes } from "@/lib/studio/attachment-types";
import { readPlacedNodes } from "@/lib/studio/agent-data";

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
      const markdown = body.type === markdownMime && markdownFilename.test(attachmentFilename(body.filename));
      if ((!markdown && !imageTypes.includes(body.type)) || !Number.isSafeInteger(body.size)
        || body.size <= 0 || body.size > (markdown ? maxMarkdownBytes : maxReferenceSize)) {
        throw new StudioError("请选择不超过 10 MB 的图片或 256 KB 的 Markdown。");
      }
      const path = `${userId}/${projectId}/${assetId}.upload`;
      const { data, error } = await admin.storage.from(bucket).createSignedUploadUrl(path, { upsert: true });
      if (error || !data?.token) throw new StudioError("无法准备上传，请重试。", 503);
      return NextResponse.json({ path, token: data.token });
    }

    if (action === "complete-upload") {
      const assetId = requireUuid(body.assetId);
      const filename = attachmentFilename(body.filename);
      const kind = markdownFilename.test(filename) ? "markdown" : "reference";
      const path = `${userId}/${projectId}/${assetId}.upload`;
      const { data: existing, error: assetError } = await admin.from("studio_assets")
        .select("id,path").eq("id", assetId).eq("project_id", projectId)
        .eq("kind", kind).maybeSingle();
      if (assetError) throw new StudioError("暂时无法检查参考图。", 503);
      let asset = existing;
      if (!existing) {
        const { data: uploaded, error } = await admin.storage.from(bucket).download(path);
        if (error || !uploaded) throw new StudioError("未找到上传的参考图，请重新上传。");
        try {
          if (!uploaded.size || uploaded.size > (kind === "markdown" ? maxMarkdownBytes : maxReferenceSize)) {
            throw new StudioError("附件超过大小限制。");
          }
          asset = await saveImage(admin, userId, projectId, assetId, kind, await uploaded.arrayBuffer(), filename);
        } finally {
          await admin.storage.from(bucket).remove([path]);
        }
      }
      if (existing) await admin.storage.from(bucket).remove([path]);
      if (!asset) throw new StudioError("参考图暂不可用。", 503);
      if (kind === "reference" && body.placeOnCanvas === true) {
        const { count, error: countError } = await admin.from("studio_canvas_nodes")
          .select("id", { count: "exact", head: true }).eq("project_id", projectId);
        if (countError) throw new StudioError("无法读取画布。", 503);
        const index = count ?? 0;
        const { error } = await admin.from("studio_canvas_nodes").upsert({
          id: assetId, project_id: projectId, asset_id: assetId,
          position_x: 80 + index % 4 * 350, position_y: 80 + Math.floor(index / 4) * 350,
        }, { ignoreDuplicates: true });
        if (error) throw new StudioError("图片已上传，暂时无法放到画布。", 503);
      }
      const url = kind === "markdown" ? `/api/studio/attachment?projectId=${projectId}&id=${assetId}`
        : await signImage(supabase, asset.path);
      return NextResponse.json({ id: assetId, url, kind, filename: filename || "项目图片" });
    }

    if (action === "submit") {
      const submissionId = requireUuid(body.submissionId);
      const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
      if (!prompt || prompt.length > maxPromptLength || !validConfig(body.config)
        || body.config.model === "gpt-image-2-5-flare") {
        throw new StudioError("请检查提示词和模型配置。");
      }
      const referenceId = body.referenceId == null ? null : requireUuid(body.referenceId);
      if (referenceId) {
        const { data: asset, error } = await supabase.from("studio_assets")
          .select("id").eq("id", referenceId).eq("project_id", projectId)
          .in("kind", ["reference", "generated"]).maybeSingle();
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
      const [submissions, placedNodes] = await Promise.all([
        readCanvas(supabase, projectId), readPlacedNodes(supabase, projectId),
      ]);
      return NextResponse.json({ submissions, placedNodes });
    }

    if (action === "regenerate") {
      const id = requireUuid(body.submissionId);
      const newId = requireUuid(body.newId);
      const { data: original, error } = await supabase.from("studio_submissions")
        .select("prompt,model,aspect_ratio,resolution,image_count,ordered_reference_ids")
        .eq("project_id", projectId).eq("id", id).eq("model", "gpt-image-2-5-flare").maybeSingle();
      if (error || !original) throw new StudioError("找不到可重新生成的 Agent 任务。", 404);
      const config = { model: original.model, aspectRatio: original.aspect_ratio,
        resolution: original.resolution, count: original.image_count };
      if (!validConfig(config)) throw new StudioError("原任务参数不可用。", 409);
      await ensureSubmission(admin, project, {
        id: newId, prompt: original.prompt, config, referenceId: null,
        orderedReferenceIds: original.ordered_reference_ids ?? [],
      });
      return NextResponse.json({ ok: true }, { status: 202 });
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

    if (action === "remove-node") {
      const id = requireUuid(body.nodeId);
      const query = body.placed === true
        ? admin.from("studio_canvas_nodes").delete()
        : admin.from("studio_jobs").update({ canvas_hidden: true });
      const { error } = await query.eq("id", id).eq("project_id", projectId);
      if (error) throw new StudioError("无法删除画布节点。", 503);
      return NextResponse.json({ ok: true });
    }

    if (action === "duplicate-node") {
      const assetId = requireUuid(body.assetId);
      const { data: asset, error: assetError } = await supabase.from("studio_assets")
        .select("id").eq("project_id", projectId).eq("id", assetId)
        .in("kind", ["reference", "generated"]).maybeSingle();
      if (assetError || !asset) throw new StudioError("找不到画布素材。", 404);
      if (![body.x, body.y].every((value) => typeof value === "number" && Math.abs(value) <= 1_000_000)
        || typeof body.width !== "number" || body.width < 24 || body.width > 4096) {
        throw new StudioError("画布坐标或尺寸无效。");
      }
      const { error } = await admin.from("studio_canvas_nodes").insert({
        id: crypto.randomUUID(), project_id: projectId, asset_id: assetId,
        position_x: body.x, position_y: body.y, width: body.width,
      });
      if (error) throw new StudioError("无法复制画布节点。", 503);
      return NextResponse.json({ ok: true });
    }

    if (action === "position") {
      const jobId = requireUuid(body.jobId);
      if (![body.x, body.y].every((value) => typeof value === "number" && Math.abs(value) <= 1_000_000)) {
        throw new StudioError("画布坐标无效。");
      }
      if (body.width != null && (typeof body.width !== "number" || body.width < 24 || body.width > 4096)) {
        throw new StudioError("画布尺寸无效。");
      }
      const placed = body.placed === true;
      const { error } = await admin.from(placed ? "studio_canvas_nodes" : "studio_jobs")
        .update({ position_x: body.x, position_y: body.y,
          ...(body.width != null ? { [placed ? "width" : "canvas_width"]: body.width } : {}) })
        .eq("id", jobId).eq("project_id", projectId);
      if (error) throw new StudioError("保存画布位置失败。", 503);
      return NextResponse.json({ ok: true });
    }

    throw new StudioError("未知的工作台操作。");
  } catch (error) {
    return errorResponse(error);
  }
}
