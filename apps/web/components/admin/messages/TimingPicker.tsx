"use client";

import {
  MINUTES_PER_DAY,
  type TemplateTiming,
  type TimingError,
  type TimingType,
  timingTypes,
} from "@funnel/shared";
import { adminUz } from "@/lib/i18n/admin";

const copy = adminUz.messages.editor;

const inputClass =
  "h-10 w-20 rounded-[10px] border border-chegara/60 bg-white px-3 text-sm text-siyoh outline-none focus:border-siyoh";

export function defaultTiming(type: TimingType, day: number): TemplateTiming {
  if (type === "after_entry") return { type, value: (day - 1) * MINUTES_PER_DAY + 60 };
  if (type === "day_time") return { type, value: 9 * 60 };
  return { type, value: MINUTES_PER_DAY };
}

export function shiftTimingToDay(timing: TemplateTiming, fromDay: number, toDay: number): TemplateTiming {
  if (timing.type !== "after_entry") return timing;
  return { type: timing.type, value: timing.value + (toDay - fromDay) * MINUTES_PER_DAY };
}

function timeString(minutes: number) {
  const hh = String(Math.floor(minutes / 60) % 24).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function parseTime(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

export function timingLabel(timing: TemplateTiming): string {
  if (timing.type === "day_time") return timeString(timing.value);
  const hours = Math.floor(timing.value / 60);
  const minutes = timing.value % 60;
  return minutes > 0 ? `${hours} ${copy.hours} ${minutes} ${copy.minutes}` : `${hours} ${copy.hours}`;
}

type TimingPickerProps = {
  day: number;
  timing: TemplateTiming;
  onChange: (timing: TemplateTiming) => void;
  error: TimingError | null;
};

export function TimingPicker({ day, timing, onChange, error }: TimingPickerProps) {
  const hours = Math.floor(timing.value / 60);
  const minutes = timing.value % 60;

  return (
    <div className="flex flex-col gap-2">
      <select
        value={timing.type}
        onChange={(e) => onChange(defaultTiming(e.target.value as TimingType, day))}
        aria-label={copy.timingTitle}
        className="h-10 rounded-[10px] border border-chegara/60 bg-white px-3 text-sm text-siyoh outline-none focus:border-siyoh"
      >
        {timingTypes.map((type) => (
          <option key={type} value={type}>
            {copy.timingTypes[type]}
          </option>
        ))}
      </select>

      <div className="flex flex-wrap items-center gap-2 text-sm text-qalam">
        {timing.type === "day_time" ? (
          <input
            type="time"
            value={timeString(timing.value)}
            onChange={(e) => {
              const parsed = parseTime(e.target.value);
              if (parsed !== null) onChange({ type: "day_time", value: parsed });
            }}
            aria-invalid={error !== null}
            className={`${inputClass} w-32`}
          />
        ) : (
          <>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={hours}
              onChange={(e) => {
                const next = Math.max(0, Math.floor(Number(e.target.value) || 0));
                onChange({ type: timing.type, value: next * 60 + (timing.type === "before_expiry" ? 0 : minutes) });
              }}
              aria-invalid={error !== null}
              className={inputClass}
            />
            <span>{copy.hours}</span>
            {timing.type === "after_entry" && (
              <>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={59}
                  value={minutes}
                  onChange={(e) => {
                    const next = Math.min(59, Math.max(0, Math.floor(Number(e.target.value) || 0)));
                    onChange({ type: "after_entry", value: hours * 60 + next });
                  }}
                  aria-invalid={error !== null}
                  className={inputClass}
                />
                <span>{copy.minutes}</span>
              </>
            )}
          </>
        )}
      </div>

      {error && (
        <p role="alert" className="m-0 text-xs text-anor">
          {copy.timingTypes[timing.type]}: {adminUz.messages.errors[error]}
        </p>
      )}
    </div>
  );
}
