import { after, NextResponse } from "next/server";
import { requireStudioMember, studioAdmin, StudioError } from "@/lib/studio/auth";
import { mapTaskRow, runArticleGenerationTask } from "@/lib/studio/article-data";
import { readProject, uuidPattern } from "@/lib/studio/projects";
import { getSubTemplate, resolveSubTemplateId, sanitizeStyle } from "@/lib/typography/templates";
import type { TemplateStyleConfig } from "@/lib/typography/types";

export const runtime = "nodejs";
export const maxDuration = 60;

function errorResponse(error: unknown) {
  if (error instanceof StudioError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error("排版生成任务请求失败", error instanceof Error ? error.message : "未知错误");
  return NextResponse.json({ error: "排版任务操作失败，请稍后重试。" }, { status: 500 });
}

function requireUuid(input: unknown, label = "无效的记录编号。") {
  if (typeof input !== "string" || !uuidPattern.test(input)) throw new StudioError(label);
  return input;
}

export async function GET(request: Request) {
  try {
    const { supabase } = await requireStudioMember();
    const url = new URL(request.url);
    const projectId = requireUuid(url.searchParams.get("projectId"), "无效的项目编号。");
    const taskId = requireUuid(url.searchParams.get("taskId"), "无效的任务编号。");

    const project = await readProject(supabase, projectId);
    if (!project) throw new StudioError("找不到项目。", 404);

    const admin = studioAdmin();
    const { data: row, error } = await admin
      .from("studio_article_tasks")
      .select("*")
      .eq("id", taskId)
      .eq("project_id", projectId)
      .maybeSingle();

    if (error || !row) throw new StudioError("找不到该排版任务。", 404);

    // Recover stale running tasks (> 75s) so client can retry cleanly
    if (row.status === "running" && Date.now() - Date.parse(row.updated_at) > 75_000) {
      const { data: timedOut } = await admin
        .from("studio_article_tasks")
        .update({
          status: "failed",
          error_message: "排版生成超时，请点击重试。",
          updated_at: new Date().toISOString(),
        })
        .eq("id", taskId)
        .eq("status", "running")
        .select("*")
        .maybeSingle();
      if (timedOut) {
        return NextResponse.json({ task: mapTaskRow(timedOut) }, { headers: { "Cache-Control": "no-store" } });
      }
    }

    return NextResponse.json({ task: mapTaskRow(row) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { supabase } = await requireStudioMember();
    if (!request.headers.get("content-type")?.startsWith("application/json")) {
      throw new StudioError("请求格式无效。", 415);
    }
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") throw new StudioError("请求内容无效。");

    const projectId = requireUuid(body.projectId, "无效的项目编号。");
    const snapshotId = requireUuid(body.snapshotId, "请选择有效的暂存版本。");
    const project = await readProject(supabase, projectId);
    if (!project) throw new StudioError("找不到项目。", 404);

    const subTemplateId = resolveSubTemplateId(
      typeof body.subTemplateId === "string" ? body.subTemplateId : undefined,
    );
    const fallbackStyle = getSubTemplate(subTemplateId).defaultStyle;
    const rawStyle =
      body.templateStyle && typeof body.templateStyle === "object"
        ? (body.templateStyle as TemplateStyleConfig)
        : fallbackStyle;
    const templateStyle = sanitizeStyle({
      ...fallbackStyle,
      ...rawStyle,
      colors: { ...fallbackStyle.colors, ...(rawStyle.colors ?? {}) },
      heading: { ...fallbackStyle.heading, ...(rawStyle.heading ?? {}) },
      paragraph: { ...fallbackStyle.paragraph, ...(rawStyle.paragraph ?? {}) },
      list: { ...fallbackStyle.list, ...(rawStyle.list ?? {}) },
      image: { ...fallbackStyle.image, ...(rawStyle.image ?? {}) },
      divider: { ...fallbackStyle.divider, ...(rawStyle.divider ?? {}) },
    });

    const admin = studioAdmin();

    // Verify snapshot belongs to project
    const { data: snap, error: snapErr } = await admin
      .from("studio_article_snapshots")
      .select("id")
      .eq("id", snapshotId)
      .eq("project_id", projectId)
      .maybeSingle();
    if (snapErr || !snap) throw new StudioError("找不到对应的画布暂存版本。", 404);

    // Deduplicate accidental double clicks: reuse active running task within 70s
    if (body.forceNew !== true) {
      const recentCutoff = new Date(Date.now() - 70_000).toISOString();
      const { data: existingRunning } = await admin
        .from("studio_article_tasks")
        .select("*")
        .eq("project_id", projectId)
        .eq("snapshot_id", snapshotId)
        .eq("sub_template_id", subTemplateId)
        .eq("status", "running")
        .gte("updated_at", recentCutoff)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingRunning) {
        return NextResponse.json({ task: mapTaskRow(existingRunning), reused: true }, { status: 202 });
      }
    }

    const nowIso = new Date().toISOString();
    const { data: created, error: createErr } = await admin
      .from("studio_article_tasks")
      .insert({
        project_id: projectId,
        snapshot_id: snapshotId,
        sub_template_id: subTemplateId,
        template_style: templateStyle,
        status: "running",
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select("*")
      .single();

    if (createErr || !created) {
      throw new StudioError("创建排版生成任务失败。", 503);
    }

    const taskId = String(created.id);
    after(async () => {
      try {
        await runArticleGenerationTask(admin, taskId, projectId);
      } catch (err) {
        console.error("后台 Qwen 排版任务异常", err instanceof Error ? err.message : err);
      }
    });

    return NextResponse.json({ task: mapTaskRow(created), reused: false }, { status: 202 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const { supabase } = await requireStudioMember();
    if (!request.headers.get("content-type")?.startsWith("application/json")) {
      throw new StudioError("请求格式无效。", 415);
    }
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") throw new StudioError("请求内容无效。");

    const projectId = requireUuid(body.projectId, "无效的项目编号。");
    const taskId = requireUuid(body.taskId, "无效的任务编号。");
    const project = await readProject(supabase, projectId);
    if (!project) throw new StudioError("找不到项目。", 404);

    const admin = studioAdmin();
    const { data: existing, error } = await admin
      .from("studio_article_tasks")
      .select("*")
      .eq("id", taskId)
      .eq("project_id", projectId)
      .maybeSingle();

    if (error || !existing) throw new StudioError("找不到该排版任务。", 404);
    if (existing.status === "running") {
      return NextResponse.json({ task: mapTaskRow(existing), reused: true }, { status: 202 });
    }
    if (existing.status !== "failed") {
      throw new StudioError("仅失败的任务可使用原输入重试。", 409);
    }

    const { data: resetRow, error: resetErr } = await admin
      .from("studio_article_tasks")
      .update({
        status: "running",
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId)
      .eq("project_id", projectId)
      .select("*")
      .single();

    if (resetErr || !resetRow) throw new StudioError("重试任务启动失败。", 503);

    after(async () => {
      try {
        await runArticleGenerationTask(admin, taskId, projectId);
      } catch (err) {
        console.error("重试 Qwen 排版任务异常", err instanceof Error ? err.message : err);
      }
    });

    return NextResponse.json({ task: mapTaskRow(resetRow), reused: false }, { status: 202 });
  } catch (error) {
    return errorResponse(error);
  }
}
