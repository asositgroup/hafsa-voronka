import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { syncSegment } from "@/funnel/segments";
import { logEvent } from "@/funnel/users";

export async function recordChannelClick(
  user: { id: number; visitorId: string | null },
  now: Date,
  meta?: Record<string, unknown>,
): Promise<void> {
  await logEvent("channel_click", { userId: user.id, visitorId: user.visitorId, meta });
  await db()
    .update(users)
    .set({ channelClickAt: now })
    .where(and(eq(users.id, user.id), isNull(users.channelClickAt)));
  await syncSegment(user.id, now).catch((error) => console.error("Segment sync failed:", error));
}
