"use client";

import type { CampaignStat } from "@funnel/shared";
import { adminUz } from "@/lib/i18n/admin";

export function CampaignTable({ campaigns }: { campaigns: CampaignStat[] }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 sm:p-5">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-zinc-100">
          {adminUz.campaigns.title}
        </h2>
      </div>

      <div className="overflow-x-auto -mx-4 sm:mx-0">
        <div className="inline-block min-w-full align-middle px-4 sm:px-0">
          <table className="min-w-full divide-y divide-zinc-800 text-left text-xs">
            <thead>
              <tr className="text-zinc-400">
                <th scope="col" className="py-2.5 pr-3 font-medium">
                  {adminUz.campaigns.source}
                </th>
                <th scope="col" className="px-3 py-2.5 font-medium">
                  {adminUz.campaigns.campaign}
                </th>
                <th scope="col" className="px-3 py-2.5 font-medium">
                  {adminUz.campaigns.content}
                </th>
                <th scope="col" className="px-3 py-2.5 font-medium text-right">
                  {adminUz.campaigns.botStarts}
                </th>
                <th scope="col" className="px-3 py-2.5 font-medium text-right">
                  {adminUz.campaigns.registrations}
                </th>
                <th scope="col" className="px-3 py-2.5 font-medium text-right">
                  {adminUz.campaigns.completionRate}
                </th>
                <th scope="col" className="pl-3 py-2.5 font-medium text-right">
                  {adminUz.campaigns.channelClicks}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-zinc-200">
              {campaigns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-zinc-500">
                    {adminUz.campaigns.empty}
                  </td>
                </tr>
              ) : (
                campaigns.map((row, idx) => (
                  <tr key={idx} className="hover:bg-zinc-800/30 transition">
                    <td className="py-2.5 pr-3 font-medium text-white whitespace-nowrap">
                      {row.source || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-zinc-300 whitespace-nowrap">
                      {row.campaign || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-zinc-400 whitespace-nowrap">
                      {row.content || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium whitespace-nowrap">
                      {row.botStarts}
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium text-indigo-400 whitespace-nowrap">
                      {row.registrations}
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[11px] ${
                          row.completionRate >= 50
                            ? "bg-emerald-950 text-emerald-400 border border-emerald-800/50"
                            : row.completionRate >= 20
                            ? "bg-amber-950 text-amber-400 border border-amber-800/50"
                            : "bg-zinc-800 text-zinc-400"
                        }`}
                      >
                        {row.completionRate}%
                      </span>
                    </td>
                    <td className="pl-3 py-2.5 text-right font-medium text-emerald-400 whitespace-nowrap">
                      {row.channelClicks}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
