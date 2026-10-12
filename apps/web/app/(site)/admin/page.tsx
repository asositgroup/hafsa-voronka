"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { AdminStatsResponse } from "@funnel/shared";
import { AdminFilters } from "@/components/admin/AdminFilters";
import { CampaignTable } from "@/components/admin/CampaignTable";
import { DailyChart } from "@/components/admin/DailyChart";
import { DropoffBars } from "@/components/admin/DropoffBars";
import { FunnelChart } from "@/components/admin/FunnelChart";
import { KpiCards } from "@/components/admin/KpiCards";
import { AdminNav } from "@/components/admin/AdminNav";
import { fetchAdminStats } from "@/lib/admin/api";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import { adminUz } from "@/lib/i18n/admin";

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

function AdminDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const today = getTashkentToday();
  const defaultFrom = addDays(today, -6);

  const from = searchParams.get("from") || defaultFrom;
  const to = searchParams.get("to") || today;
  const source = searchParams.get("source") || "";
  const campaign = searchParams.get("campaign") || "";

  const authorized = useAdminSession();
  const [stats, setStats] = useState<AdminStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authorized) return;
    let active = true;

    async function fetchData() {
      try {
        const statsData = await fetchAdminStats({ from, to, source, campaign });
        if (!active) return;
        setStats(statsData);
        setError(null);
      } catch (err: unknown) {
        if (!active) return;
        if (err instanceof Error && err.message === "UNAUTHORIZED") {
          router.replace("/admin/login");
          return;
        }
        setError(adminUz.common.error);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void fetchData();
    return () => {
      active = false;
    };
  }, [authorized, from, to, source, campaign, router]);

  const updateFilters = (newFilters: {
    from: string;
    to: string;
    source: string;
    campaign: string;
  }) => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("from", newFilters.from);
    params.set("to", newFilters.to);
    if (newFilters.source) params.set("source", newFilters.source);
    if (newFilters.campaign) params.set("campaign", newFilters.campaign);
    router.replace(`/admin?${params.toString()}`);
  };

  const handleRetry = () => {
    setLoading(true);
    setError(null);
    void fetchAdminStats({ from, to, source, campaign })
      .then((statsData) => {
        setStats(statsData);
        setLoading(false);
      })
      .catch((err) => {
        if (err instanceof Error && err.message === "UNAUTHORIZED") {
          router.replace("/admin/login");
          return;
        }
        setError(adminUz.common.error);
        setLoading(false);
      });
  };

  if (!authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-varaq text-siyoh">
        <div className="text-sm text-qalam">{adminUz.common.loading}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-varaq text-siyoh">
      <main className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6 flex-1">
        <AdminNav />
        <AdminFilters
          from={from}
          to={to}
          source={source}
          campaign={campaign}
          onApply={updateFilters}
        />

        {error && (
          <div className="rounded-[10px] border border-anor bg-anor/10 p-4 text-xs text-anor flex items-center justify-between gap-4">
            <span>{error}</span>
            <button
              type="button"
              onClick={handleRetry}
              className="rounded-[6px] bg-anor text-white px-2.5 py-1 hover:opacity-90 transition"
            >
              {adminUz.common.retry}
            </button>
          </div>
        )}

        {loading && !stats && (
          <div className="py-20 text-center text-sm text-qalam">
            {adminUz.common.loading}
          </div>
        )}

        {stats && (
          <>
            <KpiCards kpis={stats.kpis} />

            <FunnelChart funnel={stats.funnel} />
            <DropoffBars dropoff={stats.dropoff} />

            <DailyChart daily={stats.daily} />

            <div className="grid grid-cols-1 gap-6">
              <CampaignTable campaigns={stats.campaigns} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center p-4 bg-varaq text-siyoh">
          <div className="text-sm text-qalam">{adminUz.common.loading}</div>
        </div>
      }
    >
      <AdminDashboardContent />
    </Suspense>
  );
}
