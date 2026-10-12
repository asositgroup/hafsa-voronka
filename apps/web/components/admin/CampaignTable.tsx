"use client";

import type { CampaignStat } from "@funnel/shared";
import { adminUz } from "@/lib/i18n/admin";

export function CampaignTable({ campaigns }: { campaigns: CampaignStat[] }) {
  return (
    <div className="bg-white rounded-[16px] p-5 sm:p-6 flex flex-col gap-4">
      <h2 className="text-[18px] font-semibold text-siyoh m-0">
        {adminUz.campaigns.title}
      </h2>

      <div className="overflow-x-auto -mx-5 sm:mx-0">
        <div className="inline-block min-w-full align-middle px-5 sm:px-0">
          <table className="min-w-full text-left">
            <thead>
              <tr className="text-[13px] text-qalam border-b border-chiziq">
                <th scope="col" className="py-2.5 pr-3 font-normal">
                  {adminUz.campaigns.source}
                </th>
                <th scope="col" className="px-3 py-2.5 font-normal">
                  {adminUz.campaigns.campaign}
                </th>
                <th scope="col" className="px-3 py-2.5 font-normal">
                  {adminUz.campaigns.content}
                </th>
                <th scope="col" className="px-3 py-2.5 font-normal text-right">
                  {adminUz.campaigns.botStarts}
                </th>
                <th scope="col" className="px-3 py-2.5 font-normal text-right">
                  {adminUz.campaigns.registrations}
                </th>
                <th scope="col" className="px-3 py-2.5 font-normal text-right">
                  {adminUz.campaigns.completionRate}
                </th>
                <th scope="col" className="pl-3 py-2.5 font-normal text-right">
                  {adminUz.campaigns.channelClicks}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-chiziq text-[14px] text-siyoh">
              {campaigns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-qalam">
                    {adminUz.campaigns.empty}
                  </td>
                </tr>
              ) : (
                campaigns.map((row, idx) => (
                  <tr key={idx}>
                    <td className="py-2.5 pr-3 font-medium text-siyoh whitespace-nowrap">
                      {row.source || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-qalam whitespace-nowrap">
                      {row.campaign || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-qalam whitespace-nowrap">
                      {row.content || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium tabular-nums whitespace-nowrap">
                      {row.botStarts}
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium text-siyoh tabular-nums whitespace-nowrap">
                      {row.registrations}
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold text-zumrad tabular-nums whitespace-nowrap">
                      {row.completionRate}%
                    </td>
                    <td className="pl-3 py-2.5 text-right font-medium text-siyoh tabular-nums whitespace-nowrap">
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
