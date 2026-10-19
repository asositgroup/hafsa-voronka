import { eq } from "drizzle-orm";
import { GrammyError } from "grammy";
import { db } from "@/db";
import { users } from "@/db/schema";
import { syncSegment } from "@/funnel/segments";
import { setBotBlocked } from "@/funnel/users";

export function isBlockedError(error: unknown) {
  return error instanceof GrammyError && error.error_code === 403;
}

export async function markBlocked(userId: number) {
  await db().update(users).set({ botBlocked: true }).where(eq(users.id, userId));
  await syncSegment(userId);
}

export async function markBlockedByTelegramId(telegramId: number) {
  const blocked = await setBotBlocked(telegramId, true);
  if (blocked) await syncSegment(blocked.id);
}
