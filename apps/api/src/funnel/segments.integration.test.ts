import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { asc, eq } from "drizzle-orm";
import { GrammyError } from "grammy";
import { closeDb, db } from "@/db";
import { runMigrations } from "@/db/migrate";
import { segmentRuns, users, watchProgress } from "@/db/schema";
import { setTestEnv } from "@/test/env";
import { createTestVideo } from "@/test/videos";

const testDbUrl = process.env.TEST_DATABASE_URL;

function randomTelegramId() {
  return 40_000_000 + Math.floor(Math.random() * 50_000_000);
}

describe.skipIf(!testDbUrl)("Segment runs", () => {
  let syncSegment: typeof import("./segments").syncSegment;
  let completeRegistration: typeof import("./registration").completeRegistration;
  let recordProgress: typeof import("@/watch/service").recordProgress;
  let recordVideoEvent: typeof import("@/watch/service").recordVideoEvent;
  let bot: typeof import("@/telegram/bot").bot;
  let markBlockedByTelegramId: typeof import("@/telegram/blocked").markBlockedByTelegramId;
  let setBotBlocked: typeof import("./users").setBotBlocked;

  beforeAll(async () => {
    setTestEnv({ DATABASE_URL: testDbUrl!, COMPLETE_THRESHOLD: "0.95" });
    await runMigrations(testDbUrl!);
    ({ syncSegment } = await import("./segments"));
    ({ completeRegistration } = await import("./registration"));
    ({ recordProgress, recordVideoEvent } = await import("@/watch/service"));
    ({ bot } = await import("@/telegram/bot"));
    ({ markBlockedByTelegramId } = await import("@/telegram/blocked"));
    ({ setBotBlocked } = await import("./users"));
  });

  afterAll(async () => {
    await closeDb();
  });

  async function registeredUser() {
    const video = await createTestVideo({ duration: 1000, introEndSec: 100, courseStartSec: 700, priceSec: 900 });
    const telegramId = randomTelegramId();
    const [created] = await db()
      .insert(users)
      .values({ telegramId, firstName: "Seg", videoId: video.id })
      .returning();
    const registered = await completeRegistration(
      created,
      { name: "Seg User", phone: "+998901234567", phoneVerified: true },
      { actionSource: "chat" },
    );
    return { user: registered!, telegramId };
  }

  async function runsOf(userId: number) {
    return db().select().from(segmentRuns).where(eq(segmentRuns.userId, userId)).orderBy(asc(segmentRuns.id));
  }

  async function setMaxPosition(userId: number, maxPosition: number) {
    await db().update(watchProgress).set({ maxPosition }).where(eq(watchProgress.userId, userId));
    await syncSegment(userId);
  }

  it("opens segment A on registration", async () => {
    const { user } = await registeredUser();
    const runs = await runsOf(user.id);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ segment: "A", endedAt: null, endReason: null });
  });

  it("moves A to B on the first play beat", async () => {
    const { user, telegramId } = await registeredUser();
    await recordProgress(telegramId, { position: 0, event: "play" });
    const runs = await runsOf(user.id);
    expect(runs).toHaveLength(2);
    expect(runs[0]).toMatchObject({ segment: "A", endReason: "advanced" });
    expect(runs[0].endedAt).not.toBeNull();
    expect(runs[1]).toMatchObject({ segment: "B", endedAt: null });
  });

  it("keeps the same B run across status changes and moves to C at the price mark", async () => {
    const { user, telegramId } = await registeredUser();
    await recordProgress(telegramId, { position: 0, event: "play" });
    const [firstB] = (await runsOf(user.id)).filter((run) => run.segment === "B");

    await setMaxPosition(user.id, 400);
    await setMaxPosition(user.id, 700);
    const afterMid = await runsOf(user.id);
    expect(afterMid.filter((run) => run.segment === "B")).toHaveLength(1);
    expect(afterMid.find((run) => run.segment === "B")?.id).toBe(firstB.id);
    expect(afterMid.find((run) => run.segment === "B")?.endedAt).toBeNull();

    await setMaxPosition(user.id, 900);
    const afterPrice = await runsOf(user.id);
    expect(afterPrice).toHaveLength(3);
    expect(afterPrice[1]).toMatchObject({ id: firstB.id, segment: "B", endReason: "advanced" });
    expect(afterPrice[2]).toMatchObject({ segment: "C", endedAt: null });
  });

  it("closes the open run with wrote_admin on channel click and opens nothing", async () => {
    const { user, telegramId } = await registeredUser();
    await recordProgress(telegramId, { position: 0, event: "play" });
    await setMaxPosition(user.id, 900);
    await recordVideoEvent(telegramId, "channel_click");
    const runs = await runsOf(user.id);
    expect(runs.map((run) => run.segment)).toEqual(["A", "B", "C"]);
    expect(runs[2]).toMatchObject({ endReason: "wrote_admin" });
    expect(runs[2].endedAt).not.toBeNull();
    expect(runs.filter((run) => run.endedAt === null)).toHaveLength(0);
  });

  it("is a no-op when synced twice", async () => {
    const { user } = await registeredUser();
    await syncSegment(user.id);
    await syncSegment(user.id);
    expect(await runsOf(user.id)).toHaveLength(1);
  });

  it("leaves exactly one open run under concurrent syncs", async () => {
    const { user, telegramId } = await registeredUser();
    await recordProgress(telegramId, { position: 0, event: "play" });
    await db().update(watchProgress).set({ maxPosition: 950 }).where(eq(watchProgress.userId, user.id));
    await Promise.all(Array.from({ length: 5 }, () => syncSegment(user.id)));
    const runs = await runsOf(user.id);
    expect(runs.filter((run) => run.endedAt === null)).toHaveLength(1);
    expect(runs.map((run) => run.segment)).toEqual(["A", "B", "C"]);
  });

  it("closes the run with bot_blocked and opens a new one on unblock", async () => {
    const { user, telegramId } = await registeredUser();
    await markBlockedByTelegramId(telegramId);
    const blocked = await runsOf(user.id);
    expect(blocked).toHaveLength(1);
    expect(blocked[0]).toMatchObject({ segment: "A", endReason: "bot_blocked" });

    const unblocked = await setBotBlocked(telegramId, false);
    await syncSegment(unblocked!.id);
    const runs = await runsOf(user.id);
    expect(runs).toHaveLength(2);
    expect(runs[1]).toMatchObject({ segment: "A", endedAt: null });
  });

  it("marks the user blocked and closes the run when the completion message hits a 403", async () => {
    const { user, telegramId } = await registeredUser();
    const send = vi.spyOn(bot().api, "sendMessage").mockRejectedValue(
      new GrammyError(
        "Forbidden: bot was blocked by the user",
        { ok: false, error_code: 403, description: "Forbidden: bot was blocked by the user" },
        "sendMessage",
        {},
      ),
    );
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await recordProgress(telegramId, { position: 0, event: "play" });
      await db().update(watchProgress).set({ maxPosition: 970, lastPosition: 970, watchedSecs: 970 }).where(
        eq(watchProgress.userId, user.id),
      );
      await recordProgress(telegramId, { position: 1000, event: "tick" }, new Date(Date.now() + 10_000), {
        duration: 1000,
        threshold: 0.95,
      });
      expect(send).toHaveBeenCalled();
    } finally {
      send.mockRestore();
      errors.mockRestore();
    }
    const [row] = await db().select().from(users).where(eq(users.id, user.id));
    expect(row.botBlocked).toBe(true);
    const runs = await runsOf(user.id);
    expect(runs.filter((run) => run.endedAt === null)).toHaveLength(0);
    expect(runs.at(-1)).toMatchObject({ endReason: "bot_blocked" });
  });
});
