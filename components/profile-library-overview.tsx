"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Archive, ArchiveRestore, Copy, Download, ExternalLink, FolderHeart, Users } from "lucide-react";
import { LIBRARY_CATEGORY_LABELS, type LibraryItemRecord } from "@/lib/typography/templates";

export function ProfileLibraryOverview() {
  const [tab, setTab] = useState<"personal" | "team">("personal");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [personalItems, setPersonalItems] = useState<LibraryItemRecord[]>([]);
  const [teamItems, setTeamItems] = useState<LibraryItemRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/library/items?includeArchived=${includeArchived ? "1" : "0"}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      setPersonalItems(Array.isArray(data.personalItems) ? data.personalItems : []);
      setTeamItems(Array.isArray(data.teamItems) ? data.teamItems : []);
    } finally {
      setLoading(false);
    }
  }, [includeArchived]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleArchive(item: LibraryItemRecord) {
    const res = await fetch(`/api/library/items/${encodeURIComponent(item.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedVersion: item.version, archived: !item.archived }),
    });
    if (res.ok) {
      setStatus(item.archived ? `已取消归档「${item.name}」` : `已归档「${item.name}」`);
      await load();
    }
  }

  async function duplicateToPersonal(item: LibraryItemRecord) {
    const res = await fetch(`/api/library/items/${encodeURIComponent(item.id)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "duplicate", targetScopeType: "personal" }),
    });
    if (res.ok) {
      setStatus(`已将「${item.name}」复制到个人库`);
      await load();
    }
  }

  const shown = tab === "personal" ? personalItems : teamItems;

  return (
    <div className="space-y-3 rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-xl border border-neutral-200 bg-neutral-100 p-1 text-xs">
          <button
            type="button"
            onClick={() => setTab("personal")}
            className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 py-1 font-semibold transition ${
              tab === "personal" ? "bg-white text-neutral-950 shadow-sm" : "text-neutral-600"
            }`}
          >
            <FolderHeart size={14} />
            个人库 ({personalItems.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("team")}
            className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 py-1 font-semibold transition ${
              tab === "team" ? "bg-white text-neutral-950 shadow-sm" : "text-neutral-600"
            }`}
          >
            <Users size={14} />
            团队库 ({teamItems.length})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {status && (
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">
              {status}
            </span>
          )}
          <button
            type="button"
            onClick={() => setIncludeArchived((v) => !v)}
            className={`min-h-9 rounded-xl border px-3 py-1 text-xs font-medium ${
              includeArchived
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
            }`}
          >
            {includeArchived ? "隐藏归档项" : "显示归档项"}
          </button>
          <Link
            href="/typography"
            className="inline-flex min-h-9 items-center gap-1 rounded-xl bg-[#164b3e] px-3.5 py-1 text-xs font-semibold text-white hover:bg-[#123d32]"
          >
            去排版台导入或编辑
            <ExternalLink size={12} />
          </Link>
        </div>
      </div>

      {loading ? (
        <p className="py-6 text-center text-xs text-neutral-500">正在加载模板与素材库…</p>
      ) : shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50/70 py-7 text-center text-xs text-neutral-500">
          {tab === "personal"
            ? "个人库暂无保存的模板或素材。可在公众号排版台点击「导入模板」或「导入素材」添加。"
            : "当前团队库暂无共享模板或素材。"}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((item) => (
            <div
              key={item.id}
              className={`flex flex-col justify-between rounded-xl border p-3.5 text-xs ${
                item.archived ? "border-neutral-200 bg-neutral-50 opacity-75" : "border-neutral-200 bg-white"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-neutral-950">{item.name}</span>
                  <span className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600">
                    v{item.version}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-500">
                  <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-800">
                    {LIBRARY_CATEGORY_LABELS[item.category]}
                  </span>
                  {item.teamName && <span>{item.teamName}</span>}
                  {item.archived && <span className="text-amber-800">已归档</span>}
                </div>
                {item.summary && (
                  <p className="mt-1.5 line-clamp-2 text-neutral-600">{item.summary}</p>
                )}
              </div>

              <div className="mt-3 flex items-center justify-end gap-1.5 border-t border-neutral-100 pt-2">
                <button
                  type="button"
                  onClick={() => void duplicateToPersonal(item)}
                  className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-neutral-200 px-2 py-1 text-[11px] font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  <Copy size={11} />
                  复制副本
                </button>
                <a
                  href={`/api/library/items/${encodeURIComponent(item.id)}?export=json`}
                  className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-neutral-200 px-2 py-1 text-[11px] font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  <Download size={11} />
                  导出 JSON
                </a>
                {item.canEdit && (
                  <button
                    type="button"
                    onClick={() => void toggleArchive(item)}
                    className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-neutral-200 px-2 py-1 text-[11px] font-medium text-neutral-700 hover:bg-neutral-50"
                  >
                    {item.archived ? <ArchiveRestore size={11} /> : <Archive size={11} />}
                    {item.archived ? "恢复" : "归档"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
