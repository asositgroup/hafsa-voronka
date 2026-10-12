import { sendTrackBeacon } from "./beacon";
import { getOrCreateVisitorId } from "./visitor";

export function readUtmParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    utm_source: params.get("utm_source")?.slice(0, 200) || undefined,
    utm_campaign: params.get("utm_campaign")?.slice(0, 200) || undefined,
    utm_content: params.get("utm_content")?.slice(0, 200) || undefined,
    fbclid: params.get("fbclid")?.slice(0, 500) || undefined,
  };
}

type Fbq = (...args: unknown[]) => void;

function fbq(...args: unknown[]) {
  const win = window as unknown as { fbq?: Fbq };
  if (typeof win.fbq !== "function") return;
  try {
    win.fbq(...args);
  } catch {}
}

export function trackLandingView(): void {
  if (typeof window === "undefined") return;

  const visitor_id = getOrCreateVisitorId();
  const { utm_source, utm_campaign, utm_content, fbclid } = readUtmParams();
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

  fbq("trackCustom", "CTAClick");
}

export function trackLead(eventId: string): void {
  if (typeof window === "undefined") return;
  fbq("track", "Lead", {}, { eventID: eventId });
}
