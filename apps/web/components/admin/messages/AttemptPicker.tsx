"use client";

import { LINK_ATTEMPT_OPTIONS, linkAttempts } from "@funnel/shared";
import { adminUz } from "@/lib/i18n/admin";

const copy = adminUz.messages.attempts;

export function attemptLabel(attempt: number): string {
  return attempt === LINK_ATTEMPT_OPTIONS ? `${attempt}+` : String(attempt);
}

export function attemptsLabel(attempts: readonly number[]): string {
  return copy.badge.replace("{list}", attempts.map(attemptLabel).join(", "));
}

type AttemptPickerProps = {
  value: number[] | null;
  onChange: (value: number[] | null) => void;
};

export function AttemptPicker({ value, onChange }: AttemptPickerProps) {
  function toggle(attempt: number) {
    const current = value ?? [];
    const next = current.includes(attempt) ? current.filter((entry) => entry !== attempt) : [...current, attempt];
    const sorted = linkAttempts.filter((entry) => next.includes(entry));
    onChange(sorted.length === 0 || sorted.length === linkAttempts.length ? null : sorted);
  }

  const chip = (pressed: boolean) =>
    `flex min-h-11 min-w-12 items-center justify-center rounded-[10px] border px-3 text-sm tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-siyoh ${
      pressed ? "border-siyoh bg-siyoh font-semibold text-varaq" : "border-chiziq bg-white font-medium text-siyoh"
    }`;

  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
      <legend className="mb-2 p-0 text-sm font-medium text-siyoh">{copy.title}</legend>
      <div className="flex flex-wrap gap-2">
        <button type="button" aria-pressed={value === null} onClick={() => onChange(null)} className={`${chip(value === null)} px-4`}>
          {copy.all}
        </button>
        {linkAttempts.map((attempt) => {
          const pressed = value?.includes(attempt) ?? false;
          return (
            <button
              key={attempt}
              type="button"
              aria-pressed={pressed}
              aria-label={copy.item.replace("{n}", attemptLabel(attempt))}
              onClick={() => toggle(attempt)}
              className={chip(pressed)}
            >
              {attemptLabel(attempt)}
            </button>
          );
        })}
      </div>
      <p className="m-0 text-[13px] text-qalam">{copy.hint}</p>
    </fieldset>
  );
}
