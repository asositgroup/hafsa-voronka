"use client";

import { useState } from "react";
import {
  dayForTiming,
  isExpiryTiming,
  isNightMinute,
  linkBoundSegments,
  MINUTES_PER_DAY,
  NIGHT_NOTICE_MINUTE,
  TEMPLATE_DAYS,
  type FunnelSegment,
  type TemplateTiming,
  type TimingError,
  type TimingType,
  timingTypes,
} from "@funnel/shared";
import { Button } from "@/components/admin/ui/Button";
import { Field, Input } from "@/components/admin/ui/Field";
import { Select } from "@/components/admin/ui/Select";
import { TimePicker } from "@/components/admin/ui/TimePicker";
import { adminUz } from "@/lib/i18n/admin";

const copy = adminUz.messages.editor;

export function defaultTiming(type: TimingType, day: number): TemplateTiming {
  if (type === "after_entry") return { type, value: (day - 1) * MINUTES_PER_DAY + 60 };
  if (type === "day_time") return { type, value: 9 * 60 };
  if (type === "night_notice") return { type, value: 0 };
  return { type, value: 3 * 60 };
}

const stageTimingTypes: Record<FunnelSegment, TimingType> = {
  A: "before_expiry",
  B: "after_entry",
  C: "after_entry",
};

export function stageTiming(segment: FunnelSegment): TemplateTiming {
  return defaultTiming(stageTimingTypes[segment], 1);
}

function timeString(minutes: number) {
  const hh = String(Math.floor(minutes / 60) % 24).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function formatDuration(totalMinutes: number): string {
  const days = Math.floor(totalMinutes / MINUTES_PER_DAY);
  const hours = Math.floor((totalMinutes % MINUTES_PER_DAY) / 60);
  const minutes = totalMinutes % 60;
  const parts = [
    days > 0 ? `${days} ${copy.days}` : null,
    hours > 0 ? `${hours} ${copy.hours}` : null,
    minutes > 0 ? `${minutes} ${copy.minutes}` : null,
  ].filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(" ") : `0 ${copy.minutes}`;
}

export function timingLabel(timing: TemplateTiming): string {
  if (timing.type === "night_notice") return timeString(NIGHT_NOTICE_MINUTE);
  if (timing.type === "day_time") return timeString(timing.value);
  return formatDuration(timing.value);
}

export function timelineLabel(timing: TemplateTiming): string {
  if (timing.type === "night_notice") return timeString(NIGHT_NOTICE_MINUTE);
  if (timing.type === "day_time") return timeString(timing.value);
  if (timing.type === "after_entry") return `+${formatDuration(timing.value)}`;
  return `${formatDuration(timing.value)} ${copy.before}`;
}

function typeLabel(type: TimingType, segment: FunnelSegment): string {
  const label = copy.timingTypes[type];
  return typeof label === "string" ? label : label[segment];
}

function typeExample(type: TimingType, segment: FunnelSegment): string {
  const example = copy.timingExamples[type];
  return typeof example === "string" ? example : example[segment];
}

export function timingSummary(day: number, timing: TemplateTiming, segment: FunnelSegment): string {
  const dayText = adminUz.messages.dayLabel.replace("{n}", String(dayForTiming(timing, day)));
  const template = adminUz.messages.timing[timing.type];
  const timingText = (typeof template === "string" ? template : template[segment]).replace(
    "{time}",
    timingLabel(timing),
  );
  return isExpiryTiming(timing.type) ? timingText : `${dayText}: ${timingText}`;
}

const dayOptions = Array.from({ length: TEMPLATE_DAYS }, (_, index) => ({
  value: String(index + 1),
  label: adminUz.messages.dayLabel.replace("{n}", String(index + 1)),
}));

function timingTypeOptions(segment: FunnelSegment, current: TimingType) {
  return timingTypes
    .filter((type) => type !== "night_notice" || (current === "night_notice" && linkBoundSegments.includes(segment)))
    .map((type) => ({ value: type, label: typeLabel(type, segment) }));
}

const MAX_ENTRY_MINUTES = TEMPLATE_DAYS * MINUTES_PER_DAY - 1;

function clamp(raw: string, max: number) {
  return Math.min(max, Math.max(0, Math.floor(Number(raw) || 0)));
}

type TimingValue = { day: number; timing: TemplateTiming };

type TimingPickerProps = {
  day: number;
  timing: TemplateTiming;
  segment: FunnelSegment;
  onChange: (next: TimingValue) => void;
  error: TimingError | null;
};

export function TimingPicker({ day, timing, segment, onChange, error }: TimingPickerProps) {
  const entryDays = Math.floor(timing.value / MINUTES_PER_DAY);
  const entryHours = Math.floor((timing.value % MINUTES_PER_DAY) / 60);
  const entryMinutes = timing.value % 60;

  const standard = stageTimingTypes[segment];
  const [custom, setCustom] = useState(timing.type !== standard);

  const message = error ? `${typeLabel(timing.type, segment)}: ${adminUz.messages.errors[error]}` : null;

  function change(next: TemplateTiming, fallbackDay = day) {
    onChange({ day: dayForTiming(next, fallbackDay), timing: next });
  }

  function changeEntry(days: number, hours: number, minutes: number) {
    const value = Math.min(MAX_ENTRY_MINUTES, days * MINUTES_PER_DAY + hours * 60 + minutes);
    change({ type: "after_entry", value });
  }

  function toggleCustom() {
    if (custom && timing.type !== standard) change(defaultTiming(standard, day));
    setCustom(!custom);
  }

  return (
    <div className="flex flex-col gap-3">
      {custom ? (
        <>
          <Field label={copy.timingKind} hideLabel>
            {({ id }) => (
              <Select
                id={id}
                value={timing.type}
                onValueChange={(next) => change(defaultTiming(next as TimingType, day))}
                options={timingTypeOptions(segment, timing.type)}
              />
            )}
          </Field>
          <p className="m-0 text-[13px] text-qalam/70">{typeExample(timing.type, segment)}</p>
        </>
      ) : (
        <p className="m-0 text-sm font-medium text-siyoh">{typeLabel(timing.type, segment)}</p>
      )}

      {timing.type === "after_entry" && (
        <div className="flex flex-wrap items-start gap-3">
          <Field label={copy.days} hideLabel suffix={copy.days} className="w-32">
            {({ id }) => (
              <Input
                id={id}
                type="number"
                inputMode="numeric"
                min={0}
                max={6}
                value={entryDays}
                invalid={error !== null}
                onChange={(e) => changeEntry(clamp(e.target.value, 6), entryHours, entryMinutes)}
              />
            )}
          </Field>
          <Field label={copy.hours} hideLabel suffix={copy.hours} className="w-32">
            {({ id }) => (
              <Input
                id={id}
                type="number"
                inputMode="numeric"
                min={0}
                max={23}
                value={entryHours}
                invalid={error !== null}
                onChange={(e) => changeEntry(entryDays, clamp(e.target.value, 23), entryMinutes)}
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
                value={entryMinutes}
                invalid={error !== null}
                onChange={(e) => changeEntry(entryDays, entryHours, clamp(e.target.value, 59))}
              />
            )}
          </Field>
        </div>
      )}

      {timing.type === "day_time" && (
        <div className="flex flex-wrap items-start gap-3">
          <Field label={copy.day} hideLabel className="w-36">
            {({ id }) => (
              <Select
                id={id}
                value={String(day)}
                onValueChange={(next) => change(timing, Number(next))}
                options={dayOptions}
              />
            )}
          </Field>
          <Field label={copy.timingTitle} hideLabel className="w-36">
            {({ id }) => (
              <TimePicker
                id={id}
                value={timing.value}
                invalid={error !== null}
                isDisabled={isNightMinute}
                onChange={(next) => change({ type: "day_time", value: next })}
              />
            )}
          </Field>
        </div>
      )}

      {timing.type === "before_expiry" && (
        <Field label={copy.hours} hideLabel suffix={copy.hoursBefore} className="w-52">
          {({ id }) => (
            <Input
              id={id}
              type="number"
              inputMode="numeric"
              min={1}
              max={168}
              value={Math.floor(timing.value / 60)}
              invalid={error !== null}
              onChange={(e) => change({ type: "before_expiry", value: Math.max(1, clamp(e.target.value, 168)) * 60 })}
            />
          )}
        </Field>
      )}

      <p className="m-0 text-[13px] text-qalam">{timingSummary(day, timing, segment)}</p>

      <div>
        <Button variant="ghost" size="sm" onClick={toggleCustom} className="-ml-3">
          {custom ? copy.standardTiming : copy.customTiming}
        </Button>
      </div>

      {message && (
        <p role="alert" className="m-0 text-[13px] text-anor">
          {message}
        </p>
      )}
    </div>
  );
}
