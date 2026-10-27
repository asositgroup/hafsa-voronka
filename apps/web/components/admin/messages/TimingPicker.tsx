"use client";

import type { TimingError } from "@funnel/shared";
import { Field, Input } from "@/components/admin/ui/Field";
import { Segmented } from "@/components/admin/ui/Segmented";
import { TimePicker } from "@/components/admin/ui/TimePicker";
import { relativeAnchor, timingMode, timingSummary, type TimingSubject } from "@/lib/admin/messageTiming";
import { adminUz } from "@/lib/i18n/admin";

const copy = adminUz.messages.editor;

function clamp(raw: string, max: number) {
  return Math.min(max, Math.max(0, Math.floor(Number(raw) || 0)));
}

type TimingPickerProps = {
  subject: TimingSubject;
  minute: number;
  onChange: (values: { minute?: number; atExpiry?: boolean }) => void;
  error: TimingError | null;
};

export function TimingPicker({ subject, minute, onChange, error }: TimingPickerProps) {
  const mode = timingMode(subject);
  const isTrigger = subject.kind === "trigger";
  const hours = Math.floor(minute / 60);
  const minutes = minute % 60;
  const hint =
    mode === "expiry"
      ? copy.timingHints.expiry
      : isTrigger
        ? copy.timingHints.triggerClock
        : mode === "clock"
          ? copy.timingHints.clock
          : copy.timingHints[relativeAnchor(subject.segment, subject.day)];

  return (
    <div className="flex flex-col gap-3">
      {isTrigger && (
        <Segmented
          label={copy.triggerTiming.label}
          fill
          value={subject.atExpiry ? "expiry" : "clock"}
          onChange={(next) => onChange({ atExpiry: next === "expiry" })}
          items={[
            { value: "expiry", label: copy.triggerTiming.expiry },
            { value: "clock", label: copy.triggerTiming.clock },
          ]}
        />
      )}

      {mode === "relative" && (
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
                onChange={(e) => onChange({ minute: clamp(e.target.value, 23) * 60 + minutes })}
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
                onChange={(e) => onChange({ minute: hours * 60 + clamp(e.target.value, 59) })}
              />
            )}
          </Field>
        </div>
      )}

      {mode === "clock" && (
        <Field label={copy.timingTitle} hideLabel className="w-36">
          {({ id }) => <TimePicker id={id} value={minute} invalid={error !== null} onChange={(next) => onChange({ minute: next })} />}
        </Field>
      )}

      <p className="m-0 text-[13px] text-qalam/70">{hint}</p>

      {mode !== "expiry" && <p className="m-0 text-[13px] text-qalam">{timingSummary({ ...subject, minute })}</p>}

      {error && (
        <p role="alert" className="m-0 text-[13px] text-anor">
          {adminUz.messages.errors[error]}
        </p>
      )}
    </div>
  );
}
