"use client";

import { useRef } from "react";
import type { KeyboardEvent } from "react";
import { type FunnelSegment, funnelSegments } from "@funnel/shared";
import { adminUz } from "@/lib/i18n/admin";

const copy = adminUz.messages;

type AudienceTabsProps = {
  value: FunnelSegment;
  counts: Partial<Record<FunnelSegment, number>>;
  onChange: (value: FunnelSegment) => void;
};

export function AudienceTabs({ value, counts, onChange }: AudienceTabsProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(event: KeyboardEvent, index: number) {
    const last = funnelSegments.length - 1;
    let next = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = index === last ? 0 : index + 1;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = index === 0 ? last : index - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    else return;
    event.preventDefault();
    refs.current[next]?.focus();
    onChange(funnelSegments[next]);
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 id="audience-title" className="m-0 text-base font-semibold text-siyoh">
        {copy.audienceTitle}
      </h2>
      <div
        role="tablist"
        aria-labelledby="audience-title"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0 md:pb-0"
      >
        {funnelSegments.map((segment, index) => {
          const selected = segment === value;
          const count = counts[segment];
          return (
            <button
              key={segment}
              ref={(node) => {
                refs.current[index] = node;
              }}
              id={`audience-tab-${segment}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls="audience-panel"
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(segment)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={`flex min-h-11 shrink-0 flex-col items-start gap-0.5 rounded-[12px] border px-4 py-2.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-siyoh md:shrink md:min-w-0 ${
                selected ? "border-siyoh bg-siyoh text-varaq" : "border-chiziq bg-white text-siyoh hover:border-chegara"
              }`}
            >
              <span className="whitespace-nowrap text-sm font-semibold md:whitespace-normal">{adminUz.segments[segment].label}</span>
              <span className={`whitespace-nowrap text-xs tabular-nums ${selected ? "text-varaq/80" : "text-qalam"}`}>
                {count === undefined ? "…" : copy.audienceCount.replace("{n}", String(count))}
              </span>
            </button>
          );
        })}
      </div>
      <p id="audience-panel" role="tabpanel" aria-labelledby={`audience-tab-${value}`} className="m-0 text-[13px] text-qalam">
        {adminUz.segments[value].explanation}
      </p>
    </section>
  );
}
