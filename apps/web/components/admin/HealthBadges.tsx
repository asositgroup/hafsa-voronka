"use client";

import type { HealthStat } from "@funnel/shared";
import { adminUz } from "@/lib/i18n/admin";

function formatDate(iso: string | null): string {
  if (!iso) return adminUz.health.never;
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tashkent",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .format(d)
      .replace(",", "");
  } catch {
    return iso;
  }
}

export function HealthBadges({ health }: { health: HealthStat }) {
  const hasFailures = health.sheetsFailures > 0;
  const hasBacklog = health.sheetsBacklog > 0;

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <div
        className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 border ${
          hasBacklog
            ? "border-amber-800/60 bg-amber-950/40 text-amber-300"
            : "border-emerald-800/60 bg-emerald-950/40 text-emerald-300"
        }`}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            hasBacklog ? "bg-amber-400 animate-pulse" : "bg-emerald-400"
          }`}
        />
        <span>{adminUz.health.sheetsBacklog}:</span>
        <span className="font-semibold">{health.sheetsBacklog}</span>
      </div>

      <div
        className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 border ${
          hasFailures
            ? "border-rose-800/60 bg-rose-950/40 text-rose-300"
            : "border-emerald-800/60 bg-emerald-950/40 text-emerald-300"
        }`}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            hasFailures ? "bg-rose-400 animate-pulse" : "bg-emerald-400"
          }`}
        />
        <span>{adminUz.health.sheetsFailures}:</span>
        <span className="font-semibold">{health.sheetsFailures}</span>
      </div>

      <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/80 px-2.5 py-1 text-zinc-400">
        <span>{adminUz.health.lastBotStart}:</span>
        <span className="font-medium text-zinc-200">{formatDate(health.lastBotStartAt)}</span>
      </div>

      <div className="hidden md:flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/80 px-2.5 py-1 text-zinc-400">
        <span>{adminUz.health.lastEvent}:</span>
        <span className="font-medium text-zinc-200">{formatDate(health.lastEventAt)}</span>
      </div>
    </div>
  );
}
