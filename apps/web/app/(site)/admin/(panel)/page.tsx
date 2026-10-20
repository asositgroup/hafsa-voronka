"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { AdminStatsResponse } from "@funnel/shared";
import { CampaignTable } from "@/components/admin/CampaignTable";
import { DailyChart } from "@/components/admin/DailyChart";
import { DateRangeFilter } from "@/components/admin/DateRangeFilter";
import { DropoffBars } from "@/components/admin/DropoffBars";
import { FunnelChart } from "@/components/admin/FunnelChart";
import { KpiCards } from "@/components/admin/KpiCards";
import { buttonClass } from "@/components/admin/ui/Button";
import { Field, Input } from "@/components/admin/ui/Field";
import { Page, PageHeader } from "@/components/admin/ui/Page";
import { ErrorState, LoadingState } from "@/components/admin/ui/States";
import { DownloadIcon } from "@/components/icons";
import { fetchAdminStats, getLeadsCsvUrl } from "@/lib/admin/api";
import { addDays, formatDate, getTashkentToday } from "@/lib/admin/dates";
import { adminUz } from "@/lib/i18n/admin";

function AdminDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const today = getTashkentToday();
  const defaultFrom = addDays(today, -6);

  const from = searchParams.get("from") || defaultFrom;
  const to = searchParams.get("to") || today;
  const source = searchParams.get("source") || "";
  const campaign = searchParams.get("campaign") || "";

  const [stats, setStats] = useState<AdminStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [draftSource, setDraftSource] = useState(source);
  const [draftCampaign, setDraftCampaign] = useState(campaign);

  useEffect(() => {
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
  }, [from, to, source, campaign, attempt, router]);

  const updateFilters = (newFilters: { from: string; to: string; source: string; campaign: string }) => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("from", newFilters.from);
    params.set("to", newFilters.to);
    if (newFilters.source) params.set("source", newFilters.source);
    if (newFilters.campaign) params.set("campaign", newFilters.campaign);
    router.replace(`/admin?${params.toString()}`);
  };

  const handleApply = (range: { from: string; to: string }, submitted: boolean) => {
    updateFilters({
      ...range,
      source: submitted ? draftSource.trim() : source,
      campaign: submitted ? draftCampaign.trim() : campaign,
    });
  };

  const handleReset = () => {
    setDraftSource("");
    setDraftCampaign("");
    updateFilters({ from: defaultFrom, to: today, source: "", campaign: "" });
  };

  const handleRetry = () => {
    setLoading(true);
    setError(null);
    setAttempt((value) => value + 1);
  };

  const csvAction = (
    <a
      href={getLeadsCsvUrl({ from, to, source, campaign })}
      download="leads.csv"
      aria-label={adminUz.leads.exportCsvLabel}
      title={adminUz.leads.exportCsvLabel}
      className={buttonClass({ variant: "secondary" })}
    >
      <DownloadIcon className="h-4 w-4" />
      {adminUz.leads.exportCsv}
    </a>
  );

  const extra = (
    <>
      <Field label={adminUz.filters.sourceLabel} className="lg:w-40">
        {({ id }) => <Input id={id} value={draftSource} onChange={(e) => setDraftSource(e.target.value)} />}
      </Field>
      <Field label={adminUz.filters.campaignLabel} className="lg:w-44">
        {({ id }) => <Input id={id} value={draftCampaign} onChange={(e) => setDraftCampaign(e.target.value)} />}
      </Field>
    </>
  );

  return (
    <Page>
      <PageHeader
        title={adminUz.pages.stats.title}
        description={adminUz.pages.stats.description}
        meta={
          <span className="flex flex-wrap gap-x-3">
            <span>
              {formatDate(from)} – {formatDate(to)}
            </span>
            {(source || campaign) && <span>{[source, campaign].filter(Boolean).join(" / ")}</span>}
          </span>
        }
        actions={csvAction}
      />

      <DateRangeFilter
        key={`${from}_${to}_${source}_${campaign}`}
        from={from}
        to={to}
        onApply={handleApply}
        onReset={handleReset}
        extra={extra}
        extraActive={Boolean(source || campaign)}
        dirtyExtra={draftSource.trim() !== source || draftCampaign.trim() !== campaign}
      />

      {error && <ErrorState onRetry={handleRetry} />}

      {loading && !stats && <LoadingState variant="list" rows={3} />}

      {stats && (
        <>
          <KpiCards kpis={stats.kpis} />
          <FunnelChart funnel={stats.funnel} />
          <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
            <DropoffBars dropoff={stats.dropoff} />
            <DailyChart daily={stats.daily} />
          </div>
          <CampaignTable campaigns={stats.campaigns} />
        </>
      )}
    </Page>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<LoadingState variant="page" />}>
      <AdminDashboardContent />
    </Suspense>
  );
}
