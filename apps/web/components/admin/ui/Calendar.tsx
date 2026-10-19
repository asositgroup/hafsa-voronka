"use client";

import { DayPicker } from "react-day-picker";
import type { DayPickerProps } from "react-day-picker";
import { ChevronDownIcon } from "@/components/icons";
import { formatDate, getTashkentToday } from "@/lib/admin/dates";
import { adminUz } from "@/lib/i18n/admin";

const copy = adminUz.pickers;

export function toDate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toDateString(date: Date): string {
  const y = String(date.getFullYear()).padStart(4, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function displayDate(value: string): string {
  return value ? formatDate(value) : "";
}

const dayBase =
  "relative h-11 w-11 p-0 text-center text-sm lg:h-9 lg:w-9";

export const calendarClassNames = {
  root: "w-fit",
  months: "relative flex flex-col",
  month: "flex flex-col gap-2",
  month_caption: "flex h-11 items-center justify-center lg:h-9",
  caption_label: "text-sm font-semibold text-siyoh",
  nav: "absolute inset-x-0 top-0 flex h-11 items-center justify-between lg:h-9",
  button_previous:
    "inline-flex h-11 w-11 items-center justify-center rounded-[10px] text-qalam transition-colors hover:bg-varaq hover:text-siyoh focus-visible:outline-2 focus-visible:outline-siyoh disabled:opacity-30 lg:h-9 lg:w-9",
  button_next:
    "inline-flex h-11 w-11 items-center justify-center rounded-[10px] text-qalam transition-colors hover:bg-varaq hover:text-siyoh focus-visible:outline-2 focus-visible:outline-siyoh disabled:opacity-30 lg:h-9 lg:w-9",
  month_grid: "border-collapse",
  weekdays: "",
  weekday: "h-9 w-11 p-0 text-center text-xs font-medium text-qalam lg:w-9",
  weeks: "",
  week: "",
  day: dayBase,
  day_button:
    "inline-flex h-full w-full cursor-pointer items-center justify-center rounded-[10px] tabular-nums text-siyoh transition-colors hover:bg-varaq focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-siyoh",
  today: "font-bold text-zumrad underline decoration-oltin decoration-2 underline-offset-4",
  outside: "opacity-40",
  disabled: "pointer-events-none opacity-30",
  hidden: "invisible",
  selected: "[&>button]:bg-siyoh [&>button]:text-white [&>button]:hover:bg-siyoh",
  range_start: "[&>button]:rounded-r-none",
  range_end: "[&>button]:rounded-l-none",
  range_middle: "[&>button]:rounded-none [&>button]:bg-varaq [&>button]:text-siyoh [&>button]:hover:bg-kumush/40",
};

export const calendarCopy = {
  formatters: {
    formatCaption: (month: Date) => `${copy.months[month.getMonth()]} ${month.getFullYear()}`,
    formatWeekdayName: (date: Date) => copy.weekdays[date.getDay()],
  },
  labels: {
    labelPrevious: () => copy.previousMonth,
    labelNext: () => copy.nextMonth,
    labelDayButton: (date: Date) => displayDate(toDateString(date)),
    labelMonthDropdown: () => copy.months.join(", "),
  },
};

function NavChevron({ orientation, className }: { orientation?: "left" | "right" | "up" | "down"; className?: string }) {
  const rotation = orientation === "left" ? "rotate-90" : orientation === "right" ? "-rotate-90" : orientation === "up" ? "rotate-180" : "";
  return <ChevronDownIcon className={`h-5 w-5 ${rotation} ${className ?? ""}`} />;
}

type CalendarProps = DayPickerProps & { latest?: string };

export function Calendar({ latest = getTashkentToday(), ...props }: CalendarProps) {
  const maxDate = toDate(latest);

  return (
    <DayPicker
      {...props}
      weekStartsOn={1}
      showOutsideDays
      endMonth={maxDate}
      disabled={{ after: maxDate }}
      classNames={calendarClassNames}
      formatters={calendarCopy.formatters}
      labels={calendarCopy.labels}
      components={{ Chevron: NavChevron }}
    />
  );
}
