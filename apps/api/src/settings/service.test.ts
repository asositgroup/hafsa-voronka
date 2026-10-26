import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { closeDb, db } from "@/db";
import { runMigrations } from "@/db/migrate";
import { settings } from "@/db/schema";
import { setTestEnv } from "@/test/env";
import { isolatedDatabase } from "@/test/isolatedDb";
import { DEFAULT_MESSAGE_CAPS } from "@funnel/shared";
import { chatCleanupHours, invalidateSettings, linkTtlHours, messageCaps } from "./service";

const isolatedDb = isolatedDatabase("vf_settings_service");
const testDbUrl = isolatedDb.url;

describe.skipIf(!testDbUrl)("Settings", () => {
  beforeAll(async () => {
    await isolatedDb.create();
    setTestEnv({ DATABASE_URL: testDbUrl! });
    await runMigrations(testDbUrl!);
  });

  beforeEach(async () => {
    await db().delete(settings);
    invalidateSettings();
  });

  afterAll(async () => {
    await closeDb();
    await isolatedDb.drop();
  });

  it("defaults the link TTL to 24 hours", async () => {
    expect(await linkTtlHours()).toBe(24);
  });

  it("reads an override and refreshes after invalidation", async () => {
    expect(await linkTtlHours()).toBe(24);
    await db().insert(settings).values({ key: "LINK_TTL_HOURS", value: "72" });
    expect(await linkTtlHours()).toBe(24);
    invalidateSettings();
    expect(await linkTtlHours()).toBe(72);
  });

  it("falls back to 24 for values that are not positive integers", async () => {
    for (const value of ["0", "-5", "abc", "1.5", ""]) {
      await db().delete(settings);
      await db().insert(settings).values({ key: "LINK_TTL_HOURS", value });
      invalidateSettings();
      expect(await linkTtlHours()).toBe(24);
    }
  });

  it("defaults the message caps and ignores broken values", async () => {
    expect(await messageCaps()).toEqual(DEFAULT_MESSAGE_CAPS);
    for (const value of ["nope", "{}", JSON.stringify({ ...DEFAULT_MESSAGE_CAPS, B: { daily: 50, total: 7 } })]) {
      await db().delete(settings);
      await db().insert(settings).values({ key: "MESSAGE_CAPS", value });
      invalidateSettings();
      expect(await messageCaps()).toEqual(DEFAULT_MESSAGE_CAPS);
    }
  });

  it("defaults the chat cleanup delay to 24 hours and ignores values outside the choices", async () => {
    expect(await chatCleanupHours()).toBe(24);
    for (const [value, expected] of [["1", 1], ["12", 12], ["2", 24], ["48", 24], ["abc", 24], ["", 24]] as const) {
      await db().delete(settings);
      await db().insert(settings).values({ key: "CHAT_CLEANUP_HOURS", value });
      invalidateSettings();
      expect(await chatCleanupHours()).toBe(expected);
    }
  });
});
