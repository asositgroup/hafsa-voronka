"use client";

import type { KpiStats } from "@funnel/shared";
import { ArrowRightIcon } from "@/components/icons";
import { adminUz } from "@/lib/i18n/admin";

function formatNumber(num: number): string {
  return new Intl.NumberFormat("uz-UZ").format(num);
}

export function KpiCards({ kpis }: { kpis: KpiStats }) {
  const items = [
    {
      label: adminUz.kpis.landingViews,
      value: formatNumber(kpis.landingViews),
      note: adminUz.kpis.landingNote,
    },
    {
      label: adminUz.kpis.botStarts,
      value: formatNumber(kpis.botStarts),
      note: adminUz.kpis.botNote,
    },
    {
      label: adminUz.kpis.registrations,
      value: formatNumber(kpis.registrations),
      note: adminUz.kpis.registrationNote,
    },
    {
      label: adminUz.kpis.completions,
      value: formatNumber(kpis.completions),
      note: adminUz.kpis.completionNote,
    },
    {
      label: (
        <span className="inline-flex items-center gap-1">
          {adminUz.kpis.conversionRate[0]}
          <ArrowRightIcon className="h-3.5 w-3.5" />
          {adminUz.kpis.conversionRate[1]}
        </span>
      ),
      value: `${kpis.conversionRate}%`,
      note: adminUz.kpis.conversionNote,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 bg-white rounded-[16px] overflow-hidden">
      {items.map((item, i) => (
        <div
          key={i}
          className={`px-5 py-4.5 flex flex-col gap-1 ${
            i > 0 ? "border-t sm:border-t-0 sm:border-l border-chiziq" : ""
          }`}
        >
          <span className="text-[14px] text-qalam">{item.label}</span>
          <span className="text-[30px] font-bold tracking-tight text-siyoh tabular-nums leading-tight">
            {item.value}
          </span>
          <span className="text-[13px] text-qalam">{item.note}</span>
        </div>
      ))}
    </div>
  );
}
