import type { Metadata } from "next";
import { TypographyWorkbench } from "@/components/typography/workbench";

export const metadata: Metadata = {
  title: "公众号排版与模板库",
};

export default async function TypographyPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string; snapshotId?: string; draftId?: string }>;
}) {
  const params = await searchParams;
  return (
    <TypographyWorkbench
      initialProjectId={typeof params.projectId === "string" ? params.projectId : null}
      initialSnapshotId={typeof params.snapshotId === "string" ? params.snapshotId : null}
      initialDraftId={typeof params.draftId === "string" ? params.draftId : null}
    />
  );
}
