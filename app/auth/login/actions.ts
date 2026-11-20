"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function resolveSafeNextPath(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== "string") return null;
  if (raw === "profile" || raw === "/profile") return "/profile";
  if (raw === "/typography" || raw === "/typography?resumeImport=1") return raw;
  if (raw === "/projects") return "/projects";
  return null;
}

export async function logIn(formData: FormData) {
  const safeNext = resolveSafeNextPath(formData.get("next"));
  const nextParam = safeNext ? `&next=${encodeURIComponent(safeNext)}` : "";
  const email = formData.get("email");
  const password = formData.get("password");
  if (typeof email !== "string" || !email.trim() || typeof password !== "string" || !password) {
    redirect(`/auth/login?error=required${nextParam}`);
  }

  let code: string | undefined;
  try {
    const supabase = await createClient();
    const { error, data } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    code = error ? (error.code ?? "unavailable") : data.session ? undefined : "unavailable";
  } catch {
    code = "unavailable";
  }

  if (code === "invalid_credentials" || code === "email_not_confirmed") {
    redirect(`/auth/login?error=${code}${nextParam}`);
  }
  if (code) redirect(`/auth/login?error=unavailable${nextParam}`);
  redirect(safeNext ?? "/protected");
}
