import { NextResponse } from "next/server";
import sharp from "sharp";
import { requireStudioMember, studioAdmin, StudioError } from "@/lib/studio/auth";
import { bucket } from "@/lib/studio/projects";
import { detectImageMime } from "@/lib/studio/storage";
import { readAuthorizedLibraryMedia } from "@/lib/typography/library-store";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await requireStudioMember();
    const { id } = await context.params;
    const admin = studioAdmin();

    const media = await readAuthorizedLibraryMedia(admin, id, userId);
    const { data: blob, error: dlErr } = await admin.storage
      .from(bucket)
      .download(media.storagePath);
    if (dlErr || !blob) {
      return NextResponse.json({ error: "读取库图片文件失败。" }, { status: 502 });
    }

    const rawBuffer = Buffer.from(await blob.arrayBuffer());
    let outBuffer: Buffer = rawBuffer;
    let contentType: string = detectImageMime(new Uint8Array(rawBuffer)) || media.mimeType;

    try {
      outBuffer = await sharp(rawBuffer)
        .rotate()
        .resize({ width: 1280, height: 2560, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 86 })
        .toBuffer();
      contentType = "image/webp";
    } catch {
      // 若压缩失败则回退原图字节
    }

    return new NextResponse(new Uint8Array(outBuffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof StudioError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "加载库图片失败。" }, { status: 500 });
  }
}
