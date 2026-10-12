"use client";

import type { DropoffStat } from "@funnel/shared";
import { adminUz } from "@/lib/i18n/admin";

export function DropoffBars({ dropoff }: { dropoff: DropoffStat[] }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 sm:p-5">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-zinc-100">
          {adminUz.dropoff.title}
        </h2>
        <p className="text-xs text-zinc-400 mt-0.5">
          {adminUz.dropoff.subtitle}
        </p>
      </div>

      <div className="space-y-2.5">
        {dropoff.map((item) => (
          <div key={item.percent} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-zinc-300">
                {item.percent}% video
              </span>
              <div className="flex items-center gap-3">
                <span className="text-zinc-400">
                  {item.count} {adminUz.dropoff.countHeader.toLowerCase()}
                </span>
                <span className="font-semibold text-indigo-400 w-12 text-right">
                  {item.share}%
                </span>
              </div>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, item.share))}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
