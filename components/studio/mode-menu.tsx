"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export type StudioMode = "agent" | "image";
const modes = [
  { value: "agent", label: "Agent" },
  { value: "image", label: "生图" },
] as const;

export function ModeMenu({ mode, onChange, disabled }: {
  mode: StudioMode;
  onChange: (mode: StudioMode) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const current = modes.findIndex((item) => item.value === mode);
  const label = modes[current].label;

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
      <button ref={trigger} type="button" disabled={disabled} aria-label={`模式：${label}`}
        aria-haspopup="menu" aria-expanded={open && !disabled}
        className="flex h-8 items-center gap-1 rounded-lg px-2 text-xs hover:bg-neutral-100 disabled:opacity-50"
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (["ArrowDown", "ArrowUp"].includes(event.key)) {
            event.preventDefault();
            setOpen(true);
          }
        }}>
        {label}<ChevronDown size={13} />
      </button>
      {open && !disabled && (
        <div role="menu" aria-label="创作模式" className="absolute bottom-full left-0 z-30 mb-1 grid min-w-28 gap-1 rounded-lg border border-neutral-200 bg-white p-1 text-neutral-900 shadow-lg"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              close();
            } else if (event.key === "Tab") {
              setOpen(false);
            } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
              event.preventDefault();
              const index = items.current.findIndex((item) => item === document.activeElement);
              const next = event.key === "Home" ? 0 : event.key === "End" ? modes.length - 1
                : (index + (event.key === "ArrowDown" ? 1 : -1) + modes.length) % modes.length;
              items.current[next]?.focus();
            }
          }}>
          {modes.map(({ value, label }, index) => (
            <button key={value} ref={(item) => { items.current[index] = item; }} type="button"
              role="menuitemradio" aria-checked={mode === value} tabIndex={-1}
              className="flex h-8 items-center gap-2 rounded-md px-2 text-left text-xs hover:bg-neutral-100 focus:bg-neutral-100"
              onClick={() => { onChange(value); close(); }}>
              <span className="grid size-4 place-items-center">{mode === value && <Check size={13} />}</span>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
