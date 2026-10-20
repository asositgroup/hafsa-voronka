"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/admin/ui/Button";
import { Field } from "@/components/admin/ui/Field";
import { DateRangePicker, RangeCalendar } from "@/components/admin/ui/DateRangePicker";
import { Segmented } from "@/components/admin/ui/Segmented";
import { Sheet } from "@/components/admin/ui/Dialog";
import { activePreset, addDays, getTashkentToday, PRESET_DAYS, type Preset } from "@/lib/admin/dates";
import { adminUz } from "@/lib/i18n/admin";

const copy = adminUz.filters;

const presetItems: { value: Preset; label: string }[] = [
  { value: "today", label: copy.presets.today },
  { value: "7d", label: copy.presets.last7Days },
  { value: "30d", label: copy.presets.last30Days },
];

type DateRangeFilterProps = {
  from: string;
  to: string;
  onApply: (range: { from: string; to: string }, submitted: boolean) => void;
  onReset?: () => void;
  extra?: ReactNode;
  extraActive?: boolean;
  dirtyExtra?: boolean;
  applyLabel?: string;
};

export function DateRangeFilter({
  from,
  to,
  onApply,
  onReset,
  extra,
  extraActive = false,
  dirtyExtra = false,
  applyLabel = copy.applyButton,
}: DateRangeFilterProps) {
  const [currentFrom, setCurrentFrom] = useState(from);
  const [currentTo, setCurrentTo] = useState(to);
  const [sheetOpen, setSheetOpen] = useState(false);

  const preset = activePreset(from, to);
  const isDefault = preset === "7d" && !extraActive;
  const isDirty = currentFrom !== from || currentTo !== to || dirtyExtra;
  const customApplied = preset === null || extraActive;

  const applyPreset = (next: Preset) => {
    const today = getTashkentToday();
    const nextFrom = addDays(today, -PRESET_DAYS[next]);
    setCurrentFrom(nextFrom);
    setCurrentTo(today);
    onApply({ from: nextFrom, to: today }, false);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onApply({ from: currentFrom, to: currentTo }, true);
    setSheetOpen(false);
  };

  const reset = () => {
    const today = getTashkentToday();
    const defaultFrom = addDays(today, -PRESET_DAYS["7d"]);
    setCurrentFrom(defaultFrom);
    setCurrentTo(today);
    if (onReset) onReset();
    else onApply({ from: defaultFrom, to: today }, false);
    setSheetOpen(false);
  };

  const range = { from: currentFrom, to: currentTo };
  const changeRange = (next: { from: string; to: string }) => {
    setCurrentFrom(next.from);
    setCurrentTo(next.to);
  };
  const presetRanges = presetItems.map((item) => {
    const today = getTashkentToday();
    return { label: item.label, range: { from: addDays(today, -PRESET_DAYS[item.value]), to: today } };
  });

  const actions = (
    <>
      {onReset && !isDefault && (
        <Button variant="ghost" onClick={reset}>
          {copy.resetButton}
        </Button>
      )}
      <Button type="submit" disabled={!isDirty}>
        {applyLabel}
      </Button>
    </>
  );

  return (
    <>
      <div className="flex items-center gap-2 lg:hidden">
        <div className="min-w-0 flex-1">
          <Segmented label={copy.dateLabel} items={presetItems} value={preset} onChange={applyPreset} fill />
        </div>
        <Button variant="secondary" onClick={() => setSheetOpen(true)} aria-haspopup="dialog" className="relative">
          {extra ? copy.openButton : copy.dateButton}
          {customApplied && <span aria-hidden="true" className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-oltin" />}
        </Button>
      </div>

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={copy.sheetTitle}>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <RangeCalendar value={range} onChange={changeRange} />
          {extra}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{actions}</div>
        </form>
      </Sheet>

      <form onSubmit={submit} className="hidden flex-wrap items-end gap-3 rounded-[16px] bg-white p-4 lg:flex">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-siyoh">{copy.rangeLabel}</span>
          <Segmented label={copy.dateLabel} items={presetItems} value={preset} onChange={applyPreset} />
        </div>
        <Field label={copy.dateLabel} className="w-64">
          {({ id }) => <DateRangePicker id={id} value={range} onChange={changeRange} presets={presetRanges} />}
        </Field>
        {extra}
        <div className="ml-auto flex items-center gap-2">{actions}</div>
      </form>
    </>
  );
}
