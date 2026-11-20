import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireStudioMember, studioAdmin, StudioError } from "@/lib/studio/auth";
import {
  parseImportInput,
  type LibraryAssetCategory,
  type LibraryItemKind,
  type LibraryScopeType,
  type PortableEmbeddedMedia,
} from "@/lib/typography/templates";
import {
  createLibraryItem,
  listLibraryOverview,
} from "@/lib/typography/library-store";
import type { TemplateStyleConfig } from "@/lib/typography/types";

export const runtime = "nodejs";

function errorResponse(error: unknown) {
  if (error instanceof StudioError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof Error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ error: "模板与素材库请求失败，请稍后重试。" }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();
    const userId = data?.claims.sub;
    if (error || !userId) {
      return NextResponse.json(
        {
          authenticated: false,
          personalItems: [],
          teamItems: [],
          teams: [],
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const url = new URL(request.url);
    const includeArchived = url.searchParams.get("includeArchived") === "1";
    const admin = studioAdmin();
    const overview = await listLibraryOverview(admin, userId, includeArchived);

    return NextResponse.json(
      {
        authenticated: true,
        ...overview,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    if (!request.headers.get("content-type")?.startsWith("application/json")) {
      throw new StudioError("请求格式无效。", 415);
    }
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      throw new StudioError("请求内容无效。", 400);
    }

    // 服务端导入安全校验与解析预览（匿名与已登录用户均可调用）
    if (body.action === "preview-import") {
      const raw = typeof body.raw === "string" ? body.raw : "";
      if (raw.length > 8_500_000) {
        throw new StudioError("导入内容过大，请控制在 8 MB 以内。", 400);
      }
      const targetKind: LibraryItemKind = body.targetKind === "template" ? "template" : "asset";
      const format =
        body.format === "html" || body.format === "json" ? body.format : "auto";
      const preferredCategory =
        body.preferredCategory === "card"
        || body.preferredCategory === "divider"
        || body.preferredCategory === "image-border"
        || body.preferredCategory === "heading-border"
        || body.preferredCategory === "template"
          ? (body.preferredCategory as LibraryAssetCategory)
          : undefined;

      const parsed = parseImportInput({
        raw,
        format,
        targetKind,
        preferredCategory,
        fallbackName: typeof body.fallbackName === "string" ? body.fallbackName : undefined,
      });

      return NextResponse.json({ parsed }, { headers: { "Cache-Control": "no-store" } });
    }

    // 保存到个人库或团队库（须登录）
    const { userId } = await requireStudioMember();
    const admin = studioAdmin();

    const scopeType: LibraryScopeType = body.scopeType === "team" ? "team" : "personal";
    const teamId = typeof body.teamId === "string" ? body.teamId : null;
    const kind: LibraryItemKind = body.kind === "template" ? "template" : "asset";
    const rawCat = body.category;
    const category: LibraryAssetCategory =
      kind === "template"
        ? "template"
        : rawCat === "divider" || rawCat === "image-border" || rawCat === "heading-border"
          ? rawCat
          : "card";

    if (!body.rootNode || typeof body.rootNode !== "object") {
      throw new StudioError("缺少受控组件树结构。", 400);
    }

    const item = await createLibraryItem({
      admin,
      userId,
      scopeType,
      teamId,
      kind,
      category,
      name: typeof body.name === "string" ? body.name : "",
      summary: typeof body.summary === "string" ? body.summary : "",
      rootNode: body.rootNode,
      templateStyle:
        body.templateStyle && typeof body.templateStyle === "object"
          ? (body.templateStyle as TemplateStyleConfig)
          : null,
      sampleMarkdown: typeof body.sampleMarkdown === "string" ? body.sampleMarkdown : null,
      portableMedia: Array.isArray(body.portableMedia)
        ? (body.portableMedia as PortableEmbeddedMedia[])
        : undefined,
      localizeExternalImages: Boolean(body.localizeExternalImages),
    });

    return NextResponse.json({ item }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
