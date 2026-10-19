"use client";

import type { VideoReportRow } from "@funnel/shared";
import { adminUz } from "@/lib/i18n/admin";
import { ReportMetricCell } from "./ReportMetricCell";

const copy = adminUz.reports;

const headerClass = "px-3 py-2.5 text-right font-normal whitespace-nowrap";

export function VideoReportTable({ rows }: { rows: VideoReportRow[] }) {
  return (
    <section className="flex flex-col gap-4 rounded-[16px] bg-white p-5 sm:p-6">
      <div>
        <h2 className="m-0 text-[18px] font-semibold text-siyoh">{copy.videos.title}</h2>
        <p className="m-0 mt-1 text-[13px] text-qalam">
          {copy.videos.subtitle}. {copy.baseNote}
        </p>
      </div>

      <div className="overflow-x-auto -mx-5 sm:mx-0">
        <table className="min-w-[720px] w-full text-left">
          <thead>
            <tr className="border-b border-chiziq text-[13px] text-qalam">
              <th scope="col" className="sticky left-0 bg-white py-2.5 pl-5 pr-3 font-normal sm:pl-0">
                {copy.videos.video}
              </th>
              <th scope="col" className={headerClass}>{copy.videos.given}</th>
              <th scope="col" className={headerClass}>{copy.videos.opened}</th>
              <th scope="col" className={headerClass}>{copy.videos.leftEarly}</th>
              <th scope="col" className={headerClass}>{copy.videos.reachedCourse}</th>
              <th scope="col" className={headerClass}>{copy.videos.reachedPrice}</th>
              <th scope="col" className={headerClass}>{copy.videos.wroteAdmin}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-chiziq text-[14px] text-siyoh">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-qalam">
                  {copy.empty}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.videoId}>
                  <th scope="row" className="sticky left-0 bg-white py-2.5 pl-5 pr-3 text-left font-medium sm:pl-0">
                    <span className="block max-w-[180px] truncate">{row.title}</span>
                    {(row.isActive || row.archived) && (
                      <span className="block text-[12px] font-normal text-qalam">
                        {row.isActive ? copy.videos.active : copy.videos.archived}
                      </span>
                    )}
                  </th>
                  <td className="px-3 py-2.5 text-right text-[16px] font-semibold tabular-nums">{row.given}</td>
                  <ReportMetricCell count={row.opened} base={row.given} />
                  <ReportMetricCell count={row.leftEarly} base={row.given} />
                  <ReportMetricCell count={row.reachedCourse} base={row.given} />
                  <ReportMetricCell count={row.reachedPrice} base={row.given} />
                  <ReportMetricCell count={row.wroteAdmin} base={row.given} />
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
