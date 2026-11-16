import { createClient } from "@/lib/supabase/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const code = searchParams.get("code");
  const type = searchParams.get("type") as EmailOtpType | null;
  const destination = searchParams.get("next") ?? (type === "invite" ? "/auth/update-password" : "/");
  const next = /^\/(?![\/\\])/.test(destination) && !destination.includes("\\")
    ? destination : "/";

  if (token_hash && type) {
    const supabase = await createClient();

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });
    if (!error) {
      redirect(next);
    }
    redirect(`/auth/error?${new URLSearchParams({ error: error.message })}`);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) redirect(next);
    redirect(`/auth/error?${new URLSearchParams({ error: "请在注册时使用的浏览器打开确认链接，或验证后重新登录。" })}`);
  }

  redirect(`/auth/error?${new URLSearchParams({ error: "确认链接缺少必要参数。" })}`);
}
