import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { type FunnelStatus, type LinkGrantKind, offerVariantFor } from "@funnel/shared";
import { db } from "@/db";
import { type LinkGrant, linkGrants, secondChanceOffers, type User, users, watchProgress } from "@/db/schema";
import { linkStateFor } from "@/funnel/secondChance";
import { NO_VIDEO_MARKS, statusFor } from "@/funnel/status";
import { syncSegment } from "@/funnel/segments";
import { logEvent } from "@/funnel/users";
import { refreshUserLeadCards } from "@/leads/service";
import { linkExpiryFor } from "@/messages/plan";
import { linkTtlHours } from "@/settings/service";
import { videoForUser } from "@/videos/service";
import { cancelPendingAppointments } from "./appointmentStore";
import { offerHistory } from "./offers";

type Tx = Parameters<Parameters<ReturnType<typeof db>["transaction"]>[0]>[0];
type Executor = Pick<ReturnType<typeof db>, "select">;

export type GrantRequest = { kind: LinkGrantKind; offerFirst: boolean; now: Date; ttlHours: number };

export async function insertGrant(tx: Tx, userId: number, request: GrantRequest): Promise<LinkGrant> {
  const expiresAt = linkExpiryFor(request.now, request.ttlHours);
  const [grant] = await tx
    .insert(linkGrants)
    .values({
      userId,
      attempt: sql`(select coalesce(max(${linkGrants.attempt}), 0) + 1 from ${linkGrants} where ${linkGrants.userId} = ${userId})`,
      kind: request.kind,
      offerFirst: request.offerFirst,
      givenAt: request.now,
      expiresAt,
    })
    .returning();
  await tx
    .update(users)
    .set({ linkId: grant.id, linkGivenAt: request.now, linkExpiresAt: expiresAt })
    .where(eq(users.id, userId));
  return grant;
}

export async function openOffer(executor: Executor, user: Pick<User, "id" | "linkId" | "linkExpiresAt" | "wroteAdminAt">, now: Date) {
  if (user.linkId === null || user.wroteAdminAt !== null) return null;
  if (user.linkExpiresAt === null || user.linkExpiresAt.getTime() > now.getTime()) return null;
  const [offer] = await executor
    .select()
    .from(secondChanceOffers)
    .where(
      and(
        eq(secondChanceOffers.userId, user.id),
        eq(secondChanceOffers.expiredLinkId, user.linkId),
        eq(secondChanceOffers.skipped, false),
        isNotNull(secondChanceOffers.sentMessageId),
      ),
    )
    .orderBy(desc(secondChanceOffers.occasion))
    .limit(1);
  if (!offer || offer.answer === "again") return null;
  const state = linkStateFor({ history: await offerHistory(executor, user.id), expiresAt: user.linkExpiresAt }, now);
  return state === "expired" ? offer : null;
}

export function linkExpiredBeforePrice(
  user: Pick<User, "registeredAt" | "linkExpiresAt" | "completedAt">,
  status: FunnelStatus | null,
  now: Date,
) {
  return (
    user.registeredAt !== null &&
    user.linkExpiresAt !== null &&
    now >= user.linkExpiresAt &&
    user.completedAt === null &&
    status !== "narxni_kurdi" &&
    status !== "adminga_yozdi"
  );
}

async function expiredStatus(tx: Tx, user: User, now: Date) {
  const [progress] = await tx.select().from(watchProgress).where(eq(watchProgress.userId, user.id)).limit(1);
  const status = statusFor(progress, (await videoForUser(user)) ?? NO_VIDEO_MARKS, user);
  return linkExpiredBeforePrice(user, status, now) ? status : undefined;
}

export type AcceptResult = "granted" | "already" | "closed";

export async function acceptSecondChance(userId: number, now = new Date()): Promise<AcceptResult> {
  const ttlHours = await linkTtlHours();
  const result = await db().transaction(async (tx): Promise<AcceptResult> => {
    const [user] = await tx.select().from(users).where(eq(users.id, userId)).for("update");
    if (!user || user.registeredAt === null) return "closed";
    const offer = await openOffer(tx, user, now);
    if (!offer) {
      const status = await expiredStatus(tx, user, now);
      if (status !== undefined) {
        await insertGrant(tx, userId, {
          kind: "again",
          offerFirst: offerVariantFor(status) === "no_price",
          now,
          ttlHours,
        });
        await cancelPendingAppointments(tx, userId, now, ["reopen"]);
        return "granted";
      }
      const [latest] = await tx
        .select({ answer: secondChanceOffers.answer, grantedLinkId: secondChanceOffers.grantedLinkId })
        .from(secondChanceOffers)
        .where(eq(secondChanceOffers.userId, userId))
        .orderBy(desc(secondChanceOffers.occasion))
        .limit(1);
      return latest?.answer === "again" && latest.grantedLinkId === user.linkId ? "already" : "closed";
    }
    const grant = await insertGrant(tx, userId, {
      kind: "again",
      offerFirst: offer.variant === "no_price",
      now,
      ttlHours,
    });
    await tx
      .update(secondChanceOffers)
      .set({ answer: "again", answeredAt: now, grantedLinkId: grant.id })
      .where(eq(secondChanceOffers.id, offer.id));
    await cancelPendingAppointments(tx, userId, now, ["reopen"]);
    return "granted";
  });

  if (result !== "granted") return result;
  await syncSegment(userId, now).catch((error) => console.error("Segment sync failed:", error));
  await logEvent("second_chance_again", { userId });
  await refreshUserLeadCards(userId).catch((error) => console.error("Lead card refresh failed:", error));
  return result;
}

export async function answerLater(userId: number, sentMessageId: number, now = new Date()): Promise<boolean> {
  const [answered] = await db()
    .update(secondChanceOffers)
    .set({ answer: "later", answeredAt: now })
    .where(
      and(
        eq(secondChanceOffers.userId, userId),
        eq(secondChanceOffers.sentMessageId, sentMessageId),
        sql`${secondChanceOffers.answer} is null`,
      ),
    )
    .returning({ id: secondChanceOffers.id });
  if (!answered) return false;
  await logEvent("second_chance_later", { userId, meta: { offerId: answered.id } });
  await refreshUserLeadCards(userId).catch((error) => console.error("Lead card refresh failed:", error));
  return true;
}
