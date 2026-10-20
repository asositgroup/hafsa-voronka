import { and, asc, eq, gt, lt, sql } from "drizzle-orm";
import { GrammyError, type InlineKeyboard } from "grammy";
import type { OfferAnswer } from "@funnel/shared";
import { db, rawClient } from "@/db";
import { type Lead, leads, users, videos, watchProgress } from "@/db/schema";
import { env } from "@/env";
import { notAdminTelegramId } from "@/telegram/admins";
import { bot } from "@/telegram/bot";
import {
  type CardUser,
  renderCompletionReply,
  renderLeadCard,
  renderLeadKeyboard,
  watchedPercent,
} from "./card";
import { flushLeadSheet } from "./sheet";

const NOTIFY_LOCK_KEY = 849204813;
const RETRY_INTERVAL_MS = 60 * 1000;
const MAX_ATTEMPTS = 10;
const MAX_AGE_DAYS = 3;
const BATCH_SIZE = 50;

export const bumpLeadVersion = {
  notifyVersion: sql`${leads.notifyVersion} + 1`,
  notifyAttempts: 0,
  sheetsAttempts: 0,
};

export type LeadSender = {
  send(text: string, options?: { replyTo?: number; keyboard?: InlineKeyboard }): Promise<number>;
  edit(messageId: number, text: string, keyboard: InlineKeyboard): Promise<void>;
};

function telegramSender(initialChatId: string, threadId: number | undefined): LeadSender {
  let targetChatId = initialChatId;
  return {
    async send(text, { replyTo, keyboard } = {}) {
      try {
        const message = await bot().api.sendMessage(targetChatId, text, {
          message_thread_id: threadId,
          link_preview_options: { is_disabled: true },
          reply_markup: keyboard,
          reply_parameters: replyTo
            ? { message_id: replyTo, allow_sending_without_reply: true }
            : undefined,
        });
        return message.message_id;
      } catch (error) {
        if (error instanceof GrammyError && error.parameters?.migrate_to_chat_id) {
          targetChatId = String(error.parameters.migrate_to_chat_id);
          console.warn(`[telegramSender] Chat migrated to supergroup ${targetChatId}, retrying...`);
          const message = await bot().api.sendMessage(targetChatId, text, {
            message_thread_id: threadId,
            link_preview_options: { is_disabled: true },
            reply_markup: keyboard,
            reply_parameters: replyTo
              ? { message_id: replyTo, allow_sending_without_reply: true }
              : undefined,
          });
          return message.message_id;
        }
        throw error;
      }
    },
    async edit(messageId, text, keyboard) {
      try {
        await bot().api.editMessageText(targetChatId, messageId, text, {
          link_preview_options: { is_disabled: true },
          reply_markup: keyboard,
        });
      } catch (error) {
        if (error instanceof GrammyError && error.description.includes("message is not modified")) {
          return;
        }
        if (error instanceof GrammyError && error.parameters?.migrate_to_chat_id) {
          targetChatId = String(error.parameters.migrate_to_chat_id);
          await bot().api.editMessageText(targetChatId, messageId, text, {
            link_preview_options: { is_disabled: true },
            reply_markup: keyboard,
          });
          return;
        }
        throw error;
      }
    },
  };
}

export function leadSender(): LeadSender | undefined {
  return env.LEADS_CHAT_ID ? telegramSender(env.LEADS_CHAT_ID, env.LEADS_THREAD_ID) : undefined;
}

export async function syncLeadCard(lead: Lead, user: CardUser | null, sender: LeadSender) {
  const text = renderLeadCard(lead, user);
  const keyboard = renderLeadKeyboard(lead, user);
  let messageId = lead.notifyMessageId;
  if (messageId === null) {
    messageId = await sender.send(text, { keyboard });
    await db().update(leads).set({ notifyMessageId: messageId }).where(eq(leads.id, lead.id));
  } else {
    await sender.edit(messageId, text, keyboard);
  }

  if (user?.completedAt && !lead.completionNotified) {
    await sender.send(renderCompletionReply(lead), { replyTo: messageId });
    await db().update(leads).set({ completionNotified: true }).where(eq(leads.id, lead.id));
  }
}

async function flushPending(sender: LeadSender) {
  const pending = await db()
    .select({
      lead: leads,
      user: users,
      maxPosition: watchProgress.maxPosition,
      duration: videos.duration,
      offered: sql<number>`(select count(*) from second_chance_offers o where o.user_id = ${leads.userId} and o.sent_message_id is not null)::int`,
      lastAnswer: sql<OfferAnswer | null>`(select o.answer from second_chance_offers o where o.user_id = ${leads.userId} and o.sent_message_id is not null order by o.occasion desc limit 1)`,
      exhausted: sql<boolean>`exists (select 1 from segment_runs r where r.user_id = ${leads.userId} and r.end_reason = 'offers_exhausted')`,
      appointmentAt: sql<Date | null>`(select a.chosen_at from watch_appointments a where a.user_id = ${leads.userId} and a.fired_at is null and a.cancelled_at is null limit 1)`,
    })
    .from(leads)
    .leftJoin(users, eq(users.id, leads.userId))
    .leftJoin(watchProgress, eq(watchProgress.userId, leads.userId))
    .leftJoin(videos, eq(videos.id, users.videoId))
    .where(
      and(
        gt(leads.notifyVersion, leads.notifiedVersion),
        lt(leads.notifyAttempts, MAX_ATTEMPTS),
        sql`${leads.createdAt} > now() - make_interval(days => ${MAX_AGE_DAYS})`,
        notAdminTelegramId(users.telegramId),
      ),
    )
    .orderBy(asc(leads.id))
    .limit(BATCH_SIZE);

  for (const { lead, user, maxPosition, duration, offered, lastAnswer, exhausted, appointmentAt } of pending) {
    try {
      const cardUser = user && {
        ...user,
        watchedPercent: watchedPercent(maxPosition ?? 0, duration ?? 0),
        secondChance: {
          offered,
          answer: lastAnswer,
          exhausted,
          appointmentAt: appointmentAt && new Date(appointmentAt),
        },
      };
      await syncLeadCard(lead, cardUser, sender);
      await db()
        .update(leads)
        .set({ notifiedVersion: lead.notifyVersion, notifyError: null })
        .where(eq(leads.id, lead.id));
    } catch (error) {
      console.error(`Lead notification ${lead.id} failed:`, error);
      await db()
        .update(leads)
        .set({
          notifyAttempts: sql`${leads.notifyAttempts} + 1`,
          notifyError: error instanceof Error ? error.message : String(error),
        })
        .where(eq(leads.id, lead.id));
    }
  }
}

export async function flushLeadNotifications(sender = leadSender()) {
  if (!sender) return;
  const conn = await rawClient().reserve();
  try {
    const [lock] = await conn`SELECT pg_try_advisory_lock(${NOTIFY_LOCK_KEY}) as locked`;
    if (!lock?.locked) return;
    try {
      await flushPending(sender);
    } finally {
      await conn`SELECT pg_advisory_unlock(${NOTIFY_LOCK_KEY})`;
    }
  } finally {
    conn.release();
  }
}

let running: Promise<void> | undefined;
let rerun = false;

export function kickLeadNotifier() {
  if (!env.LEADS_CHAT_ID && !env.SHEETS_ENABLED) return;
  if (running) {
    rerun = true;
    return;
  }
  running = (async () => {
    do {
      rerun = false;
      await flushLeadNotifications().catch((error) => console.error("Lead notifier error:", error));
      await flushLeadSheet().catch((error) => console.error("Lead sheet error:", error));
    } while (rerun);
  })().finally(() => {
    running = undefined;
  });
}

export function startLeadNotifyLoop(): () => void {
  kickLeadNotifier();
  const timer = setInterval(kickLeadNotifier, RETRY_INTERVAL_MS);
  return () => clearInterval(timer);
}
