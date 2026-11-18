import { NextResponse } from "next/server";
import { requireStudioMember, StudioError } from "@/lib/studio/auth";
import { mapTaskRow } from "@/lib/studio/article-data";
import type { SnapshotOrderedNode } from "@/lib/studio/article-graph";
import { readProject, uuidPattern } from "@/lib/studio/projects";
import { signImage } from "@/lib/studio/storage";

export const runtime = "nodejs";

function errorResponse(error: unknown) {
  if (error instanceof StudioError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: "读取排版工作区失败。" }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const { supabase } = await requireStudioMember();
    const url = new URL(request.url);
    const requestedProjectId = url.searchParams.get("projectId");

    const { data: projects, error: projErr } = await supabase
      .from("studio_projects")
      .select("id,title,updated_at")
      .order("updated_at", { ascending: false })
      .limit(50);

    if (projErr) throw new StudioError("无法读取项目列表。", 503);
    const projectList = projects ?? [];

    const activeProjectId =
      requestedProjectId && uuidPattern.test(requestedProjectId)
        ? requestedProjectId
        : projectList[0]?.id ?? null;

    if (!activeProjectId) {
      return NextResponse.json(
        { projects: [], activeProjectId: null, snapshots: [], tasks: [], drafts: [], assetUrls: {} },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const project = await readProject(supabase, activeProjectId);
    if (!project) throw new StudioError("找不到指定项目。", 404);

    const [snapsRes, tasksRes, draftsRes] = await Promise.all([
      supabase
        .from("studio_article_snapshots")
        .select("id,project_id,version_number,title,nodes,excluded_nodes,created_at")
        .eq("project_id", activeProjectId)
        .order("version_number", { ascending: false })
        .limit(30),
      supabase
        .from("studio_article_tasks")
        .select("*")
        .eq("project_id", activeProjectId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("studio_article_drafts")
        .select("id,project_id,snapshot_id,task_id,title,sub_template_id,version,created_at,updated_at")
        .eq("project_id", activeProjectId)
        .order("updated_at", { ascending: false })
        .limit(30),
    ]);

    const snapshots = (snapsRes.data ?? []).map((s) => ({
      id: s.id,
      projectId: s.project_id,
      versionNumber: s.version_number,
      title: s.title,
      nodes: (s.nodes ?? []) as SnapshotOrderedNode[],
      excludedNodes: (s.excluded_nodes ?? []) as SnapshotOrderedNode[],
      createdAt: s.created_at,
    }));

    // Sign thumbnails for images referenced in snapshots so snapshot preview works
    const snapAssetIds = [
      ...new Set(
        snapshots
          .flatMap((s) => s.nodes)
          .filter((n) => n.kind === "image" && typeof n.assetId === "string")
          .map((n) => n.assetId as string),
      ),
    ];

    const assetUrls: Record<string, string> = {};
    if (snapAssetIds.length > 0) {
      const { data: assets } = await supabase
        .from("studio_assets")
        .select("id,path")
        .eq("project_id", activeProjectId)
        .in("id", snapAssetIds)
        .in("kind", ["reference", "generated"]);

      await Promise.all(
        (assets ?? []).map(async (a) => {
          try {
            assetUrls[a.id] = await signImage(supabase, a.path);
          } catch {
            // Skip broken signed url
          }
        }),
      );
    }

    return NextResponse.json(
      {
        projects: projectList.map((p) => ({
          id: p.id,
          title: p.title,
          updatedAt: p.updated_at,
        })),
        activeProjectId,
        snapshots,
        tasks: (tasksRes.data ?? []).map((t) => mapTaskRow(t)),
        drafts: (draftsRes.data ?? []).map((d) => ({
          id: d.id,
          projectId: d.project_id,
          snapshotId: d.snapshot_id,
          taskId: d.task_id,
          title: d.title,
          subTemplateId: d.sub_template_id,
          version: d.version,
          createdAt: d.created_at,
          updatedAt: d.updated_at,
        })),
        assetUrls,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
