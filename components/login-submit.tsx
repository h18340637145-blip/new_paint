"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

export function LoginSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "登录中…" : "登录"}
    </Button>
  );
}
