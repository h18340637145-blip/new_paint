import { NextResponse } from "next/server";
import { requireStudioMember, studioAdmin, StudioError } from "@/lib/studio/auth";
import { createStageSnapshot, readArticleWorkspace } from "@/lib/studio/article-data";
import type { ArticleTextRole } from "@/lib/studio/article-graph";
import { readProject, uuidPattern } from "@/lib/studio/projects";

export const runtime = "nodejs";

function errorResponse(error: unknown) {
  if (error instanceof StudioError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error("文章编排请求失败", error instanceof Error ? error.message : "未知错误");
  return NextResponse.json({ error: "操作失败，请稍后重试。" }, { status: 500 });
}

function requireUuid(input: unknown, label = "无效的记录编号。") {
  if (typeof input !== "string" || !uuidPattern.test(input)) throw new StudioError(label);
  return input;
}

const VALID_ROLES: ArticleTextRole[] = ["material", "requirement", "verbatim"];

export async function GET(request: Request) {
  try {
    const { supabase } = await requireStudioMember();
    const url = new URL(request.url);
    const projectId = requireUuid(url.searchParams.get("projectId"), "无效的项目编号。");
    const project = await readProject(supabase, projectId);
    if (!project) throw new StudioError("找不到项目。", 404);

    const workspace = await readArticleWorkspace(supabase, projectId);
    return NextResponse.json(workspace, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { supabase } = await requireStudioMember();
    if (!request.headers.get("content-type")?.startsWith("application/json")) {
      throw new StudioError("请求格式无效。", 415);
    }
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") throw new StudioError("请求内容无效。");

    const projectId = requireUuid(body.projectId, "无效的项目编号。");
    const project = await readProject(supabase, projectId);
    if (!project) throw new StudioError("找不到项目。", 404);

    const admin = studioAdmin();
    const action = body.action;

    if (action === "upsert-text-node") {
      const nodeId = requireUuid(body.nodeId, "无效的文本节点编号。");
      const content = typeof body.content === "string" ? body.content : "";
      if (content.length > 20_000) throw new StudioError("文本节点内容不能超过 20000 字。");
      const role: ArticleTextRole = VALID_ROLES.includes(body.role) ? body.role : "material";
      const x = typeof body.x === "number" && Math.abs(body.x) <= 1_000_000 ? body.x : 120;
      const y = typeof body.y === "number" && Math.abs(body.y) <= 1_000_000 ? body.y : 120;
      const width =
        typeof body.width === "number" && body.width >= 180 && body.width <= 1200 ? body.width : 280;

      const { data, error } = await admin
        .from("studio_article_text_nodes")
        .upsert(
          {
            id: nodeId,
            project_id: projectId,
            content,
            role,
            position_x: x,
            position_y: y,
            width,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" },
        )
        .eq("project_id", projectId)
        .select("id,content,role,position_x,position_y,width,created_at,updated_at")
        .single();

      if (error || !data) {
        if (error?.code === "42P01" || error?.code === "PGRST205") {
          throw new StudioError(
            "文章编排数据表尚未在 Supabase 创建，请先执行迁移文件 20261118223000_add_canvas_article_workflow.sql。",
            503,
          );
        }
        throw new StudioError("保存文本节点失败。", 503);
      }

      return NextResponse.json({
        node: {
          id: data.id,
          content: data.content,
          role: data.role,
          x: data.position_x,
          y: data.position_y,
          width: data.width,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        },
      });
    }

    if (action === "update-text-node-position") {
      const nodeId = requireUuid(body.nodeId, "无效的文本节点编号。");
      if (![body.x, body.y].every((v) => typeof v === "number" && Math.abs(v) <= 1_000_000)) {
        throw new StudioError("节点坐标无效。");
      }
      const patch: Record<string, unknown> = {
        position_x: body.x,
        position_y: body.y,
        updated_at: new Date().toISOString(),
      };
      if (typeof body.width === "number" && body.width >= 180 && body.width <= 1200) {
        patch.width = body.width;
      }
      const { error } = await admin
        .from("studio_article_text_nodes")
        .update(patch)
        .eq("id", nodeId)
        .eq("project_id", projectId);
      if (error) throw new StudioError("更新文本节点位置失败。", 503);
      return NextResponse.json({ ok: true });
    }

    if (action === "delete-text-node") {
      const nodeId = requireUuid(body.nodeId, "无效的文本节点编号。");
      await Promise.all([
        admin.from("studio_article_text_nodes").delete().eq("id", nodeId).eq("project_id", projectId),
        admin
          .from("studio_article_edges")
          .delete()
          .eq("project_id", projectId)
          .or(`source_node_id.eq.${nodeId},target_node_id.eq.${nodeId}`),
      ]);
      return NextResponse.json({ ok: true });
    }

    if (action === "add-edge") {
      const source = requireUuid(body.source, "无效的起点节点。");
      const target = requireUuid(body.target, "无效的终点节点。");
      if (source === target) throw new StudioError("不能将节点连接到自身。");

      const { data, error } = await admin
        .from("studio_article_edges")
        .upsert(
          { project_id: projectId, source_node_id: source, target_node_id: target },
          { onConflict: "project_id,source_node_id,target_node_id" },
        )
        .select("id,source_node_id,target_node_id")
        .single();

      if (error || !data) throw new StudioError("保存连线失败。", 503);
      return NextResponse.json({
        edge: { id: data.id, source: data.source_node_id, target: data.target_node_id },
      });
    }

    if (action === "delete-edge") {
      const edgeId = requireUuid(body.edgeId, "无效的连线编号。");
      const { error } = await admin
        .from("studio_article_edges")
        .delete()
        .eq("id", edgeId)
        .eq("project_id", projectId);
      if (error) throw new StudioError("删除连线失败。", 503);
      return NextResponse.json({ ok: true });
    }

    if (action === "stage-snapshot") {
      const headId =
        typeof body.selectedChainHeadId === "string" && uuidPattern.test(body.selectedChainHeadId)
          ? body.selectedChainHeadId
          : null;
      const snapshot = await createStageSnapshot(admin, projectId, headId);
      return NextResponse.json({ snapshot }, { status: 201 });
    }

    throw new StudioError("未知的文章编排操作。");
  } catch (error) {
    return errorResponse(error);
  }
}
