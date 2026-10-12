"use client";

import { useState } from "react";
import { LogoutButton } from "@/components/admin/LogoutButton";
import { DownloadIcon } from "@/components/icons";
import { getLeadsCsvUrl } from "@/lib/admin/api";
import { adminUz } from "@/lib/i18n/admin";

type FiltersProps = {
  from: string;
  to: string;
  source: string;
  campaign: string;
  onApply: (filters: { from: string; to: string; source: string; campaign: string }) => void;
};

type Preset = "today" | "7d" | "30d";

const PRESET_DAYS: Record<Preset, number> = { today: 0, "7d": 6, "30d": 29 };

const PRESET_LABELS: Record<Preset, string> = {
  today: adminUz.filters.presets.today,
  "7d": adminUz.filters.presets.last7Days,
  "30d": adminUz.filters.presets.last30Days,
};

function getTashkentToday(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tashkent",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0));
  return date.toISOString().slice(0, 10);
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}.${m}.${y}`;
}

function activePreset(from: string, to: string): Preset | null {
  const today = getTashkentToday();
  if (to !== today) return null;
  const match = (Object.keys(PRESET_DAYS) as Preset[]).find((preset) => addDays(today, -PRESET_DAYS[preset]) === from);
  return match ?? null;
}

const fieldClass =
  "h-10 rounded-[10px] border border-chegara/60 bg-white px-3 text-sm text-siyoh outline-none transition-colors placeholder:text-qalam/60 focus:border-siyoh focus:ring-2 focus:ring-siyoh/15";

export function AdminFilters({ from, to, source, campaign, onApply }: FiltersProps) {
  const [currentFrom, setCurrentFrom] = useState(from);
  const [currentTo, setCurrentTo] = useState(to);
  const [currentSource, setCurrentSource] = useState(source);
  const [currentCampaign, setCurrentCampaign] = useState(campaign);

  const csvUrl = getLeadsCsvUrl({ from, to, source, campaign });
  const preset = activePreset(from, to);
  const isDefault = preset === "7d" && !source && !campaign;
  const isDirty =
    currentFrom !== from ||
    currentTo !== to ||
    currentSource.trim() !== source ||
    currentCampaign.trim() !== campaign;

  const applyPreset = (next: Preset) => {
    const today = getTashkentToday();
    const nextFrom = addDays(today, -PRESET_DAYS[next]);
    setCurrentFrom(nextFrom);
    setCurrentTo(today);
    onApply({ from: nextFrom, to: today, source, campaign });
  };

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    onApply({
      from: currentFrom,
      to: currentTo,
      source: currentSource.trim(),
      campaign: currentCampaign.trim(),
    });
  };

  const handleReset = () => {
    const today = getTashkentToday();
    const defaultFrom = addDays(today, -PRESET_DAYS["7d"]);
    setCurrentFrom(defaultFrom);
    setCurrentTo(today);
    setCurrentSource("");
    setCurrentCampaign("");
    onApply({ from: defaultFrom, to: today, source: "", campaign: "" });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="m-0 text-[28px] font-bold leading-tight text-siyoh">{adminUz.dashboard.title}</h1>
          <p className="m-0 mt-1 text-sm text-qalam tabular-nums">
            {formatDate(from)} – {formatDate(to)}
            {(source || campaign) && (
              <span>
                {" · "}
                {[source, campaign].filter(Boolean).join(" / ")}
              </span>
            )}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <a
            href={csvUrl}
            download="leads.csv"
            className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-chegara/60 bg-white px-4 text-sm font-semibold text-siyoh no-underline transition-colors hover:border-siyoh"
          >
            <DownloadIcon className="h-4 w-4" />
            {adminUz.leads.exportCsv}
          </a>
          <LogoutButton />
        </div>
      </div>

      <form
        onSubmit={handleApply}
        className="flex flex-wrap items-center gap-3 rounded-[16px] bg-white p-3"
      >
        <div role="group" aria-label={adminUz.filters.dateLabel} className="flex rounded-[10px] bg-varaq p-1">
          {(Object.keys(PRESET_DAYS) as Preset[]).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={preset === key}
              onClick={() => applyPreset(key)}
              className={`h-8 rounded-[8px] px-3 text-[13px] font-medium transition-colors ${
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

        <input
          type="text"
          aria-label={adminUz.filters.sourceLabel}
          value={currentSource}
          placeholder={adminUz.filters.sourceLabel}
          onChange={(e) => setCurrentSource(e.target.value)}
          className={`${fieldClass} w-[140px]`}
        />

        <input
          type="text"
          aria-label={adminUz.filters.campaignLabel}
          value={currentCampaign}
          placeholder={adminUz.filters.campaignLabel}
          onChange={(e) => setCurrentCampaign(e.target.value)}
          className={`${fieldClass} w-[160px]`}
        />

        <div className="ml-auto flex items-center gap-2">
          {!isDefault && (
            <button
              type="button"
              onClick={handleReset}
              className="h-10 rounded-[10px] px-3 text-sm text-qalam transition-colors hover:text-siyoh"
            >
              {adminUz.filters.resetButton}
            </button>
          )}
          <button
            type="submit"
            disabled={!isDirty}
            className="h-10 rounded-[10px] bg-siyoh px-5 text-sm font-semibold text-varaq transition-opacity hover:opacity-95 disabled:opacity-40"
          >
            {adminUz.filters.applyButton}
          </button>
        </div>
      </form>
    </div>
  );
}
