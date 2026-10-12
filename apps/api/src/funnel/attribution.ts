import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import type { Utm } from "@funnel/shared";
import { campaignLinks, events } from "@/db/schema";

const VISITOR_PREFIX = "v_";
const CAMPAIGN_PREFIX = "c_";

export type Attribution = Utm & { visitorId?: string };

export function parseStartParam(param: string | undefined) {
  if (!param || !/^[A-Za-z0-9_-]{1,64}$/.test(param)) return null;
  if (param.startsWith(VISITOR_PREFIX)) {
    return { kind: "visitor" as const, value: param.slice(VISITOR_PREFIX.length) };
  }
  if (param.startsWith(CAMPAIGN_PREFIX)) {
    return { kind: "campaign" as const, value: param.slice(CAMPAIGN_PREFIX.length) };
  }
  return null;
}

function pickUtm(source: Utm | null | undefined): Utm {
  return {
    utm_source: source?.utm_source,
    utm_campaign: source?.utm_campaign,
    utm_content: source?.utm_content,
    fbclid: source?.fbclid,
  };
}

export async function resolveAttribution(param: string | undefined): Promise<Attribution> {
  const parsed = parseStartParam(param);
  if (!parsed) return {};

  if (parsed.kind === "visitor") {
    const [landing] = await db()
      .select({ meta: events.meta })
      .from(events)
      .where(and(eq(events.visitorId, parsed.value), eq(events.type, "landing_view")))
      .orderBy(asc(events.createdAt))
      .limit(1);
    return { visitorId: parsed.value, ...pickUtm(landing?.meta as Utm | undefined) };
  }

  const [campaign] = await db()
    .select({ utm: campaignLinks.utm })
    .from(campaignLinks)
    .where(eq(campaignLinks.code, parsed.value))
    .limit(1);
  return pickUtm(campaign?.utm);
}
