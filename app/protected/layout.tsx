import { StudioTopNav } from "@/components/studio-top-nav";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="studio-shell landing-motion">
      <StudioTopNav current="home" />
      {children}
    </div>
  );
}
