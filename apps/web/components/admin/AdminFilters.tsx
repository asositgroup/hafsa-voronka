"use client";

import { useState } from "react";
import { adminUz } from "@/lib/i18n/admin";

type FiltersProps = {
  from: string;
  to: string;
  source: string;
  campaign: string;
  onApply: (filters: { from: string; to: string; source: string; campaign: string }) => void;
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

export function AdminFilters({ from, to, source, campaign, onApply }: FiltersProps) {
  const [currentFrom, setCurrentFrom] = useState(from);
  const [currentTo, setCurrentTo] = useState(to);
  const [currentSource, setCurrentSource] = useState(source);
  const [currentCampaign, setCurrentCampaign] = useState(campaign);

  const applyPreset = (preset: "today" | "7d" | "30d") => {
    const today = getTashkentToday();
    let newFrom = today;
    if (preset === "7d") newFrom = addDays(today, -6);
    if (preset === "30d") newFrom = addDays(today, -29);
    setCurrentFrom(newFrom);
    setCurrentTo(today);
    onApply({
      from: newFrom,
      to: today,
      source: currentSource,
      campaign: currentCampaign,
    });
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
    const defaultFrom = addDays(today, -6);
    setCurrentFrom(defaultFrom);
    setCurrentTo(today);
    setCurrentSource("");
    setCurrentCampaign("");
    onApply({
      from: defaultFrom,
      to: today,
      source: "",
      campaign: "",
    });
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 sm:p-5">
      <form onSubmit={handleApply} className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
          <div className="text-sm font-semibold text-zinc-200">
            {adminUz.filters.title}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => applyPreset("today")}
              className="rounded-md bg-zinc-800 px-2.5 py-1 text-zinc-300 hover:bg-zinc-700 transition"
            >
              {adminUz.filters.presets.today}
            </button>
            <button
              type="button"
              onClick={() => applyPreset("7d")}
              className="rounded-md bg-zinc-800 px-2.5 py-1 text-zinc-300 hover:bg-zinc-700 transition"
            >
              {adminUz.filters.presets.last7Days}
            </button>
            <button
              type="button"
              onClick={() => applyPreset("30d")}
              className="rounded-md bg-zinc-800 px-2.5 py-1 text-zinc-300 hover:bg-zinc-700 transition"
            >
              {adminUz.filters.presets.last30Days}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              {adminUz.filters.fromLabel}
            </label>
            <input
              type="date"
              value={currentFrom}
              onChange={(e) => setCurrentFrom(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/90 px-3 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              {adminUz.filters.toLabel}
            </label>
            <input
              type="date"
              value={currentTo}
              onChange={(e) => setCurrentTo(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/90 px-3 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              {adminUz.filters.sourceLabel}
            </label>
            <input
              type="text"
              value={currentSource}
              placeholder={adminUz.filters.sourcePlaceholder}
              onChange={(e) => setCurrentSource(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/90 px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              {adminUz.filters.campaignLabel}
            </label>
            <input
              type="text"
              value={currentCampaign}
              placeholder={adminUz.filters.campaignPlaceholder}
              onChange={(e) => setCurrentCampaign(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/90 px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={handleReset}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700 hover:text-white transition"
          >
            {adminUz.filters.resetButton}
          </button>
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 transition shadow-sm"
          >
            {adminUz.filters.applyButton}
          </button>
        </div>
      </form>
    </div>
  );
}
