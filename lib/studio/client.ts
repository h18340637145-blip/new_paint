import { createClient } from "@/lib/supabase/client";
import type { ComposerInput } from "@/components/studio/composer";
import { markdownFilename, markdownMime } from "./attachment-types";
import type { StudioAttachment } from "./agent-events";

export async function studioRequest<T>(input: Record<string, unknown>, options?: { keepalive?: boolean }): Promise<T> {
  const response = await fetch("/api/studio", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    keepalive: options?.keepalive,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload) throw new Error(payload?.error ?? "工作台暂不可用，请重试。");
  return payload;
}

export async function uploadReference(file: File, projectId: string, assetId: string, createProject = false, placeOnCanvas = false) {
  const type = markdownFilename.test(file.name) ? markdownMime : file.type;
  const { path, token } = await studioRequest<{ path: string; token: string }>({
    action: "prepare-upload", projectId, assetId, createProject, type, size: file.size, filename: file.name,
  });
  const { error } = await createClient().storage.from("project-images")
    .uploadToSignedUrl(path, token, new Blob([file], { type }), { contentType: type });
  if (error) throw new Error("参考图上传失败，请重试。");
  return studioRequest<StudioAttachment>({ action: "complete-upload", projectId, assetId, filename: file.name, placeOnCanvas });
}

export async function submitGeneration(
  input: ComposerInput, projectId: string, submissionId: string, assetId: string, createProject = false,
) {
  const asset = input.file ? await uploadReference(input.file, projectId, assetId, createProject) : input.asset;
  return studioRequest<{ id: string }>({
    action: "submit", projectId, submissionId, createProject, referenceId: asset?.id ?? null,
    prompt: input.prompt, config: input.config,
  });
}
