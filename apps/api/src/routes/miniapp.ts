import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { sessionRequestSchema, type SessionResponse } from "@funnel/shared";
import type { AppEnv } from "@/auth";
import { db } from "@/db";
import { linkGrants, watchProgress } from "@/db/schema";
import { env } from "@/env";
import { NO_VIDEO_MARKS, statusFor } from "@/funnel/status";
import { logEvent, upsertUser } from "@/funnel/users";
import { acceptSecondChance, openOffer } from "@/links/service";
import { recordMessageClick } from "@/messages/clicks";
import { videoForUser } from "@/videos/service";
import { remainingWatchSecs } from "@/watch/credit";
import { startPlanFor } from "@/watch/offerVideo";
import { effectiveUnlockSec } from "@/watch/unlock";

async function readJson(request: { json: () => Promise<unknown> }) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export const miniappRoutes = new Hono<AppEnv>();

miniappRoutes.post("/session", async (c) => {
  c.header("cache-control", "no-store");
  const { reason, start, sentMessageId } = sessionRequestSchema.catch({ reason: "open" }).parse(await readJson(c.req));
  const now = new Date();
  const profile = c.get("telegramUser");
  let { user } = await upsertUser(profile, c.get("startParam"));
  if (reason === "open" && start === "again" && (await acceptSecondChance(user.id, now)) === "granted") {
    ({ user } = await upsertUser(profile, undefined));
  }
  const video = await videoForUser(user);
  if (!video) {
    return c.json({ error: "no_video" }, 503);
  }

  if (reason === "open") {
    await logEvent("app_open", { userId: user.id, visitorId: user.visitorId });
    if (sentMessageId) {
      await recordMessageClick(sentMessageId, user.id, "web_app", { start }).catch(console.error);
    }
  }

  const [progress] = await db()
    .select()
    .from(watchProgress)
    .where(eq(watchProgress.userId, user.id))
    .limit(1);

  const [grant] =
    user.linkId === null
      ? []
      : await db().select({ offerFirst: linkGrants.offerFirst }).from(linkGrants).where(eq(linkGrants.id, user.linkId)).limit(1);
  const lastPosition = progress?.lastPosition ?? 0;
  const plan = startPlanFor({
    grantOfferFirst: grant?.offerFirst ?? false,
    offerWatchedAt: user.offerWatchedAt,
    video,
    lastPosition,
    start,
  });
  const status = statusFor(progress, video ?? NO_VIDEO_MARKS, user);
  const expired =
    user.registeredAt !== null &&
    user.linkExpiresAt !== null &&
    now >= user.linkExpiresAt &&
    user.completedAt === null &&
    status !== "narxni_kurdi" &&
    status !== "adminga_yozdi";
  const secondChance = expired && (await openOffer(db(), user, now)) !== null;

  return c.json({
    registered: user.registeredAt !== null,
    name: user.name,
    phoneSet: Boolean(user.phone),
    completed: user.completedAt !== null,
    unlocked: user.unlockedAt !== null,
    unlockAt: effectiveUnlockSec(video),
    videoId: video.id,
    priceSec: video.priceSec,
    expired,
    secondChance,
    startAt: plan.startAt,
    startsAtCourse: plan.startsAtCourse,
    offerFirst: plan.offerFirst,
    progress: {
      lastPosition,
      maxPosition: progress?.maxPosition ?? 0,
      remainingSecs: remainingWatchSecs(
        progress?.watchedSecs ?? 0,
        user.completedAt !== null || Boolean(progress?.completed),
        { duration: video.duration, threshold: env.COMPLETE_THRESHOLD },
      ),
    },
    config: {
      videoUrl: video.fileUrl,
      poster: env.VIDEO_POSTER_URL,
      duration: video.duration,
      seekLock: env.SEEK_LOCK,
      gateProceed: env.GATE_PROCEED,
      channelUrl: env.CHANNEL_URL,
    },
  } satisfies SessionResponse);
});

miniappRoutes.post("/second-chance/accept", async (c) => {
  c.header("cache-control", "no-store");
  const { user } = await upsertUser(c.get("telegramUser"), c.get("startParam"));
  const result = await acceptSecondChance(user.id);
  return result === "closed" ? c.json({ error: "offer_closed" }, 409) : c.json({ ok: true, result });
});

miniappRoutes.post("/register", (c) => c.json({ error: "register_in_bot" }, 403));
