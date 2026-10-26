"use client";

import Link from "next/link";
import { type FunnelSegment, funnelSegments, type MessageTemplate } from "@funnel/shared";
import { Badge } from "@/components/admin/ui/Badge";
import { ChevronRightIcon } from "@/components/icons";
import { adminUz } from "@/lib/i18n/admin";

const copy = adminUz.messages;

export function stageHref(segment: FunnelSegment) {
  return `/admin/messages?stage=${segment}`;
}

export function chainItems(items: MessageTemplate[]) {
  return items.filter((item) => item.timing.type !== "night_notice");
}

type StageStatus = { text: string; attention: boolean };

function stageStatus(segment: FunnelSegment, items: MessageTemplate[], linkTtlHours: number | null): StageStatus {
  const count = chainItems(items).length;
  if (count === 0) return { text: copy.stages.empty, attention: true };
  const parts = [copy.count.replace("{n}", String(count))];
  if (segment === "A" && linkTtlHours !== null) parts.push(copy.stages.linkOpen.replace("{n}", String(linkTtlHours)));
  return { text: parts.join(" · "), attention: false };
}

type StageOverviewProps = {
  items: Partial<Record<FunnelSegment, MessageTemplate[]>>;
  linkTtlHours: number | null;
};

export function StageOverview({ items, linkTtlHours }: StageOverviewProps) {
  return (
    <section aria-labelledby="stages-title" className="flex flex-col gap-3">
      <h2 id="stages-title" className="sr-only">
        {copy.stages.listTitle}
      </h2>
      <ol className="m-0 flex list-none flex-col gap-3 p-0">
        {funnelSegments.map((segment, index) => {
          const list = items[segment];
          const status = list ? stageStatus(segment, list, linkTtlHours) : null;
          return (
            <li key={segment}>
              <Link
                href={stageHref(segment)}
                className="flex items-center gap-3 rounded-[16px] bg-white p-4 no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-siyoh"
              >
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-varaq text-sm font-bold tabular-nums text-siyoh"
                >
                  {index + 1}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="sr-only">{copy.stages.step.replace("{n}", String(index + 1))}</span>
                  <span className="text-[15px] font-semibold leading-snug text-siyoh">{copy.stages.titles[segment]}</span>
                  {status === null ? (
                    <span className="text-[13px] text-qalam">…</span>
                  ) : status.attention ? (
                    <span>
                      <Badge tone="attention">{status.text}</Badge>
                    </span>
                  ) : (
                    <span className="text-[13px] tabular-nums text-qalam">{status.text}</span>
                  )}
                </span>
                <ChevronRightIcon className="h-5 w-5 text-qalam" />
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
