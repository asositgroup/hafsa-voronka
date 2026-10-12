"use client";

import type { KpiStats } from "@funnel/shared";
import { adminUz } from "@/lib/i18n/admin";

function formatNumber(num: number): string {
  return new Intl.NumberFormat("uz-UZ").format(num);
}

export function KpiCards({ kpis }: { kpis: KpiStats }) {
  const cards = [
    {
      label: adminUz.kpis.landingViews,
      value: formatNumber(kpis.landingViews),
      color: "text-blue-400",
      bg: "bg-blue-500/10",
      border: "border-blue-500/20",
    },
    {
      label: adminUz.kpis.botStarts,
      value: formatNumber(kpis.botStarts),
      color: "text-sky-400",
      bg: "bg-sky-500/10",
      border: "border-sky-500/20",
    },
    {
      label: adminUz.kpis.registrations,
      value: formatNumber(kpis.registrations),
      color: "text-indigo-400",
      bg: "bg-indigo-500/10",
      border: "border-indigo-500/20",
    },
    {
      label: adminUz.kpis.completions,
      value: formatNumber(kpis.completions),
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
    },
    {
      label: adminUz.kpis.channelClicks,
      value: formatNumber(kpis.channelClicks),
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
    },
    {
      label: adminUz.kpis.conversionRate,
      value: `${kpis.conversionRate}%`,
      color: "text-violet-400",
      bg: "bg-violet-500/10",
      border: "border-violet-500/20",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
      {cards.map((card, i) => (
        <div
          key={i}
          className={`rounded-xl border ${card.border} ${card.bg} p-3.5 sm:p-4 backdrop-blur transition hover:scale-[1.01]`}
        >
          <div className="text-xs font-medium text-zinc-400 mb-1.5 truncate">
            {card.label}
          </div>
          <div className={`text-xl sm:text-2xl font-bold tracking-tight ${card.color}`}>
            {card.value}
          </div>
        </div>
      ))}
    </div>
  );
}
