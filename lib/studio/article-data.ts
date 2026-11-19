import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { StudioError } from "./auth";
import {
  analyzeArticleGraph,
  deriveSnapshotTitle,
  toSnapshotNode,
  type ArticleEdgeRecord,
  type ArticleGraphNode,
  type ArticleSnapshotRecord,
  type ArticleTextNodeRecord,
  type ArticleTextRole,
  type SnapshotOrderedNode,
} from "./article-graph";
import { bucket } from "./projects";
import { detectImageMime } from "./storage";
import {
  downscaleImageForVision,
  generateArticleWithQwen,
  type PreparedSnapshotImage,
} from "@/lib/typography/qwen-article";
import {
  extractDraftImageAssetIds,
  type DocumentTextStyle,
  type StructuredArticleBlock,
  type StructuredArticleDraft,
} from "@/lib/typography/structured";
import type { TemplateStyleConfig } from "@/lib/typography/types";

export const PUBLISHED_IMAGES_BUCKET = "published-article-images";

function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "42P01"
    || error.code === "PGRST205"
    || Boolean(error.message?.includes("Could not find the table"))
  );
}

function throwDbError(error: { code?: string; message?: string } | null, fallbackMessage: string): never {
  if (isMissingTableError(error)) {
    throw new StudioError(
      "文章编排数据表尚未在 Supabase 创建，请先执行迁移文件 supabase/migrations/20261118223000_add_canvas_article_workflow.sql。",
      503,
    );
  }
  throw new StudioError(fallbackMessage, 503);
}

export async function readArticleWorkspace(
  supabase: SupabaseClient,
  projectId: string,
): Promise<{
  textNodes: ArticleTextNodeRecord[];
  edges: ArticleEdgeRecord[];
  snapshots: ArticleSnapshotRecord[];
}> {
  const [nodesRes, edgesRes, snapsRes] = await Promise.all([
    supabase
      .from("studio_article_text_nodes")
      .select("id,content,role,position_x,position_y,width,created_at,updated_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true }),
    supabase
      .from("studio_article_edges")
      .select("id,source_node_id,target_node_id")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true }),
    supabase
      .from("studio_article_snapshots")
      .select("id,project_id,version_number,title,nodes,excluded_nodes,created_at")
      .eq("project_id", projectId)
      .order("version_number", { ascending: false })
      .limit(30),
  ]);

  if (nodesRes.error && !isMissingTableError(nodesRes.error)) {
    throw new StudioError("无法读取文章文本节点。", 503);
  }
  if (edgesRes.error && !isMissingTableError(edgesRes.error)) {
    throw new StudioError("无法读取文章连线。", 503);
  }
  if (snapsRes.error && !isMissingTableError(snapsRes.error)) {
    throw new StudioError("无法读取文章暂存记录。", 503);
  }

  return {
    textNodes: (nodesRes.data ?? []).map((r) => ({
      id: r.id,
      content: r.content,
      role: r.role as ArticleTextRole,
      x: r.position_x,
      y: r.position_y,
      width: r.width,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
    edges: (edgesRes.data ?? []).map((e) => ({
      id: e.id,
      source: e.source_node_id,
      target: e.target_node_id,
    })),
    snapshots: (snapsRes.data ?? []).map((s) => ({
      id: s.id,
      projectId: s.project_id,
      versionNumber: s.version_number,
      title: s.title,
      nodes: (s.nodes ?? []) as SnapshotOrderedNode[],
      excludedNodes: (s.excluded_nodes ?? []) as SnapshotOrderedNode[],
      createdAt: s.created_at,
    })),
  };
}

export async function createStageSnapshot(
  admin: SupabaseClient,
  projectId: string,
  selectedChainHeadId?: string | null,
): Promise<ArticleSnapshotRecord> {
  const [textRes, edgesRes, placedRes, jobsRes, assetsRes] = await Promise.all([
    admin
      .from("studio_article_text_nodes")
      .select("id,content,role,created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true }),
    admin
      .from("studio_article_edges")
      .select("id,source_node_id,target_node_id")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true }),
    admin
      .from("studio_canvas_nodes")
      .select("id,asset_id,created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true }),
    admin
      .from("studio_jobs")
      .select("id,asset_id,status,canvas_hidden,created_at")
      .eq("project_id", projectId)
      .eq("canvas_hidden", false)
      .eq("status", "succeeded")
      .not("asset_id", "is", null)
      .order("created_at", { ascending: true }),
    admin
      .from("studio_assets")
      .select("id,kind,filename")
      .eq("project_id", projectId)
      .in("kind", ["reference", "generated"]),
  ]);

  if (textRes.error) throwDbError(textRes.error, "无法读取画布文本节点。");
  if (edgesRes.error) throwDbError(edgesRes.error, "无法读取画布连线。");
  if (placedRes.error || jobsRes.error || assetsRes.error) {
    throw new StudioError("无法读取画布图片节点。", 503);
  }

  const assetMap = new Map<string, { kind: "reference" | "generated"; filename?: string }>();
  for (const a of assetsRes.data ?? []) {
    if (a.kind === "reference" || a.kind === "generated") {
      assetMap.set(a.id, { kind: a.kind, ...(a.filename ? { filename: a.filename } : {}) });
    }
  }

  const graphNodes: ArticleGraphNode[] = [];
  for (const t of textRes.data ?? []) {
    graphNodes.push({
      nodeId: t.id,
      kind: "text",
      role: t.role as ArticleTextRole,
      text: t.content,
    });
  }
  for (const job of jobsRes.data ?? []) {
    const meta = job.asset_id ? assetMap.get(job.asset_id) : undefined;
    if (!job.asset_id || !meta) continue;
    graphNodes.push({
      nodeId: job.id,
      kind: "image",
      assetId: job.asset_id,
      assetKind: "generated",
      filename: meta.filename || "生成图片",
    });
  }
  for (const p of placedRes.data ?? []) {
    const meta = assetMap.get(p.asset_id);
    if (!meta) continue;
    graphNodes.push({
      nodeId: p.id,
      kind: "image",
      assetId: p.asset_id,
      assetKind: meta.kind,
      filename: meta.filename || "上传图片",
    });
  }

  const edges: ArticleEdgeRecord[] = (edgesRes.data ?? []).map((e) => ({
    id: e.id,
    source: e.source_node_id,
    target: e.target_node_id,
  }));

  const analysis = analyzeArticleGraph(graphNodes, edges, selectedChainHeadId);
  if (analysis.status !== "ok") {
    throw new StudioError(analysis.message || "画布编排校验未通过。", 400);
  }
  if (analysis.needsChainSelection && !selectedChainHeadId) {
    throw new StudioError("检测到多条独立内容链，请先选定一条要暂存的主链。", 400);
  }

  const orderedNodes = analysis.activeChain.map((n, i) => toSnapshotNode(n, i + 1));
  const excludedNodes = analysis.excludedNodes.map((n, i) => toSnapshotNode(n, i + 1));

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data: latest, error: verErr } = await admin
      .from("studio_article_snapshots")
      .select("version_number")
      .eq("project_id", projectId)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (verErr) throwDbError(verErr, "无法读取暂存版本号。");
    const nextVersion = (latest?.version_number ?? 0) + 1;
    const title = deriveSnapshotTitle(analysis.activeChain, nextVersion);

    const { data: inserted, error: insErr } = await admin
      .from("studio_article_snapshots")
      .insert({
        project_id: projectId,
        version_number: nextVersion,
        title,
        nodes: orderedNodes,
        excluded_nodes: excludedNodes,
      })
      .select("id,project_id,version_number,title,nodes,excluded_nodes,created_at")
      .single();

    if (!insErr && inserted) {
      return {
        id: inserted.id,
        projectId: inserted.project_id,
        versionNumber: inserted.version_number,
        title: inserted.title,
        nodes: inserted.nodes as SnapshotOrderedNode[],
        excludedNodes: inserted.excluded_nodes as SnapshotOrderedNode[],
        createdAt: inserted.created_at,
      };
    }
    if (insErr?.code !== "23505") {
      throwDbError(insErr, "暂存版本保存失败，请重试。");
    }
  }

  throw new StudioError("暂存并发冲突，请再试一次。", 409);
}

export interface ArticleTaskRecord {
  id: string;
  projectId: string;
  snapshotId: string;
  subTemplateId: string;
  templateStyle: TemplateStyleConfig;
  status: "running" | "succeeded" | "failed";
  draftId: string | null;
  errorMessage: string | null;
  warnings: string[];
  createdAt: string;
  updatedAt: string;
}

export async function runArticleGenerationTask(
  admin: SupabaseClient,
  taskId: string,
  projectId: string,
): Promise<ArticleTaskRecord> {
  const { data: taskRow, error: taskErr } = await admin
    .from("studio_article_tasks")
    .select("*")
    .eq("id", taskId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (taskErr || !taskRow) {
    throw new StudioError("找不到排版生成任务。", 404);
  }

  const { data: snapRow, error: snapErr } = await admin
    .from("studio_article_snapshots")
    .select("id,title,nodes")
    .eq("id", taskRow.snapshot_id)
    .eq("project_id", projectId)
    .maybeSingle();

  if (snapErr || !snapRow) {
    await admin
      .from("studio_article_tasks")
      .update({ status: "failed", error_message: "暂存版本已不存在。", updated_at: new Date().toISOString() })
      .eq("id", taskId);
    throw new StudioError("找不到对应的暂存版本。", 404);
  }

  const snapshotNodes = (snapRow.nodes ?? []) as SnapshotOrderedNode[];
  const imageAssetIds = [
    ...new Set(
      snapshotNodes
        .filter((n) => n.kind === "image" && typeof n.assetId === "string")
        .map((n) => n.assetId as string),
    ),
  ];

  try {
    const preparedImages = new Map<string, PreparedSnapshotImage>();
    if (imageAssetIds.length > 0) {
      const { data: assets, error: assetsErr } = await admin
        .from("studio_assets")
        .select("id,path,filename")
        .eq("project_id", projectId)
        .in("id", imageAssetIds)
        .in("kind", ["reference", "generated"]);

      if (assetsErr) throw new StudioError("无法校验项目图片归属。", 503);
      const assetById = new Map((assets ?? []).map((a) => [a.id, a]));

      for (const node of snapshotNodes) {
        if (node.kind !== "image" || !node.assetId || preparedImages.has(node.assetId)) continue;
        const asset = assetById.get(node.assetId);
        if (!asset) {
          throw new StudioError("暂存版本中包含不属于当前项目的图片素材。", 403);
        }
        const { data: blob, error: dlErr } = await admin.storage.from(bucket).download(asset.path);
        if (dlErr || !blob) {
          throw new StudioError(`无法读取图片素材（${asset.filename || asset.id}）。`, 503);
        }
        const dataUrl = await downscaleImageForVision(await blob.arrayBuffer());
        preparedImages.set(node.assetId, {
          nodeId: node.nodeId,
          assetId: node.assetId,
          dataUrl,
          filename: asset.filename ?? undefined,
        });
      }
    }

    const generated = await generateArticleWithQwen(
      snapshotNodes,
      preparedImages,
      snapRow.title || "未命名公众号文章",
    );

    const nowIso = new Date().toISOString();
    const { data: draft, error: draftErr } = await admin
      .from("studio_article_drafts")
      .insert({
        project_id: projectId,
        snapshot_id: snapRow.id,
        task_id: taskId,
        title: generated.title,
        sub_template_id: taskRow.sub_template_id,
        template_style: taskRow.template_style,
        document_style: {},
        blocks: generated.blocks,
        warnings: generated.warnings,
        version: 1,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select("id")
      .single();

    if (draftErr || !draft) {
      throw new StudioError("保存生成的排版稿失败。", 503);
    }

    const { data: updatedTask, error: updErr } = await admin
      .from("studio_article_tasks")
      .update({
        status: "succeeded",
        draft_id: draft.id,
        error_message: null,
        warnings: generated.warnings,
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId)
      .select("*")
      .single();

    if (updErr || !updatedTask) {
      throw new StudioError("更新排版任务状态失败。", 503);
    }

    return mapTaskRow(updatedTask);
  } catch (err) {
    const msg = err instanceof StudioError ? err.message : "Qwen 排版生成失败，请重试。";
    const { data: failedRow } = await admin
      .from("studio_article_tasks")
      .update({
        status: "failed",
        error_message: msg,
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId)
      .select("*")
      .maybeSingle();

    if (failedRow) return mapTaskRow(failedRow);
    throw err;
  }
}

export function mapTaskRow(row: Record<string, unknown>): ArticleTaskRecord {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    snapshotId: String(row.snapshot_id),
    subTemplateId: String(row.sub_template_id),
    templateStyle: row.template_style as TemplateStyleConfig,
    status: row.status as "running" | "succeeded" | "failed",
    draftId: row.draft_id ? String(row.draft_id) : null,
    errorMessage: row.error_message ? String(row.error_message) : null,
    warnings: Array.isArray(row.warnings) ? (row.warnings as string[]) : [],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function mapDraftRow(row: Record<string, unknown>): StructuredArticleDraft {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    snapshotId: String(row.snapshot_id),
    taskId: row.task_id ? String(row.task_id) : null,
    title: String(row.title),
    subTemplateId: String(row.sub_template_id),
    templateStyle: row.template_style as TemplateStyleConfig,
    documentStyle: (row.document_style ?? {}) as DocumentTextStyle,
    blocks: (row.blocks ?? []) as StructuredArticleBlock[],
    warnings: Array.isArray(row.warnings) ? (row.warnings as string[]) : [],
    version: Number(row.version),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export interface UserArticleDraftItem {
  draft: StructuredArticleDraft;
  projectTitle: string;
}

export async function readUserArticleDrafts(
  admin: SupabaseClient,
  userId: string,
  limit = 20,
): Promise<{ items: UserArticleDraftItem[]; imageUrls: Record<string, string> }> {
  const { data: projects, error: projErr } = await admin
    .from("studio_projects")
    .select("id,title")
    .eq("owner_id", userId);

  if (projErr || !projects || projects.length === 0) {
    return { items: [], imageUrls: {} };
  }

  const projectTitleById = new Map<string, string>(
    projects.map((p) => [String(p.id), String(p.title || "未命名画布")]),
  );
  const projectIds = Array.from(projectTitleById.keys());

  const { data: rows, error: draftErr } = await admin
    .from("studio_article_drafts")
    .select("*")
    .in("project_id", projectIds)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (draftErr) {
    if (isMissingTableError(draftErr)) {
      return { items: [], imageUrls: {} };
    }
    return { items: [], imageUrls: {} };
  }

  const items: UserArticleDraftItem[] = (rows ?? []).map((row) => {
    const draft = mapDraftRow(row as Record<string, unknown>);
    return {
      draft,
      projectTitle: projectTitleById.get(draft.projectId) ?? "未命名画布",
    };
  });

  const imageUrls: Record<string, string> = {};
  for (const item of items) {
    for (const id of extractDraftImageAssetIds(item.draft.blocks)) {
      imageUrls[id] = `/api/typography/preview-image/${encodeURIComponent(item.draft.projectId)}/${encodeURIComponent(id)}`;
    }
  }

  return {
    items,
    imageUrls,
  };
}

export async function signDraftPreviewImages(
  _supabase: SupabaseClient,
  projectId: string,
  blocks: StructuredArticleBlock[],
): Promise<Record<string, string>> {
  const assetIds = extractDraftImageAssetIds(blocks);
  const urls: Record<string, string> = {};
  for (const id of assetIds) {
    urls[id] = `/api/typography/preview-image/${encodeURIComponent(projectId)}/${encodeURIComponent(id)}`;
  }
  return urls;
}

export async function publishDraftImages(
  admin: SupabaseClient,
  ownerId: string,
  projectId: string,
  assetIds: string[],
): Promise<Record<string, string>> {
  if (assetIds.length === 0) return {};

  // Ensure public bucket exists
  const { data: buckets } = await admin.storage.listBuckets();
  if (buckets && !buckets.some((b) => b.id === PUBLISHED_IMAGES_BUCKET)) {
    await admin.storage.createBucket(PUBLISHED_IMAGES_BUCKET, {
      public: true,
      fileSizeLimit: 20_971_520,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    });
  }

  // Verify every requested asset belongs to this project
  const { data: assets, error: assetErr } = await admin
    .from("studio_assets")
    .select("id,path")
    .eq("project_id", projectId)
    .in("id", assetIds)
    .in("kind", ["reference", "generated"]);

  if (assetErr) throw new StudioError("无法校验文章配图归属。", 503);
  const assetById = new Map((assets ?? []).map((a) => [a.id, a]));
  for (const id of assetIds) {
    if (!assetById.has(id)) {
      throw new StudioError("稿件中包含无权访问或不存在的图片素材。", 403);
    }
  }

  // Reuse existing published copies if already created
  const { data: existingRows, error: pubErr } = await admin
    .from("studio_published_images")
    .select("asset_id,public_url")
    .in("asset_id", assetIds);

  if (pubErr) throwDbError(pubErr, "无法查询公开图片记录。");

  const result: Record<string, string> = {};
  for (const row of existingRows ?? []) {
    result[row.asset_id] = row.public_url;
  }

  for (const id of assetIds) {
    if (result[id]) continue;
    const asset = assetById.get(id)!;
    const { data: blob, error: dlErr } = await admin.storage.from(bucket).download(asset.path);
    if (dlErr || !blob) {
      throw new StudioError("读取原始图片失败，请重试。", 503);
    }
    const buffer = await blob.arrayBuffer();
    const mime = detectImageMime(new Uint8Array(buffer));
    if (!mime) {
      throw new StudioError("不支持的图片格式。", 400);
    }
    const ext = mime === "image/jpeg" ? "jpg" : mime.split("/")[1];
    const publicPath = `articles/${id}.${ext}`;

    const { error: upErr } = await admin.storage
      .from(PUBLISHED_IMAGES_BUCKET)
      .upload(publicPath, buffer, {
        contentType: mime,
        cacheControl: "31536000",
        upsert: true,
      });

    if (upErr) {
      throw new StudioError("生成公开图片副本失败，请点击重试。", 503);
    }

    const { data: pubUrlData } = admin.storage.from(PUBLISHED_IMAGES_BUCKET).getPublicUrl(publicPath);
    const publicUrl = pubUrlData.publicUrl;

    const { data: savedRow, error: saveErr } = await admin
      .from("studio_published_images")
      .upsert(
        {
          asset_id: id,
          owner_id: ownerId,
          project_id: projectId,
          public_path: publicPath,
          public_url: publicUrl,
          mime_type: mime,
        },
        { onConflict: "asset_id" },
      )
      .select("public_url")
      .single();

    if (saveErr || !savedRow) {
      throwDbError(saveErr, "保存公开图片映射失败，请重试。");
    }
    result[id] = savedRow.public_url;
  }

  return result;
}
