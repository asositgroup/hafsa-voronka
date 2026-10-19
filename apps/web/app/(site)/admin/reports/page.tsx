"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { AdminReportResponse } from "@funnel/shared";
import { AdminNav } from "@/components/admin/AdminNav";
import { MessageReportTable } from "@/components/admin/reports/MessageReportTable";
import { ReportRangeFilter } from "@/components/admin/reports/ReportRangeFilter";
import { VideoReportTable } from "@/components/admin/reports/VideoReportTable";
import { addDays, getTashkentToday } from "@/lib/admin/dates";
import { fetchAdminReport } from "@/lib/admin/reports";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import { adminUz } from "@/lib/i18n/admin";

function AdminReportsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const today = getTashkentToday();
  const from = searchParams.get("from") || addDays(today, -6);
  const to = searchParams.get("to") || today;

  const authorized = useAdminSession();
  const [report, setReport] = useState<AdminReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!authorized) return;
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
  }, [authorized, from, to, attempt, router]);

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
        <ReportRangeFilter key={`${from}_${to}`} from={from} to={to} onApply={updateRange} />

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

        {loading && !report && (
          <div className="py-20 text-center text-sm text-qalam">{adminUz.common.loading}</div>
        )}

        {report && (
          <>
            <VideoReportTable rows={report.videos} />
            <MessageReportTable rows={report.messages} />
          </>
        )}
      </main>
    </div>
  );
}

export default function AdminReportsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center p-4 bg-varaq text-siyoh">
          <div className="text-sm text-qalam">{adminUz.common.loading}</div>
        </div>
      }
    >
      <AdminReportsContent />
    </Suspense>
  );
}
