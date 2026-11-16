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
  ["invalid_credentials", "邮箱或密码不正确。"],
  ["email_not_confirmed", "请先通过注册邮件验证邮箱。"],
  ["unavailable", "登录服务暂不可用，请稍后重试。"],
]);

export function LoginForm({
  className, errorCode, ...props
}: React.ComponentPropsWithoutRef<"div"> & { errorCode?: string }) {
  const error = errorCode ? loginErrors.get(errorCode) : undefined;
  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">登录创作工作台</CardTitle>
          <CardDescription>
            使用邮箱和密码登录。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={logIn}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="email">邮箱</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="m@example.com"
                  required
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">密码</Label>
                  <Link
                    href="/auth/forgot-password"
                    className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
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
              {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
              <LoginSubmit />
            </div>
            <p className="mt-4 text-center text-sm">
              还没有账号？{" "}
              <Link href="/auth/sign-up" className="underline underline-offset-4">
                注册账号
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
