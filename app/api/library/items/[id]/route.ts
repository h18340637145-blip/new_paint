import { NextResponse } from "next/server";
import { requireStudioMember, studioAdmin, StudioError } from "@/lib/studio/auth";
import {
  duplicateLibraryItem,
  exportPortableLibraryItem,
  materializeItemSnapshot,
  readAuthorizedLibraryItem,
  updateLibraryItem,
} from "@/lib/typography/library-store";
import type { LibraryAssetCategory, LibraryScopeType } from "@/lib/typography/custom-tree";
import type { TemplateStyleConfig } from "@/lib/typography/types";

export const runtime = "nodejs";

function errorResponse(error: unknown) {
  if (error instanceof StudioError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: "库条目操作失败，请稍后重试。" }, { status: 500 });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await requireStudioMember();
    const { id } = await context.params;
    const admin = studioAdmin();
    const url = new URL(request.url);

    if (url.searchParams.get("export") === "json") {
      const exported = await exportPortableLibraryItem(admin, id, userId);
      const safeFilename = encodeURIComponent(exported.item.name || "library-item");
      return new NextResponse(JSON.stringify(exported, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename*=UTF-8''${safeFilename}.json`,
          "Cache-Control": "no-store",
        },
      });
    }

    const { item } = await readAuthorizedLibraryItem(admin, id, userId);
    return NextResponse.json({ item }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await requireStudioMember();
    const { id } = await context.params;

    if (!request.headers.get("content-type")?.startsWith("application/json")) {
      throw new StudioError("请求格式无效。", 415);
    }
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      throw new StudioError("请求内容无效。", 400);
    }

    const expectedVersion = Number(body.expectedVersion);
    if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) {
      throw new StudioError("缺少有效的条目版本号。", 400);
    }

    const rawCat = body.category;
    const category: LibraryAssetCategory | undefined =
      rawCat === "template"
      || rawCat === "card"
      || rawCat === "divider"
      || rawCat === "image-border"
      || rawCat === "heading-border"
        ? rawCat
        : undefined;

    const admin = studioAdmin();
    const item = await updateLibraryItem({
      admin,
      itemId: id,
      userId,
      expectedVersion,
      name: typeof body.name === "string" ? body.name : undefined,
      summary: typeof body.summary === "string" ? body.summary : undefined,
      category,
      rootNode: body.rootNode !== undefined ? body.rootNode : undefined,
      templateStyle:
        body.templateStyle !== undefined
          ? body.templateStyle && typeof body.templateStyle === "object"
            ? (body.templateStyle as TemplateStyleConfig)
            : null
          : undefined,
      sampleMarkdown:
        body.sampleMarkdown !== undefined
          ? typeof body.sampleMarkdown === "string"
            ? body.sampleMarkdown
            : null
          : undefined,
      archived: typeof body.archived === "boolean" ? body.archived : undefined,
      localizeExternalImages: Boolean(body.localizeExternalImages),
    });

    return NextResponse.json({ item }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { supabase, userId } = await requireStudioMember();
    const { id } = await context.params;

    if (!request.headers.get("content-type")?.startsWith("application/json")) {
      throw new StudioError("请求格式无效。", 415);
    }
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      throw new StudioError("请求内容无效。", 400);
    }

    const admin = studioAdmin();

    if (body.action === "duplicate") {
      const targetScopeType: LibraryScopeType = body.targetScopeType === "team" ? "team" : "personal";
      const targetTeamId = typeof body.targetTeamId === "string" ? body.targetTeamId : null;
      const duplicated = await duplicateLibraryItem({
        admin,
        itemId: id,
        userId,
        targetScopeType,
        targetTeamId,
        newName: typeof body.newName === "string" ? body.newName : undefined,
      });
      return NextResponse.json({ item: duplicated }, { status: 201 });
    }

    if (body.action === "materialize") {
      const projectId = typeof body.projectId === "string" && body.projectId ? body.projectId : null;
      const { snapshot, item } = await materializeItemSnapshot({
        supabase,
        admin,
        itemId: id,
        userId,
        projectId,
      });
      return NextResponse.json({ snapshot, item });
    }

    throw new StudioError("不支持的库操作。", 400);
  } catch (error) {
    return errorResponse(error);
  }
}
