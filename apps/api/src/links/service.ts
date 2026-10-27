import { and, eq, sql } from "drizzle-orm";
import { type FunnelStatus, type LinkGrantKind, linkBoundSegments } from "@funnel/shared";
import { db } from "@/db";
import { type LinkGrant, linkGrants, type User, users, videos, watchProgress } from "@/db/schema";
import { syncSegment } from "@/funnel/segments";
import { isLessonClosed, NO_VIDEO_MARKS, segmentFor, statusFor } from "@/funnel/status";
import { logEvent } from "@/funnel/users";
import { refreshUserLeadCards } from "@/leads/service";
import { funnelDayAt, linkExpiryFor } from "@/messages/plan";
import { linkTtlHours } from "@/settings/service";
import { cancelPendingAppointments } from "./appointmentStore";

type Tx = Parameters<Parameters<ReturnType<typeof db>["transaction"]>[0]>[0];
type Reader = Pick<ReturnType<typeof db>, "select">;

export type GrantRequest = {
  kind: LinkGrantKind;
  offerFirst: boolean;
  now: Date;
  ttlHours: number;
  day: number;
  silent?: boolean;
};

const currentEpochOf = (userId: number) =>
  sql<number>`(select ${users.funnelEpoch} from ${users} where ${users.id} = ${userId})`;

export async function insertGrant(tx: Tx, userId: number, request: GrantRequest): Promise<LinkGrant> {
  const expiresAt = linkExpiryFor(request.now, request.ttlHours);
  const epoch = currentEpochOf(userId);
  const [grant] = await tx
    .insert(linkGrants)
    .values({
      userId,
      epoch,
      attempt: sql`(select coalesce(max(${linkGrants.attempt}), 0) + 1 from ${linkGrants} where ${linkGrants.userId} = ${userId} and ${linkGrants.epoch} = ${epoch})`,
      day: request.day,
      kind: request.kind,
      offerFirst: request.offerFirst,
      silent: request.silent ?? false,
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

export async function currentFunnelDay(
  executor: Reader,
  user: Pick<User, "linkId" | "linkExpiresAt">,
  now: Date,
): Promise<number> {
  if (user.linkId === null) return 1;
  const [grant] = await executor.select({ day: linkGrants.day }).from(linkGrants).where(eq(linkGrants.id, user.linkId));
  return grant ? funnelDayAt({ day: grant.day, expiresAt: user.linkExpiresAt }, now) : 1;
}

export type LessonState = { status: FunnelStatus | null; closed: boolean };

export async function lessonState(executor: Reader, user: User, now: Date): Promise<LessonState> {
  const [row] = await executor
    .select({ progress: watchProgress, video: videos })
    .from(users)
    .leftJoin(watchProgress, eq(watchProgress.userId, users.id))
    .leftJoin(videos, eq(videos.id, users.videoId))
    .where(eq(users.id, user.id));
  const status = statusFor(row?.progress ?? undefined, row?.video ?? NO_VIDEO_MARKS, user);
  return { status, closed: isLessonClosed(user, status, now) };
}

export type ReopenResult = "reopened" | "open" | "closed";
export type ReopenSource = "again" | "screen" | "start";

export async function reopenWithin(
  tx: Tx,
  userId: number,
  kind: "again" | "scheduled",
  now: Date,
  ttlHours: number,
  restart = false,
): Promise<ReopenResult> {
  const [user] = await tx.select().from(users).where(eq(users.id, userId)).for("update");
  if (!user || user.registeredAt === null || user.wroteAdminAt !== null || user.botBlocked) return "closed";
  const state = await lessonState(tx, user, now);
  const segment = segmentFor(state.status);
  const restartable = restart && user.completedAt === null && segment !== null && linkBoundSegments.includes(segment);
  if (!state.closed && !restartable) return "open";
  const day = restartable ? 1 : await currentFunnelDay(tx, user, now);
  await insertGrant(tx, userId, { kind, offerFirst: segment === "B", now, ttlHours, day });
  return "reopened";
}

export async function reopenLesson(userId: number, source: ReopenSource, now = new Date()): Promise<ReopenResult> {
  const ttlHours = await linkTtlHours();
  const result = await db().transaction(async (tx) => {
    const outcome = await reopenWithin(tx, userId, "again", now, ttlHours, source === "start");
    if (outcome === "reopened") await cancelPendingAppointments(tx, userId, now, ["reopen"]);
    return outcome;
  });

  if (result !== "reopened") return result;
  await syncSegment(userId, now).catch((error) => console.error("Segment sync failed:", error));
  await logEvent("lesson_reopened", { userId, meta: { source } });
  await refreshUserLeadCards(userId).catch((error) => console.error("Lead card refresh failed:", error));
  return result;
}
