"use client";

import type { DropoffStat } from "@funnel/shared";
import { adminUz } from "@/lib/i18n/admin";

export function DropoffBars({ dropoff }: { dropoff: DropoffStat[] }) {
  return (
    <div className="bg-white rounded-[16px] p-5 sm:p-6 flex flex-col gap-4">
      <div>
        <h2 className="text-[18px] font-semibold text-siyoh m-0">
          {adminUz.dropoff.title}
        </h2>
        <p className="text-xs text-qalam mt-1 m-0">
          {adminUz.dropoff.subtitle}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {dropoff.map((item) => (
          <div key={item.percent} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-siyoh">
                {item.percent}% video
              </span>
              <div className="flex items-center gap-3">
                <span className="text-qalam">
                  {item.count} {adminUz.dropoff.countHeader.toLowerCase()}
                </span>
                <span className="font-semibold text-siyoh w-12 text-right tabular-nums">
                  {item.share}%
                </span>
              </div>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-[4px] bg-varaq">
              <div
                className="h-full rounded-[4px] bg-siyoh transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(0, item.share))}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
