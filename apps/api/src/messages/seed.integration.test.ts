import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asc, eq } from "drizzle-orm";
import { closeDb, db } from "@/db";
import { runMigrations } from "@/db/migrate";
import { messageTemplates } from "@/db/schema";
import { setTestEnv } from "@/test/env";
import { isolatedDatabase } from "@/test/isolatedDb";

const isolated = isolatedDatabase("vf_seed");

describe.skipIf(!isolated.url)("Template seed", () => {
  let seedStartingTemplates: typeof import("./seed").seedStartingTemplates;
  let seedInputs: typeof import("./seed").seedInputs;

  beforeAll(async () => {
    await isolated.create();
    setTestEnv({ DATABASE_URL: isolated.url! });
    await runMigrations(isolated.url!);
    ({ seedStartingTemplates, seedInputs } = await import("./seed"));
  });

  afterAll(async () => {
    await closeDb();
    await isolated.drop();
  });

  it("inserts once and skips on the second run", async () => {
    const first = await seedStartingTemplates();
    expect(first).toEqual({ A: seedInputs("A").length, B: seedInputs("B").length, C: seedInputs("C").length });
    const second = await seedStartingTemplates();
    expect(second).toEqual({ A: 0, B: 0, C: 0 });
    const rows = await db().select().from(messageTemplates);
    expect(rows).toHaveLength(first.A + first.B + first.C);
  });

  it("stores segment B statuses and sequential positions per day", async () => {
    const rows = await db()
      .select()
      .from(messageTemplates)
      .where(eq(messageTemplates.segment, "B"))
      .orderBy(asc(messageTemplates.day), asc(messageTemplates.position));
    expect(rows.filter((row) => row.statuses !== null)).toHaveLength(3);
    const dayOne = rows.filter((row) => row.day === 1).map((row) => row.position);
    expect(dayOne).toEqual(dayOne.map((_, index) => index));
  });
});
