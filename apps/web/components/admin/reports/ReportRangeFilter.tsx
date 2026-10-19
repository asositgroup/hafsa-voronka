"use client";

import { useState } from "react";
import { DownloadIcon } from "@/components/icons";
import { addDays, formatDate, getTashkentToday } from "@/lib/admin/dates";
import { getReportXlsxUrl } from "@/lib/admin/reports";
import { adminUz } from "@/lib/i18n/admin";

type Props = {
  from: string;
  to: string;
  onApply: (range: { from: string; to: string }) => void;
};

type Preset = "today" | "7d" | "30d";

const PRESET_DAYS: Record<Preset, number> = { today: 0, "7d": 6, "30d": 29 };

const PRESET_LABELS: Record<Preset, string> = {
  today: adminUz.filters.presets.today,
  "7d": adminUz.filters.presets.last7Days,
  "30d": adminUz.filters.presets.last30Days,
};

function activePreset(from: string, to: string): Preset | null {
  const today = getTashkentToday();
  if (to !== today) return null;
  const match = (Object.keys(PRESET_DAYS) as Preset[]).find((preset) => addDays(today, -PRESET_DAYS[preset]) === from);
  return match ?? null;
}

const fieldClass =
  "h-10 min-w-0 flex-1 rounded-[10px] border border-chegara/60 bg-white px-3 text-sm text-siyoh outline-none transition-colors focus:border-siyoh focus:ring-2 focus:ring-siyoh/15 sm:flex-none";

export function ReportRangeFilter({ from, to, onApply }: Props) {
  const [currentFrom, setCurrentFrom] = useState(from);
  const [currentTo, setCurrentTo] = useState(to);

  const preset = activePreset(from, to);
  const isDirty = currentFrom !== from || currentTo !== to;

  const applyPreset = (next: Preset) => {
    const today = getTashkentToday();
    const nextFrom = addDays(today, -PRESET_DAYS[next]);
    setCurrentFrom(nextFrom);
    setCurrentTo(today);
    onApply({ from: nextFrom, to: today });
  };

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    onApply({ from: currentFrom, to: currentTo });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h1 className="m-0 text-[28px] font-bold leading-tight text-siyoh">{adminUz.reports.title}</h1>
          <p className="m-0 mt-1 text-sm text-qalam tabular-nums">
            {formatDate(from)} – {formatDate(to)}
          </p>
        </div>

        <a
          href={getReportXlsxUrl({ from, to })}
          download
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-[10px] border border-chegara/60 bg-white px-4 text-sm font-semibold text-siyoh no-underline transition-colors hover:border-siyoh"
        >
          <DownloadIcon className="h-4 w-4" />
          {adminUz.reports.exportXlsx}
        </a>
      </div>

      <form onSubmit={handleApply} className="flex flex-col gap-3 rounded-[16px] bg-white p-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div role="group" aria-label={adminUz.filters.dateLabel} className="flex rounded-[10px] bg-varaq p-1">
          {(Object.keys(PRESET_DAYS) as Preset[]).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={preset === key}
              onClick={() => applyPreset(key)}
              className={`h-8 flex-1 whitespace-nowrap rounded-[8px] px-3 text-[13px] font-medium transition-colors sm:flex-none ${
                preset === key ? "bg-white text-siyoh shadow-[0_1px_3px_rgba(18,59,51,.15)]" : "text-qalam hover:text-siyoh"
              }`}
            >
              {PRESET_LABELS[key]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="date"
            aria-label={adminUz.filters.fromLabel}
            value={currentFrom}
            max={currentTo}
            onChange={(e) => setCurrentFrom(e.target.value)}
            className={fieldClass}
          />
          <span aria-hidden="true" className="text-qalam">
            –
          </span>
          <input
            type="date"
            aria-label={adminUz.filters.toLabel}
            value={currentTo}
            min={currentFrom}
            onChange={(e) => setCurrentTo(e.target.value)}
            className={fieldClass}
          />
        </div>

        <button
          type="submit"
          disabled={!isDirty}
          className="h-10 rounded-[10px] bg-siyoh px-5 text-sm font-semibold text-varaq transition-opacity hover:opacity-95 disabled:opacity-40 sm:ml-auto"
        >
          {adminUz.reports.applyButton}
        </button>
      </form>
    </div>
  );
}
