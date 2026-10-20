import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { closeDb, db } from "@/db";
import { runMigrations } from "@/db/migrate";
import { events, users } from "@/db/schema";
import { setTestEnv, TEST_BOT_TOKEN } from "@/test/env";
import { createTestVideo } from "@/test/videos";
import { signInitData } from "@/telegram/initData";

const testDbUrl = process.env.TEST_DATABASE_URL;
const START = new Date(1700000000000);

function randomTelegramId() {
  return 60_000_000 + Math.floor(Math.random() * 30_000_000);
}

describe.skipIf(!testDbUrl)("Write-to-admin unlock", () => {
  let recordProgress: typeof import("./service").recordProgress;
  let bot: typeof import("@/telegram/bot").bot;
  let createApp: typeof import("@/app").createApp;
  let send: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    setTestEnv({ DATABASE_URL: testDbUrl!, COMPLETE_THRESHOLD: "0.95" });
    await runMigrations(testDbUrl!);
    ({ recordProgress } = await import("./service"));
    ({ bot } = await import("@/telegram/bot"));
    ({ createApp } = await import("@/app"));
    send = vi.spyOn(bot().api, "sendMessage").mockResolvedValue({} as never);
  });

  afterEach(() => {
    send.mockClear();
  });

  afterAll(async () => {
    send.mockRestore();
    await closeDb();
  });

  async function userOn(marks: Parameters<typeof createTestVideo>[0]) {
    const video = await createTestVideo({ duration: 100, ...marks });
    const telegramId = randomTelegramId();
    const [user] = await db()
      .insert(users)
      .values({ telegramId, firstName: "Unlock", registeredAt: new Date(), videoId: video.id })
      .returning();
    return { user, telegramId };
  }

  async function walk(telegramId: number, positions: number[], options: { play: boolean } = { play: true }) {
    if (options.play) await recordProgress(telegramId, { position: 0, event: "play" }, START);
    const results = [];
    for (const position of positions) {
      results.push(await recordProgress(telegramId, { position, event: "tick" }, new Date(START.getTime() + position * 1000)));
    }
    return results;
  }

  async function reload(userId: number) {
    const [row] = await db().select().from(users).where(eq(users.id, userId));
    return row;
  }

  function sessionFor(telegramId: number) {
    const params = new URLSearchParams({
      auth_date: String(Math.floor(Date.now() / 1000)),
      user: JSON.stringify({ id: telegramId, first_name: "Unlock" }),
    });
    params.set("hash", signInitData(params, TEST_BOT_TOKEN));
    return createApp().request("/app/session", {
      method: "POST",
      headers: { authorization: `tma ${params.toString()}`, "content-type": "application/json" },
      body: JSON.stringify({ reason: "poll" }),
    });
  }

  it("unlocks at the price point when no unlock point is set", async () => {
    const { user, telegramId } = await userOn({ priceSec: 50 });
    const results = await walk(telegramId, [10, 20, 30, 40]);
    expect(results.every((r) => r.ok && !r.unlocked)).toBe(true);
    expect((await reload(user.id)).unlockedAt).toBeNull();

    const [atPrice] = await walk(telegramId, [50], { play: false });
    expect(atPrice.ok && atPrice.unlocked).toBe(true);
    expect(atPrice.ok && atPrice.completed).toBe(false);
    expect((await reload(user.id)).unlockedAt).not.toBeNull();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("unlocks at unlock_sec when it is set before the price", async () => {
    const { user, telegramId } = await userOn({ priceSec: 70, unlockSec: 30 });
    const results = await walk(telegramId, [10, 20, 30]);
    expect(results.map((r) => r.ok && r.unlocked)).toEqual([false, false, true]);
    expect((await reload(user.id)).unlockedAt).not.toBeNull();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("sends the bot message once at unlock and not again at completion", async () => {
    const { user, telegramId } = await userOn({ unlockSec: 30 });
    await walk(telegramId, [10, 20, 30, 40, 50]);
    expect(send).toHaveBeenCalledTimes(1);

    await walk(telegramId, [60, 70, 80, 90, 96, 100], { play: false });
    const row = await reload(user.id);
    expect(row.completedAt).not.toBeNull();
    expect(row.unlockedAt).not.toBeNull();
    expect(row.unlockedAt!.getTime()).toBeLessThan(row.completedAt!.getTime());
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("keeps completion side effects at real completion", async () => {
    const { user, telegramId } = await userOn({ unlockSec: 30 });
    await walk(telegramId, [10, 20, 30, 40, 50, 60, 70, 80, 90]);
    expect((await reload(user.id)).completedAt).toBeNull();

    await walk(telegramId, [96], { play: false });
    expect((await reload(user.id)).completedAt).not.toBeNull();
    const completeEvents = await db()
      .select()
      .from(events)
      .where(and(eq(events.userId, user.id), eq(events.type, "video_complete")));
    expect(completeEvents).toHaveLength(1);
  });

  it("falls back to completion when there is no price and no unlock point", async () => {
    const { user, telegramId } = await userOn({});
    const results = await walk(telegramId, [10, 20, 30, 40, 50, 60, 70, 80, 90]);
    expect(results.every((r) => r.ok && !r.unlocked)).toBe(true);
    expect((await reload(user.id)).unlockedAt).toBeNull();
    expect(send).not.toHaveBeenCalled();

    const [done] = await walk(telegramId, [96], { play: false });
    expect(done.ok && done.unlocked && done.completed).toBe(true);
    const row = await reload(user.id);
    expect(row.unlockedAt).toEqual(row.completedAt);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("sends once when concurrent beats reach the unlock point together", async () => {
    const { user, telegramId } = await userOn({ unlockSec: 20 });
    await walk(telegramId, [10]);
    const at = new Date(START.getTime() + 20_000);
    await Promise.all(
      Array.from({ length: 4 }, () => recordProgress(telegramId, { position: 20, event: "tick" }, at)),
    );
    expect((await reload(user.id)).unlockedAt).not.toBeNull();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("reports unlocked and unlockAt in the session", async () => {
    const { telegramId } = await userOn({ priceSec: 60, unlockSec: 30 });
    const before = await (await sessionFor(telegramId)).json();
    expect(before).toMatchObject({ unlocked: false, unlockAt: 30, completed: false });

    await walk(telegramId, [10, 20, 30]);
    expect(await (await sessionFor(telegramId)).json()).toMatchObject({ unlocked: true, unlockAt: 30 });
  });

  it("reports a null unlockAt when falling back to completion", async () => {
    const { telegramId } = await userOn({});
    expect(await (await sessionFor(telegramId)).json()).toMatchObject({ unlocked: false, unlockAt: null });
  });

  it("uses the price as unlockAt when no unlock point is set", async () => {
    const { telegramId } = await userOn({ priceSec: 55 });
    expect(await (await sessionFor(telegramId)).json()).toMatchObject({ unlockAt: 55 });
  });
});
