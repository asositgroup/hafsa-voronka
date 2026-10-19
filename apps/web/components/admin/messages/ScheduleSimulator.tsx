"use client";

import { useEffect, useState } from "react";
import {
  type FunnelSegment,
  type MessageTemplate,
  plainTextPreview,
  renderPlainText,
  SAMPLE_CONTEXT,
  type SchedulePreview,
  TASHKENT_OFFSET_MS,
  variableValues,
} from "@funnel/shared";
import { Badge, type BadgeTone } from "@/components/admin/ui/Badge";
import { Disclosure } from "@/components/admin/ui/Disclosure";
import { Field } from "@/components/admin/ui/Field";
import { Notice } from "@/components/admin/ui/Notice";
import { LoadingState } from "@/components/admin/ui/States";
import { formatTime, TimePicker } from "@/components/admin/ui/TimePicker";
import { previewSchedule } from "@/lib/admin/messages";
import { adminUz } from "@/lib/i18n/admin";

const copy = adminUz.messages.simulator;
const DAY_MS = 86_400_000;
const DEFAULT_GIVEN_MINUTE = 10 * 60;

type PreviewKind = SchedulePreview["items"][number]["kind"];

const kindTone: Record<PreviewKind, BadgeTone | null> = {
  regular: null,
  collapsed: "attention",
  night_notice: "success",
  swallowed: "neutral",
  dropped: "danger",
};

function localDay(ms: number) {
  return Math.floor((ms + TASHKENT_OFFSET_MS) / DAY_MS);
}

function localMinute(ms: number) {
  return Math.floor((((ms + TASHKENT_OFFSET_MS) % DAY_MS) + DAY_MS) % DAY_MS / 60_000);
}

function givenAtIso(minute: number) {
  const today = localDay(Date.now()) * DAY_MS;
  return new Date(today + minute * 60_000 - TASHKENT_OFFSET_MS).toISOString();
}

function dayWord(offset: number) {
  if (offset === 0) return copy.today;
  if (offset === 1) return copy.tomorrow;
  return copy.dayN.replace("{n}", String(offset + 1));
}

function moment(iso: string, baseDay: number) {
  const ms = new Date(iso).getTime();
  return `${dayWord(localDay(ms) - baseDay)} ${formatTime(localMinute(ms))}`;
}

type ScheduleSimulatorProps = { segment: FunnelSegment; items: MessageTemplate[] };

export function ScheduleSimulator({ segment, items }: ScheduleSimulatorProps) {
  const [open, setOpen] = useState(false);
  const [givenMinute, setGivenMinute] = useState(DEFAULT_GIVEN_MINUTE);
  const [preview, setPreview] = useState<{ key: string; data: SchedulePreview | null } | null>(null);

  const signature = items.map((item) => `${item.id}:${item.updatedAt}:${item.isActive}`).join(",");
  const requestKey = `${segment}|${givenMinute}|${signature}`;

  useEffect(() => {
    if (!open) return;
    let active = true;
    void previewSchedule(segment, givenAtIso(givenMinute)).then((result) => {
      if (active) setPreview({ key: requestKey, data: result.ok ? result.data : null });
    });
    return () => {
      active = false;
    };
  }, [open, segment, givenMinute, requestKey]);

  const current = preview?.key === requestKey ? preview : null;
  const byId = new Map(items.map((item) => [item.id, item]));
  const data = current?.data ?? null;
  const baseDay = data ? localDay(new Date(data.linkGivenAt).getTime()) : 0;

  return (
    <Disclosure title={copy.title} summary={copy.summary} open={open} onOpenChange={setOpen}>
      <div className="flex flex-col gap-3">
        <Field label={copy.givenAt} className="w-44">
          {({ id }) => <TimePicker id={id} value={givenMinute} onChange={setGivenMinute} />}
        </Field>

        {!current && <LoadingState variant="list" rows={3} />}
        {current && !data && <Notice tone="danger">{copy.failed}</Notice>}
        {data && (
          <>
            <p className="m-0 text-[13px] text-qalam">
              {copy.expiresAt.replace("{time}", moment(data.linkExpiresAt, baseDay))}
              {data.extended && ` (${copy.extended})`}
            </p>
            {data.items.length === 0 ? (
              <p className="m-0 text-sm text-qalam">{copy.empty}</p>
            ) : (
              <ul className="m-0 flex list-none flex-col divide-y divide-chiziq rounded-[12px] bg-varaq p-0">
                {data.items.map((row) => {
                  const template = byId.get(row.templateId);
                  const skipped = row.kind === "swallowed" || row.kind === "dropped";
                  const tone = kindTone[row.kind];
                  return (
                    <li key={`${row.templateId}:${row.at}`} className={`flex items-start gap-3 px-3 py-2 ${skipped ? "opacity-60" : ""}`}>
                      <span
                        className={`w-[6.5rem] shrink-0 pt-px text-[13px] font-semibold tabular-nums text-siyoh ${skipped ? "line-through" : ""}`}
                      >
                        {moment(row.at, baseDay)}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="line-clamp-2 text-sm text-siyoh">
                          {template
                            ? renderPlainText(
                                plainTextPreview(template.text, 120),
                                variableValues({
                                  ...SAMPLE_CONTEXT,
                                  linkExpiresAt: new Date(data.linkExpiresAt),
                                  now: new Date(row.at),
                                }),
                              )
                            : ""}
                        </span>
                        <span className="flex flex-wrap items-center gap-2 text-xs text-qalam">
                          {tone && <Badge tone={tone}>{copy.kinds[row.kind]}</Badge>}
                          <span className="tabular-nums">
                            {row.kind === "night_notice"
                              ? copy.noticeUntil.replace("{time}", row.remaining)
                              : copy.remaining.replace("{time}", row.remaining)}
                          </span>
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </Disclosure>
  );
}
