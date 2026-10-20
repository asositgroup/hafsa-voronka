"use client";

import { useState } from "react";
import { CalendarIcon } from "@/components/icons";
import { Calendar, displayDate, toDate, toDateString } from "@/components/admin/ui/Calendar";
import { PickerSurface } from "@/components/admin/ui/PickerSurface";
import { inputClass } from "@/components/admin/ui/Field";
import { adminUz } from "@/lib/i18n/admin";

const copy = adminUz.pickers;

export type DateRangeValue = { from: string; to: string };
export type DateRangePreset = { label: string; range: DateRangeValue };

type RangeCalendarProps = {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  max?: string;
  presets?: DateRangePreset[];
  onComplete?: () => void;
};

export function RangeCalendar({ value, onChange, max, presets, onComplete }: RangeCalendarProps) {
  const [anchor, setAnchor] = useState<string | null>(null);
  const selected = value.from && value.to ? { from: toDate(value.from), to: toDate(value.to) } : undefined;
  const activePreset = presets?.find((preset) => preset.range.from === value.from && preset.range.to === value.to);

  const pick = (date: Date) => {
    const day = toDateString(date);
    if (anchor === null) {
      setAnchor(day);
      onChange({ from: day, to: day });
      return;
    }
    const [from, to] = anchor <= day ? [anchor, day] : [day, anchor];
    setAnchor(null);
    onChange({ from, to });
    onComplete?.();
  };

  return (
    <div className="flex flex-col items-center gap-3">
      {presets && (
        <div className="flex w-full flex-wrap gap-2">
          {presets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              aria-pressed={preset === activePreset}
              onClick={() => {
                setAnchor(null);
                onChange(preset.range);
                onComplete?.();
              }}
              className={`h-9 rounded-[10px] px-3 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-siyoh ${
                preset === activePreset ? "bg-siyoh text-white" : "bg-varaq text-siyoh hover:bg-kumush/40"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}
      <Calendar
        mode="range"
        latest={max}
        selected={selected}
        defaultMonth={selected?.to}
        onDayClick={pick}
        autoFocus
      />
      <p role="status" className="m-0 w-full text-[13px] text-qalam">
        {anchor === null ? copy.rangeHint : copy.rangeEndHint}
      </p>
    </div>
  );
}

type DateRangePickerProps = {
  id?: string;
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  max?: string;
  presets?: DateRangePreset[];
  invalid?: boolean;
  className?: string;
  "aria-label"?: string;
};

export function DateRangePicker({ id, value, onChange, max, presets, invalid = false, className = "", "aria-label": ariaLabel }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const text = value.from && value.to ? `${displayDate(value.from)} – ${displayDate(value.to)}` : "";

  return (
    <PickerSurface
      open={open}
      onOpenChange={setOpen}
      title={ariaLabel ?? copy.selectRange}
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
          <span className={`truncate ${text ? "" : "text-qalam/60"}`}>{text || copy.selectRange}</span>
          <CalendarIcon className="h-4 w-4 text-qalam" />
        </button>
      )}
    >
      <RangeCalendar value={value} onChange={onChange} max={max} presets={presets} onComplete={() => setOpen(false)} />
    </PickerSurface>
  );
}
