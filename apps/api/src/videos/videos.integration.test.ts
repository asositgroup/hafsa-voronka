import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { closeDb, db } from "@/db";
import { runMigrations } from "@/db/migrate";
import { users, videos } from "@/db/schema";
import { upsertUser } from "@/funnel/users";
import { createTestVideo, ensureActiveTestVideo } from "@/test/videos";
import { activeVideo, seedVideoFromEnv, videoForUser } from "./service";

const testDbUrl = process.env.TEST_DATABASE_URL;

const violatesMarksOrder = { cause: { constraint_name: "videos_marks_order" } };

function randomTelegramId() {
  return 30_000_000 + Math.floor(Math.random() * 50_000_000);
}

async function insertUser(videoId: number | null = null) {
  const [user] = await db()
    .insert(users)
    .values({ telegramId: randomTelegramId(), firstName: "Video", videoId })
    .returning();
  return user;
}

describe.skipIf(!testDbUrl)("Videos", () => {
  beforeAll(async () => {
    Object.assign(process.env, {
      BOT_TOKEN: "123456:TEST-token",
      BOT_USERNAME: "test_bot",
      WEBHOOK_SECRET: "test-secret-0123456789",
      API_URL: "https://api.example.com",
      WEB_URL: "https://example.com",
      DATABASE_URL: testDbUrl,
      CHANNEL_URL: "https://t.me/example",
      VIDEO_POSTER_URL: "https://video.example.com/poster.webp",
    });
    await runMigrations(testDbUrl!);
    await ensureActiveTestVideo();
  });

  afterAll(async () => {
    await closeDb();
  });

  it("rejects a second active video", async () => {
    await ensureActiveTestVideo();
    await expect(
      db().insert(videos).values({ title: "Second", fileUrl: "https://video.example.com/b.mp4", duration: 100, isActive: true }),
    ).rejects.toMatchObject({ cause: { constraint_name: "videos_one_active_idx" } });
  });

  it("rejects a price mark at or after the end of the video", async () => {
    await expect(createTestVideo({ duration: 100, priceSec: 100 })).rejects.toMatchObject(violatesMarksOrder);
    await expect(createTestVideo({ duration: 100, courseStartSec: 60, priceSec: 50 })).rejects.toMatchObject(
      violatesMarksOrder,
    );
  });

  it("assigns the active video to a new user", async () => {
    const active = await ensureActiveTestVideo();
    const { user, isNew } = await upsertUser({ id: randomTelegramId() }, undefined);
    expect(isNew).toBe(true);
    expect(user.videoId).toBe(active.id);
  });

  it("keeps the old video for an existing user after the active video changes", async () => {
    const original = await ensureActiveTestVideo();
    const replacement = await createTestVideo({ duration: 300 });
    const profile = { id: randomTelegramId() };
    const { user } = await upsertUser(profile, undefined);
    expect(user.videoId).toBe(original.id);

    try {
      await db().transaction(async (tx) => {
        await tx.update(videos).set({ isActive: false }).where(eq(videos.id, original.id));
        await tx.update(videos).set({ isActive: true }).where(eq(videos.id, replacement.id));
      });

      const again = await upsertUser(profile, undefined);
      expect(again.isNew).toBe(false);
      expect(again.user.videoId).toBe(original.id);

      const fresh = await upsertUser({ id: randomTelegramId() }, undefined);
      expect(fresh.user.videoId).toBe(replacement.id);
      expect((await activeVideo())?.id).toBe(replacement.id);
      expect((await videoForUser(again.user))?.id).toBe(original.id);
    } finally {
      await db().transaction(async (tx) => {
        await tx.update(videos).set({ isActive: false }).where(eq(videos.id, replacement.id));
        await tx.update(videos).set({ isActive: true }).where(eq(videos.id, original.id));
      });
    }
  });

  it("repairs a user without a video from the active video", async () => {
    const active = await ensureActiveTestVideo();
    const user = await insertUser();
    expect(user.videoId).toBeNull();

    const video = await videoForUser(user);
    expect(video?.id).toBe(active.id);

    const [stored] = await db().select().from(users).where(eq(users.id, user.id));
    expect(stored.videoId).toBe(active.id);
  });

  it("returns an archived video for a user who still has it", async () => {
    const archived = await createTestVideo({ archivedAt: new Date() });
    const user = await insertUser(archived.id);
    expect((await videoForUser(user))?.id).toBe(archived.id);
  });

  it("does not seed when videos exist or the env values are missing", async () => {
    await ensureActiveTestVideo();
    const user = await insertUser();
    const before = await db().select({ id: videos.id }).from(videos);

    await seedVideoFromEnv({ url: "https://video.example.com/seed.mp4", duration: 600 });
    await seedVideoFromEnv({ url: "https://video.example.com/seed.mp4" });
    await seedVideoFromEnv({ duration: 600 });
    await seedVideoFromEnv({});

    const after = await db().select({ id: videos.id }).from(videos);
    expect(after.length).toBe(before.length);
    const [stored] = await db().select().from(users).where(eq(users.id, user.id));
    expect(stored.videoId).toBeNull();
  });
});
