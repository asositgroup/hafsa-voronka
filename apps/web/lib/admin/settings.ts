import { type AdminSettings, adminSettingsSchema } from "@funnel/shared";
import { API_URL } from "@/lib/api";
import { authHeaders } from "@/lib/admin/api";

export type SettingsResult = { ok: true; settings: AdminSettings } | { ok: false; status: number };

async function call(init: RequestInit = {}): Promise<SettingsResult> {
  try {
    const res = await fetch(`${API_URL}/admin/settings`, {
      ...init,
      headers: {
        ...authHeaders(),
        ...(init.body ? { "content-type": "application/json" } : {}),
      },
      credentials: "include",
    });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, settings: adminSettingsSchema.parse(await res.json()) };
  } catch {
    return { ok: false, status: 0 };
  }
}

export const fetchSettings = () => call();
export const saveSettings = (input: AdminSettings) => call({ method: "PUT", body: JSON.stringify(input) });
