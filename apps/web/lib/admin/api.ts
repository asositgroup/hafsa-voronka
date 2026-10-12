import {
  adminStatsResponseSchema,
  type AdminStatsResponse,
} from "@funnel/shared";
import { API_URL } from "@/lib/api";

export async function adminLogin(password: string): Promise<{ ok: boolean; status: number; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/admin/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
      credentials: "include",
    });

    if (res.ok) {
      return { ok: true, status: res.status };
    }

    const data = await res.json().catch(() => ({}));
    return { ok: false, status: res.status, error: data?.error };
  } catch {
    return { ok: false, status: 500, error: "network_error" };
  }
}

export async function adminLogout(): Promise<{ ok: boolean }> {
  try {
    const res = await fetch(`${API_URL}/admin/logout`, {
      method: "POST",
      credentials: "include",
    });
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}

export async function adminMe(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/admin/me`, {
      method: "GET",
      credentials: "include",
    });
    return res.status === 200;
  } catch {
    return false;
  }
}

export async function fetchAdminStats(params: {
  from: string;
  to: string;
  source?: string;
  campaign?: string;
}): Promise<AdminStatsResponse> {
  const query = new URLSearchParams();
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  if (params.source) query.set("source", params.source);
  if (params.campaign) query.set("campaign", params.campaign);

  const res = await fetch(`${API_URL}/admin/stats?${query.toString()}`, {
    method: "GET",
    credentials: "include",
  });

  if (res.status === 401) {
    throw new Error("UNAUTHORIZED");
  }

  if (!res.ok) {
    throw new Error(`STATS_FAILED_${res.status}`);
  }

  const json = await res.json();
  return adminStatsResponseSchema.parse(json);
}

export function getLeadsCsvUrl(params: {
  from: string;
  to: string;
  source?: string;
  campaign?: string;
}): string {
  const query = new URLSearchParams();
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  if (params.source) query.set("source", params.source);
  if (params.campaign) query.set("campaign", params.campaign);

  return `${API_URL}/admin/leads.csv?${query.toString()}`;
}
