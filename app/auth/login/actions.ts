"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function logIn(formData: FormData) {
  const email = formData.get("email");
  const password = formData.get("password");
  if (typeof email !== "string" || !email.trim() || typeof password !== "string" || !password) {
    redirect("/auth/login?error=required");
  }

  let code: string | undefined;
  try {
    const supabase = await createClient();
    const { error, data } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    code = error ? (error.code ?? "unavailable") : (data.session ? undefined : "unavailable");
  } catch {
    code = "unavailable";
  }

  if (code === "invalid_credentials" || code === "email_not_confirmed") {
    redirect(`/auth/login?error=${code}`);
  }
  if (code) redirect("/auth/login?error=unavailable");
  redirect("/protected");
}
