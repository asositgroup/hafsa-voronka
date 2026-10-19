"use client";

import {
  type FunnelSegment,
  type FunnelStatus,
  formatMmSs,
  type MessageTemplatesResponse,
  normalizeStatuses,
  segmentStatuses,
} from "@funnel/shared";
import { adminUz } from "@/lib/i18n/admin";

const copy = adminUz.messages.stopPoints;

export type VideoMarks = MessageTemplatesResponse["videoMarks"];

type StopPoint = keyof typeof copy.names;

function range(from: number | null, to: string | null): string | null {
  return from === null || to === null ? null : `${formatMmSs(from)}–${to}`;
}

function stopPointName(status: FunnelStatus): string {
  return copy.names[status as StopPoint] ?? status;
}

function stopPointSpan(status: FunnelStatus, marks: VideoMarks): string | null {
  const mark = (value: number | null | undefined) => (value == null ? null : formatMmSs(value));
  if (status === "korishni_boshladi") return range(0, mark(marks?.introEndSec));
  if (status === "dars_yarmida") return range(marks?.introEndSec ?? null, mark(marks?.courseStartSec));
  if (status === "sotuvda_toxtadi") return range(marks?.courseStartSec ?? null, copy.price);
  return null;
}

export function stopPointLabel(status: FunnelStatus, marks: VideoMarks): string {
  return stopPointSpan(status, marks) ?? stopPointName(status);
}

type StopPointPickerProps = {
  segment: FunnelSegment;
  value: FunnelStatus[] | null;
  marks: VideoMarks;
  onChange: (value: FunnelStatus[] | null) => void;
};

export function StopPointPicker({ segment, value, marks, onChange }: StopPointPickerProps) {
  const options = segmentStatuses[segment];

  function toggle(status: FunnelStatus) {
    const current = value ?? [];
    const next = current.includes(status) ? current.filter((entry) => entry !== status) : [...current, status];
    onChange(next.length === 0 ? null : normalizeStatuses(segment, next));
  }

  const chip = (pressed: boolean) =>
    `flex min-h-11 min-w-0 flex-col items-start justify-center rounded-[10px] border px-3 py-1.5 text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-siyoh ${
      pressed ? "border-siyoh bg-siyoh font-semibold text-varaq" : "border-chiziq bg-white font-medium text-siyoh"
    }`;

  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
      <legend className="mb-2 p-0 text-sm font-medium text-siyoh">{copy.title}</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <button type="button" aria-pressed={value === null} onClick={() => onChange(null)} className={chip(value === null)}>
          {copy.all}
        </button>
        {options.map((status) => {
          const pressed = value?.includes(status) ?? false;
          const span = stopPointSpan(status, marks);
          return (
            <button key={status} type="button" aria-pressed={pressed} onClick={() => toggle(status)} className={chip(pressed)}>
              <span className="tabular-nums">{span ?? stopPointName(status)}</span>
              {span !== null && (
                <span className={`text-xs font-normal ${pressed ? "text-varaq/80" : "text-qalam"}`}>{stopPointName(status)}</span>
              )}
            </button>
          );
        })}
      </div>
      <p className="m-0 text-[13px] text-qalam">{copy.hint}</p>
    </fieldset>
  );
}
