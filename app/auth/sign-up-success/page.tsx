import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">
                请查看邮箱
              </CardTitle>
              <CardDescription>
                首次注册时，请打开邮箱中的验证链接。已经验证过的账号可以直接登录。
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-4">
              <Link href="/auth/login" className="text-sm underline underline-offset-4">
                返回登录
              </Link>
              <Link href="/auth/forgot-password" className="text-sm underline underline-offset-4">
                重置密码
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
