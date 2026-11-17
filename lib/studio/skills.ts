import "server-only";
import { JSON_SCHEMA, load } from "js-yaml";
import { StudioError } from "./auth";

export const maxSkillBytes = 65_536;

export function parseSkill(source: string) {
  if (Buffer.byteLength(source) > maxSkillBytes || source.includes("\0")) {
    throw new StudioError("SKILL.md 须为不超过 64 KB 的 UTF-8 文本。");
  }
  const match = source.match(/^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/);
  if (!match) throw new StudioError("SKILL.md 开头需要 YAML frontmatter。");
  let fields: unknown;
  try {
    fields = load(match[1], { schema: JSON_SCHEMA });
  } catch {
    throw new StudioError("SKILL.md 的 YAML frontmatter 格式无效。");
  }
  const value = fields as { name?: unknown; description?: unknown } | null;
  const name = value?.name;
  const description = typeof value?.description === "string" ? value.description.trim() : "";
  if (typeof name !== "string" || name.length > 64 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
    throw new StudioError("技能名称只能用小写英文字母、数字和单连字符，最多 64 个字符。");
  }
  if (!description || description.length > 1024) throw new StudioError("请填写不超过 1024 个字符的技能简介。");
  const body = source.slice(match[0].length);
  if (!body.trim()) throw new StudioError("SKILL.md 缺少技能正文。");
  return { name, description, body };
}
