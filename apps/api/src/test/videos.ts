import { eq } from "drizzle-orm";
import { db } from "@/db";
import { type Video, videos } from "@/db/schema";

export async function ensureActiveTestVideo(): Promise<Video> {
  await db()
    .insert(videos)
    .values({
      title: "Test video",
      fileUrl: "https://video.example.com/master.mp4",
      duration: 900,
      isActive: true,
    })
    .onConflictDoNothing();
  const [video] = await db().select().from(videos).where(eq(videos.isActive, true)).limit(1);
  return video;
}

export async function createTestVideo(overrides: Partial<typeof videos.$inferInsert> = {}): Promise<Video> {
  const [video] = await db()
    .insert(videos)
    .values({
      title: "Test video",
      fileUrl: "https://video.example.com/other.mp4",
      duration: 900,
      ...overrides,
      isActive: false,
    })
    .returning();
  return video;
}
