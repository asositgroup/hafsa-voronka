"use client";

import { useId } from "react";
import type { ReactNode } from "react";
import { ChevronDownIcon } from "@/components/icons";

type DisclosureProps = {
  title: string;
  summary?: string;
  action?: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
};

export function Disclosure({ title, summary, action, open, onOpenChange, children }: DisclosureProps) {
  const panelId = useId();

  return (
    <div className="rounded-[12px] border border-chiziq">
      <div className="flex items-center gap-1 pr-2">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => onOpenChange(!open)}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-[12px] px-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-siyoh"
        >
          <span className="shrink-0 text-[15px] font-semibold text-siyoh">{title}</span>
          {summary && <span className="min-w-0 flex-1 truncate text-[13px] text-qalam">{summary}</span>}
          <ChevronDownIcon
            className={`ml-auto h-4 w-4 text-qalam motion-safe:transition-transform motion-safe:duration-150 ${open ? "rotate-180" : ""}`}
          />
        </button>
        {action}
      </div>
      <div id={panelId} hidden={!open} className="border-t border-chiziq p-3">
        {children}
      </div>
    </div>
  );
}
