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
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-100">
            {adminUz.leads.title}
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            {data.total} {adminUz.leads.total} ({adminUz.leads.page} {data.page} / {data.totalPages})
          </p>
        </div>

        <a
          href={csvUrl}
          download="leads.csv"
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-700/60 bg-emerald-950/40 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-900/50 hover:text-emerald-200 transition"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          <span>{adminUz.leads.exportCsv}</span>
        </a>
      </div>

      <div className="overflow-x-auto -mx-4 sm:mx-0">
        <div className="inline-block min-w-full align-middle px-4 sm:px-0">
          <table className="min-w-full divide-y divide-zinc-800 text-left text-xs">
            <thead>
              <tr className="text-zinc-400">
                <th scope="col" className="py-2.5 pr-3 font-medium">
                  {adminUz.leads.registeredAt}
                </th>
                <th scope="col" className="px-3 py-2.5 font-medium">
                  {adminUz.leads.name}
                </th>
                <th scope="col" className="px-3 py-2.5 font-medium">
                  {adminUz.leads.phone}
                </th>
                <th scope="col" className="px-3 py-2.5 font-medium">
                  {adminUz.leads.username}
                </th>
                <th scope="col" className="px-3 py-2.5 font-medium">
                  {adminUz.leads.source}
                </th>
                <th scope="col" className="px-3 py-2.5 font-medium">
                  {adminUz.leads.campaign}
                </th>
                <th scope="col" className="px-3 py-2.5 font-medium">
                  {adminUz.leads.progress}
                </th>
                <th scope="col" className="px-3 py-2.5 font-medium text-center">
                  {adminUz.leads.completed}
                </th>
                <th scope="col" className="pl-3 py-2.5 font-medium text-center">
                  {adminUz.leads.channelClicked}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-zinc-200">
              {data.leads.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-zinc-500">
                    {adminUz.leads.empty}
                  </td>
                </tr>
              ) : (
                data.leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-zinc-800/30 transition">
                    <td className="py-2.5 pr-3 text-zinc-400 whitespace-nowrap">
                      {formatDate(lead.registeredAt)}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-white whitespace-nowrap">
                      {lead.name || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-zinc-300 font-mono whitespace-nowrap">
                      {lead.phone || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-zinc-400 whitespace-nowrap">
                      {lead.username ? `@${lead.username.replace(/^@/, "")}` : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-zinc-400 whitespace-nowrap">
                      {lead.source || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-zinc-400 whitespace-nowrap">
                      {lead.campaign || "—"}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-14 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                          <div
                            className="h-full bg-indigo-500 rounded-full"
                            style={{ width: `${lead.progressPercent}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-medium text-zinc-300">
                          {lead.progressPercent}%
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center whitespace-nowrap">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          lead.completed
                            ? "bg-emerald-950 text-emerald-400 border border-emerald-800/60"
                            : "bg-zinc-800 text-zinc-500"
                        }`}
                      >
                        {lead.completed ? adminUz.leads.yes : adminUz.leads.no}
                      </span>
                    </td>
                    <td className="pl-3 py-2.5 text-center whitespace-nowrap">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          lead.channelClicked
                            ? "bg-emerald-950 text-emerald-400 border border-emerald-800/60"
                            : "bg-zinc-800 text-zinc-500"
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
        <div className="flex items-center justify-between border-t border-zinc-800/80 pt-4 mt-3 text-xs">
          <div className="text-zinc-400">
            {adminUz.leads.page} <span className="font-medium text-white">{data.page}</span>{" "}
            {adminUz.leads.of} <span className="font-medium text-white">{data.totalPages}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={data.page <= 1}
              onClick={() => onPageChange(data.page - 1)}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-zinc-300 hover:bg-zinc-700 disabled:opacity-40 transition"
            >
              {adminUz.leads.prev}
            </button>
            <button
              type="button"
              disabled={data.page >= data.totalPages}
              onClick={() => onPageChange(data.page + 1)}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-zinc-300 hover:bg-zinc-700 disabled:opacity-40 transition"
            >
              {adminUz.leads.next}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
