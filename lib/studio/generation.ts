import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { StudioError } from "./auth";
import { createKieTask, getKieTask, KieError } from "./kie";
import type { GenerationConfig } from "./models";
import { downloadGeneratedImage, saveImage, signImage } from "./storage";
import type { CanvasJob, CanvasSubmission, ImageAsset, JobStatus } from "./types";

type Project = { id: string; title: string; owner_id: string };
type RequestRow = {
  id: string;
  project_id: string;
  prompt: string;
  model: GenerationConfig["model"];
  resolution: GenerationConfig["resolution"];
  aspect_ratio: string;
  image_count: number;
  reference_id: string | null;
  ordered_reference_ids?: string[] | null;
  created_at?: string;
};
type TaskRow = {
  id: string;
  submission_id: string;
  slot: number;
  attempt: number;
  status: JobStatus;
  provider_id: string | null;
  asset_id: string | null;
  error_message: string | null;
  position_x: number;
  position_y: number;
  checked_at: string | null;
  canvas_hidden?: boolean;
  canvas_width?: number | null;
};

function configOf(row: RequestRow): GenerationConfig {
  return { model: row.model, resolution: row.resolution, aspectRatio: row.aspect_ratio, count: row.image_count };
}

function latestJobs(rows: TaskRow[]) {
  const latest = new Map<string, TaskRow>();
  for (const row of rows) {
    const key = `${row.submission_id}/${row.slot}`;
    const previous = latest.get(key);
    if (!previous || previous.attempt < row.attempt) latest.set(key, row);
  }
  return [...latest.values()];
}

export async function ensureSubmission(
  database: SupabaseClient,
  project: Project,
  input: { id: string; prompt: string; config: GenerationConfig; referenceId: string | null; orderedReferenceIds?: string[] },
) {
  const row: RequestRow = {
    id: input.id, project_id: project.id, prompt: input.prompt, model: input.config.model,
    resolution: input.config.resolution, aspect_ratio: input.config.aspectRatio,
    image_count: input.config.count, reference_id: input.referenceId,
    ...(input.orderedReferenceIds ? { ordered_reference_ids: input.orderedReferenceIds } : {}),
  };
  const { error: insertError } = await database.from("studio_submissions")
    .upsert(row, { onConflict: "id", ignoreDuplicates: true });
  if (insertError) throw new StudioError("无法记录本次生图请求。", 503);
  const { data: saved, error } = await database.from("studio_submissions").select("*")
    .eq("id", row.id).eq("project_id", project.id).single<RequestRow>();
  if (error || !saved) throw new StudioError("提交编号已被占用。", 409);
  if (Object.entries(row).some(([key, value]) => {
    const existing = saved[key as keyof RequestRow];
    return Array.isArray(value) ? JSON.stringify(existing) !== JSON.stringify(value) : existing !== value;
  })) {
    throw new StudioError("这次提交已经记录，请刷新项目查看状态。", 409);
  }

  const { count, error: countError } = await database.from("studio_submissions")
    .select("id", { count: "exact", head: true }).eq("project_id", project.id);
  if (countError) throw new StudioError("无法读取当前项目的生图记录。", 503);
  const requests = Array.from({ length: saved.image_count }, (_, slot) => ({
    project_id: project.id, submission_id: saved.id, slot,
    position_x: 80 + slot * 365, position_y: 80 + Math.max(0, (count ?? 1) - 1) * 390,
  }));
  const { error: jobError } = await database.from("studio_jobs")
    .upsert(requests, { onConflict: "submission_id,slot,attempt", ignoreDuplicates: true });
  if (jobError) throw new StudioError("无法创建图片任务，请重试。", 503);
  await database.from("studio_projects").update({ updated_at: new Date().toISOString() }).eq("id", project.id);
}

export async function startPending(
  database: SupabaseClient,
  project: Project,
  submission?: string,
) {
  let query = database.from("studio_jobs").select("*").eq("project_id", project.id).eq("status", "pending");
  if (submission) query = query.eq("submission_id", submission);
  const { data, error } = await query.limit(5).returns<TaskRow[]>();
  if (error) throw new StudioError("无法读取待处理任务。", 503);

  await Promise.all(data.map(async (job) => {
    const { data: claimed, error: claimError } = await database.from("studio_jobs")
      .update({ status: "starting", checked_at: new Date().toISOString() })
      .eq("id", job.id).eq("status", "pending").select("id").maybeSingle();
    if (claimError || !claimed) return;

    let providerId: string;
    try {
      const { data: request, error: requestError } = await database.from("studio_submissions")
        .select("*").eq("id", job.submission_id).single<RequestRow>();
      if (requestError || !request) throw new StudioError("无法读取原生图请求。", 503);
      const ids = request.ordered_reference_ids ?? (request.reference_id ? [request.reference_id] : []);
      const urls = await Promise.all(ids.map(async (id) => {
        const { data: image, error: imageError } = await database.from("studio_assets").select("path,kind")
          .eq("project_id", project.id).eq("id", id).single();
        if (imageError || !image || !["reference", "generated"].includes(image.kind)) {
          throw new StudioError("参考图已不可用。", 404);
        }
        return signImage(database, image.path, 3600);
      }));
      providerId = await createKieTask(request.prompt, configOf(request), urls);
    } catch (failure) {
      const uncertain = failure instanceof KieError && failure.uncertain;
      const message = failure instanceof KieError || failure instanceof StudioError
        ? failure.message : "生图服务暂不可用。";
      await database.from("studio_jobs").update({
        status: uncertain ? "unknown" : "failed", error_message: message,
      }).eq("id", job.id).eq("status", "starting");
      return;
    }
    const { error: recordError } = await database.from("studio_jobs").update({
      provider_id: providerId, status: "generating", checked_at: null,
    }).eq("id", job.id).in("status", ["starting", "unknown"]);
    if (recordError) console.error("生图任务编号存储失败", job.id);
  }));
}

export async function refreshJobs(database: SupabaseClient, project: Project) {
  await database.from("studio_jobs").update({
    status: "unknown", error_message: "暂时无法确认是否已提交，请联系管理员核对。",
  }).eq("project_id", project.id).eq("status", "starting")
    .lt("checked_at", new Date(Date.now() - 60_000).toISOString());

  const now = new Date();
  const threshold = new Date(now.getTime() - 4000).toISOString();
  const { data, error } = await database.from("studio_jobs").select("*")
    .eq("project_id", project.id).in("status", ["generating", "importing"])
    .or(`checked_at.is.null,checked_at.lt.${threshold}`)
    .order("checked_at", { ascending: true, nullsFirst: true }).limit(5).returns<TaskRow[]>();
  if (error) throw new StudioError("查询生图状态失败。", 503);

  const allowedHosts = (process.env.KIE_IMAGE_HOSTS || "static.aiquickdraw.com,tempfile.aiquickdraw.com,cdn.kie.ai")
    .split(",").map((host) => host.trim().toLowerCase());
  await Promise.all(data.map(async (job) => {
    if (!job.provider_id) return;
    const delay = job.status === "importing" ? 35_000 : 4000;
    if (job.checked_at && Date.parse(job.checked_at) > now.getTime() - delay) return;
    let lock = database.from("studio_jobs").update({ checked_at: now.toISOString() }).eq("id", job.id)
      .eq("status", job.status);
    lock = job.checked_at ? lock.eq("checked_at", job.checked_at) : lock.is("checked_at", null);
    const { data: claimed } = await lock.select("id").maybeSingle();
    if (!claimed) return;
    try {
      const result = await getKieTask(job.provider_id);
      if (result.status === "generating") return;
      if (result.status === "failed") {
        await database.from("studio_jobs").update({
          status: "failed", error_message: "生图服务未能生成图片，可以重试。",
        }).eq("id", job.id);
        return;
      }
      await database.from("studio_jobs").update({ status: "importing" }).eq("id", job.id);
      const buffer = await downloadGeneratedImage(result.url, allowedHosts);
      const asset = await saveImage(database, project.owner_id, project.id, job.id, "generated", buffer);
      const { error: saveError } = await database.from("studio_jobs").update({
        status: "succeeded", asset_id: asset.id, error_message: null,
      }).eq("id", job.id);
      if (saveError) throw new StudioError("结果已保存，正在重新关联。", 503);
      await database.from("studio_projects").update({ updated_at: new Date().toISOString() }).eq("id", project.id);
    } catch (failure) {
      const message = failure instanceof StudioError || failure instanceof KieError
        ? failure.message : "正在重新读取生图结果。";
      await database.from("studio_jobs").update({ error_message: message }).eq("id", job.id);
    }
  }));
}

export async function readCanvas(database: SupabaseClient, projectId: string): Promise<CanvasSubmission[]> {
  const [requests, jobResult, assets] = await Promise.all([
    database.from("studio_submissions").select("*").eq("project_id", projectId)
      .order("created_at").order("id").returns<RequestRow[]>(),
    database.from("studio_jobs").select("*").eq("project_id", projectId).returns<TaskRow[]>(),
    database.from("studio_assets").select("id,path").eq("project_id", projectId),
  ]);
  if (requests.error || jobResult.error || assets.error) throw new StudioError("无法读取项目画布。", 503);
  const paths = new Map<string, string>(assets.data.map((item) => [item.id, item.path]));
  const jobs = latestJobs(jobResult.data);
  const ids = new Set([
    ...requests.data.map((row) => row.reference_id),
    ...requests.data.flatMap((row) => row.ordered_reference_ids ?? []),
    ...jobs.map((row) => row.asset_id),
  ]);
  const images = new Map<string, ImageAsset>();
  await Promise.all([...ids].map(async (id) => {
    const path = id ? paths.get(id) : undefined;
    if (!id || !path) return;
    try {
      images.set(id, { id, url: await signImage(database, path) });
    } catch {
      return;
    }
  }));
  return requests.data.map((row) => ({
    id: row.id, createdAt: row.created_at ?? "", prompt: row.prompt, config: configOf(row),
    reference: row.reference_id ? images.get(row.reference_id) ?? null : null,
    references: row.ordered_reference_ids?.flatMap((id) => {
      const image = images.get(id);
      return image ? [image] : [];
    }),
    jobs: jobs.filter((job) => job.submission_id === row.id)
      .sort((a, b) => a.slot - b.slot).map((job): CanvasJob => ({
        id: job.id, slot: job.slot, attempt: job.attempt, status: job.status,
        error: job.error_message, asset: job.asset_id ? images.get(job.asset_id) ?? null : null,
        x: job.position_x, y: job.position_y,
        canvasHidden: job.canvas_hidden, canvasWidth: job.canvas_width,
      })),
  }));
}
