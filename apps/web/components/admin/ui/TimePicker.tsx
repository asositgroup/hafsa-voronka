"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { ClockIcon } from "@/components/icons";
import { PickerSurface } from "@/components/admin/ui/PickerSurface";
import { inputClass } from "@/components/admin/ui/Field";
import { Button } from "@/components/admin/ui/Button";
import { adminUz } from "@/lib/i18n/admin";

const copy = adminUz.pickers;

const hourValues = Array.from({ length: 24 }, (_, hour) => hour);
const minuteSteps = Array.from({ length: 12 }, (_, step) => step * 5);

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function formatTime(minuteOfDay: number): string {
  return `${pad(Math.floor(minuteOfDay / 60) % 24)}:${pad(minuteOfDay % 60)}`;
}

function parseTime(text: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : null;
}

type ColumnItem = { value: number; disabled: boolean };

function PickerColumn({ label, items, selected, onSelect }: { label: string; items: ColumnItem[]; selected: number; onSelect: (value: number) => void }) {
  const refs = useRef(new Map<number, HTMLButtonElement>());
  const listRef = useRef<HTMLDivElement>(null);
  const focusable = items.find((item) => item.value === selected && !item.disabled)?.value ?? items.find((item) => !item.disabled)?.value;

  useEffect(() => {
    const element = refs.current.get(selected);
    const list = listRef.current;
    if (element && list) list.scrollTop = element.offsetTop - list.clientHeight / 2 + element.clientHeight / 2;
  }, [selected]);

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const step = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
    const edge = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : null;
    if (step === 0 && edge === null) return;
    event.preventDefault();
    let next = edge ?? index + step;
    const direction = edge === items.length - 1 ? -1 : edge === 0 ? 1 : step;
    while (next >= 0 && next < items.length && items[next].disabled) next += direction;
    if (next < 0 || next >= items.length) return;
    refs.current.get(items[next].value)?.focus();
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className="text-[13px] font-medium text-qalam">{label}</span>
      <div
        ref={listRef}
        role="listbox"
        aria-label={label}
        className="relative flex h-56 flex-col gap-0.5 overflow-y-auto rounded-[12px] bg-varaq p-1"
      >
        {items.map((item, index) => {
          const isSelected = item.value === selected;
          return (
            <button
              key={item.value}
              ref={(node) => {
                if (node) refs.current.set(item.value, node);
                else refs.current.delete(item.value);
              }}
              type="button"
              role="option"
              aria-selected={isSelected}
              aria-disabled={item.disabled || undefined}
              disabled={item.disabled}
              tabIndex={item.value === focusable ? 0 : -1}
              onClick={() => onSelect(item.value)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={`h-11 shrink-0 rounded-[8px] text-sm tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-siyoh disabled:cursor-not-allowed disabled:opacity-35 disabled:line-through lg:h-9 ${
                isSelected ? "bg-siyoh font-semibold text-white" : "text-siyoh hover:bg-white"
              }`}
            >
              {pad(item.value)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

type TimePickerProps = {
  id?: string;
  value: number;
  onChange: (minuteOfDay: number) => void;
  isDisabled?: (minuteOfDay: number) => boolean;
  invalid?: boolean;
  className?: string;
  "aria-label"?: string;
};

export function TimePicker({ id, value, onChange, isDisabled, invalid = false, className = "", "aria-label": ariaLabel }: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const hour = Math.floor(value / 60);
  const minute = value % 60;
  const blocked = (minuteOfDay: number) => isDisabled?.(minuteOfDay) ?? false;

  const hourItems = hourValues.map((h) => ({ value: h, disabled: minuteSteps.every((m) => blocked(h * 60 + m)) && !blocked(h * 60 + minute) }));
  const minuteValues = minuteSteps.includes(minute) ? minuteSteps : [...minuteSteps, minute].sort((a, b) => a - b);
  const minuteItems = minuteValues.map((m) => ({ value: m, disabled: blocked(hour * 60 + m) }));

  const typedValue = draft === null ? null : parseTime(draft);
  const draftError = draft !== null && (typedValue === null ? copy.timeInvalid : blocked(typedValue) ? copy.timeUnavailable : null);

  const pickHour = (nextHour: number) => {
    const keep = nextHour * 60 + minute;
    const fallback = minuteSteps.find((m) => !blocked(nextHour * 60 + m));
    const next = !blocked(keep) ? keep : fallback !== undefined ? nextHour * 60 + fallback : null;
    if (next !== null) onChange(next);
    setDraft(null);
  };

  const pickMinute = (nextMinute: number) => {
    onChange(hour * 60 + nextMinute);
    setDraft(null);
  };

  const commitDraft = () => {
    if (typedValue !== null && !blocked(typedValue)) {
      onChange(typedValue);
      setDraft(null);
    }
  };

  return (
    <PickerSurface
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setDraft(null);
      }}
      title={ariaLabel ?? copy.selectTime}
      trigger={({ ref, onClick }) => (
        <button
          ref={ref}
          id={id}
          type="button"
          aria-label={ariaLabel}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={onClick}
          className={`${inputClass(invalid)} flex cursor-pointer items-center justify-between gap-2 text-left tabular-nums ${className}`}
        >
          <span>{formatTime(value)}</span>
          <ClockIcon className="h-4 w-4 text-qalam" />
        </button>
      )}
    >
      <div className="flex w-full flex-col gap-3 lg:w-64">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id ?? "time"}-typed`} className="text-[13px] font-medium text-qalam">
            {copy.timeInput}
          </label>
          <input
            id={`${id ?? "time"}-typed`}
            data-autofocus
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="09:00"
            maxLength={5}
            value={draft ?? formatTime(value)}
            aria-invalid={draftError ? true : undefined}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commitDraft}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitDraft();
              }
            }}
            className={`${inputClass(Boolean(draftError))} tabular-nums`}
          />
          {draftError && (
            <span role="alert" className="text-[13px] text-anor">
              {draftError}
            </span>
          )}
        </div>
        <div className="flex gap-3">
          <PickerColumn label={copy.hours} items={hourItems} selected={hour} onSelect={pickHour} />
          <PickerColumn label={copy.minutes} items={minuteItems} selected={minute} onSelect={pickMinute} />
        </div>
        <Button onClick={() => setOpen(false)}>{copy.done}</Button>
      </div>
    </PickerSurface>
  );
}
