"use client";

import { useState } from "react";
import { getLeadsCsvUrl } from "@/lib/admin/api";
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

  const csvUrl = getLeadsCsvUrl({
    from: currentFrom,
    to: currentTo,
    source: currentSource,
    campaign: currentCampaign,
  });

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
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div className="flex flex-col gap-1">
          <h1 className="text-[28px] font-bold text-siyoh m-0 leading-tight">
            {adminUz.dashboard.title}
          </h1>
          <p className="text-sm text-qalam m-0">
            {adminUz.dashboard.subtitle}
          </p>
        </div>

        <form onSubmit={handleApply} className="flex gap-3 items-end flex-wrap">
          <label className="flex flex-col gap-1 text-[13px] text-qalam">
            {adminUz.filters.fromLabel}
            <input
              type="date"
              value={currentFrom}
              onChange={(e) => setCurrentFrom(e.target.value)}
              className="min-h-[40px] px-3 rounded-[10px] border border-chegara bg-white text-siyoh text-sm outline-none focus:border-siyoh focus:ring-1 focus:ring-siyoh"
            />
          </label>

          <label className="flex flex-col gap-1 text-[13px] text-qalam">
            {adminUz.filters.toLabel}
            <input
              type="date"
              value={currentTo}
              onChange={(e) => setCurrentTo(e.target.value)}
              className="min-h-[40px] px-3 rounded-[10px] border border-chegara bg-white text-siyoh text-sm outline-none focus:border-siyoh focus:ring-1 focus:ring-siyoh"
            />
          </label>

          <label className="flex flex-col gap-1 text-[13px] text-qalam">
            {adminUz.filters.sourceLabel}
            <input
              type="text"
              value={currentSource}
              placeholder={adminUz.filters.sourcePlaceholder}
              onChange={(e) => setCurrentSource(e.target.value)}
              className="min-h-[40px] w-[130px] px-3 rounded-[10px] border border-chegara bg-white text-siyoh text-sm outline-none focus:border-siyoh focus:ring-1 focus:ring-siyoh placeholder:text-qalam/50"
            />
          </label>

          <label className="flex flex-col gap-1 text-[13px] text-qalam">
            {adminUz.filters.campaignLabel}
            <input
              type="text"
              value={currentCampaign}
              placeholder={adminUz.filters.campaignPlaceholder}
              onChange={(e) => setCurrentCampaign(e.target.value)}
              className="min-h-[40px] w-[130px] px-3 rounded-[10px] border border-chegara bg-white text-siyoh text-sm outline-none focus:border-siyoh focus:ring-1 focus:ring-siyoh placeholder:text-qalam/50"
            />
          </label>

          <button
            type="submit"
            className="min-h-[40px] px-4 rounded-[10px] bg-siyoh text-varaq text-sm font-semibold hover:opacity-95 transition"
          >
            {adminUz.filters.applyButton}
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="min-h-[40px] px-3 rounded-[10px] border border-chegara bg-white text-siyoh text-sm hover:bg-varaq transition"
          >
            {adminUz.filters.resetButton}
          </button>

          <a
            href={csvUrl}
            download="leads.csv"
            className="inline-flex items-center min-h-[40px] px-[18px] rounded-[10px] bg-oltin text-siyoh text-[15px] font-semibold hover:opacity-95 transition no-underline"
          >
            {adminUz.leads.exportCsv}
          </a>
        </form>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <button
          type="button"
          onClick={() => applyPreset("today")}
          className="rounded-[6px] border border-chegara bg-white px-2.5 py-1 text-qalam hover:text-siyoh hover:bg-varaq transition"
        >
          {adminUz.filters.presets.today}
        </button>
        <button
          type="button"
          onClick={() => applyPreset("7d")}
          className="rounded-[6px] border border-chegara bg-white px-2.5 py-1 text-qalam hover:text-siyoh hover:bg-varaq transition"
        >
          {adminUz.filters.presets.last7Days}
        </button>
        <button
          type="button"
          onClick={() => applyPreset("30d")}
          className="rounded-[6px] border border-chegara bg-white px-2.5 py-1 text-qalam hover:text-siyoh hover:bg-varaq transition"
        >
          {adminUz.filters.presets.last30Days}
        </button>
      </div>
    </div>
  );
}
