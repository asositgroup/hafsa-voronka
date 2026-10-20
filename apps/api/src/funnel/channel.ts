import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { syncSegment } from "@/funnel/segments";
import { logEvent } from "@/funnel/users";
import { refreshUserLeadCards } from "@/leads/service";

export async function markWroteAdmin(
  userId: number,
  actor: { id: number } | null,
  now: Date,
): Promise<boolean> {
  const [marked] = await db()
    .update(users)
    .set({ wroteAdminAt: now, wroteAdminBy: actor?.id ?? null })
    .where(and(eq(users.id, userId), isNull(users.wroteAdminAt)))
    .returning({ id: users.id });
  if (!marked) return false;

  await syncSegment(userId, now).catch((error) => console.error("Segment sync failed:", error));
  await refreshUserLeadCards(userId).catch((error) =>
    console.error("Lead card refresh failed:", error),
  );
  return true;
}

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
  await markWroteAdmin(user.id, null, now);
}
