import { and, eq, isNull } from "drizzle-orm";
import { InlineKeyboard } from "grammy";
import type { EventType } from "@funnel/shared";
import { type CapiClient, sendCapiEvent } from "@/capi";
import { db } from "@/db";
import { linkGrants, users, watchProgress } from "@/db/schema";
import { env } from "@/env";
import { recordChannelClick } from "@/funnel/channel";
import { syncSegment } from "@/funnel/segments";
import { findByTelegramId, logEvent } from "@/funnel/users";
import { refreshUserLeadCards } from "@/leads/service";
import { bot } from "@/telegram/bot";
import { isBlockedError, markBlocked } from "@/telegram/blocked";
import { videoForUser } from "@/videos/service";
import { botText, sendBotText } from "@/telegram/texts";
import {
  applyBeat,
  remainingWatchSecs,
  type WatchBeat,
  type WatchConfig,
  type WatchState,
} from "./credit";
import { isOfferComplete } from "./offerVideo";
import { effectiveUnlockSec } from "./unlock";

export type ProgressResult =
  | { ok: true; completed: boolean; unlocked: boolean; maxPosition: number; remainingSecs: number }
  | { ok: false; error: "not_registered" | "no_video" };

export type EventResult =
  | { ok: true }
  | { ok: false; error: "not_found" };

async function sendUnlockMessage(userId: number, telegramId: number) {
  try {
    const keyboard = new InlineKeyboard().url(await botText("channelButton"), env.CHANNEL_URL);
    await sendBotText(bot().api, telegramId, "completion", {}, keyboard);
  } catch (error) {
    if (isBlockedError(error)) {
      await markBlocked(userId).catch((e) => console.error("Segment sync failed:", e));
    } else {
      console.error("Failed to send bot completion message:", error);
    }
  }
}

export async function recordProgress(
  telegramId: number,
  beat: WatchBeat,
  now: Date = new Date(),
  config?: WatchConfig,
  client?: CapiClient,
): Promise<ProgressResult> {
  const user = await findByTelegramId(telegramId);
  if (!user || user.registeredAt === null) {
    return { ok: false, error: "not_registered" };
  }

  const video = await videoForUser(user);
  if (!video && !config) {
    return { ok: false, error: "no_video" };
  }
  const watchConfig: WatchConfig = config ?? {
    duration: video!.duration,
    threshold: env.COMPLETE_THRESHOLD,
    courseStartSec: video!.courseStartSec,
  };

  const { result, previousMax } = await db().transaction(async (tx) => {
    await tx
      .insert(watchProgress)
      .values({
        userId: user.id,
        startedAt: beat.event === "play" ? now : null,
      })
      .onConflictDoNothing();

    const [locked] = await tx
      .select()
      .from(watchProgress)
      .where(eq(watchProgress.userId, user.id))
      .for("update");

    const state: WatchState = {
      maxPosition: locked.maxPosition,
      watchedSecs: locked.watchedSecs,
      lastPosition: locked.lastPosition,
      lastBeatAt: locked.lastBeatAt,
      playing: locked.playing,
      completed: locked.completed,
    };

    const res = applyBeat(state, beat, now, watchConfig);
    const startedAt = locked.startedAt ?? (beat.event === "play" ? now : null);

    if (!res.ignored) {
      await tx
        .update(watchProgress)
        .set({
          maxPosition: res.state.maxPosition,
          watchedSecs: res.state.watchedSecs,
          lastBeatAt: res.state.lastBeatAt,
          lastPosition: res.state.lastPosition,
          playing: res.state.playing,
          completed: res.state.completed,
          startedAt,
        })
        .where(eq(watchProgress.userId, user.id));
    }

    return { result: res, previousMax: locked.maxPosition };
  });

  if (!result.ignored) {
    await syncSegment(user.id, now).catch((error) => console.error("Segment sync failed:", error));
  }

  for (const milestone of result.milestones) {
    await logEvent(`progress_${milestone}` as EventType, {
      userId: user.id,
      visitorId: user.visitorId,
    });
  }

  const priceSec = video?.priceSec ?? null;
  if (!result.ignored && priceSec !== null && previousMax < priceSec && result.state.maxPosition >= priceSec) {
    await logEvent("price_reached", {
      userId: user.id,
      visitorId: user.visitorId,
      meta: { videoId: video!.id, priceSec },
    });
  }

  if (result.milestones.length > 0 && !result.completedNow) {
    await refreshUserLeadCards(user.id).catch((error) =>
      console.error("Lead progress update failed:", error),
    );
  }

  const unlockSec = effectiveUnlockSec(video);
  const unlockReached =
    !result.ignored &&
    user.unlockedAt === null &&
    (result.state.completed || (unlockSec !== null && result.state.maxPosition >= unlockSec));
  if (unlockReached) {
    const [unlockedUser] = await db()
      .update(users)
      .set({ unlockedAt: now })
      .where(and(eq(users.id, user.id), isNull(users.unlockedAt)))
      .returning();
    if (unlockedUser && !user.botBlocked) {
      await sendUnlockMessage(user.id, user.telegramId);
    }
  }

  if (result.completedNow) {
    const [updatedUser] = await db()
      .update(users)
      .set({ completedAt: now })
      .where(and(eq(users.id, user.id), isNull(users.completedAt)))
      .returning();

    await logEvent("video_complete", {
      userId: user.id,
      visitorId: user.visitorId,
    });

    await refreshUserLeadCards(user.id).catch((error) =>
      console.error("Lead completion update failed:", error),
    );

    void sendCapiEvent({
      name: "VideoComplete",
      eventId: `vc_${user.id}`,
      user: updatedUser ?? user,
      client,
    }).catch((error) => console.error("CAPI VideoComplete failed:", error));

  }

  return {
    ok: true,
    completed: result.state.completed,
    unlocked: user.unlockedAt !== null || unlockReached,
    maxPosition: result.state.maxPosition,
    remainingSecs: remainingWatchSecs(result.state.watchedSecs, result.state.completed, watchConfig),
  };
}

export async function recordVideoEvent(
  telegramId: number,
  type: "video_start" | "channel_click",
  now: Date = new Date(),
): Promise<EventResult> {
  const user = await findByTelegramId(telegramId);
  if (!user) {
    return { ok: false, error: "not_found" };
  }

  if (type === "video_start") {
    await logEvent("video_start", {
      userId: user.id,
      visitorId: user.visitorId,
    });
  } else if (type === "channel_click") {
    await recordChannelClick(user, now);
  }

  return { ok: true };
}

export type OfferProgressResult =
  | { ok: true; completed: boolean }
  | { ok: false; error: "not_registered" | "no_offer_video" };

export async function recordOfferProgress(
  telegramId: number,
  beat: WatchBeat,
  now: Date = new Date(),
): Promise<OfferProgressResult> {
  const user = await findByTelegramId(telegramId);
  if (!user || user.registeredAt === null) {
    return { ok: false, error: "not_registered" };
  }

  const video = await videoForUser(user);
  const duration = video?.shortOfferVideoUrl ? video.shortOfferDuration : null;
  if (duration === null || duration === undefined || user.linkId === null) {
    return { ok: false, error: "no_offer_video" };
  }
  const [grant] = await db()
    .select({ offerFirst: linkGrants.offerFirst })
    .from(linkGrants)
    .where(eq(linkGrants.id, user.linkId))
    .limit(1);
  if (!grant?.offerFirst) {
    return { ok: false, error: "no_offer_video" };
  }
  if (user.offerWatchedAt !== null) {
    return { ok: true, completed: true };
  }

  let startedAt = user.offerStartedAt;
  if (startedAt === null && beat.event === "play") {
    await db()
      .update(users)
      .set({ offerStartedAt: now })
      .where(and(eq(users.id, user.id), isNull(users.offerStartedAt)));
    startedAt = now;
  }

  if (!isOfferComplete({ position: beat.position, duration, startedAt, now })) {
    return { ok: true, completed: false };
  }

  const [watched] = await db()
    .update(users)
    .set({ offerWatchedAt: now, unlockedAt: user.unlockedAt ?? now })
    .where(and(eq(users.id, user.id), isNull(users.offerWatchedAt)))
    .returning({ id: users.id });
  if (watched) {
    await logEvent("offer_video_complete", {
      userId: user.id,
      visitorId: user.visitorId,
      meta: { videoId: video!.id },
    });
    await syncSegment(user.id, now).catch((error) => console.error("Segment sync failed:", error));
    await refreshUserLeadCards(user.id).catch((error) =>
      console.error("Lead offer video update failed:", error),
    );
  }
  return { ok: true, completed: true };
}
