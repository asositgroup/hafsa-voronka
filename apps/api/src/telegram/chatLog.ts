import { and, asc, eq, gt, isNull, lte } from "drizzle-orm";
import { type Api, GrammyError } from "grammy";
import { db } from "@/db";
import { type ChatMessage, chatMessages } from "@/db/schema";
import { chatCleanupHours } from "@/settings/service";
import { isBlockedError } from "@/telegram/blocked";

const HOUR_MS = 3_600_000;
const DELETE_LIMIT_MS = 48 * HOUR_MS;
const KEEP_ROWS_MS = 72 * HOUR_MS;
const CLEANUP_BATCH_SIZE = 500;
const MESSAGE_NOT_FOUND = "message to delete not found";

type Pace = () => Promise<void>;

export async function logChatMessage(chatId: number, messageId: number, fromBot: boolean, now = new Date()) {
  await db()
    .insert(chatMessages)
    .values({ chatId, messageId, fromBot, sentAt: now })
    .onConflictDoNothing();
}

const undeleted = and(isNull(chatMessages.deletedAt), isNull(chatMessages.deleteError));

async function deleteLogged(api: Api, row: ChatMessage, now: Date) {
  const mark = (values: { deletedAt: Date } | { deleteError: string }) =>
    db().update(chatMessages).set(values).where(eq(chatMessages.id, row.id));

  if (now.getTime() - row.sentAt.getTime() >= DELETE_LIMIT_MS) {
    await mark({ deleteError: "too_old" });
    return;
  }
  try {
    await api.deleteMessage(row.chatId, row.messageId);
    await mark({ deletedAt: now });
  } catch (error) {
    if (error instanceof GrammyError && error.error_code === 429) throw error;
    if (isBlockedError(error) || (error instanceof GrammyError && error.description.includes(MESSAGE_NOT_FOUND))) {
      await mark({ deletedAt: now });
    } else {
      await mark({ deleteError: error instanceof Error ? error.message : String(error) });
    }
  }
}

export async function replaceBotReply(api: Api, chatId: number, send: () => Promise<{ message_id: number }>) {
  const now = new Date();
  const previous = await db()
    .select()
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.chatId, chatId),
        eq(chatMessages.fromBot, true),
        gt(chatMessages.sentAt, new Date(now.getTime() - DELETE_LIMIT_MS)),
        undeleted,
      ),
    )
    .orderBy(asc(chatMessages.id));
  for (const row of previous) {
    await deleteLogged(api, row, now).catch((error) => console.error("Chat message delete failed:", error));
  }
  const message = await send();
  await logChatMessage(chatId, message.message_id, true);
  return message;
}

export async function cleanupChatMessages(api: Api, now: Date, pace: Pace) {
  await db().delete(chatMessages).where(lte(chatMessages.sentAt, new Date(now.getTime() - KEEP_ROWS_MS)));
  await db()
    .update(chatMessages)
    .set({ deleteError: "too_old" })
    .where(and(lte(chatMessages.sentAt, new Date(now.getTime() - DELETE_LIMIT_MS)), undeleted));

  const cleanupAgeMs = (await chatCleanupHours()) * HOUR_MS;
  const rows = await db()
    .select()
    .from(chatMessages)
    .where(and(lte(chatMessages.sentAt, new Date(now.getTime() - cleanupAgeMs)), undeleted))
    .orderBy(asc(chatMessages.sentAt))
    .limit(CLEANUP_BATCH_SIZE);
  for (const row of rows) {
    await pace();
    await deleteLogged(api, row, now);
  }
}
