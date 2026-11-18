import { NextResponse } from "next/server";
import { requireStudioMember, studioAdmin, StudioError } from "@/lib/studio/auth";
import { publishDraftImages } from "@/lib/studio/article-data";
import { readProject, uuidPattern } from "@/lib/studio/projects";
import { extractDraftImageAssetIds, type StructuredArticleBlock } from "@/lib/typography/structured";

export const runtime = "nodejs";
export const maxDuration = 60;

function errorResponse(error: unknown) {
  if (error instanceof StudioError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error("导出公开图片失败", error instanceof Error ? error.message : "未知错误");
  return NextResponse.json({ error: "准备公众号公开图片失败，请重试。" }, { status: 500 });
}

function requireUuid(input: unknown, label = "无效的记录编号。") {
  if (typeof input !== "string" || !uuidPattern.test(input)) throw new StudioError(label);
  return input;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { supabase, userId } = await requireStudioMember();
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

    // Ensure draft belongs to project
    const { data: draftRow, error: draftErr } = await supabase
      .from("studio_article_drafts")
      .select("id,blocks")
      .eq("id", draftId)
      .eq("project_id", projectId)
      .maybeSingle();

    if (draftErr || !draftRow) throw new StudioError("找不到该排版稿。", 404);

    // Only publish images actually exported in the current blocks
    const sourceBlocks = Array.isArray(body.blocks)
      ? (body.blocks as StructuredArticleBlock[])
      : ((draftRow.blocks ?? []) as StructuredArticleBlock[]);

    const assetIds = extractDraftImageAssetIds(sourceBlocks).filter((aid) => uuidPattern.test(aid));
    const admin = studioAdmin();
    const images = await publishDraftImages(admin, userId, projectId, assetIds);

    return NextResponse.json({ images }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
