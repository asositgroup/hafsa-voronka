import { eq } from "drizzle-orm";
import type { TemplateContext } from "@funnel/shared";
import { db } from "@/db";
import { users, videos, watchProgress } from "@/db/schema";

export async function templateContextFor(userId: number, now: Date): Promise<TemplateContext | null> {
  const [row] = await db()
    .select({
      name: users.name,
      firstName: users.firstName,
      linkExpiresAt: users.linkExpiresAt,
      lastPosition: watchProgress.lastPosition,
      duration: videos.duration,
    })
    .from(users)
    .leftJoin(watchProgress, eq(watchProgress.userId, users.id))
    .leftJoin(videos, eq(videos.id, users.videoId))
    .where(eq(users.id, userId));
  if (!row) return null;
  return {
    name: row.name,
    firstName: row.firstName,
    lastPositionSec: row.lastPosition ?? 0,
    durationSec: row.duration,
    linkExpiresAt: row.linkExpiresAt,
    now,
  };
}
