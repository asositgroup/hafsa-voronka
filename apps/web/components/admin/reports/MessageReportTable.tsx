"use client";

import { Fragment } from "react";
import { funnelSegments, type MessageReportRow } from "@funnel/shared";
import { adminUz } from "@/lib/i18n/admin";
import { ReportMetricCell } from "./ReportMetricCell";

const copy = adminUz.reports;

const headerClass = "px-3 py-2.5 text-right font-normal whitespace-nowrap";

export function MessageReportTable({ rows }: { rows: MessageReportRow[] }) {
  return (
    <section className="flex flex-col gap-4 rounded-[16px] bg-white p-5 sm:p-6">
      <div>
        <h2 className="m-0 text-[18px] font-semibold text-siyoh">{copy.messages.title}</h2>
        <p className="m-0 mt-1 text-[13px] text-qalam">
          {copy.messages.subtitle}. {copy.baseNote}. {copy.clickedBaseNote}
        </p>
      </div>

      <div className="overflow-x-auto -mx-5 sm:mx-0">
        <table className="min-w-[720px] w-full text-left">
          <thead>
            <tr className="border-b border-chiziq text-[13px] text-qalam">
              <th scope="col" className="sticky left-0 bg-white py-2.5 pl-5 pr-3 font-normal sm:pl-0">
                {copy.messages.message}
              </th>
              <th scope="col" className={headerClass}>{copy.messages.sent}</th>
              <th scope="col" className={headerClass}>{copy.messages.clicked}</th>
              <th scope="col" className={headerClass}>{copy.messages.priceAfter}</th>
              <th scope="col" className={headerClass}>{copy.messages.adminAfter}</th>
              <th scope="col" className={headerClass}>{copy.messages.clickedPriceAfter}</th>
              <th scope="col" className={headerClass}>{copy.messages.clickedAdminAfter}</th>
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
              funnelSegments.map((segment) => {
                const segmentRows = rows.filter((row) => row.segment === segment);
                if (segmentRows.length === 0) return null;
                return (
                  <Fragment key={segment}>
                    <tr>
                      <th
                        scope="colgroup"
                        colSpan={7}
                        className="bg-varaq py-2 pl-5 pr-3 text-left text-[13px] font-semibold text-siyoh sm:pl-3"
                      >
                        {copy.messages.segments[segment]}
                      </th>
                    </tr>
                    {segmentRows.map((row) => (
                      <tr key={row.templateId}>
                        <th scope="row" className="sticky left-0 bg-white py-2.5 pl-5 pr-3 text-left font-normal sm:pl-0">
                          <span className="block whitespace-nowrap font-medium">
                            {copy.messages.day.replace("{n}", String(row.day))} · #{row.position + 1}
                          </span>
                          <span className="block max-w-[200px] truncate text-[12px] text-qalam">
                            {row.deleted ? `(${copy.messages.deleted}) ` : ""}
                            {row.preview}
                          </span>
                        </th>
                        <td className="px-3 py-2.5 text-right text-[16px] font-semibold tabular-nums">{row.sent}</td>
                        <ReportMetricCell count={row.clicked} base={row.sent} />
                        <ReportMetricCell count={row.priceAfter} base={row.sent} />
                        <ReportMetricCell count={row.adminAfter} base={row.sent} />
                        <ReportMetricCell count={row.clickedPriceAfter} base={row.clicked} />
                        <ReportMetricCell count={row.clickedAdminAfter} base={row.clicked} />
                      </tr>
                    ))}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
