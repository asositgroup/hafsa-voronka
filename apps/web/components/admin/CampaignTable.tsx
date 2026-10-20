"use client";

import type { CampaignStat } from "@funnel/shared";
import { Section } from "@/components/admin/ui/Section";
import { type StatColumn, StatTable } from "@/components/admin/ui/StatTable";
import { adminUz } from "@/lib/i18n/admin";

const copy = adminUz.campaigns;

const dash = (value: string | null | undefined) => value || "—";

const columns: StatColumn<CampaignStat>[] = [
  { key: "source", label: copy.source, mobile: "title", render: (row) => <span className="font-semibold">{dash(row.source)}</span> },
  { key: "campaign", label: copy.campaign, render: (row) => <span className="text-qalam">{dash(row.campaign)}</span> },
  { key: "content", label: copy.content, render: (row) => <span className="text-qalam">{dash(row.content)}</span> },
  { key: "botStarts", label: copy.botStarts, align: "right", render: (row) => row.botStarts },
  { key: "registrations", label: copy.registrations, align: "right", render: (row) => row.registrations },
  { key: "completionRate", label: copy.completionRate, align: "right", render: (row) => <span className="text-zumrad">{row.completionRate}%</span> },
  { key: "channelClicks", label: copy.channelClicks, align: "right", render: (row) => row.channelClicks },
];

export function CampaignTable({ campaigns }: { campaigns: CampaignStat[] }) {
  return (
    <Section title={copy.title}>
      <StatTable columns={columns} rows={campaigns} rowKey={(row) => `${row.source}|${row.campaign}|${row.content}`} empty={copy.empty} />
    </Section>
  );
}
