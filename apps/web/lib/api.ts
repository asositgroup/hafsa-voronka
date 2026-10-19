import { sessionResponseSchema, type SessionRequest, type SessionResponse } from "@funnel/shared";
import { readMessageRef, readStartMode } from "@/lib/telegram";

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export function miniAppPost(path: string, initData: string, body?: unknown) {
  return fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      authorization: `tma ${initData}`,
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function miniAppBeacon(path: string, initData: string, body: Record<string, unknown>) {
  const payload = new Blob([JSON.stringify({ ...body, initData })], { type: "text/plain" });
  if (navigator.sendBeacon?.(`${API_URL}${path}`, payload)) return;
  void fetch(`${API_URL}${path}`, { method: "POST", body: payload, keepalive: true }).catch(() => {});
}

export async function fetchSession(
  initData: string,
  request: SessionRequest = { reason: "open" },
): Promise<SessionResponse> {
  const res = await miniAppPost("/app/session", initData, {
    ...request,
    start: readStartMode(),
    sentMessageId: request.reason === "poll" ? undefined : readMessageRef(),
  });
  if (!res.ok) {
    throw new Error(`Session request failed: ${res.status}`);
  }
  return sessionResponseSchema.parse(await res.json());
}

