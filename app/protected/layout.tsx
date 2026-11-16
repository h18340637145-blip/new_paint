import { LogoutButton } from "@/components/logout-button";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="absolute right-4 top-4 z-10">
        <LogoutButton />
      </div>
      {children}
    </>
  );
}
