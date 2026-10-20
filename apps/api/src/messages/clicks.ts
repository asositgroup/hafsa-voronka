import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { type SentMessage, sentMessages } from "@/db/schema";
import { logEvent } from "@/funnel/users";

export async function recordMessageClick(
  sentId: number,
  userId: number,
  via: "callback" | "web_app" | "url",
  meta?: Record<string, unknown>,
  now = new Date(),
): Promise<SentMessage | null> {
  const [row] = await db()
    .update(sentMessages)
    .set({ clickedAt: sql`coalesce(${sentMessages.clickedAt}, ${now.toISOString()}::timestamptz)` })
    .where(and(eq(sentMessages.id, sentId), eq(sentMessages.userId, userId)))
    .returning();
  if (!row) return null;
  await logEvent("message_click", {
    userId,
    meta: { sentMessageId: row.id, templateId: row.templateId, via, ...meta },
  });
  return row;
}
