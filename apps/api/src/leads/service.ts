import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { normalizeUzPhone, type LeadRequest } from "@funnel/shared";
import { type CapiClient, sendCapiEvent } from "@/capi";
import { db } from "@/db";
import { type Lead, leads, type User } from "@/db/schema";
import { env } from "@/env";
import { resolveAttribution } from "@/funnel/attribution";
import { logEvent } from "@/funnel/users";
import { uz } from "@/i18n/uz";
import { enqueueLead, formatWebLeadRow, sendLeadInline } from "@/sheets";
import { kickLeadNotifier } from "./notifier";

const RESUBMIT_WINDOW_HOURS = 24;
const MATCH_WINDOW_DAYS = 30;

export type WebLeadResult =
  | { ok: true; lead: Lead }
  | { ok: false; field: "name" | "phone"; message: string };

const bumpNotify = { notifyVersion: sql`${leads.notifyVersion} + 1`, notifyAttempts: 0 };

function trustedPageUrl(url: string | undefined) {
  if (!url) return null;
  try {
    return new URL(url).origin === new URL(env.WEB_URL).origin ? url : null;
  } catch {
    return null;
  }
}

async function utmFor(input: LeadRequest) {
  if (input.utm_source || input.utm_campaign || input.utm_content || input.fbclid) {
    return input;
  }
  return resolveAttribution(`v_${input.visitor_id}`);
}

export async function submitWebLead(input: LeadRequest, client: CapiClient): Promise<WebLeadResult> {
  const phone = normalizeUzPhone(input.phone);
  if (!phone) return { ok: false, field: "phone", message: uz.validation.phoneRequired };

  const [recent] = await db()
    .select()
    .from(leads)
    .where(
      and(
        eq(leads.visitorId, input.visitor_id),
        eq(leads.source, "web"),
        isNull(leads.userId),
        sql`${leads.createdAt} > now() - make_interval(hours => ${RESUBMIT_WINDOW_HOURS})`,
      ),
    )
    .orderBy(desc(leads.id))
    .limit(1);

  if (recent) {
    if (recent.name === input.name && recent.phone === phone) return { ok: true, lead: recent };
    const [updated] = await db()
      .update(leads)
      .set({ name: input.name, phone, ...bumpNotify })
      .where(eq(leads.id, recent.id))
      .returning();
    kickLeadNotifier();
    return { ok: true, lead: updated };
  }

  const utm = await utmFor(input);
  const pageUrl = trustedPageUrl(input.page_url);
  const [lead] = await db()
    .insert(leads)
    .values({
      source: "web",
      visitorId: input.visitor_id,
      name: input.name,
      phone,
      utmSource: utm.utm_source ?? null,
      utmCampaign: utm.utm_campaign ?? null,
      utmContent: utm.utm_content ?? null,
      fbclid: utm.fbclid ?? null,
      pageUrl,
      userAgent: client.userAgent?.slice(0, 500) ?? null,
    })
    .returning();

  await logEvent("lead_submitted", { visitorId: lead.visitorId, meta: { leadId: lead.id } });
  kickLeadNotifier();

  void sendCapiEvent({
    name: "Lead",
    eventId: leadEventId(lead),
    user: { phone: lead.phone, fbclid: lead.fbclid, createdAt: lead.createdAt, visitorId: lead.visitorId },
    externalId: `v_${lead.visitorId}`,
    sourceUrl: pageUrl ?? undefined,
    actionSource: "website",
    client,
  }).catch((error) => console.error("CAPI Lead failed:", error));

  if (env.SHEETS_ENABLED) {
    void enqueueLead(null, formatWebLeadRow(lead))
      .then(sendLeadInline)
      .catch((error) => console.error("Sheets send error:", error));
  }

  return { ok: true, lead };
}

export function leadEventId(lead: Pick<Lead, "id">) {
  return `lead_${lead.id}`;
}

export async function findMatchingWebLead(visitorId: string | null, phone: string | null) {
  const recentUnlinked = and(
    eq(leads.source, "web"),
    isNull(leads.userId),
    sql`${leads.createdAt} > now() - make_interval(days => ${MATCH_WINDOW_DAYS})`,
  );
  const byField = async (condition: ReturnType<typeof eq>) => {
    const [lead] = await db()
      .select()
      .from(leads)
      .where(and(recentUnlinked, condition))
      .orderBy(desc(leads.id))
      .limit(1);
    return lead;
  };

  return (
    (visitorId ? await byField(eq(leads.visitorId, visitorId)) : undefined) ??
    (phone ? await byField(eq(leads.phone, phone)) : undefined)
  );
}

export async function attachLeadToUser(user: User) {
  const match = await findMatchingWebLead(user.visitorId, user.phone);
  if (match) {
    await db()
      .update(leads)
      .set({ userId: user.id, linkedAt: new Date(), ...bumpNotify })
      .where(and(eq(leads.id, match.id), isNull(leads.userId)));
  } else {
    await db().insert(leads).values({
      source: "bot",
      userId: user.id,
      visitorId: user.visitorId,
      name: user.name ?? user.firstName ?? uz.bot.defaultName,
      phone: user.phone ?? "",
      utmSource: user.utmSource,
      utmCampaign: user.utmCampaign,
      utmContent: user.utmContent,
      fbclid: user.fbclid,
      linkedAt: new Date(),
    });
  }
  kickLeadNotifier();
}

export async function markLeadCompleted(userId: number) {
  await db().update(leads).set(bumpNotify).where(eq(leads.userId, userId));
  kickLeadNotifier();
}
