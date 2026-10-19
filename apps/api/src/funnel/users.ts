import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import type { EventType } from "@funnel/shared";
import { events, users } from "@/db/schema";
import { resolveAttribution } from "./attribution";

export type TelegramProfile = {
  id: number;
  username?: string;
  first_name?: string;
  language_code?: string;
};

export async function upsertUser(
  profile: TelegramProfile,
  startParam: string | undefined,
) {
  const profileFields = {
    username: profile.username ?? null,
    firstName: profile.first_name ?? null,
    languageCode: profile.language_code ?? null,
  };

  const [existing] = await db()
    .select()
    .from(users)
    .where(eq(users.telegramId, profile.id))
    .limit(1);

  if (existing) {
    const [updated] = await db()
      .update(users)
      .set(profileFields)
      .where(eq(users.id, existing.id))
      .returning();
    return { user: updated, isNew: false };
  }

  const attribution = await resolveAttribution(startParam);
  const [created] = await db()
    .insert(users)
    .values({
      telegramId: profile.id,
      ...profileFields,
      startParam: startParam || null,
      visitorId: attribution.visitorId ?? null,
      utmSource: attribution.utm_source ?? null,
      utmCampaign: attribution.utm_campaign ?? null,
      utmContent: attribution.utm_content ?? null,
      fbclid: attribution.fbclid ?? null,
      videoId: sql`(select id from videos where is_active)`,
    })
    .onConflictDoUpdate({ target: users.telegramId, set: profileFields })
    .returning();
  return { user: created, isNew: true };
}

export async function saveContactPhone(profile: TelegramProfile, phone: string) {
  const { user } = await upsertUser(profile, undefined);
  const [updated] = await db()
    .update(users)
    .set({ phone, phoneVerified: true })
    .where(eq(users.id, user.id))
    .returning();
  return updated;
}

export async function markRegistered(
  userId: number,
  fields: { name: string; phone: string; phoneVerified: boolean },
) {
  const [updated] = await db()
    .update(users)
    .set({ ...fields, registeredAt: new Date() })
    .where(and(eq(users.id, userId), isNull(users.registeredAt)))
    .returning();
  return updated;
}

export async function setBotBlocked(telegramId: number, blocked: boolean) {
  await db().update(users).set({ botBlocked: blocked }).where(eq(users.telegramId, telegramId));
}

export async function findByTelegramId(telegramId: number) {
  const [user] = await db().select().from(users).where(eq(users.telegramId, telegramId)).limit(1);
  return user;
}

export async function logEvent(
  type: EventType,
  fields: { userId?: number; visitorId?: string | null; meta?: Record<string, unknown> },
) {
  await db().insert(events).values({
    type,
    userId: fields.userId,
    visitorId: fields.visitorId ?? null,
    meta: fields.meta,
  });
}
