import { NextResponse } from "next/server";
import { requireStudioMember, studioAdmin, StudioError } from "@/lib/studio/auth";
import { saveLibraryMediaBuffer } from "@/lib/typography/library-store";
import type { LibraryScopeType } from "@/lib/typography/custom-tree";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { userId } = await requireStudioMember();
    const formData = await request.formData().catch(() => null);
    if (!formData) {
      throw new StudioError("请上传有效的图片文件。", 400);
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new StudioError("未检测到图片文件。", 400);
    }

    const scopeRaw = formData.get("scopeType");
    const scopeType: LibraryScopeType = scopeRaw === "team" ? "team" : "personal";
    const teamIdRaw = formData.get("teamId");
    const teamId = typeof teamIdRaw === "string" && teamIdRaw ? teamIdRaw : null;

    const buffer = await file.arrayBuffer();
    const admin = studioAdmin();
    const media = await saveLibraryMediaBuffer({
      admin,
      userId,
      scopeType,
      teamId,
      buffer,
      filename: file.name,
    });

    return NextResponse.json(
      {
        media: {
          id: media.id,
          scopeType: media.scopeType,
          teamId: media.teamId,
          mimeType: media.mimeType,
          filename: media.filename,
          previewUrl: `/api/library/media/${encodeURIComponent(media.id)}`,
        },
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof StudioError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "上传素材图片失败，请稍后重试。" }, { status: 500 });
  }
}
