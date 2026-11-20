import { cn } from "@/lib/utils";
import { logIn } from "@/app/auth/login/actions";
import { LoginSubmit } from "@/components/login-submit";
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

const loginErrors = new Map([
  ["required", "请输入邮箱和密码。"],
  ["invalid_credentials", "邮箱或密码不正确，请核对后重试。"],
  ["email_not_confirmed", "该账号尚未完成邮箱验证，请先打开注册确认邮件中的链接。"],
  ["unavailable", "登录服务暂不可用，请稍后重试。"],
]);

export function LoginForm({
  className,
  errorCode,
  next,
  ...props
}: React.ComponentPropsWithoutRef<"div"> & { errorCode?: string; next?: string }) {
  const error = errorCode ? loginErrors.get(errorCode) : undefined;
  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="rounded-2xl border-neutral-200/80 bg-white text-neutral-950 shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl tracking-tight text-neutral-950">登录创作工作台</CardTitle>
          <CardDescription>使用已注册的邮箱与密码继续创作、管理项目或同步个人与团队素材库。</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={logIn}>
            {next && <input type="hidden" name="next" value={next} />}
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
                <Label htmlFor="email">邮箱</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@example.com"
                  required
                />
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">密码</Label>
                  <Link
                    href="/auth/forgot-password"
                    className="inline-flex min-h-9 items-center text-xs font-medium text-neutral-600 underline-offset-4 hover:text-neutral-950 hover:underline"
                  >
                    忘记密码？
                  </Link>
                </div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </div>

              <LoginSubmit />
            </div>

            <p className="mt-4 text-center text-sm text-neutral-600">
              还没有账号？{" "}
              <Link
                href="/auth/sign-up"
                className="inline-flex min-h-11 items-center font-medium text-neutral-950 underline underline-offset-4"
              >
                免费注册账号
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
