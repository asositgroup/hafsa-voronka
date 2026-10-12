import { type BotTextItem, type BotTextKey, botTextsResponseSchema } from "@funnel/shared";
import { API_URL } from "@/lib/api";
import { authHeaders } from "@/lib/admin/api";

export type BotTextsResult =
  | { ok: true; items: BotTextItem[]; mediaEnabled?: boolean }
  | { ok: false; status: number; error?: string };

async function call(path: string, init: RequestInit = {}): Promise<BotTextsResult> {
  try {
    const res = await fetch(`${API_URL}/admin/bot-texts${path}`, {
      ...init,
      headers: { ...authHeaders(), ...(init.headers as Record<string, string>) },
      credentials: "include",
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, status: res.status, error: json?.error };
    const parsed = botTextsResponseSchema.partial({ mediaEnabled: true }).parse(json);
    return { ok: true, items: parsed.items, mediaEnabled: parsed.mediaEnabled };
  } catch {
    return { ok: false, status: 0, error: "network_error" };
  }
}

export function fetchBotTexts() {
  return call("");
}

export function saveBotText(key: BotTextKey, text: string) {
  return call(`/${key}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  });
}

export function resetBotText(key: BotTextKey) {
  return call(`/${key}`, { method: "DELETE" });
}

export function uploadBotMedia(key: BotTextKey, file: File) {
  const form = new FormData();
  form.append("file", file);
  return call(`/${key}/media`, { method: "POST", body: form });
}

export function removeBotMedia(key: BotTextKey) {
  return call(`/${key}/media`, { method: "DELETE" });
}

export function botMediaUrl(item: BotTextItem) {
  return `${API_URL}/admin/bot-texts/${item.key}/media?v=${encodeURIComponent(item.updatedAt ?? "")}`;
}
