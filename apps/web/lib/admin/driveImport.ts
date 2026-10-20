import {
  type DriveConfig,
  type DriveImport,
  type DriveImportError,
  driveConfigSchema,
  driveImportSchema,
} from "@funnel/shared";
import { API_URL } from "@/lib/api";
import { authHeaders } from "@/lib/admin/api";

export type DriveImportFailure = DriveImportError | "import_in_progress" | "uploads_not_configured" | "network_error";

export type StartDriveImportResult = { ok: true; item: DriveImport } | { ok: false; error: DriveImportFailure };

async function request(path: string, init: RequestInit = {}) {
  const res = await fetch(`${API_URL}/admin/videos/drive${path}`, {
    ...init,
    headers: {
      ...authHeaders(),
      ...(init.body ? { "content-type": "application/json" } : {}),
    },
    credentials: "include",
  });
  const json = await res.json().catch(() => ({}));
  return { res, json };
}

export async function fetchDriveConfig(): Promise<DriveConfig | null> {
  try {
    const { res, json } = await request("");
    return res.ok ? driveConfigSchema.parse(json) : null;
  } catch {
    return null;
  }
}

export async function startDriveImport(input: { url: string; title?: string }): Promise<StartDriveImportResult> {
  try {
    const { res, json } = await request("/imports", { method: "POST", body: JSON.stringify(input) });
    if (!res.ok) return { ok: false, error: json?.error ?? "network_error" };
    return { ok: true, item: driveImportSchema.parse(json) };
  } catch {
    return { ok: false, error: "network_error" };
  }
}

export async function fetchDriveImport(id: number): Promise<DriveImport | null> {
  try {
    const { res, json } = await request(`/imports/${id}`);
    return res.ok ? driveImportSchema.parse(json) : null;
  } catch {
    return null;
  }
}
