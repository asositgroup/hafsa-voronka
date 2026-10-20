"use client";

import { useState } from "react";
import { CalendarIcon } from "@/components/icons";
import { Calendar, displayDate, toDate, toDateString } from "@/components/admin/ui/Calendar";
import { PickerSurface } from "@/components/admin/ui/PickerSurface";
import { inputClass } from "@/components/admin/ui/Field";
import { adminUz } from "@/lib/i18n/admin";

type DatePickerProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  max?: string;
  placeholder?: string;
  invalid?: boolean;
  className?: string;
  "aria-label"?: string;
};

export function DatePicker({
  id,
  value,
  onChange,
  max,
  placeholder = adminUz.pickers.selectDate,
  invalid = false,
  className = "",
  "aria-label": ariaLabel,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = value ? toDate(value) : undefined;

  return (
    <PickerSurface
      open={open}
      onOpenChange={setOpen}
      title={ariaLabel ?? placeholder}
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
          <span className={`truncate ${value ? "" : "text-qalam/60"}`}>{value ? displayDate(value) : placeholder}</span>
          <CalendarIcon className="h-4 w-4 text-qalam" />
        </button>
      )}
    >
      <div className="flex justify-center">
        <Calendar
          mode="single"
          latest={max}
          selected={selected}
          defaultMonth={selected}
          onSelect={(date) => {
            if (!date) return;
            onChange(toDateString(date));
            setOpen(false);
          }}
          autoFocus
        />
      </div>
    </PickerSurface>
  );
}
