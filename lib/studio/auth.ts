import "server-only";
import { createServerAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StudioError } from "./errors";

export { StudioError };

export function studioAdmin() {
  try {
    return createServerAdminClient();
  } catch {
    throw new StudioError("工作台服务端尚未配置。", 503);
  }
}

export async function requireStudioMember() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (error || !userId) throw new StudioError("请先登录。", 401);

  const { data: member, error: memberError } = await supabase
    .from("studio_members").select("user_id").eq("user_id", userId).maybeSingle();
  if (memberError) throw new StudioError("暂时无法验证工作台访问权限。", 503);
  if (!member) {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || user?.id !== userId) throw new StudioError("请重新登录。", 401);
    if (!user.email || !user.email_confirmed_at) {
      throw new StudioError("请先验证邮箱。", 403);
    }

    const { error: enrollmentError } = await studioAdmin()
      .from("studio_members").upsert({ user_id: userId }, { ignoreDuplicates: true });
    if (enrollmentError) throw new StudioError("暂时无法开通工作台，请稍后重试。", 503);
  }

  return { supabase, userId };
}

export async function studioPageSession() {
  try {
    return await requireStudioMember();
  } catch (error) {
    if (error instanceof StudioError && error.status === 401) redirect("/auth/login");
    if (error instanceof StudioError && error.status === 403) redirect("/invite-required");
    throw error;
  }
}
