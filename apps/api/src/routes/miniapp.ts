import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { sessionRequestSchema, type SessionResponse } from "@funnel/shared";
import type { AppEnv } from "@/auth";
import { db } from "@/db";
import { watchProgress } from "@/db/schema";
import { env } from "@/env";
import { logEvent, upsertUser } from "@/funnel/users";
import { videoForUser } from "@/videos/service";
import { remainingWatchSecs } from "@/watch/credit";

async function readJson(request: { json: () => Promise<unknown> }) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export const miniappRoutes = new Hono<AppEnv>();

miniappRoutes.post("/session", async (c) => {
  const { reason, start } = sessionRequestSchema.catch({ reason: "open" }).parse(await readJson(c.req));
  const { user } = await upsertUser(c.get("telegramUser"), c.get("startParam"));
  const video = await videoForUser(user);
  if (!video) {
    return c.json({ error: "no_video" }, 503);
  }

  if (reason === "open") {
    await logEvent("app_open", { userId: user.id, visitorId: user.visitorId });
  }

  const [progress] = await db()
    .select()
    .from(watchProgress)
    .where(eq(watchProgress.userId, user.id))
    .limit(1);

  const lastPosition = progress?.lastPosition ?? 0;
  const expired =
    user.registeredAt !== null &&
    user.linkExpiresAt !== null &&
    new Date() >= user.linkExpiresAt &&
    user.completedAt === null &&
    user.channelClickAt === null;

  return c.json({
    registered: user.registeredAt !== null,
    name: user.name,
    phoneSet: Boolean(user.phone),
    completed: user.completedAt !== null,
    expired,
    startAt: start === "offer" ? (video.courseStartSec ?? lastPosition) : lastPosition,
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

miniappRoutes.post("/register", (c) => c.json({ error: "register_in_bot" }, 403));
