import { adminReportResponseSchema, type AdminReportResponse } from "@funnel/shared";
import { API_URL } from "@/lib/api";
import { authHeaders, getAdminToken } from "./api";

export async function fetchAdminReport(params: { from: string; to: string }): Promise<AdminReportResponse> {
  const query = new URLSearchParams({ from: params.from, to: params.to });

  const res = await fetch(`${API_URL}/admin/reports?${query.toString()}`, {
    method: "GET",
    headers: authHeaders(),
    credentials: "include",
  });

  if (res.status === 401) {
    throw new Error("UNAUTHORIZED");
  }

  if (!res.ok) {
    throw new Error(`REPORTS_FAILED_${res.status}`);
  }

  return adminReportResponseSchema.parse(await res.json());
}

export function getReportXlsxUrl(params: { from: string; to: string }): string {
  const query = new URLSearchParams({ from: params.from, to: params.to });
  const token = getAdminToken();
  if (token) query.set("token", token);

  return `${API_URL}/admin/reports/export.xlsx?${query.toString()}`;
}
