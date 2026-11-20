import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { studioAdmin, StudioError } from "@/lib/studio/auth";
import { localizeExternalMediaInTree } from "@/lib/typography/library-store";
import type { LibraryScopeType } from "@/lib/typography/custom-tree";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    if (!request.headers.get("content-type")?.startsWith("application/json")) {
      throw new StudioError("请求格式无效。", 415);
    }
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || !body.rootNode) {
      throw new StudioError("缺少组件树结构。", 400);
    }

    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    const userId = data?.claims.sub ?? null;

    const scopeType: LibraryScopeType = body.scopeType === "team" ? "team" : "personal";
    const teamId = typeof body.teamId === "string" ? body.teamId : null;
    const admin = userId ? studioAdmin() : undefined;

    const result = await localizeExternalMediaInTree({
      admin,
      userId,
      scopeType,
      teamId,
      rootNode: body.rootNode,
    });

    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof StudioError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "外链图片转存失败，请手动上传替换。" }, { status: 500 });
  }
}
