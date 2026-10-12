import type { TrackRequest } from "@funnel/shared";
import { API_URL } from "@/lib/api";

export function sendTrackBeacon(data: TrackRequest): void {
  const url = `${API_URL}/track`;
  const json = JSON.stringify(data);
  const blob = new Blob([json], { type: "text/plain" });

  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    try {
      const sent = navigator.sendBeacon(url, blob);
      if (sent) return;
    } catch {}
  }

  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: json,
    keepalive: true,
  }).catch(() => {});
}
