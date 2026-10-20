"use client";

import type { VideoReportRow } from "@funnel/shared";
import { useState } from "react";
import { FlowFunnel, type FlowStage } from "@/components/admin/FlowFunnel";
import { Disclosure } from "@/components/admin/ui/Disclosure";
import { Select } from "@/components/admin/ui/Select";
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

function defaultVideoId(rows: VideoReportRow[]) {
  const active = rows.find((row) => row.isActive);
  if (active) return active.videoId;
  return rows.reduce((best, row) => (row.given > best.given ? row : best), rows[0]).videoId;
}

function stagesOf(row: VideoReportRow): FlowStage[] {
  const stages: FlowStage[] = [
    { key: "given", label: copy.videos.given, count: row.given },
    { key: "opened", label: copy.videos.opened, count: row.opened },
  ];
  if (row.reachedCourse !== null) stages.push({ key: "reachedCourse", label: copy.videos.reachedCourse, count: row.reachedCourse });
  if (row.reachedPrice !== null) stages.push({ key: "reachedPrice", label: copy.videos.reachedPrice, count: row.reachedPrice });
  stages.push({ key: "wroteAdmin", label: copy.videos.wroteAdmin, count: row.wroteAdmin });
  return stages;
}

function optionLabel(row: VideoReportRow) {
  if (row.isActive) return `${row.title} (${copy.videos.active})`;
  if (row.archived) return `${row.title} (${copy.videos.archived})`;
  return row.title;
}

export function VideoReportTable({ rows }: { rows: VideoReportRow[] }) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [tableOpen, setTableOpen] = useState(false);

  const hasData = rows.some((row) => row.given > 0);
  const selected = rows.find((row) => row.videoId === selectedId) ?? (rows.length > 0 ? rows.find((row) => row.videoId === defaultVideoId(rows)) : undefined);

  return (
    <Section title={copy.videos.title} description={`${copy.videos.subtitle} ${copy.baseNote}`}>
      {!hasData || !selected ? (
        <p className="m-0 py-6 text-center text-sm text-qalam">{copy.empty}</p>
      ) : (
        <>
          {rows.length > 1 && (
            <Select
              aria-label={copy.videos.select}
              value={String(selected.videoId)}
              onValueChange={(value) => setSelectedId(Number(value))}
              options={rows.map((row) => ({ value: String(row.videoId), label: optionLabel(row) }))}
            />
          )}
          <div className="flex flex-col gap-2">
            {rows.length === 1 && (
              <p className="m-0 flex flex-wrap items-center gap-2 text-sm font-semibold text-siyoh">
                {selected.title}
                {selected.isActive && <Badge tone="success">{copy.videos.active}</Badge>}
              </p>
            )}
            <FlowFunnel bare compact title={selected.title} stages={stagesOf(selected)} />
            <div className="flex flex-col gap-0.5 text-[13px] text-qalam">
              {selected.leftEarly > 0 && (
                <p className="m-0 tabular-nums">{copy.videos.leftEarlyNote.replace("{n}", String(selected.leftEarly))}</p>
              )}
              {selected.offerWatched !== null && (
                <p className="m-0 tabular-nums">{copy.videos.offerWatchedNote.replace("{n}", String(selected.offerWatched))}</p>
              )}
            </div>
          </div>
        </>
      )}
      {rows.length > 0 && (
        <Disclosure title={copy.videos.table} summary={copy.videos.tableSummary} open={tableOpen} onOpenChange={setTableOpen}>
          <StatTable columns={columns} rows={rows} rowKey={(row) => row.videoId} empty={copy.empty} />
        </Disclosure>
      )}
    </Section>
  );
}
