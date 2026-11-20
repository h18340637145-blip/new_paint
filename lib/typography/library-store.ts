import "server-only";
import { randomUUID } from "node:crypto";
import dns from "node:dns/promises";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PUBLISHED_IMAGES_BUCKET } from "@/lib/studio/article-data";
import { StudioError } from "@/lib/studio/auth";
import { bucket, readProject, uuidPattern } from "@/lib/studio/projects";
import { detectImageMime, saveImage } from "@/lib/studio/storage";
import {
  cloneComponentNode,
  collectLibraryMediaIds,
  remapComponentImages,
  validateComponentNode,
  type AppliedComponentSnapshot,
  type ComponentImageRef,
  type ComponentNode,
  type LibraryAssetCategory,
  type LibraryItemKind,
  type LibraryItemRecord,
  type LibraryScopeType,
  type PortableEmbeddedMedia,
  type PortableLibraryExportV1,
  type TeamMemberRole,
} from "./custom-tree";
import { sanitizeStyle } from "./renderer";
import type { TemplateStyleConfig } from "./types";

export interface TeamMemberInfo {
  userId: string;
  email: string;
  role: TeamMemberRole;
  createdAt: string;
}

export interface TeamInviteInfo {
  id: string;
  teamId: string;
  teamName: string;
  email: string;
  invitedUserId: string | null;
  role: Exclude<TeamMemberRole, "owner">;
  status: "pending" | "accepted" | "declined" | "revoked";
  invitedBy: string;
  createdAt: string;
}

export interface TeamSummary {
  id: string;
  name: string;
  ownerId: string;
  myRole: TeamMemberRole;
  createdAt: string;
  members: TeamMemberInfo[];
  pendingInvites: TeamInviteInfo[];
}

export interface LibraryMediaRow {
  id: string;
  scopeType: LibraryScopeType;
  ownerId: string | null;
  teamId: string | null;
  storagePath: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  byteSize: number;
  filename: string | null;
  createdBy: string;
  createdAt: string;
}

interface LocalLedgerData {
  teams: Array<{
    id: string;
    name: string;
    owner_id: string;
    created_at: string;
    updated_at: string;
  }>;
  members: Array<{
    team_id: string;
    user_id: string;
    role: TeamMemberRole;
    created_at: string;
  }>;
  invites: Array<{
    id: string;
    team_id: string;
    email: string;
    invited_user_id: string | null;
    role: Exclude<TeamMemberRole, "owner">;
    status: "pending" | "accepted" | "declined" | "revoked";
    invited_by: string;
    created_at: string;
    responded_at: string | null;
  }>;
  media: Array<{
    id: string;
    scope_type: LibraryScopeType;
    owner_id: string | null;
    team_id: string | null;
    storage_path: string;
    mime_type: "image/png" | "image/jpeg" | "image/webp";
    byte_size: number;
    filename: string | null;
    created_by: string;
    created_at: string;
  }>;
  items: Array<{
    id: string;
    scope_type: LibraryScopeType;
    owner_id: string | null;
    team_id: string | null;
    kind: LibraryItemKind;
    category: LibraryAssetCategory;
    name: string;
    summary: string;
    root_node: ComponentNode;
    template_style: TemplateStyleConfig | null;
    sample_markdown: string | null;
    archived: boolean;
    version: number;
    created_by: string;
    created_at: string;
    updated_at: string;
  }>;
}

const LEDGER_FILE = path.join(process.cwd(), ".next", "cache", "typography-library-ledger.json");
let ledgerLock: Promise<void> = Promise.resolve();
let dbTableAvailableCache: boolean | null = null;

function isMissingTable(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  return (
    err.code === "42P01"
    || err.code === "PGRST205"
    || Boolean(err.message?.includes("Could not find the table"))
  );
}

async function hasNativePostgresTables(admin: SupabaseClient): Promise<boolean> {
  if (dbTableAvailableCache !== null) return dbTableAvailableCache;
  const { error } = await admin.from("typography_library_items").select("id").limit(1);
  if (error && isMissingTable(error)) {
    dbTableAvailableCache = false;
    return false;
  }
  dbTableAvailableCache = true;
  return true;
}

async function withLedger<T>(fn: (data: LocalLedgerData) => Promise<{ result: T; mutated?: boolean }>): Promise<T> {
  const prev = ledgerLock;
  let release!: () => void;
  ledgerLock = new Promise<void>((res) => {
    release = res;
  });
  await prev;
  try {
    let data: LocalLedgerData = { teams: [], members: [], invites: [], media: [], items: [] };
    try {
      const raw = await fs.readFile(LEDGER_FILE, "utf8");
      const parsed = JSON.parse(raw) as Partial<LocalLedgerData>;
      data = {
        teams: Array.isArray(parsed.teams) ? parsed.teams : [],
        members: Array.isArray(parsed.members) ? parsed.members : [],
        invites: Array.isArray(parsed.invites) ? parsed.invites : [],
        media: Array.isArray(parsed.media) ? parsed.media : [],
        items: Array.isArray(parsed.items) ? parsed.items : [],
      };
    } catch {
      // 首次初始化隔离账本
    }
    const { result, mutated } = await fn(data);
    if (mutated) {
      await fs.mkdir(path.dirname(LEDGER_FILE), { recursive: true });
      await fs.writeFile(LEDGER_FILE, JSON.stringify(data, null, 2), "utf8");
    }
    return result;
  } finally {
    release();
  }
}

async function resolveUserEmailMap(admin: SupabaseClient, userIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (userIds.length === 0) return map;
  const unique = Array.from(new Set(userIds));
  await Promise.all(
    unique.map(async (uid) => {
      const { data } = await admin.auth.admin.getUserById(uid);
      if (data?.user?.email) {
        map.set(uid, data.user.email.toLowerCase());
      }
    }),
  );
  return map;
}

async function findRegisteredUserByEmail(
  admin: SupabaseClient,
  rawEmail: string,
): Promise<{ id: string; email: string } | null> {
  const target = rawEmail.trim().toLowerCase();
  if (!target || !target.includes("@")) return null;
  let page = 1;
  while (page <= 10) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data?.users?.length) break;
    const matched = data.users.find(
      (u) => u.email?.toLowerCase() === target && Boolean(u.email_confirmed_at),
    );
    if (matched && matched.email) {
      return { id: matched.id, email: matched.email.toLowerCase() };
    }
    if (data.users.length < 200) break;
    page += 1;
  }
  return null;
}

export async function getTeamRole(
  admin: SupabaseClient,
  teamId: string,
  userId: string,
): Promise<TeamMemberRole | null> {
  if (!uuidPattern.test(teamId)) return null;
  if (await hasNativePostgresTables(admin)) {
    const { data } = await admin
      .from("typography_team_members")
      .select("role")
      .eq("team_id", teamId)
      .eq("user_id", userId)
      .maybeSingle();
    return (data?.role as TeamMemberRole | undefined) ?? null;
  }
  return withLedger(async (ledger) => {
    const found = ledger.members.find((m) => m.team_id === teamId && m.user_id === userId);
    return { result: found?.role ?? null };
  });
}

function canWriteScope(role: TeamMemberRole | null): boolean {
  return role === "owner" || role === "editor";
}

function mapDbItemRow(
  row: Record<string, unknown>,
  teamNames: Map<string, string>,
  myTeamRoles: Map<string, TeamMemberRole>,
  userId: string,
): LibraryItemRecord {
  const scopeType = row.scope_type as LibraryScopeType;
  const ownerId = row.owner_id ? String(row.owner_id) : null;
  const teamId = row.team_id ? String(row.team_id) : null;
  const myRole = teamId ? myTeamRoles.get(teamId) ?? null : null;
  const canEdit = scopeType === "personal" ? ownerId === userId : canWriteScope(myRole);

  return {
    id: String(row.id),
    scopeType,
    ownerId,
    teamId,
    teamName: teamId ? teamNames.get(teamId) ?? "协作团队" : null,
    kind: row.kind as LibraryItemKind,
    category: row.category as LibraryAssetCategory,
    name: String(row.name),
    summary: String(row.description ?? row.summary ?? ""),
    rootNode: validateComponentNode(row.root_node),
    templateStyle: row.template_style ? sanitizeStyle(row.template_style as TemplateStyleConfig) : null,
    sampleMarkdown: typeof row.sample_markdown === "string" ? row.sample_markdown : null,
    archived: Boolean(row.archived),
    version: Number(row.version ?? 1),
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    canEdit,
  };
}

/**
 * 上传并登记私有库图片素材（校验 JPEG/PNG/WebP 魔数，上限 10 MB）
 */
export async function saveLibraryMediaBuffer(params: {
  admin: SupabaseClient;
  userId: string;
  scopeType: LibraryScopeType;
  teamId?: string | null;
  buffer: ArrayBuffer;
  filename?: string;
}): Promise<LibraryMediaRow> {
  const { admin, userId, scopeType, buffer, filename } = params;
  const teamId = scopeType === "team" ? params.teamId ?? null : null;

  if (scopeType === "team") {
    if (!teamId || !uuidPattern.test(teamId)) {
      throw new StudioError("请选择有效的目标团队。", 400);
    }
    const role = await getTeamRole(admin, teamId, userId);
    if (!canWriteScope(role)) {
      throw new StudioError("仅团队所有者或编辑者可向团队库上传素材。", 403);
    }
  }

  const bytes = new Uint8Array(buffer);
  if (!bytes.length || bytes.length > 10 * 1024 * 1024) {
    throw new StudioError("图片大小须在 10 MB 以内。", 400);
  }
  const mime = detectImageMime(bytes) as LibraryMediaRow["mimeType"] | null;
  if (!mime) {
    throw new StudioError("仅支持 PNG、JPEG 或 WebP 格式的图片。", 400);
  }

  const mediaId = randomUUID();
  const ext = mime === "image/jpeg" ? "jpg" : mime.split("/")[1];
  const storagePath =
    scopeType === "personal"
      ? `library/personal/${userId}/${mediaId}.${ext}`
      : `library/team/${teamId}/${mediaId}.${ext}`;

  const { error: uploadErr } = await admin.storage
    .from(bucket)
    .upload(storagePath, buffer, { contentType: mime, upsert: true });
  if (uploadErr) {
    throw new StudioError("保存私有图片文件失败，请稍后重试。", 503);
  }

  const nowIso = new Date().toISOString();
  const cleanFilename = filename ? filename.trim().slice(0, 120) : null;

  if (await hasNativePostgresTables(admin)) {
    const { data, error } = await admin
      .from("typography_library_media")
      .insert({
        id: mediaId,
        scope_type: scopeType,
        owner_id: scopeType === "personal" ? userId : null,
        team_id: scopeType === "team" ? teamId : null,
        storage_path: storagePath,
        mime_type: mime,
        size_bytes: bytes.length,
        filename: cleanFilename,
        uploaded_by: userId,
        created_at: nowIso,
      })
      .select("*")
      .single();
    if (error || !data) {
      // 数据库明确拒绝写入时，撤回本次上传，避免重试叠加无引用文件。
      if (error?.code && /^(?:23[A-Z0-9]{3}|42[A-Z0-9]{3}|PGRST204)$/.test(error.code)) {
        const { error: cleanupError } = await admin.storage.from(bucket).remove([storagePath]);
        if (cleanupError) console.error("回收未登记的库图片失败", { mediaId, status: cleanupError.name });
      }
      console.error("登记库图片失败", { mediaId, code: error?.code });
      throw new StudioError("登记私有图片记录失败。", 503);
    }
    return {
      id: String(data.id),
      scopeType: data.scope_type as LibraryScopeType,
      ownerId: data.owner_id ? String(data.owner_id) : null,
      teamId: data.team_id ? String(data.team_id) : null,
      storagePath: String(data.storage_path),
      mimeType: data.mime_type as LibraryMediaRow["mimeType"],
      byteSize: Number(data.size_bytes),
      filename: data.filename ? String(data.filename) : null,
      createdBy: String(data.uploaded_by),
      createdAt: String(data.created_at),
    };
  }

  return withLedger(async (ledger) => {
    const row = {
      id: mediaId,
      scope_type: scopeType,
      owner_id: scopeType === "personal" ? userId : null,
      team_id: scopeType === "team" ? teamId : null,
      storage_path: storagePath,
      mime_type: mime,
      byte_size: bytes.length,
      filename: cleanFilename,
      created_by: userId,
      created_at: nowIso,
    };
    ledger.media.push(row);
    return {
      mutated: true,
      result: {
        id: row.id,
        scopeType: row.scope_type,
        ownerId: row.owner_id,
        teamId: row.team_id,
        storagePath: row.storage_path,
        mimeType: row.mime_type,
        byteSize: row.byte_size,
        filename: row.filename,
        createdBy: row.created_by,
        createdAt: row.created_at,
      },
    };
  });
}

/**
 * 按当前会话身份读取私有库图片元信息（校验个人归属或团队成员资格）
 */
export async function readAuthorizedLibraryMedia(
  admin: SupabaseClient,
  mediaId: string,
  userId: string,
): Promise<LibraryMediaRow> {
  if (!uuidPattern.test(mediaId)) {
    throw new StudioError("无效的图片编号。", 400);
  }
  let row: LibraryMediaRow | null = null;
  if (await hasNativePostgresTables(admin)) {
    const { data } = await admin
      .from("typography_library_media")
      .select("*")
      .eq("id", mediaId)
      .maybeSingle();
    if (data) {
      row = {
        id: String(data.id),
        scopeType: data.scope_type as LibraryScopeType,
        ownerId: data.owner_id ? String(data.owner_id) : null,
        teamId: data.team_id ? String(data.team_id) : null,
        storagePath: String(data.storage_path),
        mimeType: data.mime_type as LibraryMediaRow["mimeType"],
        byteSize: Number(data.size_bytes),
        filename: data.filename ? String(data.filename) : null,
        createdBy: String(data.uploaded_by),
        createdAt: String(data.created_at),
      };
    }
  } else {
    row = await withLedger(async (ledger) => {
      const found = ledger.media.find((m) => m.id === mediaId);
      if (!found) return { result: null };
      return {
        result: {
          id: found.id,
          scopeType: found.scope_type,
          ownerId: found.owner_id,
          teamId: found.team_id,
          storagePath: found.storage_path,
          mimeType: found.mime_type,
          byteSize: found.byte_size,
          filename: found.filename,
          createdBy: found.created_by,
          createdAt: found.created_at,
        },
      };
    });
  }

  if (!row) {
    throw new StudioError("找不到该库图片素材。", 404);
  }

  if (row.scopeType === "personal") {
    if (row.ownerId !== userId) {
      throw new StudioError("无权访问该私有图片素材。", 403);
    }
    return row;
  }

  if (!row.teamId) {
    throw new StudioError("无效的团队图片记录。", 404);
  }
  const role = await getTeamRole(admin, row.teamId, userId);
  if (!role) {
    throw new StudioError("您不是该团队成员，无权访问该图片素材。", 403);
  }
  return row;
}

/**
 * 校验 IP 地址是否属于回环、内网、链路本地、CGNAT、多播或保留地址段（防止外链图片拉取触发 SSRF）
 */
function isPrivateOrReservedIp(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) {
    const parts = ip.split(".").map((n) => Number.parseInt(n, 10));
    if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) {
      return true;
    }
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }
  if (family === 6) {
    const norm = ip.trim().toLowerCase();
    if (norm === "::" || norm === "::1") return true;
    if (norm.startsWith("fc") || norm.startsWith("fd")) return true;
    if (/^fe[89ab]/.test(norm)) return true;
    if (norm.startsWith("ff")) return true;
    if (norm.startsWith("::ffff:")) {
      const tail = norm.slice(7);
      if (net.isIP(tail) === 4) return isPrivateOrReservedIp(tail);
      const hexMatch = /^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(tail);
      if (hexMatch) {
        const hi = Number.parseInt(hexMatch[1], 16);
        const lo = Number.parseInt(hexMatch[2], 16);
        return isPrivateOrReservedIp(
          `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`,
        );
      }
      return true;
    }
    return false;
  }
  return true;
}

/**
 * 在严格 SSRF 防护下拉取公开 HTTPS 装饰图片（如秀米/公众号图床），并由 sharp 清洗重编码为透明通道 PNG
 */
export async function downloadSafeExternalImageToPng(rawUrl: string): Promise<Buffer | null> {
  try {
    let current = rawUrl.trim();
    if (current.startsWith("//")) current = `https:${current}`;

    for (let hop = 0; hop <= 3; hop += 1) {
      let parsed: URL;
      try {
        parsed = new URL(current);
      } catch {
        return null;
      }
      if (parsed.protocol !== "https:") return null;
      if (parsed.username || parsed.password) return null;
      if (parsed.port && parsed.port !== "443") return null;

      const host = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();
      if (
        !host
        || net.isIP(host) !== 0
        || !host.includes(".")
        || host === "localhost"
        || host.endsWith(".local")
        || host.endsWith(".internal")
      ) {
        return null;
      }

      const resolved = await dns.lookup(host, { all: true });
      if (!resolved.length || resolved.some((entry) => isPrivateOrReservedIp(entry.address))) {
        return null;
      }

      const res = await fetch(parsed.toString(), {
        method: "GET",
        redirect: "manual",
        referrerPolicy: "no-referrer",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; NewPaintTypographyImporter/1.0)",
          Accept: "image/avif,image/webp,image/apng,image/png,image/jpeg,image/*,*/*;q=0.8",
        },
        signal: AbortSignal.timeout(6000),
      });

      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) return null;
        current = new URL(loc, parsed).toString();
        continue;
      }

      if (!res.ok || !res.body) return null;
      const contentLen = Number(res.headers.get("content-length") ?? "0");
      if (contentLen > 8 * 1024 * 1024) return null;

      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          total += value.byteLength;
          if (total > 8 * 1024 * 1024) {
            await reader.cancel().catch(() => undefined);
            return null;
          }
          chunks.push(value);
        }
      }
      if (total === 0) return null;

      const rawBuf = Buffer.concat(chunks);
      const pngBuf = await sharp(rawBuf)
        .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
        .png()
        .toBuffer();
      return pngBuf.byteLength > 0 && pngBuf.byteLength <= 10 * 1024 * 1024 ? pngBuf : null;
    }
    return null;
  } catch {
    return null;
  }
}

function toArrayBuffer(buf: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(buf.byteLength);
  copy.set(buf);
  return copy.buffer;
}

/**
 * 将清洗后的静态内联 SVG 矢量装饰图栅格化为高清透明 PNG，保证保存到私有库及公众号发布时持久可用
 */
export async function rasterizeInlineSvgToPng(svgDataUrl: string): Promise<Buffer | null> {
  try {
    const prefix = "data:image/svg+xml;base64,";
    if (!svgDataUrl.startsWith(prefix)) return null;
    const svgBuf = Buffer.from(svgDataUrl.slice(prefix.length), "base64");
    if (!svgBuf.byteLength || svgBuf.byteLength > 256 * 1024) return null;
    const pngBuf = await sharp(svgBuf, { density: 288 })
      .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
    return pngBuf.byteLength > 0 && pngBuf.byteLength <= 10 * 1024 * 1024 ? pngBuf : null;
  } catch {
    return null;
  }
}

/**
 * 将组件树中的内嵌粘贴位图（inline-data）、静态矢量图标（inline-svg）、可选外链装饰图与便携导出包媒体持久化为目标范围的独立私有文件
 */
async function persistEmbeddedMediaInTree(params: {
  admin: SupabaseClient;
  userId: string;
  scopeType: LibraryScopeType;
  teamId?: string | null;
  rootNode: ComponentNode;
  portableMedia?: PortableEmbeddedMedia[];
  localizeExternalImages?: boolean;
}): Promise<ComponentNode> {
  const { admin, userId, scopeType, teamId, rootNode, portableMedia, localizeExternalImages } = params;
  const portableById = new Map<string, PortableEmbeddedMedia>();
  for (const m of portableMedia ?? []) {
    portableById.set(m.mediaId, m);
  }

  const createdMediaMap = new Map<string, string>();
  const svgMediaCache = new Map<string, string>();
  const externalMediaCache = new Map<string, string | null>();
  let externalDownloadAttempts = 0;

  async function ensurePortableCloned(oldMediaId: string): Promise<string | null> {
    if (createdMediaMap.has(oldMediaId)) return createdMediaMap.get(oldMediaId)!;
    const entry = portableById.get(oldMediaId);
    if (!entry) return null;
    const buf = Buffer.from(entry.base64Data, "base64");
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const saved = await saveLibraryMediaBuffer({
      admin,
      userId,
      scopeType,
      teamId,
      buffer: ab,
      filename: entry.filename ?? "imported-media",
    });
    createdMediaMap.set(oldMediaId, saved.id);
    return saved.id;
  }

  async function walk(node: ComponentNode): Promise<ComponentNode> {
    if (node.type === "container") {
      const nextChildren: ComponentNode[] = [];
      for (const child of node.children) {
        nextChildren.push(await walk(child));
      }
      return { ...node, children: nextChildren };
    }
    if (node.type === "image") {
      if (node.imageRef.kind === "inline-data") {
        const commaIdx = node.imageRef.dataUrl.indexOf(",");
        if (commaIdx > 0) {
          const b64 = node.imageRef.dataUrl.slice(commaIdx + 1);
          const buf = Buffer.from(b64, "base64");
          const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
          const saved = await saveLibraryMediaBuffer({
            admin,
            userId,
            scopeType,
            teamId,
            buffer: ab,
            filename: node.alt || "pasted-image",
          });
          return { ...node, imageRef: { kind: "library-media", mediaId: saved.id } };
        }
      } else if (node.imageRef.kind === "inline-svg") {
        const key = node.imageRef.svgDataUrl;
        let mediaId = svgMediaCache.get(key) ?? null;
        if (!mediaId) {
          const pngBuf = await rasterizeInlineSvgToPng(key);
          if (pngBuf) {
            const saved = await saveLibraryMediaBuffer({
              admin,
              userId,
              scopeType,
              teamId,
              buffer: toArrayBuffer(pngBuf),
              filename: node.alt || "svg-ornament",
            });
            mediaId = saved.id;
            svgMediaCache.set(key, mediaId);
          }
        }
        if (mediaId) {
          return { ...node, imageRef: { kind: "library-media", mediaId } };
        }
      } else if (node.imageRef.kind === "missing-external" && localizeExternalImages) {
        const urlKey = node.imageRef.originalUrl;
        let mediaId = externalMediaCache.get(urlKey);
        if (mediaId === undefined && externalDownloadAttempts < 12) {
          externalDownloadAttempts += 1;
          const pngBuf = await downloadSafeExternalImageToPng(urlKey);
          if (pngBuf) {
            const saved = await saveLibraryMediaBuffer({
              admin,
              userId,
              scopeType,
              teamId,
              buffer: toArrayBuffer(pngBuf),
              filename: node.alt || "imported-ornament",
            });
            mediaId = saved.id;
          } else {
            mediaId = null;
          }
          externalMediaCache.set(urlKey, mediaId);
        }
        if (mediaId) {
          return { ...node, imageRef: { kind: "library-media", mediaId } };
        }
      } else if (node.imageRef.kind === "library-media") {
        if (portableById.has(node.imageRef.mediaId)) {
          const clonedId = await ensurePortableCloned(node.imageRef.mediaId);
          if (clonedId) {
            return { ...node, imageRef: { kind: "library-media", mediaId: clonedId } };
          }
        } else {
          // 校验当前用户对该 mediaId 有读取权限；若跨范围保存则自动克隆副本
          const media = await readAuthorizedLibraryMedia(admin, node.imageRef.mediaId, userId);
          const sameScope =
            (scopeType === "personal" && media.scopeType === "personal" && media.ownerId === userId)
            || (scopeType === "team" && media.scopeType === "team" && media.teamId === teamId);
          if (!sameScope) {
            const { data: blob, error: dlErr } = await admin.storage.from(bucket).download(media.storagePath);
            if (!dlErr && blob) {
              const saved = await saveLibraryMediaBuffer({
                admin,
                userId,
                scopeType,
                teamId,
                buffer: await blob.arrayBuffer(),
                filename: media.filename ?? undefined,
              });
              return { ...node, imageRef: { kind: "library-media", mediaId: saved.id } };
            }
          }
        }
      }
    }
    return node;
  }

  return walk(rootNode);
}

/**
 * 一键将导入组件树中的外链图片（如秀米/公众号装饰图）转存为私有素材（已登录存入库媒体，未登录转为安全内嵌 PNG）
 */
export async function localizeExternalMediaInTree(params: {
  admin?: SupabaseClient;
  userId?: string | null;
  scopeType?: LibraryScopeType;
  teamId?: string | null;
  rootNode: unknown;
}): Promise<{ rootNode: ComponentNode; localizedCount: number; remainingCount: number }> {
  const validated = validateComponentNode(params.rootNode);
  let localizedCount = 0;
  let remainingCount = 0;
  let attempts = 0;
  let anonInlineBytes = 0;
  const cache = new Map<string, ComponentImageRef | null>();

  async function walk(node: ComponentNode): Promise<ComponentNode> {
    if (node.type === "container") {
      const nextChildren: ComponentNode[] = [];
      for (const child of node.children) {
        nextChildren.push(await walk(child));
      }
      return { ...node, children: nextChildren };
    }
    if (node.type === "image" && node.imageRef.kind === "missing-external") {
      const urlKey = node.imageRef.originalUrl;
      let resolvedRef = cache.get(urlKey);
      if (resolvedRef === undefined && attempts < 12) {
        attempts += 1;
        const pngBuf = await downloadSafeExternalImageToPng(urlKey);
        if (pngBuf) {
          if (params.admin && params.userId) {
            const saved = await saveLibraryMediaBuffer({
              admin: params.admin,
              userId: params.userId,
              scopeType: params.scopeType === "team" ? "team" : "personal",
              teamId: params.teamId,
              buffer: toArrayBuffer(pngBuf),
              filename: node.alt || "localized-ornament",
            });
            resolvedRef = { kind: "library-media", mediaId: saved.id };
          } else if (pngBuf.byteLength <= 1_500_000 && anonInlineBytes + pngBuf.byteLength <= 3_500_000) {
            anonInlineBytes += pngBuf.byteLength;
            resolvedRef = {
              kind: "inline-data",
              dataUrl: `data:image/png;base64,${pngBuf.toString("base64")}`,
            };
          } else {
            resolvedRef = null;
          }
        } else {
          resolvedRef = null;
        }
        cache.set(urlKey, resolvedRef);
      }
      if (resolvedRef) {
        localizedCount += 1;
        return { ...node, imageRef: resolvedRef };
      }
      remainingCount += 1;
    }
    return node;
  }

  const nextRoot = await walk(validated);
  return { rootNode: nextRoot, localizedCount, remainingCount };
}

export async function listLibraryOverview(
  admin: SupabaseClient,
  userId: string,
  includeArchived = false,
): Promise<{
  personalItems: LibraryItemRecord[];
  teamItems: LibraryItemRecord[];
  teams: Array<{ id: string; name: string; myRole: TeamMemberRole }>;
}> {
  if (await hasNativePostgresTables(admin)) {
    const { data: memberRows } = await admin
      .from("typography_team_members")
      .select("team_id,role")
      .eq("user_id", userId);

    const myTeamRoles = new Map<string, TeamMemberRole>();
    for (const r of memberRows ?? []) {
      myTeamRoles.set(String(r.team_id), r.role as TeamMemberRole);
    }
    const teamIds = Array.from(myTeamRoles.keys());
    const teamNames = new Map<string, string>();
    if (teamIds.length > 0) {
      const { data: tRows } = await admin
        .from("typography_teams")
        .select("id,name")
        .in("id", teamIds);
      for (const t of tRows ?? []) {
        teamNames.set(String(t.id), String(t.name));
      }
    }

    let pQuery = admin
      .from("typography_library_items")
      .select("*")
      .eq("scope_type", "personal")
      .eq("owner_id", userId)
      .order("updated_at", { ascending: false });
    if (!includeArchived) pQuery = pQuery.eq("archived", false);
    const { data: pRows } = await pQuery;

    let tRows: Record<string, unknown>[] = [];
    if (teamIds.length > 0) {
      let tQuery = admin
        .from("typography_library_items")
        .select("*")
        .eq("scope_type", "team")
        .in("team_id", teamIds)
        .order("updated_at", { ascending: false });
      if (!includeArchived) tQuery = tQuery.eq("archived", false);
      const { data } = await tQuery;
      tRows = (data ?? []) as Record<string, unknown>[];
    }

    return {
      personalItems: ((pRows ?? []) as Record<string, unknown>[]).map((r) =>
        mapDbItemRow(r, teamNames, myTeamRoles, userId),
      ),
      teamItems: tRows
        .filter((r) => {
          // 普通成员不查看团队已归档素材
          if (r.archived && !canWriteScope(myTeamRoles.get(String(r.team_id)) ?? null)) return false;
          return true;
        })
        .map((r) => mapDbItemRow(r, teamNames, myTeamRoles, userId)),
      teams: teamIds.map((tid) => ({
        id: tid,
        name: teamNames.get(tid) ?? "协作团队",
        myRole: myTeamRoles.get(tid)!,
      })),
    };
  }

  return withLedger(async (ledger) => {
    const myMemberships = ledger.members.filter((m) => m.user_id === userId);
    const myTeamRoles = new Map(myMemberships.map((m) => [m.team_id, m.role]));
    const teamNames = new Map(ledger.teams.map((t) => [t.id, t.name]));

    const personalItems = ledger.items
      .filter((it) => it.scope_type === "personal" && it.owner_id === userId && (includeArchived || !it.archived))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .map((it) => mapDbItemRow(it as unknown as Record<string, unknown>, teamNames, myTeamRoles, userId));

    const teamItems = ledger.items
      .filter((it) => {
        if (it.scope_type !== "team" || !it.team_id || !myTeamRoles.has(it.team_id)) return false;
        if (it.archived && (!includeArchived || !canWriteScope(myTeamRoles.get(it.team_id) ?? null))) return false;
        return true;
      })
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .map((it) => mapDbItemRow(it as unknown as Record<string, unknown>, teamNames, myTeamRoles, userId));

    const teams = myMemberships.map((m) => ({
      id: m.team_id,
      name: teamNames.get(m.team_id) ?? "协作团队",
      myRole: m.role,
    }));

    return { result: { personalItems, teamItems, teams } };
  });
}

export async function readAuthorizedLibraryItem(
  admin: SupabaseClient,
  itemId: string,
  userId: string,
): Promise<{ item: LibraryItemRecord; teamRole: TeamMemberRole | null }> {
  if (!uuidPattern.test(itemId)) {
    throw new StudioError("无效的库条目编号。", 400);
  }

  let rawRow: Record<string, unknown> | null = null;
  let teamName = "协作团队";

  if (await hasNativePostgresTables(admin)) {
    const { data } = await admin
      .from("typography_library_items")
      .select("*")
      .eq("id", itemId)
      .maybeSingle();
    rawRow = (data as Record<string, unknown> | null) ?? null;
    if (rawRow?.team_id) {
      const { data: tRow } = await admin
        .from("typography_teams")
        .select("name")
        .eq("id", String(rawRow.team_id))
        .maybeSingle();
      if (tRow?.name) teamName = String(tRow.name);
    }
  } else {
    rawRow = await withLedger(async (ledger) => {
      const found = ledger.items.find((it) => it.id === itemId);
      if (found?.team_id) {
        const t = ledger.teams.find((tm) => tm.id === found.team_id);
        if (t) teamName = t.name;
      }
      return { result: found ? ({ ...found } as unknown as Record<string, unknown>) : null };
    });
  }

  if (!rawRow) {
    throw new StudioError("找不到该模板或素材。", 404);
  }

  const scopeType = rawRow.scope_type as LibraryScopeType;
  if (scopeType === "personal") {
    if (String(rawRow.owner_id) !== userId) {
      throw new StudioError("无权访问他人个人库条目。", 403);
    }
    return {
      item: mapDbItemRow(rawRow, new Map(), new Map(), userId),
      teamRole: null,
    };
  }

  const teamId = String(rawRow.team_id ?? "");
  const role = await getTeamRole(admin, teamId, userId);
  if (!role) {
    throw new StudioError("您不是该团队成员，无权访问该团队库素材。", 403);
  }

  const teamNames = new Map([[teamId, teamName]]);
  const myRoles = new Map([[teamId, role]]);
  return {
    item: mapDbItemRow(rawRow, teamNames, myRoles, userId),
    teamRole: role,
  };
}

export async function createLibraryItem(params: {
  admin: SupabaseClient;
  userId: string;
  scopeType: LibraryScopeType;
  teamId?: string | null;
  kind: LibraryItemKind;
  category: LibraryAssetCategory;
  name: string;
  summary?: string;
  rootNode: unknown;
  templateStyle?: TemplateStyleConfig | null;
  sampleMarkdown?: string | null;
  portableMedia?: PortableEmbeddedMedia[];
  localizeExternalImages?: boolean;
}): Promise<LibraryItemRecord> {
  const { admin, userId, scopeType, kind } = params;
  const teamId = scopeType === "team" ? params.teamId ?? null : null;

  let myRole: TeamMemberRole | null = null;
  let teamName = "协作团队";
  if (scopeType === "team") {
    if (!teamId || !uuidPattern.test(teamId)) {
      throw new StudioError("请选择有效的保存团队。", 400);
    }
    myRole = await getTeamRole(admin, teamId, userId);
    if (!canWriteScope(myRole)) {
      throw new StudioError("仅团队所有者或编辑者可向团队库新增模板或素材。", 403);
    }
  }

  const cleanName = params.name.trim().slice(0, 60) || (kind === "template" ? "未命名模板" : "未命名素材");
  const cleanSummary = (params.summary ?? "").trim().slice(0, 200);
  const category: LibraryAssetCategory =
    kind === "template"
      ? "template"
      : params.category === "template"
        ? "card"
        : params.category;

  const validatedTree = validateComponentNode(params.rootNode);
  const persistedTree = await persistEmbeddedMediaInTree({
    admin,
    userId,
    scopeType,
    teamId,
    rootNode: validatedTree,
    portableMedia: params.portableMedia,
    localizeExternalImages: params.localizeExternalImages,
  });

  const cleanStyle =
    kind === "template" && params.templateStyle
      ? sanitizeStyle(params.templateStyle)
      : params.templateStyle
        ? sanitizeStyle(params.templateStyle)
        : null;
  const cleanSample =
    typeof params.sampleMarkdown === "string" && params.sampleMarkdown.trim()
      ? params.sampleMarkdown.slice(0, 20000)
      : null;

  const id = randomUUID();
  const nowIso = new Date().toISOString();

  if (await hasNativePostgresTables(admin)) {
    const { data, error } = await admin
      .from("typography_library_items")
      .insert({
        id,
        scope_type: scopeType,
        owner_id: scopeType === "personal" ? userId : null,
        team_id: scopeType === "team" ? teamId : null,
        kind,
        category,
        name: cleanName,
        description: cleanSummary,
        root_node: persistedTree,
        media_ids: collectLibraryMediaIds(persistedTree),
        template_style: cleanStyle,
        sample_markdown: cleanSample,
        archived: false,
        version: 1,
        created_by: userId,
        updated_by: userId,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select("*")
      .single();
    if (error || !data) {
      throw new StudioError("保存库条目失败，请重试。", 503);
    }
    if (teamId) {
      const { data: tRow } = await admin.from("typography_teams").select("name").eq("id", teamId).maybeSingle();
      if (tRow?.name) teamName = String(tRow.name);
    }
    return mapDbItemRow(
      data as Record<string, unknown>,
      teamId ? new Map([[teamId, teamName]]) : new Map(),
      teamId && myRole ? new Map([[teamId, myRole]]) : new Map(),
      userId,
    );
  }

  return withLedger(async (ledger) => {
    if (teamId) {
      const t = ledger.teams.find((tm) => tm.id === teamId);
      if (t) teamName = t.name;
    }
    const row = {
      id,
      scope_type: scopeType,
      owner_id: scopeType === "personal" ? userId : null,
      team_id: scopeType === "team" ? teamId : null,
      kind,
      category,
      name: cleanName,
      summary: cleanSummary,
      root_node: persistedTree,
      template_style: cleanStyle,
      sample_markdown: cleanSample,
      archived: false,
      version: 1,
      created_by: userId,
      created_at: nowIso,
      updated_at: nowIso,
    };
    ledger.items.push(row);
    return {
      mutated: true,
      result: mapDbItemRow(
        row as unknown as Record<string, unknown>,
        teamId ? new Map([[teamId, teamName]]) : new Map(),
        teamId && myRole ? new Map([[teamId, myRole]]) : new Map(),
        userId,
      ),
    };
  });
}

export async function updateLibraryItem(params: {
  admin: SupabaseClient;
  itemId: string;
  userId: string;
  expectedVersion: number;
  name?: string;
  summary?: string;
  category?: LibraryAssetCategory;
  rootNode?: unknown;
  templateStyle?: TemplateStyleConfig | null;
  sampleMarkdown?: string | null;
  archived?: boolean;
  localizeExternalImages?: boolean;
}): Promise<LibraryItemRecord> {
  const { admin, itemId, userId, expectedVersion } = params;
  const { item: current, teamRole } = await readAuthorizedLibraryItem(admin, itemId, userId);

  if (current.scopeType === "team" && !canWriteScope(teamRole)) {
    throw new StudioError("仅团队所有者或编辑者可修改团队库素材，您可以将其复制到个人库后编辑。", 403);
  }

  if (current.version !== expectedVersion) {
    throw new StudioError(
      "该条目已被其他成员或窗口修改（版本冲突），请刷新加载最新版本，或另存为新项。",
      409,
    );
  }

  const nextName =
    typeof params.name === "string" && params.name.trim()
      ? params.name.trim().slice(0, 60)
      : current.name;
  const nextSummary =
    typeof params.summary === "string" ? params.summary.trim().slice(0, 200) : current.summary;
  const nextCategory: LibraryAssetCategory =
    current.kind === "template"
      ? "template"
      : params.category && params.category !== "template"
        ? params.category
        : current.category;
  const nextArchived = typeof params.archived === "boolean" ? params.archived : current.archived;

  let nextTree = current.rootNode;
  if (params.rootNode !== undefined) {
    const validated = validateComponentNode(params.rootNode);
    nextTree = await persistEmbeddedMediaInTree({
      admin,
      userId,
      scopeType: current.scopeType,
      teamId: current.teamId,
      rootNode: validated,
      localizeExternalImages: params.localizeExternalImages,
    });
  }

  const nextStyle =
    params.templateStyle !== undefined
      ? params.templateStyle
        ? sanitizeStyle(params.templateStyle)
        : null
      : current.templateStyle;
  const nextSample =
    params.sampleMarkdown !== undefined
      ? typeof params.sampleMarkdown === "string"
        ? params.sampleMarkdown.slice(0, 20000)
        : null
      : current.sampleMarkdown;

  const nowIso = new Date().toISOString();
  const nextVersion = expectedVersion + 1;

  if (await hasNativePostgresTables(admin)) {
    const { data, error } = await admin
      .from("typography_library_items")
      .update({
        name: nextName,
        description: nextSummary,
        category: nextCategory,
        root_node: nextTree,
        media_ids: collectLibraryMediaIds(nextTree),
        template_style: nextStyle,
        sample_markdown: nextSample,
        archived: nextArchived,
        version: nextVersion,
        updated_at: nowIso,
        updated_by: userId,
      })
      .eq("id", itemId)
      .eq("version", expectedVersion)
      .select("*")
      .maybeSingle();

    if (error) throw new StudioError("保存修改失败。", 503);
    if (!data) {
      throw new StudioError(
        "该条目已被并发更新，请刷新加载最新版本，或复制为新项。",
        409,
      );
    }
    return mapDbItemRow(
      data as Record<string, unknown>,
      current.teamId ? new Map([[current.teamId, current.teamName ?? "协作团队"]]) : new Map(),
      current.teamId && teamRole ? new Map([[current.teamId, teamRole]]) : new Map(),
      userId,
    );
  }

  return withLedger(async (ledger) => {
    const idx = ledger.items.findIndex((it) => it.id === itemId);
    if (idx === -1) throw new StudioError("找不到该条目。", 404);
    if (ledger.items[idx].version !== expectedVersion) {
      throw new StudioError(
        "该条目已被并发更新，请刷新加载最新版本，或复制为新项。",
        409,
      );
    }
    const updated = {
      ...ledger.items[idx],
      name: nextName,
      summary: nextSummary,
      category: nextCategory,
      root_node: nextTree,
      template_style: nextStyle,
      sample_markdown: nextSample,
      archived: nextArchived,
      version: nextVersion,
      updated_at: nowIso,
    };
    ledger.items[idx] = updated;
    return {
      mutated: true,
      result: mapDbItemRow(
        updated as unknown as Record<string, unknown>,
        current.teamId ? new Map([[current.teamId, current.teamName ?? "协作团队"]]) : new Map(),
        current.teamId && teamRole ? new Map([[current.teamId, teamRole]]) : new Map(),
        userId,
      ),
    };
  });
}

/**
 * 复制模板或素材到个人库或指定团队库（同时独立复制其引用的私有图片文件）
 */
export async function duplicateLibraryItem(params: {
  admin: SupabaseClient;
  itemId: string;
  userId: string;
  targetScopeType: LibraryScopeType;
  targetTeamId?: string | null;
  newName?: string;
}): Promise<LibraryItemRecord> {
  const { admin, itemId, userId, targetScopeType, targetTeamId } = params;
  const { item: source } = await readAuthorizedLibraryItem(admin, itemId, userId);
  const clonedRoot = cloneComponentNode(source.rootNode, true);

  return createLibraryItem({
    admin,
    userId,
    scopeType: targetScopeType,
    teamId: targetScopeType === "team" ? targetTeamId : null,
    kind: source.kind,
    category: source.category,
    name: params.newName?.trim() || `${source.name}（副本）`,
    summary: source.summary,
    rootNode: clonedRoot,
    templateStyle: source.templateStyle,
    sampleMarkdown: source.sampleMarkdown,
  });
}

/**
 * 导出携带内嵌私有媒体的版本化 JSON 包（接收方导入后生成独立私有副本）
 */
export async function exportPortableLibraryItem(
  admin: SupabaseClient,
  itemId: string,
  userId: string,
): Promise<PortableLibraryExportV1> {
  const { item } = await readAuthorizedLibraryItem(admin, itemId, userId);
  const mediaIds = collectLibraryMediaIds(item.rootNode);
  const portableMedia: PortableEmbeddedMedia[] = [];

  for (const mid of mediaIds) {
    const media = await readAuthorizedLibraryMedia(admin, mid, userId);
    const { data: blob, error } = await admin.storage.from(bucket).download(media.storagePath);
    if (!error && blob) {
      const buf = Buffer.from(await blob.arrayBuffer());
      portableMedia.push({
        mediaId: mid,
        mimeType: media.mimeType,
        filename: media.filename ?? undefined,
        base64Data: buf.toString("base64"),
      });
    }
  }

  return {
    schemaVersion: "new-paint-library-v1",
    exportedAt: new Date().toISOString(),
    item: {
      name: item.name,
      kind: item.kind,
      category: item.category,
      summary: item.summary,
      rootNode: item.rootNode,
      templateStyle: item.templateStyle,
      sampleMarkdown: item.sampleMarkdown,
    },
    portableMedia,
  };
}

/**
 * 将库条目物化为稿件内快照：将引用的图片复制至目标可读范围（项目 studio_assets 或个人 library_media），
 * 确保未来退出团队或归档原条目后，历史稿件仍能正常预览和导出。
 */
export async function materializeItemSnapshot(params: {
  supabase: SupabaseClient;
  admin: SupabaseClient;
  itemId: string;
  userId: string;
  projectId?: string | null;
}): Promise<{ snapshot: AppliedComponentSnapshot; item: LibraryItemRecord }> {
  const { supabase, admin, itemId, userId, projectId } = params;
  const { item } = await readAuthorizedLibraryItem(admin, itemId, userId);

  let targetProjectOwnerId: string | null = null;
  if (projectId) {
    const project = await readProject(supabase, projectId);
    if (!project) {
      throw new StudioError("无权访问目标画布项目。", 404);
    }
    targetProjectOwnerId = userId;
  }

  const clonedTree = cloneComponentNode(item.rootNode, false);
  const mediaIds = collectLibraryMediaIds(clonedTree);
  const remappedRefs = new Map<string, ComponentImageRef>();

  for (const mid of mediaIds) {
    const media = await readAuthorizedLibraryMedia(admin, mid, userId);
    const { data: blob, error } = await admin.storage.from(bucket).download(media.storagePath);
    if (error || !blob) {
      throw new StudioError("读取素材内图片失败，请重试。", 503);
    }
    const arrayBuf = await blob.arrayBuffer();

    if (projectId && targetProjectOwnerId) {
      const newAssetId = randomUUID();
      await saveImage(
        admin,
        targetProjectOwnerId,
        projectId,
        newAssetId,
        "reference",
        arrayBuf,
        media.filename ?? item.name,
      );
      remappedRefs.set(mid, { kind: "project-asset", assetId: newAssetId });
    } else if (media.scopeType === "team" || media.ownerId !== userId) {
      const personalCopy = await saveLibraryMediaBuffer({
        admin,
        userId,
        scopeType: "personal",
        buffer: arrayBuf,
        filename: media.filename ?? item.name,
      });
      remappedRefs.set(mid, { kind: "library-media", mediaId: personalCopy.id });
    }
  }

  const finalRoot =
    remappedRefs.size > 0
      ? remapComponentImages(clonedTree, (ref) =>
          ref.kind === "library-media" && remappedRefs.has(ref.mediaId)
            ? remappedRefs.get(ref.mediaId)!
            : ref,
        )
      : clonedTree;

  const snapshot: AppliedComponentSnapshot = {
    snapshotId: `snap-${randomUUID().slice(0, 8)}`,
    sourceItemId: item.id,
    sourceScopeType: item.scopeType,
    sourceTeamId: item.teamId,
    sourceVersion: item.version,
    name: item.name,
    category: item.category,
    rootNode: finalRoot,
    appliedAt: new Date().toISOString(),
  };

  return { snapshot, item };
}

/**
 * 将普通 Markdown 模式下使用的个人库私有图片发布至公开存储桶（需前端确认后调用）
 */
export async function publishLibraryMediaForWechat(
  admin: SupabaseClient,
  userId: string,
  mediaIds: string[],
): Promise<Record<string, string>> {
  if (mediaIds.length === 0) return {};
  const { data: buckets } = await admin.storage.listBuckets();
  if (buckets && !buckets.some((b) => b.id === PUBLISHED_IMAGES_BUCKET)) {
    await admin.storage.createBucket(PUBLISHED_IMAGES_BUCKET, {
      public: true,
      fileSizeLimit: 20_971_520,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    });
  }

  const out: Record<string, string> = {};
  for (const mid of mediaIds) {
    const media = await readAuthorizedLibraryMedia(admin, mid, userId);
    const { data: blob, error } = await admin.storage.from(bucket).download(media.storagePath);
    if (error || !blob) {
      throw new StudioError("读取组件配图失败，请点击重试。", 503);
    }
    const buffer = await blob.arrayBuffer();
    const mime = detectImageMime(new Uint8Array(buffer));
    if (!mime) throw new StudioError("不支持的图片格式。", 400);
    const ext = mime === "image/jpeg" ? "jpg" : mime.split("/")[1];
    const publicPath = `library-published/${mid}.${ext}`;

    const { error: upErr } = await admin.storage
      .from(PUBLISHED_IMAGES_BUCKET)
      .upload(publicPath, buffer, {
        contentType: mime,
        cacheControl: "31536000",
        upsert: true,
      });
    if (upErr) {
      throw new StudioError("生成公开图片副本失败，请重试。", 503);
    }
    const { data: pubData } = admin.storage.from(PUBLISHED_IMAGES_BUCKET).getPublicUrl(publicPath);
    out[mid] = pubData.publicUrl;
  }

  return out;
}

/**
 * 读取当前用户的全部团队、成员、发出的邀请与收到的待处理站内邀请
 */
export async function listUserTeamsAndInvites(
  admin: SupabaseClient,
  userId: string,
  userEmail: string,
): Promise<{
  teams: TeamSummary[];
  incomingInvites: TeamInviteInfo[];
}> {
  const normalizedEmail = userEmail.trim().toLowerCase();

  if (await hasNativePostgresTables(admin)) {
    const { data: myMemberRows } = await admin
      .from("typography_team_members")
      .select("team_id,role")
      .eq("user_id", userId);

    const myRoleByTeam = new Map<string, TeamMemberRole>();
    for (const r of myMemberRows ?? []) {
      myRoleByTeam.set(String(r.team_id), r.role as TeamMemberRole);
    }
    const teamIds = Array.from(myRoleByTeam.keys());

    let teamRows: Array<Record<string, unknown>> = [];
    let allMemberRows: Array<Record<string, unknown>> = [];
    let teamInviteRows: Array<Record<string, unknown>> = [];

    if (teamIds.length > 0) {
      const [tRes, mRes, iRes] = await Promise.all([
        admin.from("typography_teams").select("*").in("id", teamIds).order("created_at", { ascending: true }),
        admin.from("typography_team_members").select("*").in("team_id", teamIds).order("joined_at", { ascending: true }),
        admin
          .from("typography_team_invites")
          .select("*")
          .in("team_id", teamIds)
          .eq("status", "pending")
          .order("created_at", { ascending: false }),
      ]);
      teamRows = (tRes.data ?? []) as Array<Record<string, unknown>>;
      allMemberRows = (mRes.data ?? []) as Array<Record<string, unknown>>;
      teamInviteRows = (iRes.data ?? []) as Array<Record<string, unknown>>;
    }

    const { data: incomingRows } = await admin
      .from("typography_team_invites")
      .select("*")
      .eq("status", "pending")
      .or(`invited_user_id.eq.${userId},invited_email.eq.${normalizedEmail}`)
      .order("created_at", { ascending: false });

    const incomingTeamIds = Array.from(
      new Set((incomingRows ?? []).map((r) => String(r.team_id))),
    );
    const incomingTeamNames = new Map<string, string>();
    if (incomingTeamIds.length > 0) {
      const { data: incTeams } = await admin
        .from("typography_teams")
        .select("id,name")
        .in("id", incomingTeamIds);
      for (const t of incTeams ?? []) {
        incomingTeamNames.set(String(t.id), String(t.name));
      }
    }

    const emailMap = await resolveUserEmailMap(
      admin,
      allMemberRows.map((m) => String(m.user_id)),
    );

    const teams: TeamSummary[] = teamRows.map((t) => {
      const tid = String(t.id);
      const myRole = myRoleByTeam.get(tid)!;
      const members: TeamMemberInfo[] = allMemberRows
        .filter((m) => String(m.team_id) === tid)
        .map((m) => ({
          userId: String(m.user_id),
          email: (typeof m.email === "string" && m.email) || emailMap.get(String(m.user_id)) || "已验证成员",
          role: m.role as TeamMemberRole,
          createdAt: String(m.joined_at ?? m.created_at),
        }));
      const pendingInvites: TeamInviteInfo[] =
        myRole === "owner"
          ? teamInviteRows
              .filter((inv) => String(inv.team_id) === tid)
              .map((inv) => ({
                id: String(inv.id),
                teamId: tid,
                teamName: String(t.name),
                email: String(inv.invited_email ?? inv.email),
                invitedUserId: inv.invited_user_id ? String(inv.invited_user_id) : null,
                role: inv.role as Exclude<TeamMemberRole, "owner">,
                status: "pending",
                invitedBy: String(inv.invited_by),
                createdAt: String(inv.created_at),
              }))
          : [];
      return {
        id: tid,
        name: String(t.name),
        ownerId: String(t.owner_id),
        myRole,
        createdAt: String(t.created_at),
        members,
        pendingInvites,
      };
    });

    const incomingInvites: TeamInviteInfo[] = ((incomingRows ?? []) as Array<Record<string, unknown>>)
      .filter((inv) => !myRoleByTeam.has(String(inv.team_id)))
      .map((inv) => ({
        id: String(inv.id),
        teamId: String(inv.team_id),
        teamName: incomingTeamNames.get(String(inv.team_id)) ?? "协作团队",
        email: String(inv.invited_email ?? inv.email),
        invitedUserId: inv.invited_user_id ? String(inv.invited_user_id) : null,
        role: inv.role as Exclude<TeamMemberRole, "owner">,
        status: "pending",
        invitedBy: String(inv.invited_by),
        createdAt: String(inv.created_at),
      }));

    return { teams, incomingInvites };
  }

  const snapshot = await withLedger(async (ledger) => ({
    result: {
      teams: [...ledger.teams],
      members: [...ledger.members],
      invites: [...ledger.invites],
    },
  }));

  const myMemberships = snapshot.members.filter((m) => m.user_id === userId);
  const myRoleByTeam = new Map(myMemberships.map((m) => [m.team_id, m.role]));
  const relevantUserIds = snapshot.members
    .filter((m) => myRoleByTeam.has(m.team_id))
    .map((m) => m.user_id);
  const emailMap = await resolveUserEmailMap(admin, relevantUserIds);
  const teamNameById = new Map(snapshot.teams.map((t) => [t.id, t.name]));

  const teams: TeamSummary[] = snapshot.teams
    .filter((t) => myRoleByTeam.has(t.id))
    .map((t) => {
      const myRole = myRoleByTeam.get(t.id)!;
      return {
        id: t.id,
        name: t.name,
        ownerId: t.owner_id,
        myRole,
        createdAt: t.created_at,
        members: snapshot.members
          .filter((m) => m.team_id === t.id)
          .map((m) => ({
            userId: m.user_id,
            email: emailMap.get(m.user_id) ?? "已验证成员",
            role: m.role,
            createdAt: m.created_at,
          })),
        pendingInvites:
          myRole === "owner"
            ? snapshot.invites
                .filter((inv) => inv.team_id === t.id && inv.status === "pending")
                .map((inv) => ({
                  id: inv.id,
                  teamId: t.id,
                  teamName: t.name,
                  email: inv.email,
                  invitedUserId: inv.invited_user_id,
                  role: inv.role,
                  status: inv.status,
                  invitedBy: inv.invited_by,
                  createdAt: inv.created_at,
                }))
            : [],
      };
    });

  const incomingInvites: TeamInviteInfo[] = snapshot.invites
    .filter(
      (inv) =>
        inv.status === "pending"
        && !myRoleByTeam.has(inv.team_id)
        && (inv.invited_user_id === userId || inv.email === normalizedEmail),
    )
    .map((inv) => ({
      id: inv.id,
      teamId: inv.team_id,
      teamName: teamNameById.get(inv.team_id) ?? "协作团队",
      email: inv.email,
      invitedUserId: inv.invited_user_id,
      role: inv.role,
      status: inv.status,
      invitedBy: inv.invited_by,
      createdAt: inv.created_at,
    }));

  return { teams, incomingInvites };
}

export async function createTeam(
  admin: SupabaseClient,
  userId: string,
  rawName: string,
): Promise<{ id: string; name: string }> {
  const name = rawName.trim().slice(0, 48);
  if (!name) throw new StudioError("请输入团队名称。", 400);
  const id = randomUUID();
  const nowIso = new Date().toISOString();

  if (await hasNativePostgresTables(admin)) {
    const { data: ownerInfo } = await admin.auth.admin.getUserById(userId);
    const ownerEmail = ownerInfo?.user?.email?.trim().toLowerCase() || "owner@local.invalid";
    const { error: tErr } = await admin.from("typography_teams").insert({
      id,
      name,
      owner_id: userId,
      created_at: nowIso,
      updated_at: nowIso,
    });
    if (tErr) throw new StudioError("创建团队失败。", 503);
    const { error: mErr } = await admin.from("typography_team_members").insert({
      team_id: id,
      user_id: userId,
      email: ownerEmail,
      role: "owner",
      joined_at: nowIso,
    });
    if (mErr) {
      await admin.from("typography_teams").delete().eq("id", id);
      throw new StudioError("初始化团队所有者失败。", 503);
    }
    return { id, name };
  }

  return withLedger(async (ledger) => {
    ledger.teams.push({ id, name, owner_id: userId, created_at: nowIso, updated_at: nowIso });
    ledger.members.push({ team_id: id, user_id: userId, role: "owner", created_at: nowIso });
    return { mutated: true, result: { id, name } };
  });
}

export async function inviteTeamMemberByEmail(params: {
  admin: SupabaseClient;
  actorUserId: string;
  teamId: string;
  email: string;
  role: Exclude<TeamMemberRole, "owner">;
}): Promise<TeamInviteInfo> {
  const { admin, actorUserId, teamId, role } = params;
  const actorRole = await getTeamRole(admin, teamId, actorUserId);
  if (actorRole !== "owner") {
    throw new StudioError("仅团队所有者可发起成员邀请。", 403);
  }

  const registered = await findRegisteredUserByEmail(admin, params.email);
  if (!registered) {
    throw new StudioError("该邮箱尚未在本站注册并验证，请先请对方注册账号后再发起站内邀请。", 400);
  }
  if (registered.id === actorUserId) {
    throw new StudioError("您已是该团队所有者，无需邀请自己。", 400);
  }

  const existingMemberRole = await getTeamRole(admin, teamId, registered.id);
  if (existingMemberRole) {
    throw new StudioError("该账号已是团队成员。", 409);
  }

  const inviteId = randomUUID();
  const nowIso = new Date().toISOString();

  if (await hasNativePostgresTables(admin)) {
    const { data: teamRow } = await admin
      .from("typography_teams")
      .select("name")
      .eq("id", teamId)
      .maybeSingle();

    await admin
      .from("typography_team_invites")
      .update({ status: "revoked", responded_at: nowIso })
      .eq("team_id", teamId)
      .eq("invited_email", registered.email)
      .eq("status", "pending");

    const { data: inserted, error } = await admin
      .from("typography_team_invites")
      .insert({
        id: inviteId,
        team_id: teamId,
        invited_email: registered.email,
        invited_user_id: registered.id,
        role,
        status: "pending",
        invited_by: actorUserId,
        created_at: nowIso,
      })
      .select("*")
      .single();

    if (error || !inserted) throw new StudioError("发送站内邀请失败。", 503);
    return {
      id: String(inserted.id),
      teamId,
      teamName: String(teamRow?.name ?? "协作团队"),
      email: registered.email,
      invitedUserId: registered.id,
      role,
      status: "pending",
      invitedBy: actorUserId,
      createdAt: nowIso,
    };
  }

  return withLedger(async (ledger) => {
    const team = ledger.teams.find((t) => t.id === teamId);
    if (!team) throw new StudioError("找不到目标团队。", 404);
    for (const inv of ledger.invites) {
      if (inv.team_id === teamId && inv.email === registered.email && inv.status === "pending") {
        inv.status = "revoked";
        inv.responded_at = nowIso;
      }
    }
    ledger.invites.push({
      id: inviteId,
      team_id: teamId,
      email: registered.email,
      invited_user_id: registered.id,
      role,
      status: "pending",
      invited_by: actorUserId,
      created_at: nowIso,
      responded_at: null,
    });
    return {
      mutated: true,
      result: {
        id: inviteId,
        teamId,
        teamName: team.name,
        email: registered.email,
        invitedUserId: registered.id,
        role,
        status: "pending",
        invitedBy: actorUserId,
        createdAt: nowIso,
      },
    };
  });
}

export async function respondToTeamInvite(params: {
  admin: SupabaseClient;
  userId: string;
  userEmail: string;
  inviteId: string;
  decision: "accept" | "decline" | "revoke";
}): Promise<void> {
  const { admin, userId, inviteId, decision } = params;
  const normalizedEmail = params.userEmail.trim().toLowerCase();
  if (!uuidPattern.test(inviteId)) throw new StudioError("无效的邀请编号。", 400);
  const nowIso = new Date().toISOString();

  if (await hasNativePostgresTables(admin)) {
    const { data: inv } = await admin
      .from("typography_team_invites")
      .select("*")
      .eq("id", inviteId)
      .maybeSingle();
    if (!inv || inv.status !== "pending") {
      throw new StudioError("该邀请已处理或已失效。", 404);
    }
    const teamId = String(inv.team_id);

    if (decision === "revoke") {
      const actorRole = await getTeamRole(admin, teamId, userId);
      if (actorRole !== "owner") throw new StudioError("仅团队所有者可撤回邀请。", 403);
      await admin
        .from("typography_team_invites")
        .update({ status: "revoked", responded_at: nowIso })
        .eq("id", inviteId);
      return;
    }

    const invEmail = String(inv.invited_email ?? inv.email ?? "").toLowerCase();
    const isRecipient =
      inv.invited_user_id === userId || (Boolean(normalizedEmail) && invEmail === normalizedEmail);
    if (!isRecipient) {
      throw new StudioError("无权操作他人的团队邀请。", 403);
    }

    if (decision === "accept") {
      await admin.from("typography_team_members").upsert(
        {
          team_id: teamId,
          user_id: userId,
          email: normalizedEmail || invEmail || "member@local.invalid",
          role: inv.role,
          joined_at: nowIso,
        },
        { onConflict: "team_id,user_id" },
      );
      await admin
        .from("typography_team_invites")
        .update({ status: "accepted", responded_at: nowIso })
        .eq("id", inviteId);
    } else {
      await admin
        .from("typography_team_invites")
        .update({ status: "declined", responded_at: nowIso })
        .eq("id", inviteId);
    }
    return;
  }

  await withLedger(async (ledger) => {
    const inv = ledger.invites.find((i) => i.id === inviteId);
    if (!inv || inv.status !== "pending") {
      throw new StudioError("该邀请已处理或已失效。", 404);
    }
    if (decision === "revoke") {
      const ownerMem = ledger.members.find(
        (m) => m.team_id === inv.team_id && m.user_id === userId && m.role === "owner",
      );
      if (!ownerMem) throw new StudioError("仅团队所有者可撤回邀请。", 403);
      inv.status = "revoked";
      inv.responded_at = nowIso;
      return { mutated: true, result: undefined };
    }

    const isRecipient = inv.invited_user_id === userId || inv.email === normalizedEmail;
    if (!isRecipient) throw new StudioError("无权操作他人的团队邀请。", 403);

    if (decision === "accept") {
      if (!ledger.members.some((m) => m.team_id === inv.team_id && m.user_id === userId)) {
        ledger.members.push({
          team_id: inv.team_id,
          user_id: userId,
          role: inv.role,
          created_at: nowIso,
        });
      }
      inv.status = "accepted";
      inv.responded_at = nowIso;
    } else {
      inv.status = "declined";
      inv.responded_at = nowIso;
    }
    return { mutated: true, result: undefined };
  });
}

export async function updateTeamMemberRole(params: {
  admin: SupabaseClient;
  actorUserId: string;
  teamId: string;
  targetUserId: string;
  role: Exclude<TeamMemberRole, "owner">;
}): Promise<void> {
  const { admin, actorUserId, teamId, targetUserId, role } = params;
  const actorRole = await getTeamRole(admin, teamId, actorUserId);
  if (actorRole !== "owner") {
    throw new StudioError("仅团队所有者可调整成员角色。", 403);
  }
  if (actorUserId === targetUserId) {
    throw new StudioError("不能修改团队所有者的自身角色。", 400);
  }

  if (await hasNativePostgresTables(admin)) {
    const { error } = await admin
      .from("typography_team_members")
      .update({ role })
      .eq("team_id", teamId)
      .eq("user_id", targetUserId)
      .neq("role", "owner");
    if (error) throw new StudioError("更新成员角色失败。", 503);
    return;
  }

  await withLedger(async (ledger) => {
    const mem = ledger.members.find((m) => m.team_id === teamId && m.user_id === targetUserId);
    if (!mem) throw new StudioError("找不到该团队成员。", 404);
    if (mem.role === "owner") throw new StudioError("不能修改团队所有者角色。", 400);
    mem.role = role;
    return { mutated: true, result: undefined };
  });
}

export async function removeOrLeaveTeamMember(params: {
  admin: SupabaseClient;
  actorUserId: string;
  teamId: string;
  targetUserId: string;
}): Promise<void> {
  const { admin, actorUserId, teamId, targetUserId } = params;
  const actorRole = await getTeamRole(admin, teamId, actorUserId);
  if (!actorRole) throw new StudioError("您不是该团队成员。", 403);

  const isSelfLeave = actorUserId === targetUserId;
  if (!isSelfLeave && actorRole !== "owner") {
    throw new StudioError("仅团队所有者可移除其他成员。", 403);
  }

  const targetRole = isSelfLeave ? actorRole : await getTeamRole(admin, teamId, targetUserId);
  if (!targetRole) throw new StudioError("找不到目标成员。", 404);
  if (targetRole === "owner") {
    throw new StudioError("团队所有者不能移除自己。", 400);
  }

  if (await hasNativePostgresTables(admin)) {
    const { error } = await admin
      .from("typography_team_members")
      .delete()
      .eq("team_id", teamId)
      .eq("user_id", targetUserId);
    if (error) throw new StudioError("移除成员失败。", 503);
    return;
  }

  await withLedger(async (ledger) => {
    ledger.members = ledger.members.filter(
      (m) => !(m.team_id === teamId && m.user_id === targetUserId),
    );
    return { mutated: true, result: undefined };
  });
}
