import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { StudioError } from "./auth";
import type { ProjectCardData } from "./types";

export const bucket = "project-images";
export const projectPageSize = 20;
export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function readProject(supabase: SupabaseClient, id: string) {
  if (!uuidPattern.test(id)) return null;
  const { data, error } = await supabase
    .from("studio_projects").select("id,title,owner_id").eq("id", id).maybeSingle();
  if (error) throw new StudioError("无法读取项目。", 503);
  return data;
}

export async function readProjects(supabase: SupabaseClient, limit: number, offset = 0) {
  const { data, error } = await supabase.from("studio_projects").select("id,title,updated_at")
    .order("updated_at", { ascending: false }).order("id", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw new StudioError("无法读取项目列表。", 503);

  const projects = await Promise.all(data.map(async (project): Promise<ProjectCardData> => {
    const { data: cover } = await supabase.from("studio_assets").select("path")
      .eq("project_id", project.id).eq("kind", "generated")
      .order("created_at").order("id").limit(1).maybeSingle();
    const signed = cover
      ? await supabase.storage.from(bucket).createSignedUrl(cover.path, 3600)
      : null;
    return {
      id: project.id,
      title: project.title,
      updatedAt: project.updated_at,
      coverUrl: signed?.data?.signedUrl ?? null,
    };
  }));
  return projects;
}
