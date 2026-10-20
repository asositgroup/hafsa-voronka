"use client";

import type { SecondChanceReport as SecondChanceReportData } from "@funnel/shared";
import { Section } from "@/components/admin/ui/Section";
import { type StatColumn, StatTable } from "@/components/admin/ui/StatTable";
import { adminUz } from "@/lib/i18n/admin";
import { MetricValue } from "./ReportMetricCell";

const copy = adminUz.reports;

type Row = SecondChanceReportData & { key: "offers" };

const columns: StatColumn<Row>[] = [
  { key: "row", label: copy.secondChance.title, mobile: "title", render: () => <span className="font-semibold">{copy.secondChance.row}</span> },
  { key: "offered", label: copy.secondChance.offered, align: "right", render: (row) => <span className="font-semibold">{row.offered}</span> },
  { key: "again", label: copy.secondChance.again, align: "right", render: (row) => <MetricValue count={row.again} base={row.offered} /> },
  { key: "later", label: copy.secondChance.later, align: "right", render: (row) => <MetricValue count={row.later} base={row.offered} /> },
  { key: "reopened", label: copy.secondChance.reopened, align: "right", render: (row) => <MetricValue count={row.reopened} base={row.offered} /> },
  {
    key: "reachedPrice",
    label: copy.secondChance.reachedPrice,
    align: "right",
    render: (row) => <MetricValue count={row.reachedPrice} base={row.offered} />,
  },
];

export function SecondChanceReport({ data }: { data: SecondChanceReportData }) {
  const rows: Row[] = data.offered > 0 ? [{ ...data, key: "offers" }] : [];
  return (
    <Section title={copy.secondChance.title} description={copy.secondChance.subtitle}>
      <StatTable columns={columns} rows={rows} rowKey={(row) => row.key} empty={copy.empty} />
    </Section>
  );
}
