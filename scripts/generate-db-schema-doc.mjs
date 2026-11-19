import { readFileSync, readdirSync } from "node:fs";

const migrationDir = new URL("../supabase/migrations/", import.meta.url);
const migrations = readdirSync(migrationDir).filter((name) => name.endsWith(".sql")).sort();
const tables = new Map();
const functions = new Map();
const rls = new Set();
const buckets = new Map();

for (const name of migrations) {
  const sql = readFileSync(new URL(name, migrationDir), "utf8");
  for (const [, table] of sql.matchAll(/^create table (?:if not exists )?public\.(\w+)/gim)) {
    tables.set(table, name);
  }
  for (const [, fn] of sql.matchAll(/^create (?:or replace )?function public\.(\w+)/gim)) {
    functions.set(fn, name);
  }
  for (const [, table] of sql.matchAll(/^alter table public\.(\w+) enable row level security/gim)) {
    rls.add(table);
  }
  for (const [, bucket, isPublic] of sql.matchAll(/^values \('([^']+)', '\1', (true|false),/gim)) {
    buckets.set(bucket, { name, isPublic: isPublic === "true" });
  }
}

const migrationLink = (name) => `[${name}](../../supabase/migrations/${name})`;
const lines = [
  "# 数据库结构索引",
  "",
  "<!-- 此文件由仓库迁移生成。修改迁移后重新生成。 -->",
  "",
  "索引列出仓库迁移中声明的对象。字段、外键、权限和变更顺序请查对应 SQL。确认部署环境时，单独核对目标 Supabase 项目的迁移历史和实际结构。",
  "",
  "在仓库根目录重新生成。",
  "",
  "```bash",
  "node scripts/generate-db-schema-doc.mjs > docs/generated/db-schema.md",
  "```",
  "",
  "## 业务表",
  "",
  "| 表 | 迁移声明启用 RLS | 定义迁移 |",
  "| --- | --- | --- |",
  ...Array.from(tables, ([table, name]) =>
    `| \`${table}\` | ${rls.has(table) ? "是" : "未发现"} | ${migrationLink(name)} |`),
  "",
  "## 数据库函数",
  "",
  "| 函数 | 定义迁移 |",
  "| --- | --- |",
  ...Array.from(functions, ([fn, name]) => `| \`${fn}\` | ${migrationLink(name)} |`),
  "",
  "## 存储桶",
  "",
  "| 存储桶 | 访问方式 | 定义迁移 |",
  "| --- | --- | --- |",
  ...Array.from(buckets, ([bucket, { name, isPublic }]) =>
    `| \`${bucket}\` | ${isPublic ? "公开读取" : "私有"} | ${migrationLink(name)} |`),
];

console.log(lines.join("\n"));
