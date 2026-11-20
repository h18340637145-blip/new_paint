"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Image as ImageIcon, Sparkles } from "lucide-react";

export type StudioMode = "agent" | "image";

const modes = [
  {
    value: "agent",
    label: "AI 图文共创",
    hint: "聊选题、出分镜，自动写文案配图并连线",
    icon: Sparkles,
  },
  {
    value: "image",
    label: "单图生成",
    hint: "输入画面描述直接生成配图",
    icon: ImageIcon,
  },
] as const;

export function ModeMenu({
  mode,
  onChange,
  disabled,
}: {
  mode: StudioMode;
  onChange: (mode: StudioMode) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const current = modes.findIndex((item) => item.value === mode);
  const activeItem = modes[current] ?? modes[0];
  const ActiveIcon = activeItem.icon;

  useEffect(() => {
    if (!open || disabled) return;
    items.current[current]?.focus();
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open, disabled, current]);

  function close() {
    setOpen(false);
    trigger.current?.focus();
  }

  return (
    <div ref={root} className="relative shrink-0">
      <button
        ref={trigger}
        type="button"
        disabled={disabled}
        aria-label={`模式：${activeItem.label}`}
        aria-haspopup="menu"
        aria-expanded={open && !disabled}
        className={`flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition disabled:opacity-50 ${
          mode === "agent"
            ? "border-[#c5d9cf] bg-[#eef5f1] text-[#164b3e] hover:bg-[#e3efe8]"
            : "border-neutral-200 bg-neutral-50 text-neutral-800 hover:bg-neutral-100"
        }`}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (["ArrowDown", "ArrowUp"].includes(event.key)) {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <ActiveIcon size={13} aria-hidden="true" />
        <span>{activeItem.label}</span>
        <ChevronDown size={13} aria-hidden="true" />
      </button>

      {open && !disabled && (
        <div
          role="menu"
          aria-label="创作模式"
          className="absolute bottom-full left-0 z-30 mb-1.5 grid w-64 gap-1 rounded-xl border border-neutral-200 bg-white p-1.5 text-neutral-900 shadow-lg"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              close();
            } else if (event.key === "Tab") {
              setOpen(false);
            } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
              event.preventDefault();
              const index = items.current.findIndex((item) => item === document.activeElement);
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? modes.length - 1
                    : (index + (event.key === "ArrowDown" ? 1 : -1) + modes.length) % modes.length;
              items.current[next]?.focus();
            }
          }}
        >
          {modes.map(({ value, label, hint, icon: ItemIcon }, index) => (
            <button
              key={value}
              ref={(item) => {
                items.current[index] = item;
              }}
              type="button"
              role="menuitemradio"
              aria-checked={mode === value}
              tabIndex={-1}
              className="flex items-start gap-2 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-neutral-100 focus:bg-neutral-100"
              onClick={() => {
                onChange(value);
                close();
              }}
            >
              <ItemIcon size={14} className="mt-0.5 shrink-0 text-[#164b3e]" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-neutral-950">{label}</span>
                <span className="mt-0.5 block text-[11px] leading-snug text-neutral-500">{hint}</span>
              </span>
              <span className="mt-0.5 grid size-4 shrink-0 place-items-center text-[#164b3e]">
                {mode === value && <Check size={13} />}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
