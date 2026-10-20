"use client";

import { useRef } from "react";
import type { KeyboardEvent, ReactNode } from "react";

type SegmentedItem<T> = { value: T; label: ReactNode; sub?: ReactNode };

type SegmentedProps<T extends string | number> = {
  label: string;
  items: SegmentedItem<T>[];
  value: T | null;
  onChange: (value: T) => void;
  role?: "tablist" | "radiogroup";
  fill?: boolean;
};

export function Segmented<T extends string | number>({
  label,
  items,
  value,
  onChange,
  role = "radiogroup",
  fill = false,
}: SegmentedProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const activeIndex = items.findIndex((item) => item.value === value);
  const tabbable = activeIndex >= 0 ? activeIndex : 0;
  const itemRole = role === "tablist" ? "tab" : "radio";

  function onKeyDown(event: KeyboardEvent, index: number) {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = (index + step + items.length) % items.length;
    refs.current[next]?.focus();
    onChange(items[next].value);
  }

  return (
    <div role={role} aria-label={label} className={`gap-1 rounded-[12px] bg-varaq p-1 ${fill ? "grid" : "inline-flex max-w-full"}`} style={fill ? { gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` } : undefined}>
      {items.map((item, index) => {
        const selected = index === activeIndex;
        return (
          <button
            key={String(item.value)}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role={itemRole}
            {...(role === "tablist" ? { "aria-selected": selected } : { "aria-checked": selected })}
            tabIndex={index === tabbable ? 0 : -1}
            onClick={() => onChange(item.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={`flex min-h-11 min-w-0 flex-col items-center justify-center rounded-[10px] px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-siyoh ${
              selected ? "bg-siyoh font-semibold text-varaq" : "font-medium text-qalam hover:bg-white hover:text-siyoh"
            }`}
          >
            <span className={fill ? "py-1 text-center leading-tight" : "whitespace-nowrap"}>{item.label}</span>
            {item.sub !== undefined && (
              <span className={`text-xs font-normal tabular-nums ${selected ? "text-varaq/80" : "text-qalam"}`}>{item.sub}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
