"use client";

import type { VideoReportRow } from "@funnel/shared";
import { Badge } from "@/components/admin/ui/Badge";
import { Section } from "@/components/admin/ui/Section";
import { type StatColumn, StatTable } from "@/components/admin/ui/StatTable";
import { adminUz } from "@/lib/i18n/admin";
import { MetricValue } from "./ReportMetricCell";

const copy = adminUz.reports;

const columns: StatColumn<VideoReportRow>[] = [
  {
    key: "video",
    label: copy.videos.video,
    mobile: "title",
    render: (row) => (
      <span className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 break-words font-semibold">{row.title}</span>
        {row.isActive && <Badge tone="success">{copy.videos.active}</Badge>}
        {!row.isActive && row.archived && <Badge>{copy.videos.archived}</Badge>}
      </span>
    ),
  },
  { key: "given", label: copy.videos.given, align: "right", render: (row) => <span className="font-semibold">{row.given}</span> },
  { key: "opened", label: copy.videos.opened, align: "right", render: (row) => <MetricValue count={row.opened} base={row.given} /> },
  { key: "leftEarly", label: copy.videos.leftEarly, align: "right", render: (row) => <MetricValue count={row.leftEarly} base={row.given} /> },
  { key: "reachedCourse", label: copy.videos.reachedCourse, align: "right", render: (row) => <MetricValue count={row.reachedCourse} base={row.given} /> },
  { key: "reachedPrice", label: copy.videos.reachedPrice, align: "right", render: (row) => <MetricValue count={row.reachedPrice} base={row.given} /> },
  { key: "offerWatched", label: copy.videos.offerWatched, align: "right", render: (row) => <MetricValue count={row.offerWatched} base={row.given} /> },
  { key: "wroteAdmin", label: copy.videos.wroteAdmin, align: "right", render: (row) => <MetricValue count={row.wroteAdmin} base={row.given} /> },
];

export function VideoReportTable({ rows }: { rows: VideoReportRow[] }) {
  return (
    <Section title={copy.videos.title} description={`${copy.videos.subtitle} ${copy.baseNote}`}>
      <StatTable columns={columns} rows={rows} rowKey={(row) => row.videoId} empty={copy.empty} />
    </Section>
  );
}
