import { NextResponse } from "next/server";
import { requireStudioMember, studioAdmin, StudioError } from "@/lib/studio/auth";
import { uuidPattern } from "@/lib/studio/projects";
import { publishLibraryMediaForWechat } from "@/lib/typography/library-store";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { userId } = await requireStudioMember();
    if (!request.headers.get("content-type")?.startsWith("application/json")) {
      throw new StudioError("请求格式无效。", 415);
    }
    const body = await request.json().catch(() => null);
    const rawIds = Array.isArray(body?.mediaIds) ? (body.mediaIds as unknown[]) : [];
    const mediaIds = rawIds
      .filter((id): id is string => typeof id === "string" && uuidPattern.test(id))
      .slice(0, 30);

    const admin = studioAdmin();
    const images = await publishLibraryMediaForWechat(admin, userId, mediaIds);
    return NextResponse.json({ images }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof StudioError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "准备公众号公开图片失败，请点击重试。" }, { status: 500 });
  }
}
