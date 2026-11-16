"use server";

import { redirect } from "next/navigation";
import { studioAdmin, studioPageSession, StudioError } from "./auth";

export async function createEmptyProject() {
  const { userId } = await studioPageSession();
  const { data, error } = await studioAdmin().from("studio_projects")
    .insert({ owner_id: userId }).select("id").single();
  if (error) throw new StudioError("无法创建项目，请稍后重试。", 503);
  redirect(`/canvas?projectId=${data.id}`);
}
