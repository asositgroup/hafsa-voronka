"use client";

import type { FunnelStep } from "@funnel/shared";
import { adminUz } from "@/lib/i18n/admin";

export function FunnelChart({ funnel }: { funnel: FunnelStep[] }) {
  const maxCount = funnel.length > 0 ? Math.max(funnel[0].count, 1) : 1;

  return (
    <div className="bg-white rounded-[16px] p-5 sm:p-6 flex flex-col gap-3">
      <h2 className="text-[18px] font-semibold text-siyoh mb-1 m-0">
        {adminUz.funnel.title}
      </h2>

      <div className="flex flex-col gap-3 overflow-x-auto">
        <div className="min-w-[500px] flex flex-col gap-3">
          {funnel.map((step, i) => {
            const isComplete =
              step.step === "video_complete" || step.name.includes("Kanal ochildi");
            const widthPct = Math.max(0, Math.min(100, Math.round((step.count / maxCount) * 100)));

            return (
              <div
                key={step.step}
                className="grid grid-cols-[150px_minmax(0,1fr)_64px_52px] gap-3 items-center text-[14px]"
              >
                <span className="text-siyoh truncate font-medium">{step.name}</span>

                <div className="h-3.5 rounded-[4px] bg-varaq overflow-hidden">
                  <div
                    className={`h-3.5 rounded-[4px] transition-all duration-300 ${
                      isComplete ? "bg-oltin" : "bg-siyoh"
                    }`}
                    style={{ width: `${widthPct}%` }}
                  />
                </div>

                <span className="text-right font-semibold text-siyoh tabular-nums">
                  {new Intl.NumberFormat("uz-UZ").format(step.count)}
                </span>

                <span className="text-right text-qalam tabular-nums text-xs">
                  {i === 0 ? "" : `${step.conversionRate}%`}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
