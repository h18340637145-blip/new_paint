"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
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
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignUpForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSignUp = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isLoading) return;
    if (password !== repeatPassword) {
      setError("两次输入的密码不一致。");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const { data, error } = await createClient().auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
        },
      });
      if (error?.code === "email_address_not_authorized") {
        throw new Error("当前邮件服务无法向这个邮箱发送验证邮件，请联系管理员。");
      }
      if (error?.code === "over_email_send_rate_limit") {
        throw new Error("验证邮件发送次数已达上限，请稍后重试。");
      }
      if (error?.code === "user_already_exists" || error?.code === "email_exists") {
        throw new Error("该邮箱已注册，请返回登录或重置密码。");
      }
      if (error) throw error;
      router.replace(data.session ? "/protected" : "/auth/sign-up-success");
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "注册失败，请稍后重试。");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">注册创作工作台</CardTitle>
          <CardDescription>注册后请通过邮件验证邮箱。</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignUp}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="email">邮箱</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="m@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">密码</Label>
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="repeat-password">确认密码</Label>
                </div>
                <Input
                  id="repeat-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={repeatPassword}
                  onChange={(e) => setRepeatPassword(e.target.value)}
                />
              </div>
              {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "注册中…" : "注册"}
              </Button>
            </div>
            <div className="mt-4 text-center text-sm">
              已有账号？{" "}
              <Link href="/auth/login" className="underline underline-offset-4">
                返回登录
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
