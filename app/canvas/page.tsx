import { notFound } from "next/navigation";
import "@xyflow/react/dist/style.css";
import { CanvasWorkspace } from "@/components/studio/canvas";
import { studioPageSession } from "@/lib/studio/auth";
import { readCanvas } from "@/lib/studio/generation";
import { readProject } from "@/lib/studio/projects";

export default async function CanvasPage({ searchParams }: { searchParams: Promise<{ projectId?: string }> }) {
  const { supabase } = await studioPageSession();
  const { projectId } = await searchParams;
  const project = typeof projectId === "string" ? await readProject(supabase, projectId) : null;
  if (!project) notFound();
  const submissions = await readCanvas(supabase, project.id);
  return <CanvasWorkspace key={project.id} project={project} initial={submissions} />;
}
