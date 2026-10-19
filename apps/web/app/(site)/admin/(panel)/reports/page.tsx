"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { AdminReportResponse } from "@funnel/shared";
import { DateRangeFilter } from "@/components/admin/DateRangeFilter";
import { MessageReportTable } from "@/components/admin/reports/MessageReportTable";
import { VideoReportTable } from "@/components/admin/reports/VideoReportTable";
import { buttonClass } from "@/components/admin/ui/Button";
import { Page, PageHeader } from "@/components/admin/ui/Page";
import { ErrorState, LoadingState } from "@/components/admin/ui/States";
import { DownloadIcon } from "@/components/icons";
import { addDays, formatDate, getTashkentToday } from "@/lib/admin/dates";
import { fetchAdminReport, getReportXlsxUrl } from "@/lib/admin/reports";
import { adminUz } from "@/lib/i18n/admin";

function AdminReportsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const today = getTashkentToday();
  const from = searchParams.get("from") || addDays(today, -6);
  const to = searchParams.get("to") || today;

  const [report, setReport] = useState<AdminReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const data = await fetchAdminReport({ from, to });
        if (!active) return;
        setReport(data);
        setError(null);
      } catch (err: unknown) {
        if (!active) return;
        if (err instanceof Error && err.message === "UNAUTHORIZED") {
          router.replace("/admin/login");
          return;
        }
        setError(adminUz.common.error);
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [from, to, attempt, router]);

  const updateRange = (range: { from: string; to: string }) => {
    setLoading(true);
    const params = new URLSearchParams({ from: range.from, to: range.to });
    router.replace(`/admin/reports?${params.toString()}`);
  };

  const handleRetry = () => {
    setLoading(true);
    setError(null);
    setAttempt((value) => value + 1);
  };

  return (
    <Page>
      <PageHeader
        title={adminUz.pages.reports.title}
        description={adminUz.pages.reports.description}
        meta={`${formatDate(from)} – ${formatDate(to)}`}
        actions={
          <a
            href={getReportXlsxUrl({ from, to })}
            download
            aria-label={adminUz.reports.exportXlsxLabel}
            title={adminUz.reports.exportXlsxLabel}
            className={buttonClass({ variant: "secondary" })}
          >
            <DownloadIcon className="h-4 w-4" />
            {adminUz.reports.exportXlsx}
          </a>
        }
      />

      <DateRangeFilter key={`${from}_${to}`} from={from} to={to} onApply={updateRange} applyLabel={adminUz.reports.applyButton} />

      {error && <ErrorState onRetry={handleRetry} />}

      {loading && !report && <LoadingState variant="list" rows={3} />}

      {report && (
        <>
          <VideoReportTable rows={report.videos} />
          <MessageReportTable rows={report.messages} />
        </>
      )}
    </Page>
  );
}

export default function AdminReportsPage() {
  return (
    <Suspense fallback={<LoadingState variant="page" />}>
      <AdminReportsContent />
    </Suspense>
  );
}
