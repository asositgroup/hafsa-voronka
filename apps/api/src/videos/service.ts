import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { type User, users, type Video, videos } from "@/db/schema";

export async function activeVideo(): Promise<Video | undefined> {
  const [video] = await db().select().from(videos).where(eq(videos.isActive, true)).limit(1);
  return video;
}

async function videoById(id: number): Promise<Video | undefined> {
  const [video] = await db().select().from(videos).where(eq(videos.id, id)).limit(1);
  return video;
}

export async function videoForUser(user: Pick<User, "id" | "videoId">): Promise<Video | undefined> {
  if (user.videoId !== null) return videoById(user.videoId);

  const [assigned] = await db()
    .update(users)
    .set({ videoId: sql`(select id from ${videos} where ${videos.isActive})` })
    .where(sql`${users.id} = ${user.id} and ${users.videoId} is null`)
    .returning({ videoId: users.videoId });

  const videoId = assigned?.videoId;
  if (videoId !== null && videoId !== undefined) return videoById(videoId);

  const [current] = await db()
    .select({ videoId: users.videoId })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  return current?.videoId != null ? videoById(current.videoId) : undefined;
}

export async function seedVideoFromEnv(seed: { url?: string; duration?: number }) {
  if (!seed.url || !seed.duration) return;

  const existing = await db().execute(sql`select 1 from ${videos} limit 1`);
  if (existing.length > 0) return;

  await db().transaction(async (tx) => {
    const [inserted] = await tx
      .insert(videos)
      .values({ title: "Asosiy dars", fileUrl: seed.url!, duration: seed.duration!, isActive: true })
      .onConflictDoNothing()
      .returning();
    if (!inserted) return;
    await tx.update(users).set({ videoId: inserted.id }).where(sql`${users.videoId} is null`);
  });
}
