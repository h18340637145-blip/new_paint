import { NextResponse } from "next/server";
import { requireStudioMember, studioAdmin, StudioError } from "@/lib/studio/auth";
import { mapDraftRow, signDraftPreviewImages } from "@/lib/studio/article-data";
import { readProject, uuidPattern } from "@/lib/studio/projects";
import { resolveSubTemplateId, sanitizeStyle } from "@/lib/typography/templates";
import type { DocumentTextStyle, StructuredArticleBlock } from "@/lib/typography/structured";
import type { TemplateStyleConfig } from "@/lib/typography/types";

export const runtime = "nodejs";

function errorResponse(error: unknown) {
  if (error instanceof StudioError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: "排版稿操作失败，请稍后重试。" }, { status: 500 });
}

function requireUuid(input: unknown, label = "无效的记录编号。") {
  if (typeof input !== "string" || !uuidPattern.test(input)) throw new StudioError(label);
  return input;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { supabase } = await requireStudioMember();
    const { id } = await context.params;
    const draftId = requireUuid(id, "无效的排版稿编号。");

    const { data: row, error } = await supabase
      .from("studio_article_drafts")
      .select("*")
      .eq("id", draftId)
      .maybeSingle();

    if (error || !row) throw new StudioError("找不到该排版稿。", 404);

    const project = await readProject(supabase, String(row.project_id));
    if (!project) throw new StudioError("无权访问该排版稿。", 404);

    const draft = mapDraftRow(row);
    const imageUrls = await signDraftPreviewImages(supabase, draft.projectId, draft.blocks);

    return NextResponse.json({ draft, imageUrls }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { supabase } = await requireStudioMember();
    const { id } = await context.params;
    const draftId = requireUuid(id, "无效的排版稿编号。");

    if (!request.headers.get("content-type")?.startsWith("application/json")) {
      throw new StudioError("请求格式无效。", 415);
    }
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") throw new StudioError("请求内容无效。");

    const projectId = requireUuid(body.projectId, "无效的项目编号。");
    const project = await readProject(supabase, projectId);
    if (!project) throw new StudioError("找不到项目。", 404);

    const expectedVersion = Number(body.expectedVersion);
    if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) {
      throw new StudioError("缺少有效的排版稿版本号。", 400);
    }

    const title = typeof body.title === "string" && body.title.trim()
      ? body.title.trim().slice(0, 200)
      : "未命名排版稿";
    const subTemplateId = resolveSubTemplateId(
      typeof body.subTemplateId === "string" ? body.subTemplateId : undefined,
    );
    if (!body.templateStyle || typeof body.templateStyle !== "object") {
      throw new StudioError("缺少模板样式配置。");
    }
    const templateStyle = sanitizeStyle(body.templateStyle as TemplateStyleConfig);
    const documentStyle = (
      body.documentStyle && typeof body.documentStyle === "object" ? body.documentStyle : {}
    ) as DocumentTextStyle;
    if (!Array.isArray(body.blocks)) {
      throw new StudioError("文章内容结构无效。");
    }
    const blocks = body.blocks as StructuredArticleBlock[];

    const admin = studioAdmin();
    const { data: updated, error } = await admin
      .from("studio_article_drafts")
      .update({
        title,
        sub_template_id: subTemplateId,
        template_style: templateStyle,
        document_style: documentStyle,
        blocks,
        version: expectedVersion + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", draftId)
      .eq("project_id", projectId)
      .eq("version", expectedVersion)
      .select("*")
      .maybeSingle();

    if (error) throw new StudioError("保存排版稿失败。", 503);

    if (!updated) {
      const { data: current } = await admin
        .from("studio_article_drafts")
        .select("version")
        .eq("id", draftId)
        .eq("project_id", projectId)
        .maybeSingle();

      if (!current) throw new StudioError("找不到该排版稿。", 404);
      throw new StudioError(
        "该排版稿已在其他页面被修改，请刷新加载最新版本后再保存，避免覆盖他人或另一标签页的改动。",
        409,
      );
    }

    return NextResponse.json({ draft: mapDraftRow(updated) });
  } catch (error) {
    return errorResponse(error);
  }
}
