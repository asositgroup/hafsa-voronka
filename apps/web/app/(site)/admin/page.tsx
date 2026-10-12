"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { AdminLeadsResponse, AdminStatsResponse } from "@funnel/shared";
import { AdminFilters } from "@/components/admin/AdminFilters";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { CampaignTable } from "@/components/admin/CampaignTable";
import { DailyChart } from "@/components/admin/DailyChart";
import { DropoffBars } from "@/components/admin/DropoffBars";
import { FunnelChart } from "@/components/admin/FunnelChart";
import { KpiCards } from "@/components/admin/KpiCards";
import { LeadsTable } from "@/components/admin/LeadsTable";
import { adminMe, fetchAdminLeads, fetchAdminStats } from "@/lib/admin/api";
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
  const page = Number(searchParams.get("page")) || 1;

  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [stats, setStats] = useState<AdminStatsResponse | null>(null);
  const [leads, setLeads] = useState<AdminLeadsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void adminMe().then((isLoggedIn) => {
      if (!active) return;
      if (!isLoggedIn) {
        router.replace("/admin/login");
      } else {
        setAuthorized(true);
      }
    });
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (!authorized) return;
    let active = true;

    async function fetchData() {
      try {
        const [statsData, leadsData] = await Promise.all([
          fetchAdminStats({ from, to, source, campaign }),
          fetchAdminLeads({ from, to, source, campaign, page }),
        ]);
        if (!active) return;
        setStats(statsData);
        setLeads(leadsData);
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
  }, [authorized, from, to, source, campaign, page, router]);

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
    params.set("page", "1");
    router.replace(`/admin?${params.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    setLoading(true);
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(newPage));
    router.replace(`/admin?${params.toString()}`);
  };

  const handleRetry = () => {
    setLoading(true);
    setError(null);
    void Promise.all([
      fetchAdminStats({ from, to, source, campaign }),
      fetchAdminLeads({ from, to, source, campaign, page }),
    ])
      .then(([statsData, leadsData]) => {
        setStats(statsData);
        setLeads(leadsData);
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

  if (authorized === null) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-sm text-zinc-500">{adminUz.common.loading}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#09090B]">
      {stats && <AdminHeader health={stats.health} />}

      <main className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6 flex-1">
        <AdminFilters
          from={from}
          to={to}
          source={source}
          campaign={campaign}
          onApply={updateFilters}
        />

        {error && (
          <div className="rounded-xl border border-rose-800/60 bg-rose-950/40 p-4 text-xs text-rose-300 flex items-center justify-between gap-4">
            <span>{error}</span>
            <button
              type="button"
              onClick={handleRetry}
              className="rounded bg-rose-900/60 px-2.5 py-1 text-white hover:bg-rose-800 transition"
            >
              {adminUz.common.retry}
            </button>
          </div>
        )}

        {loading && !stats && (
          <div className="py-20 text-center text-sm text-zinc-500">
            {adminUz.common.loading}
          </div>
        )}

        {stats && (
          <>
            <KpiCards kpis={stats.kpis} />

            <div className="grid grid-cols-1 gap-6">
              <FunnelChart funnel={stats.funnel} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <DailyChart daily={stats.daily} />
              <DropoffBars dropoff={stats.dropoff} />
            </div>

            <div className="grid grid-cols-1 gap-6">
              <CampaignTable campaigns={stats.campaigns} />
            </div>

            {leads && (
              <div className="grid grid-cols-1 gap-6">
                <LeadsTable
                  data={leads}
                  from={from}
                  to={to}
                  source={source}
                  campaign={campaign}
                  onPageChange={handlePageChange}
                />
              </div>
            )}
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
        <div className="flex min-h-screen items-center justify-center p-4">
          <div className="text-sm text-zinc-500">{adminUz.common.loading}</div>
        </div>
      }
    >
      <AdminDashboardContent />
    </Suspense>
  );
}
