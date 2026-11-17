"use client";

import { useRef, useState } from "react";
import { BookOpen, Trash2, Upload, X } from "lucide-react";
import type { StudioSkill } from "@/lib/studio/agent-events";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function SkillPicker({ projectId, selected, onChange, onMutating, disabled }: {
  projectId: string;
  selected: StudioSkill | null;
  onChange: (skill: StudioSkill | null) => void;
  onMutating: (mutating: boolean) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [skills, setSkills] = useState<StudioSkill[]>([]);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const picker = useRef<HTMLInputElement>(null);
  const endpoint = `/api/studio/skills?projectId=${projectId}`;

  async function request(path: string, options?: RequestInit) {
    const result = await fetch(path, options);
    const value = await result.json().catch(() => null);
    if (!result.ok || !value) throw new Error(value?.error || "技能操作失败。");
    return value;
  }

  async function change(action: () => Promise<void>, mutating = false) {
    if (mutating) onMutating(true);
    setWorking(true);
    setError("");
    try {
      await action();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "技能操作失败。");
    } finally {
      setWorking(false);
      if (mutating) onMutating(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1">
      <input ref={picker} type="file" aria-label="选择 SKILL.md" accept=".md" className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          void change(async () => {
            if (file.size > 65_536) throw new Error("SKILL.md 不能超过 64 KB。");
            const source = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
            const { skill } = await request(endpoint, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ filename: file.name, source }),
            });
            setSkills((items) => [...items, skill]);
            onChange(skill);
            setOpen(false);
          }, true);
        }} />
      <DropdownMenu open={open && !disabled} modal={false} onOpenChange={(next) => {
        setOpen(next);
        if (next) void change(async () => { setSkills((await request(endpoint)).skills); });
      }}>
        <DropdownMenuTrigger type="button" disabled={disabled}
          className="flex h-12 w-12 flex-col items-center justify-center gap-1 rounded-xl bg-neutral-100 text-[10px] text-neutral-600 hover:bg-neutral-200">
          <BookOpen size={14} />Skill
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-72 max-w-[85vw] border-neutral-200 bg-white p-2 text-neutral-900">
          <button type="button" disabled={working} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs hover:bg-neutral-100"
            onClick={() => picker.current?.click()}><Upload size={14} />上传 SKILL.md</button>
          {working && <p role="status" className="px-2 py-1 text-xs text-neutral-600">正在处理…</p>}
          {!working && !skills.length && <p className="px-2 py-1 text-xs text-neutral-500">当前项目还没有技能。</p>}
          {skills.map((skill) => (
            <div key={skill.id} className="flex items-start gap-1 rounded-lg border-t border-neutral-100">
              <button type="button" disabled={working} aria-label={`选择 ${skill.name}`} aria-pressed={selected?.id === skill.id}
                onClick={() => { onChange(skill); setOpen(false); }}
                className="min-w-0 flex-1 rounded-lg px-2 py-1.5 text-left hover:bg-neutral-100 aria-pressed:bg-neutral-100">
                <span className="block truncate text-xs font-semibold">{skill.name}</span>
                <span className="line-clamp-2 break-words text-xs text-neutral-600" title={skill.description}>{skill.description}</span>
              </button>
              <button type="button" disabled={working} className="rounded p-2 text-neutral-500 hover:bg-neutral-100"
                aria-label={`移除技能 ${skill.name}`} onClick={() => void change(async () => {
                  await request(`${endpoint}&id=${skill.id}`, { method: "DELETE" });
                  setSkills((items) => items.filter((item) => item.id !== skill.id));
                  if (selected?.id === skill.id) onChange(null);
                }, true)}><Trash2 size={13} /></button>
            </div>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {selected && <span className="inline-flex max-w-48 items-center gap-1 rounded-md bg-neutral-100 px-2 py-1 text-xs">
        <span className="truncate" title={selected.description}>{selected.name}</span>
        <button type="button" disabled={disabled} aria-label="清除本次 Skill" onClick={() => onChange(null)}><X size={12} /></button>
      </span>}
      {error && <p role="alert" className="basis-full text-xs text-red-700">{error}</p>}
    </div>
  );
}
