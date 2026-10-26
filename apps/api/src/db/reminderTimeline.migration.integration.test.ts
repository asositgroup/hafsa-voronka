import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { runMigrations } from "@/db/migrate";
import { isolatedDatabase } from "@/test/isolatedDb";

const LEGACY_TAG = "0023_chat_messages";
const NOT_OPENED = "{link_berildi}";
const NO_PRICE = "{korishni_boshladi,dars_yarmida,sotuvda_toxtadi}";

type Journal = { entries: { tag: string }[] };

function legacyMigrationsFolder() {
  const folder = mkdtempSync(join(tmpdir(), "vf-legacy-drizzle-"));
  cpSync(resolve("drizzle"), folder, { recursive: true });
  const journalPath = join(folder, "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf8")) as Journal;
  const cut = journal.entries.findIndex((entry) => entry.tag === LEGACY_TAG);
  writeFileSync(journalPath, JSON.stringify({ ...journal, entries: journal.entries.slice(0, cut + 1) }));
  return folder;
}

function legacyDatabase(name: string) {
  const database = isolatedDatabase(name);
  let client: postgres.Sql | null = null;
  return {
    url: database.url,
    sql: () => client!,
    setUp: async () => {
      await database.create();
      client = postgres(database.url!, { max: 1, onnotice: () => {} });
      const folder = legacyMigrationsFolder();
      try {
        await migrate(drizzle({ client }), { migrationsFolder: folder });
      } finally {
        rmSync(folder, { recursive: true, force: true });
      }
    },
    tearDown: async () => {
      await client?.end();
      await database.drop();
    },
  };
}

function startOfYesterdayInTashkent(now: Date) {
  const offset = 5 * 60 * 60 * 1000;
  const day = 24 * 60 * 60 * 1000;
  return new Date(Math.floor((now.getTime() + offset) / day) * day - day - offset);
}

const main = legacyDatabase("vf_migration");
const custom = legacyDatabase("vf_migration_custom");

describe.skipIf(!main.url)("0024 reminder timeline migration", () => {
  const ids: Record<string, number> = {};
  let grantsBefore: readonly unknown[] = [];
  let usersBefore: readonly unknown[] = [];
  let telegramId = 9000;

  async function template(key: string, values: Record<string, unknown>) {
    const sql = main.sql();
    const row = {
      position: 0,
      text: key,
      timing_value: 0,
      buttons: "[]",
      is_active: true,
      ...values,
    };
    const [inserted] = await sql`insert into message_templates ${sql(row)} returning id`;
    ids[key] = Number(inserted.id);
  }

  async function user(key: string, values: Record<string, unknown> = {}) {
    const sql = main.sql();
    const [row] = await sql`insert into users ${sql({ telegram_id: ++telegramId, ...values })} returning id`;
    ids[key] = Number(row.id);
    return ids[key];
  }

  async function grant(userId: number, attempt: number) {
    const sql = main.sql();
    const [row] = await sql`
      insert into link_grants (user_id, attempt, kind, given_at, expires_at)
      values (${userId}, ${attempt}, 'again', now() - interval '3 days', now() - interval '2 days')
      returning id
    `;
    await sql`update users set link_id = ${row.id}, link_expires_at = now() - interval '2 days' where id = ${userId}`;
    return Number(row.id);
  }

  async function openDRun(userId: number) {
    await main.sql()`insert into segment_runs (user_id, segment, entered_at, attempt) values (${userId}, 'D', now() - interval '2 days', 1)`;
  }

  beforeAll(async () => {
    await main.setUp();
    const sql = main.sql();

    await template("d1_not_opened", {
      segment: "D",
      day: 1,
      timing_type: "occasion",
      statuses: NOT_OPENED,
      text: "Afsus, havolani ochmadingiz",
      media_type: "photo",
      media_file_id: "photo-file",
      buttons: JSON.stringify([{ kind: "again", text: "Ha, ko'raman" }]),
      is_active: false,
    });
    await template("d1_no_price", { segment: "D", day: 1, timing_type: "occasion", statuses: NO_PRICE, text: "Afsus, narxgacha yetmadingiz" });
    await template("d2_not_opened", { segment: "D", day: 2, timing_type: "occasion", statuses: NOT_OPENED, text: "Ikkinchi imkon" });
    await template("d7_not_opened", { segment: "D", day: 7, timing_type: "occasion", statuses: NOT_OPENED, text: "Oxirgi imkon" });
    await template("d3_deleted", {
      segment: "D",
      day: 3,
      timing_type: "occasion",
      statuses: NOT_OPENED,
      text: "O‘chirilgan imkon",
      deleted_at: new Date().toISOString(),
    });
    await template("a2_existing", { segment: "A", day: 2, timing_type: "day_time", timing_value: 600, text: "A day 2" });
    await template("after_day3", { segment: "A", day: 3, timing_type: "after_entry", timing_value: 2 * 1440 + 75 });
    await template("after_day1", { segment: "A", day: 1, timing_type: "after_entry", timing_value: 90 });
    await template("before_expiry", { segment: "A", day: 1, timing_type: "before_expiry", timing_value: 180 });
    await template("clock_day1", { segment: "C", day: 1, timing_type: "day_time", timing_value: 540 });
    await template("night_notice", { segment: "B", day: 1, timing_type: "night_notice", timing_value: 0 });

    const [video] = await sql`
      insert into videos (title, file_url, duration, price_sec, is_active)
      values ('Dars', 'https://example.com/v.mp4', 1000, 800, true)
      returning id
    `;

    const fresh = await user("fresh", { video_id: video.id });
    const freshGrant = await grant(fresh, 2);
    await openDRun(fresh);
    const [offer] = await sql`
      insert into second_chance_offers (user_id, occasion, variant, expired_link_id, due_at)
      values (${fresh}, 1, 'not_opened', ${freshGrant}, now() - interval '1 day')
      returning id
    `;
    const [appointment] = await sql`
      insert into watch_appointments (user_id, offer_id, purpose, chosen_at)
      values (${fresh}, ${offer.id}, 'reopen', now() + interval '1 hour')
      returning id
    `;
    ids.appointment = Number(appointment.id);

    const played = await user("played", { video_id: video.id });
    await grant(played, 3);
    await openDRun(played);
    await sql`insert into watch_progress (user_id, max_position, started_at) values (${played}, 120, now() - interval '3 days')`;

    const priced = await user("priced", { video_id: video.id });
    await grant(priced, 2);
    await openDRun(priced);
    await sql`insert into watch_progress (user_id, max_position, started_at) values (${priced}, 850, now() - interval '3 days')`;

    const blocked = await user("blocked", { video_id: video.id, bot_blocked: true });
    await grant(blocked, 2);
    await openDRun(blocked);

    const wrote = await user("wrote", { video_id: video.id, wrote_admin_at: new Date().toISOString() });
    await grant(wrote, 2);
    await openDRun(wrote);

    grantsBefore = await sql`select * from link_grants order by id`;
    usersBefore = await sql`select id, link_id, link_expires_at from users order by id`;

    await runMigrations(main.url!);
  });

  afterAll(async () => {
    await main.tearDown();
  });

  const live = (segment: string, day: number) =>
    main.sql()`
      select * from message_templates
      where segment = ${segment} and day = ${day} and deleted_at is null
      order by position, id
    `;

  it("copies D occasions 1–6 into A and B day N+1 at 10:00", async () => {
    const aDay2 = await live("A", 2);
    const bDay2 = await live("B", 2);
    const bDay3 = await live("B", 3);
    const aDay3 = await live("A", 3);
    expect(aDay2.map((row) => row.text)).toEqual(["A day 2", "Afsus, havolani ochmadingiz"]);
    expect(bDay2.map((row) => row.text)).toEqual(["Afsus, narxgacha yetmadingiz"]);
    expect(bDay3.map((row) => row.text)).toEqual(["Ikkinchi imkon"]);
    expect(aDay3.map((row) => row.text)).toContain("Ikkinchi imkon");
    const copies = [aDay2[1], bDay2[0], bDay3[0], aDay3.find((row) => row.text === "Ikkinchi imkon")!];
    for (const copy of copies) {
      expect(copy).toMatchObject({ timing_value: 600, statuses: null, attempts: null });
    }
  });

  it("drops occasion 7 and soft-deletes every D template", async () => {
    const sql = main.sql();
    expect(await sql`select id from message_templates where segment = 'D' and deleted_at is null`).toHaveLength(0);
    expect(await sql`select id from message_templates where text = 'Oxirgi imkon' and deleted_at is null`).toHaveLength(0);
    expect(await sql`select id from message_templates where text = 'O‘chirilgan imkon' and segment <> 'D'`).toHaveLength(0);
    expect(await sql`select id from message_templates where segment in ('A', 'B') and day = 8`).toHaveLength(0);
  });

  it("appends copies after existing reminders and keeps media, buttons and the active flag", async () => {
    const [existing, copy] = await live("A", 2);
    expect(existing).toMatchObject({ position: 0, text: "A day 2" });
    expect(copy).toMatchObject({
      position: 1,
      media_type: "photo",
      media_file_id: "photo-file",
      buttons: [{ kind: "again", text: "Ha, ko'raman" }],
      is_active: false,
    });
  });

  it("converts legacy timings", async () => {
    const sql = main.sql();
    const byId = async (key: string) => (await sql`select * from message_templates where id = ${ids[key]}`)[0];
    expect(await byId("after_day3")).toMatchObject({ day: 3, timing_value: 75 });
    expect(await byId("after_day1")).toMatchObject({ day: 1, timing_value: 90 });
    expect(await byId("before_expiry")).toMatchObject({ day: 1, timing_value: 1260, deleted_at: null });
    expect(await byId("clock_day1")).toMatchObject({ day: 2, timing_value: 540 });
    const notice = await byId("night_notice");
    expect(notice.deleted_at).not.toBeNull();
    expect(notice.timing_value).toBe(0);
    const columns = await sql`select column_name from information_schema.columns where table_name = 'message_templates'`;
    expect(columns.map((column) => column.column_name)).not.toContain("timing_type");
  });

  it("moves open D runs back to A or B without sending or relinking", async () => {
    const sql = main.sql();
    const runs = await sql`select * from segment_runs order by id`;
    const runsOf = (key: string) => runs.filter((run) => Number(run.user_id) === ids[key]);
    const yesterday = startOfYesterdayInTashkent(new Date());

    for (const key of ["fresh", "played", "priced", "blocked", "wrote"]) {
      const [ended] = runsOf(key);
      expect(ended).toMatchObject({ segment: "D", end_reason: "relinked" });
      expect(ended.ended_at).not.toBeNull();
    }

    expect(runsOf("fresh")[1]).toMatchObject({ segment: "A", attempt: 2, ended_at: null });
    expect(new Date(runsOf("fresh")[1].entered_at)).toEqual(yesterday);
    expect(runsOf("played")[1]).toMatchObject({ segment: "B", attempt: 3, ended_at: null });
    expect(runsOf("priced")[1]).toMatchObject({ segment: "C", attempt: 2, ended_at: null });
    expect(runsOf("blocked")).toHaveLength(1);
    expect(runsOf("wrote")).toHaveLength(1);
    expect(await sql`select id from segment_runs where segment = 'D' and ended_at is null`).toHaveLength(0);

    expect(await sql`select * from link_grants order by id`).toEqual(grantsBefore);
    expect(await sql`select id, link_id, link_expires_at from users order by id`).toEqual(usersBefore);
    expect(await sql`select id from sent_messages`).toHaveLength(0);
  });

  it("keeps pending «Keyinroq» appointments", async () => {
    const [appointment] = await main.sql()`select * from watch_appointments where id = ${ids.appointment}`;
    expect(appointment).toMatchObject({ fired_at: null, cancelled_at: null });
    expect(appointment.offer_id).not.toBeNull();
  });

  it("clears the seeded B total cap of 7 but keeps an admin-chosen value", async () => {
    const [caps] = await main.sql()`select value from settings where key = 'MESSAGE_CAPS'`;
    expect(JSON.parse(caps.value)).toEqual({
      A: { daily: 10, total: null },
      B: { daily: 4, total: null },
      C: { daily: 10, total: null },
    });
  });
});

describe.skipIf(!custom.url)("0024 reminder timeline migration with admin settings", () => {
  let expiryId = 0;

  beforeAll(async () => {
    await custom.setUp();
    const sql = custom.sql();
    await sql`insert into settings (key, value) values ('LINK_TTL_HOURS', '48')`;
    await sql`
      update settings
      set value = '{"A":{"daily":10,"total":null},"B":{"daily":4,"total":5},"C":{"daily":10,"total":null}}'
      where key = 'MESSAGE_CAPS'
    `;
    const [row] = await sql`
      insert into message_templates (segment, day, position, text, timing_type, timing_value)
      values ('A', 1, 0, 'Muddat tugayapti', 'before_expiry', 180)
      returning id
    `;
    expiryId = Number(row.id);
    await runMigrations(custom.url!);
  });

  afterAll(async () => {
    await custom.tearDown();
  });

  it("converts before_expiry against the configured link TTL", async () => {
    const [row] = await custom.sql()`select day, timing_value from message_templates where id = ${expiryId}`;
    expect(row).toMatchObject({ day: 1, timing_value: 1439 });
  });

  it("clears the seeded B total cap of 7 but keeps an admin-chosen value", async () => {
    const [caps] = await custom.sql()`select value from settings where key = 'MESSAGE_CAPS'`;
    expect(JSON.parse(caps.value).B).toEqual({ daily: 4, total: 5 });
  });
});
