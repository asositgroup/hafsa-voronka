"use client";

import { funnelSegments, type MessageReportRow, SECOND_CHANCE_SEGMENT } from "@funnel/shared";
import { Badge } from "@/components/admin/ui/Badge";
import { Section } from "@/components/admin/ui/Section";
import { type StatColumn, StatTable } from "@/components/admin/ui/StatTable";
import { adminUz } from "@/lib/i18n/admin";
import { MetricValue } from "./ReportMetricCell";

const copy = adminUz.reports;

const columns: StatColumn<MessageReportRow>[] = [
  {
    key: "message",
    label: copy.messages.message,
    mobile: "title",
    render: (row) => (
      <span className="block min-w-0">
        <span className="flex flex-wrap items-center gap-2 font-semibold">
          {(row.segment === SECOND_CHANCE_SEGMENT ? copy.messages.rowTitleOccasion : copy.messages.rowTitle)
            .replace("{day}", String(row.day))
            .replace("{n}", String(row.position + 1))}
          {row.deleted && <Badge tone="danger">{copy.messages.deleted}</Badge>}
        </span>
        <span className="mt-0.5 block max-w-[240px] truncate text-xs font-normal text-qalam">{row.preview}</span>
      </span>
    ),
  },
  { key: "sent", label: copy.messages.sent, align: "right", render: (row) => <span className="font-semibold">{row.sent}</span> },
  { key: "clicked", label: copy.messages.clicked, align: "right", render: (row) => <MetricValue count={row.clicked} base={row.sent} /> },
  { key: "priceAfter", label: copy.messages.priceAfter, align: "right", render: (row) => <MetricValue count={row.priceAfter} base={row.sent} /> },
  { key: "adminAfter", label: copy.messages.adminAfter, align: "right", render: (row) => <MetricValue count={row.adminAfter} base={row.sent} /> },
  {
    key: "clickedPriceAfter",
    label: copy.messages.clickedPriceAfter,
    align: "right",
    render: (row) => <MetricValue count={row.clickedPriceAfter} base={row.clicked} />,
  },
  {
    key: "clickedAdminAfter",
    label: copy.messages.clickedAdminAfter,
    align: "right",
    render: (row) => <MetricValue count={row.clickedAdminAfter} base={row.clicked} />,
  },
];

export function MessageReportTable({ rows }: { rows: MessageReportRow[] }) {
  const groups = funnelSegments
    .map((segment) => ({
      label: adminUz.segments[segment].label,
      rows: rows.filter((row) => row.segment === segment),
    }))
    .filter((group) => group.rows.length > 0);

  return (
    <Section title={copy.messages.title} description={`${copy.messages.subtitle} ${copy.baseNote} ${copy.clickedBaseNote}`}>
      <StatTable columns={columns} rows={rows} groups={groups} rowKey={(row) => row.templateId} empty={copy.empty} />
    </Section>
  );
}
