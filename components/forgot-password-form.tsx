"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { AuthStatusCard } from "@/components/auth-status-card";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useState } from "react";

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleForgotPassword = async (
    e: React.SubmitEvent<HTMLFormElement>,
  ) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/update-password`,
      });
      if (error) throw error;
      setSuccess(true);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "发送重置邮件失败，请稍后重试。");
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <AuthStatusCard
        tone="success"
        title="重置邮件已发出"
        description="如果该邮箱已完成注册，您将收到一封包含密码重置链接的邮件，请在有效期内打开链接设置新密码。"
        primaryAction={{ label: "返回登录", href: "/auth/login" }}
      />
    );
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="rounded-2xl border-neutral-200/80 bg-white text-neutral-950 shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl tracking-tight text-neutral-950">找回登录密码</CardTitle>
          <CardDescription>
            输入您的注册邮箱，我们将向您发送安全的密码重置链接。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleForgotPassword}>
            <div className="flex flex-col gap-5">
              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-800"
                >
                  {error}
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="email">注册邮箱</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <Button type="submit" className="min-h-11 w-full bg-[#164b3e] hover:bg-[#123d32]" disabled={isLoading}>
                {isLoading ? "正在发送…" : "发送重置链接"}
              </Button>
            </div>
            <div className="mt-4 text-center text-sm text-neutral-600">
              想起密码了？{" "}
              <Link
                href="/auth/login"
                className="inline-flex min-h-11 items-center font-medium text-neutral-950 underline underline-offset-4"
              >
                返回登录
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
