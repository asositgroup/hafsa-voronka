import { and, asc, eq, gt, lt, sql } from "drizzle-orm";
import { GrammyError, type InlineKeyboard } from "grammy";
import { db, rawClient } from "@/db";
import { type Lead, leads, users } from "@/db/schema";
import { env } from "@/env";
import { bot } from "@/telegram/bot";
import { type CardUser, renderCompletionReply, renderLeadCard, renderLeadKeyboard } from "./card";

const NOTIFY_LOCK_KEY = 849204813;
const RETRY_INTERVAL_MS = 60 * 1000;
const MAX_ATTEMPTS = 10;
const MAX_AGE_DAYS = 3;
const BATCH_SIZE = 50;

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
  const keyboard = renderLeadKeyboard(lead);
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
    .select({ lead: leads, user: users })
    .from(leads)
    .leftJoin(users, eq(users.id, leads.userId))
    .where(
      and(
        gt(leads.notifyVersion, leads.notifiedVersion),
        lt(leads.notifyAttempts, MAX_ATTEMPTS),
        sql`${leads.createdAt} > now() - make_interval(days => ${MAX_AGE_DAYS})`,
      ),
    )
    .orderBy(asc(leads.id))
    .limit(BATCH_SIZE);

  for (const { lead, user } of pending) {
    try {
      await syncLeadCard(lead, user, sender);
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
  if (!env.LEADS_CHAT_ID) return;
  if (running) {
    rerun = true;
    return;
  }
  running = (async () => {
    do {
      rerun = false;
      await flushLeadNotifications().catch((error) => console.error("Lead notifier error:", error));
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
