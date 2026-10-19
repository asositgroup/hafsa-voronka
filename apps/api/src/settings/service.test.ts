import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { closeDb, db } from "@/db";
import { runMigrations } from "@/db/migrate";
import { settings } from "@/db/schema";
import { setTestEnv } from "@/test/env";
import { invalidateSettings, linkTtlHours } from "./service";

const testDbUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDbUrl)("Settings", () => {
  beforeAll(async () => {
    setTestEnv({ DATABASE_URL: testDbUrl! });
    await runMigrations(testDbUrl!);
  });

  beforeEach(async () => {
    await db().delete(settings);
    invalidateSettings();
  });

  afterAll(async () => {
    await closeDb();
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
});
