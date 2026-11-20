import { LoginForm } from "@/components/login-form";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[]; next?: string | string[] }>;
}) {
  const { error, next } = await searchParams;
  return (
    <div className="flex w-full items-center justify-center">
      <div className="w-full max-w-md">
        <LoginForm
          next={typeof next === "string" ? next : undefined}
          errorCode={typeof error === "string" ? error : undefined}
        />
      </div>
    </div>
  );
}
