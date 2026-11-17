import { requireStudioMember, StudioError } from "@/lib/studio/auth";
import { readAgentAssets } from "@/lib/studio/agent-data";
import { maxMarkdownBytes } from "@/lib/studio/attachment-types";
import { bucket, readProject, uuidPattern } from "@/lib/studio/projects";

export async function GET(request: Request) {
  try {
    const { supabase } = await requireStudioMember();
    const params = new URL(request.url).searchParams;
    const projectId = params.get("projectId") ?? "";
    const id = params.get("id") ?? "";
    if (!uuidPattern.test(id) || !await readProject(supabase, projectId)) {
      throw new StudioError("找不到附件。", 404);
    }
    const [asset] = await readAgentAssets(supabase, projectId, [id]);
    if (!asset || asset.kind !== "markdown") throw new StudioError("找不到附件。", 404);
    const { data, error } = await supabase.storage.from(bucket).download(asset.path);
    if (error || !data || data.size > maxMarkdownBytes) throw new StudioError("无法读取 Markdown 附件。", 503);
    const download = params.get("download") === "1";
    const headers = new Headers({
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    });
    if (download) {
      const filename = encodeURIComponent((asset.filename ?? "附件.md").toWellFormed()).replace(/['()*]/g, (char) => "%" + char.charCodeAt(0).toString(16));
      headers.set("Content-Disposition", `attachment; filename="attachment.md"; filename*=UTF-8''${filename}`);
    }
    return new Response(data, { headers });
  } catch (error) {
    const failure = error instanceof StudioError ? error : new StudioError("无法读取附件。", 503);
    return Response.json({ error: failure.message }, { status: failure.status });
  }
}
