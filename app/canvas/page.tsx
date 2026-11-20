import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "@xyflow/react/dist/style.css";
import { CanvasWorkspace } from "@/components/studio/canvas";
import { readAgentTurns, readPlacedNodes } from "@/lib/studio/agent-data";
import { readArticleWorkspace } from "@/lib/studio/article-data";
import { studioPageSession } from "@/lib/studio/auth";
import { readCanvas } from "@/lib/studio/generation";
import { readProject } from "@/lib/studio/projects";

export const metadata: Metadata = {
  title: "自由画布与图文编排",
};

export default async function CanvasPage({ searchParams }: { searchParams: Promise<{ projectId?: string }> }) {
  const { supabase } = await studioPageSession();
  const { projectId } = await searchParams;
  const project = typeof projectId === "string" ? await readProject(supabase, projectId) : null;
  if (!project) notFound();
  const [submissions, agentTurns, placedNodes, articleWorkspace] = await Promise.all([
    readCanvas(supabase, project.id),
    readAgentTurns(supabase, project.id),
    readPlacedNodes(supabase, project.id),
    readArticleWorkspace(supabase, project.id),
  ]);
  return (
    <CanvasWorkspace
      key={project.id}
      project={project}
      initial={submissions}
      initialAgentTurns={agentTurns}
      initialPlacedNodes={placedNodes}
      initialTextNodes={articleWorkspace.textNodes}
      initialArticleEdges={articleWorkspace.edges}
      initialSnapshots={articleWorkspace.snapshots}
    />
  );
}
