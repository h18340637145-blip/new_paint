import { NextResponse } from "next/server";
import sharp from "sharp";
import { requireStudioMember, studioAdmin, StudioError } from "@/lib/studio/auth";
import { bucket, readProject, uuidPattern } from "@/lib/studio/projects";
import { detectImageMime } from "@/lib/studio/storage";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string; assetId: string }> },
) {
  try {
    const { supabase } = await requireStudioMember();
    const { projectId, assetId } = await context.params;

    if (!uuidPattern.test(projectId) || !uuidPattern.test(assetId)) {
      return NextResponse.json({ error: "无效的图片参数。" }, { status: 400 });
    }

    const project = await readProject(supabase, projectId);
    if (!project) {
      return NextResponse.json({ error: "无权访问该项目图片。" }, { status: 404 });
    }

    const admin = studioAdmin();
    const { data: asset, error: assetErr } = await admin
      .from("studio_assets")
      .select("id,path,kind")
      .eq("project_id", projectId)
      .eq("id", assetId)
      .in("kind", ["reference", "generated"])
      .maybeSingle();

    if (assetErr || !asset) {
      return NextResponse.json({ error: "找不到该配图素材。" }, { status: 404 });
    }

    const { data: blob, error: dlErr } = await admin.storage.from(bucket).download(asset.path);
    if (dlErr || !blob) {
      return NextResponse.json({ error: "读取配图文件失败。" }, { status: 502 });
    }

    const rawBuffer = Buffer.from(await blob.arrayBuffer());

    let outBuffer: Buffer = rawBuffer;
    let contentType = detectImageMime(new Uint8Array(rawBuffer)) || "image/png";

    try {
      outBuffer = await sharp(rawBuffer)
        .rotate()
        .resize({ width: 1280, height: 2560, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 86 })
        .toBuffer();
      contentType = "image/webp";
    } catch {
      // Fallback to original image bytes if sharp transform fails
    }

    return new NextResponse(new Uint8Array(outBuffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=86400, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof StudioError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "加载预览图片失败。" }, { status: 500 });
  }
}
