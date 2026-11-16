import { SignUpForm } from "@/components/sign-up-form";

export default function SignUpPage() {
  return (
    <main className="flex min-h-svh items-center justify-center p-6 md:p-10">
      <SignUpForm className="w-full max-w-sm" />
    </main>
  );
}
