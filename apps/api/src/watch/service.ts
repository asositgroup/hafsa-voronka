import { and, eq, isNull } from "drizzle-orm";
import { InlineKeyboard } from "grammy";
import type { EventType } from "@funnel/shared";
import { sendCapiEvent } from "@/capi";
import { db } from "@/db";
import { users, watchProgress } from "@/db/schema";
import { env } from "@/env";
import { findByTelegramId, logEvent } from "@/funnel/users";
import { uz } from "@/i18n/uz";
import { bot } from "@/telegram/bot";
import {
  applyBeat,
  type WatchBeat,
  type WatchConfig,
  type WatchState,
} from "./credit";

export type ProgressResult =
  | { ok: true; completed: boolean; maxPosition: number }
  | { ok: false; error: "not_registered" };

export type EventResult =
  | { ok: true }
  | { ok: false; error: "not_found" };

export async function recordProgress(
  telegramId: number,
  beat: WatchBeat,
  now: Date = new Date(),
  config?: WatchConfig,
): Promise<ProgressResult> {
  const user = await findByTelegramId(telegramId);
  if (!user || user.registeredAt === null) {
    return { ok: false, error: "not_registered" };
  }

  const watchConfig = config ?? {
    duration: env.VIDEO_DURATION_SEC,
    threshold: env.COMPLETE_THRESHOLD,
  };

  const { result } = await db().transaction(async (tx) => {
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

    return { result: res };
  });

  for (const milestone of result.milestones) {
    await logEvent(`progress_${milestone}` as EventType, {
      userId: user.id,
      visitorId: user.visitorId,
    });
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

    void sendCapiEvent({
      name: "VideoComplete",
      eventId: `vc_${user.id}`,
      user: updatedUser ?? user,
    }).catch((error) => console.error("CAPI VideoComplete failed:", error));

    if (!user.botBlocked) {
      try {
        const keyboard = new InlineKeyboard().url(uz.bot.channelButton, env.CHANNEL_URL);
        await bot().api.sendMessage(user.telegramId, uz.bot.completion, {
          reply_markup: keyboard,
        });
      } catch (error) {
        console.error("Failed to send bot completion message:", error);
      }
    }
  }

  return {
    ok: true,
    completed: result.state.completed,
    maxPosition: result.state.maxPosition,
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
    await logEvent("channel_click", {
      userId: user.id,
      visitorId: user.visitorId,
    });
    await db()
      .update(users)
      .set({ channelClickAt: now })
      .where(and(eq(users.id, user.id), isNull(users.channelClickAt)));
  }

  return { ok: true };
}
