import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { maxMarkdownBytes, markdownFilename, markdownMime } from "./attachment-types";
import { StudioError } from "./auth";
import { bucket } from "./projects";

export function detectImageMime(bytes: Uint8Array) {
  const matches = (signature: number[], offset = 0) =>
    signature.every((value, index) => bytes[index + offset] === value);
  if (matches([255, 216, 255])) return "image/jpeg";
  if (matches([137, 80, 78, 71, 13, 10, 26, 10])) return "image/png";
  if (matches([82, 73, 70, 70]) && matches([87, 69, 66, 80], 8)) return "image/webp";
  return null;
}

export async function signImage(database: SupabaseClient, path: string, lifetime = 3600) {
  const { data, error } = await database.storage.from(bucket).createSignedUrl(path, lifetime);
  if (error || !data?.signedUrl) throw new StudioError("暂时无法读取项目图片。", 503);
  return data.signedUrl;
}

export async function saveImage(
  database: SupabaseClient,
  ownerId: string,
  projectId: string,
  id: string,
  kind: "reference" | "generated" | "markdown",
  buffer: ArrayBuffer,
  filename?: string,
) {
  const bytes = new Uint8Array(buffer);
  if (kind === "markdown") {
    if (!filename || !markdownFilename.test(filename) || !bytes.length || bytes.length > maxMarkdownBytes || bytes.includes(0)) {
      throw new StudioError("请选择不超过 256 KB 的 Markdown 文档。");
    }
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new StudioError("Markdown 文件须使用 UTF-8 编码。");
    }
  }
  const type = kind === "markdown" ? markdownMime : detectImageMime(bytes);
  if (!type) throw new StudioError("图片格式必须为 JPEG、PNG 或 WebP。");
  const path = `${ownerId}/${projectId}/${id}.${type.split("/")[1]}`;
  const { data: existing, error: checkError } = await database.from("studio_assets")
    .select("project_id,path,kind").eq("id", id).maybeSingle();
  if (checkError) throw new StudioError("暂时无法检查图片记录。", 503);
  if (existing) {
    if (existing.project_id !== projectId || existing.path !== path || existing.kind !== kind) {
      throw new StudioError("图片编号已被占用。", 409);
    }
    return { id, path };
  }
  const { error: uploadError } = await database.storage.from(bucket)
    .upload(path, buffer, { contentType: type, upsert: true });
  if (uploadError) throw new StudioError("保存图片失败，请重试。", 503);
  const { error } = await database.from("studio_assets")
    .upsert({ id, project_id: projectId, path, kind, ...(filename ? { filename } : {}) }, { ignoreDuplicates: true });
  const { data: saved } = await database.from("studio_assets")
    .select("id").eq("id", id).eq("project_id", projectId).eq("path", path).eq("kind", kind).maybeSingle();
  if (error || !saved) throw new StudioError("记录图片失败，请重试。", 503);
  return { id, path };
}

export async function downloadGeneratedImage(url: string, allowedHosts: string[]) {
  const address = new URL(url);
  if (address.protocol !== "https:" || !allowedHosts.includes(address.hostname)
    || address.username || address.password || address.port) {
    throw new StudioError("生图服务返回了未经配置的图片地址。", 502);
  }

  const response = await fetch(address, {
    redirect: "error",
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  const limit = 50 * 1024 * 1024;
  if (!response.ok || !response.body || Number(response.headers.get("content-length")) > limit) {
    throw new StudioError("暂时无法下载生图结果。", 502);
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) throw new StudioError("生图结果超过存储上限。", 502);
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes.buffer;
}
