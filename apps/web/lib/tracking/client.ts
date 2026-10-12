import { sendTrackBeacon } from "./beacon";
import { getOrCreateVisitorId } from "./visitor";

export function trackLandingView(): void {
  if (typeof window === "undefined") return;

  const visitor_id = getOrCreateVisitorId();
  const params = new URLSearchParams(window.location.search);

  const utm_source = params.get("utm_source")?.slice(0, 200) || undefined;
  const utm_campaign = params.get("utm_campaign")?.slice(0, 200) || undefined;
  const utm_content = params.get("utm_content")?.slice(0, 200) || undefined;
  const fbclid = params.get("fbclid")?.slice(0, 500) || undefined;
  const referrer =
    typeof document !== "undefined" && document.referrer
      ? document.referrer.slice(0, 500)
      : undefined;

  sendTrackBeacon({
    visitor_id,
    type: "landing_view",
    utm_source,
    utm_campaign,
    utm_content,
    fbclid,
    referrer,
  });
}

export function trackCtaClick(): void {
  if (typeof window === "undefined") return;

  const visitor_id = getOrCreateVisitorId();
  sendTrackBeacon({
    visitor_id,
    type: "cta_click",
  });

  const win = window as unknown as { fbq?: (...args: unknown[]) => void };
  if (typeof win.fbq === "function") {
    try {
      win.fbq("trackCustom", "CTAClick");
    } catch {}
  }
}
