"use client";

import type { AdminLeadsResponse } from "@funnel/shared";
import { getLeadsCsvUrl } from "@/lib/admin/api";
import { adminUz } from "@/lib/i18n/admin";

type LeadsTableProps = {
  data: AdminLeadsResponse;
  from: string;
  to: string;
  source: string;
  campaign: string;
  onPageChange: (newPage: number) => void;
};

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tashkent",
      year: "numeric",
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

export function LeadsTable({
  data,
  from,
  to,
  source,
  campaign,
  onPageChange,
}: LeadsTableProps) {
  const csvUrl = getLeadsCsvUrl({ from, to, source, campaign });

  return (
    <div className="bg-white rounded-[16px] p-5 sm:p-6 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-semibold text-siyoh m-0">
            {adminUz.leads.title}
          </h2>
          <p className="text-xs text-qalam mt-0.5 m-0">
            {data.total} {adminUz.leads.total} ({adminUz.leads.page} {data.page} / {data.totalPages})
          </p>
        </div>

        <a
          href={csvUrl}
          download="leads.csv"
          className="inline-flex items-center gap-1.5 rounded-[10px] bg-oltin px-3.5 py-1.5 text-xs font-semibold text-siyoh hover:opacity-95 transition no-underline"
        >
          <span>{adminUz.leads.exportCsv}</span>
        </a>
      </div>

      <div className="overflow-x-auto -mx-5 sm:mx-0">
        <div className="inline-block min-w-full align-middle px-5 sm:px-0">
          <table className="min-w-full text-left">
            <thead>
              <tr className="text-[13px] text-qalam border-b border-chiziq">
                <th scope="col" className="py-2.5 pr-3 font-normal">
                  {adminUz.leads.registeredAt}
                </th>
                <th scope="col" className="px-3 py-2.5 font-normal">
                  {adminUz.leads.name}
                </th>
                <th scope="col" className="px-3 py-2.5 font-normal">
                  {adminUz.leads.phone}
                </th>
                <th scope="col" className="px-3 py-2.5 font-normal">
                  {adminUz.leads.username}
                </th>
                <th scope="col" className="px-3 py-2.5 font-normal">
                  {adminUz.leads.source}
                </th>
                <th scope="col" className="px-3 py-2.5 font-normal">
                  {adminUz.leads.campaign}
                </th>
                <th scope="col" className="px-3 py-2.5 font-normal text-right">
                  {adminUz.leads.progress}
                </th>
                <th scope="col" className="px-3 py-2.5 font-normal text-center">
                  {adminUz.leads.completed}
                </th>
                <th scope="col" className="pl-3 py-2.5 font-normal text-center">
                  {adminUz.leads.channelClicked}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-chiziq text-[14px] text-siyoh">
              {data.leads.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-qalam">
                    {adminUz.leads.empty}
                  </td>
                </tr>
              ) : (
                data.leads.map((lead) => (
                  <tr key={lead.id}>
                    <td className="py-2.5 pr-3 text-qalam whitespace-nowrap tabular-nums text-xs">
                      {formatDate(lead.registeredAt)}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-siyoh whitespace-nowrap">
                      {lead.name || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-siyoh tabular-nums whitespace-nowrap">
                      {lead.phone || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-qalam whitespace-nowrap text-xs">
                      {lead.username ? `@${lead.username.replace(/^@/, "")}` : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-qalam whitespace-nowrap">
                      {lead.source || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-qalam whitespace-nowrap">
                      {lead.campaign || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold text-siyoh tabular-nums whitespace-nowrap">
                      {lead.progressPercent}%
                    </td>
                    <td className="px-3 py-2.5 text-center whitespace-nowrap">
                      <span
                        className={`text-xs ${
                          lead.completed ? "font-semibold text-zumrad" : "text-qalam"
                        }`}
                      >
                        {lead.completed ? adminUz.leads.yes : adminUz.leads.no}
                      </span>
                    </td>
                    <td className="pl-3 py-2.5 text-center whitespace-nowrap">
                      <span
                        className={`text-xs ${
                          lead.channelClicked ? "font-semibold text-zumrad" : "text-qalam"
                        }`}
                      >
                        {lead.channelClicked ? adminUz.leads.yes : adminUz.leads.no}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {data.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-chiziq pt-3 text-xs">
          <div className="text-qalam">
            {adminUz.leads.page} <span className="font-medium text-siyoh tabular-nums">{data.page}</span>{" "}
            {adminUz.leads.of} <span className="font-medium text-siyoh tabular-nums">{data.totalPages}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={data.page <= 1}
              onClick={() => onPageChange(data.page - 1)}
              className="rounded-[8px] border border-chegara bg-white px-3 py-1.5 text-siyoh hover:bg-varaq disabled:opacity-40 transition"
            >
              {adminUz.leads.prev}
            </button>
            <button
              type="button"
              disabled={data.page >= data.totalPages}
              onClick={() => onPageChange(data.page + 1)}
              className="rounded-[8px] border border-chegara bg-white px-3 py-1.5 text-siyoh hover:bg-varaq disabled:opacity-40 transition"
            >
              {adminUz.leads.next}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
