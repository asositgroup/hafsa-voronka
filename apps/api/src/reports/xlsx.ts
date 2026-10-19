import writeExcelFile, { type Cell, type Row } from "write-excel-file/node";
import { reportPercent, type AdminReportResponse } from "@funnel/shared";
import { reportLabels } from "./labels";

const HEADER_STYLE = { fontWeight: "bold" } as const;

function formatDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${day}.${month}.${year}`;
}

function header(label: string): Cell {
  return { type: String, value: label, ...HEADER_STYLE };
}

function count(value: number | null): Cell {
  return value === null ? reportLabels.noValue : { type: Number, value };
}

function percent(value: number | null, base: number): Cell {
  const pct = reportPercent(value, base);
  return pct === null ? reportLabels.noValue : { type: Number, value: pct / 100, format: "0.0%" };
}

function countWithPercent(value: number | null, base: number): Cell[] {
  return [count(value), percent(value, base)];
}

function titleRow(report: AdminReportResponse): Row {
  return [{ type: String, value: `${reportLabels.period}: ${formatDate(report.from)} – ${formatDate(report.to)}`, ...HEADER_STYLE }];
}

function videoStatus(row: AdminReportResponse["videos"][number]): string {
  if (row.isActive) return reportLabels.status.active;
  if (row.archived) return reportLabels.status.archived;
  return reportLabels.status.none;
}

export async function buildReportWorkbook(report: AdminReportResponse): Promise<Buffer> {
  const v = reportLabels.videoColumns;
  const m = reportLabels.messageColumns;

  const videoData: Row[] = [
    titleRow(report),
    [
      header(v.video),
      header(v.status),
      header(v.given),
      header(v.opened),
      header(`${v.opened} ${v.percent}`),
      header(v.leftEarly),
      header(v.percent),
      header(v.reachedCourse),
      header(v.percent),
      header(v.reachedPrice),
      header(v.percent),
      header(v.offerWatched),
      header(v.percent),
      header(v.wroteAdmin),
      header(v.percent),
    ],
    ...report.videos.map((row): Row => [
      row.title,
      videoStatus(row),
      count(row.given),
      ...countWithPercent(row.opened, row.given),
      ...countWithPercent(row.leftEarly, row.given),
      ...countWithPercent(row.reachedCourse, row.given),
      ...countWithPercent(row.reachedPrice, row.given),
      ...countWithPercent(row.offerWatched, row.given),
      ...countWithPercent(row.wroteAdmin, row.given),
    ]),
  ];

  const messageData: Row[] = [
    titleRow(report),
    [
      header(m.segment),
      header(m.day),
      header(m.position),
      header(m.message),
      header(m.sent),
      header(m.clicked),
      header(m.percent),
      header(m.priceAfter),
      header(m.percent),
      header(m.adminAfter),
      header(m.percent),
      header(m.clickedPriceAfter),
      header(m.percent),
      header(m.clickedAdminAfter),
      header(m.percent),
    ],
    ...report.messages.map((row): Row => [
      row.segment,
      count(row.day),
      count(row.position + 1),
      row.deleted ? `${reportLabels.deletedPrefix}${row.preview}` : row.preview,
      count(row.sent),
      ...countWithPercent(row.clicked, row.sent),
      ...countWithPercent(row.priceAfter, row.sent),
      ...countWithPercent(row.adminAfter, row.sent),
      ...countWithPercent(row.clickedPriceAfter, row.clicked),
      ...countWithPercent(row.clickedAdminAfter, row.clicked),
    ]),
  ];

  return writeExcelFile(
    [
      {
        sheet: reportLabels.videoSheet,
        data: videoData,
        columns: [{ width: 28 }, { width: 10 }, ...Array.from({ length: 13 }, () => ({ width: 14 }))],
        stickyRowsCount: 2,
      },
      {
        sheet: reportLabels.messageSheet,
        data: messageData,
        columns: [{ width: 10 }, { width: 6 }, { width: 8 }, { width: 44 }, ...Array.from({ length: 11 }, () => ({ width: 14 }))],
        stickyRowsCount: 2,
      },
    ],
  ).toBuffer();
}
