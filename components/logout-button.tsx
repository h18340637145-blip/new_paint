"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  return (
    <Button size="sm" variant="outline" className="min-h-11 rounded-xl px-3.5 text-xs font-medium" onClick={logout}>
      退出登录
    </Button>
  );
}
