import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="absolute right-4 top-4 z-10 flex items-center gap-3">
        <Link href="/profile" className="text-sm font-medium hover:underline">个人中心</Link>
        <LogoutButton />
      </div>
      {children}
    </>
  );
}
