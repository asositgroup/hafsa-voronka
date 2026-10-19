import type { ReactNode } from "react";

export type BadgeTone = "neutral" | "success" | "attention" | "danger";

const toneClass: Record<BadgeTone, string> = {
  neutral: "bg-chiziq text-qalam",
  success: "bg-zumrad/12 text-zumrad",
  attention: "bg-oltin/20 text-siyoh",
  danger: "bg-anor/10 text-anor",
};

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${toneClass[tone]}`}>
      {children}
    </span>
  );
}
