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
    <div className="flex flex-wrap items-center gap-4 text-xs text-qalam">
      <div className="flex items-center gap-1.5">
        <span
          className={`w-2 h-2 rotate-45 inline-block shrink-0 ${
            hasBacklog ? "bg-anor" : "bg-zumrad"
          }`}
        />
        <span>{adminUz.health.sheetsBacklog}:</span>
        <span className="font-semibold text-siyoh tabular-nums">{health.sheetsBacklog}</span>
      </div>

      <div className="flex items-center gap-1.5">
        <span
          className={`w-2 h-2 rotate-45 inline-block shrink-0 ${
            hasFailures ? "bg-anor" : "bg-zumrad"
          }`}
        />
        <span>{adminUz.health.sheetsFailures}:</span>
        <span className="font-semibold text-siyoh tabular-nums">{health.sheetsFailures}</span>
      </div>

      <div className="hidden sm:flex items-center gap-1.5">
        <span className="w-2 h-2 rotate-45 bg-zumrad inline-block shrink-0" />
        <span>{adminUz.health.lastBotStart}:</span>
        <span className="font-medium text-siyoh tabular-nums">{formatDate(health.lastBotStartAt)}</span>
      </div>

      <div className="hidden md:flex items-center gap-1.5">
        <span className="w-2 h-2 rotate-45 bg-zumrad inline-block shrink-0" />
        <span>{adminUz.health.lastEvent}:</span>
        <span className="font-medium text-siyoh tabular-nums">{formatDate(health.lastEventAt)}</span>
      </div>
    </div>
  );
}
