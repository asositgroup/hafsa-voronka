"use client";

import { type FunnelSegment, linkBoundSegments, type TimingError } from "@funnel/shared";
import { Field, Input } from "@/components/admin/ui/Field";
import { TimePicker } from "@/components/admin/ui/TimePicker";
import { adminUz } from "@/lib/i18n/admin";

const copy = adminUz.messages.editor;

function clockTime(minute: number) {
  const hh = String(Math.floor(minute / 60)).padStart(2, "0");
  const mm = String(minute % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function duration(minute: number) {
  const hours = Math.floor(minute / 60);
  const minutes = minute % 60;
  const parts = [hours > 0 ? `${hours} ${copy.hours}` : null, minutes > 0 ? `${minutes} ${copy.minutes}` : null].filter(
    (part): part is string => part !== null,
  );
  return parts.length > 0 ? parts.join(" ") : `0 ${copy.minutes}`;
}

export function timelineLabel(day: number, minute: number): string {
  return day === 1 ? `+${duration(minute)}` : clockTime(minute);
}

export function timingSummary(segment: FunnelSegment, day: number, minute: number): string {
  if (day === 1) return adminUz.messages.timing.afterEntry[segment].replace("{time}", duration(minute));
  return adminUz.messages.timing.clock.replace("{n}", String(day)).replace("{time}", clockTime(minute));
}

function clamp(raw: string, max: number) {
  return Math.min(max, Math.max(0, Math.floor(Number(raw) || 0)));
}

type TimingPickerProps = {
  segment: FunnelSegment;
  day: number;
  minute: number;
  onChange: (minute: number) => void;
  error: TimingError | null;
};

export function TimingPicker({ segment, day, minute, onChange, error }: TimingPickerProps) {
  const hours = Math.floor(minute / 60);
  const minutes = minute % 60;

  return (
    <div className="flex flex-col gap-3">
      {day === 1 ? (
        <div className="flex flex-wrap items-start gap-3">
          <Field label={copy.hours} hideLabel suffix={copy.hours} className="w-32">
            {({ id }) => (
              <Input
                id={id}
                type="number"
                inputMode="numeric"
                min={0}
                max={23}
                value={hours}
                invalid={error !== null}
                onChange={(e) => onChange(clamp(e.target.value, 23) * 60 + minutes)}
              />
            )}
          </Field>
          <Field label={copy.minutes} hideLabel suffix={copy.minutes} className="w-36">
            {({ id }) => (
              <Input
                id={id}
                type="number"
                inputMode="numeric"
                min={0}
                max={59}
                value={minutes}
                invalid={error !== null}
                onChange={(e) => onChange(hours * 60 + clamp(e.target.value, 59))}
              />
            )}
          </Field>
        </div>
      ) : (
        <Field label={copy.timingTitle} hideLabel className="w-36">
          {({ id }) => <TimePicker id={id} value={minute} invalid={error !== null} onChange={onChange} />}
        </Field>
      )}

      <p className="m-0 text-[13px] text-qalam/70">{day === 1 ? copy.timingHints[segment] : copy.timingHints.clock}</p>

      {day > 1 && linkBoundSegments.includes(segment) && (
        <p className="m-0 text-[13px] text-qalam/70">{copy.timingHints.clockLinkOpen}</p>
      )}

      <p className="m-0 text-[13px] text-qalam">{timingSummary(segment, day, minute)}</p>

      {error && (
        <p role="alert" className="m-0 text-[13px] text-anor">
          {adminUz.messages.errors[error]}
        </p>
      )}
    </div>
  );
}
