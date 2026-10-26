import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import readExcelFile from "read-excel-file/node";
import { hashPassword } from "@/admin/auth";
import { closeDb, db } from "@/db";
import { runMigrations } from "@/db/migrate";
import { events, messageTemplates, segmentRuns, sentMessages, users, videos, watchProgress } from "@/db/schema";
import { setTestEnv } from "@/test/env";
import { createTestVideo } from "@/test/videos";

const serverDbUrl = process.env.TEST_DATABASE_URL;
const isolatedDbName = `vf_reports_${process.pid}`;
const testDbUrl = serverDbUrl && Object.assign(new URL(serverDbUrl), { pathname: `/${isolatedDbName}` }).toString();
const PASSWORD = "reports-admin-password";
const RANGE = "from=2026-10-01&to=2026-10-07";
const LINK_GIVEN = new Date("2026-10-03T06:00:00Z");
const T0 = new Date("2026-10-03T06:00:00Z");
const hoursAfter = (hours: number) => new Date(T0.getTime() + hours * 3_600_000);

describe.skipIf(!testDbUrl)("Admin reports", () => {
  let app: ReturnType<typeof import("@/app").createApp>;
  let cookie: string;
  let token: string;
  let nextTelegramId = 9000;
  let v1: typeof videos.$inferSelect;
  let v2: typeof videos.$inferSelect;
  const templates: Record<string, number> = {};

  beforeAll(async () => {
    const admin = postgres(serverDbUrl!, { max: 1 });
    await admin.unsafe(`drop database if exists ${isolatedDbName}`);
    await admin.unsafe(`create database ${isolatedDbName}`);
    await admin.end();
    setTestEnv({
      DATABASE_URL: testDbUrl!,
      ADMIN_PASSWORD_HASH: await hashPassword(PASSWORD),
      SESSION_SECRET: "reports-session-secret-0123456789abcdef",
    });
    await runMigrations(testDbUrl!);
    app = (await import("@/app")).createApp();

    const login = await app.request("/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: PASSWORD }),
    });
    cookie = login.headers.get("set-cookie")!.split(";")[0];
    token = ((await login.json()) as { token: string }).token;

    await seedVideoCohort();
    await seedMessages();
  });

  afterAll(async () => {
    await closeDb();
    const admin = postgres(serverDbUrl!, { max: 1 });
    await admin.unsafe(`drop database if exists ${isolatedDbName} with (force)`);
    await admin.end();
  });

  async function seedUser(overrides: Partial<typeof users.$inferInsert> = {}) {
    const [user] = await db()
      .insert(users)
      .values({
        telegramId: nextTelegramId++,
        firstName: "Report",
        registeredAt: LINK_GIVEN,
        linkGivenAt: LINK_GIVEN,
        ...overrides,
      })
      .returning();
    return user;
  }

  async function seedProgress(userId: number, values: Partial<typeof watchProgress.$inferInsert>) {
    await db().insert(watchProgress).values({ userId, ...values });
  }

  async function seedVideoCohort() {
    v1 = await createTestVideo({ title: "V1", duration: 1800, courseStartSec: 600, priceSec: 1200, shortOfferVideoUrl: "https://video.example.com/offer.mp4", shortOfferDuration: 60 });
    v2 = await createTestVideo({ title: "V2", duration: 1800 });
    await db().update(videos).set({ archivedAt: LINK_GIVEN }).where(eq(videos.id, v2.id));

    await seedUser({ videoId: v1.id });

    const openedOnly = await seedUser({ videoId: v1.id });
    await db().insert(events).values({ userId: openedOnly.id, type: "app_open", createdAt: hoursAfter(1) });

    const early = await seedUser({ videoId: v1.id });
    await seedProgress(early.id, { maxPosition: 200, startedAt: hoursAfter(1), lastBeatAt: hoursAfter(2) });

    const course = await seedUser({ videoId: v1.id });
    await seedProgress(course.id, { maxPosition: 700, startedAt: hoursAfter(1), lastBeatAt: hoursAfter(3) });

    const price = await seedUser({ videoId: v1.id, channelClickAt: hoursAfter(5), offerWatchedAt: hoursAfter(4) });
    await seedProgress(price.id, { maxPosition: 1300, startedAt: hoursAfter(1), lastBeatAt: hoursAfter(4) });

    const watchingNow = await seedUser({ videoId: v1.id });
    await seedProgress(watchingNow.id, { maxPosition: 250, startedAt: hoursAfter(1), lastBeatAt: new Date() });

    await seedUser({ videoId: v1.id, linkGivenAt: new Date("2026-10-07T19:30:00Z") });

    const archived = await seedUser({ videoId: v2.id });
    await seedProgress(archived.id, { maxPosition: 900, startedAt: hoursAfter(1), lastBeatAt: hoursAfter(2) });
  }

  async function seedTemplate(key: string, segment: "A" | "B" | "C", day: number, position: number, text: string) {
    const [row] = await db()
      .insert(messageTemplates)
      .values({ segment, day, position, text, timingValue: 60 })
      .returning();
    templates[key] = row.id;
  }

  async function seedSend(
    userId: number,
    templateKey: string,
    sentAt: Date,
    overrides: Partial<typeof sentMessages.$inferInsert> = {},
  ) {
    const [run] = await db()
      .insert(segmentRuns)
      .values({ userId, segment: "A", enteredAt: sentAt })
      .onConflictDoNothing()
      .returning();
    const segmentRunId =
      run?.id ?? (await db().select().from(segmentRuns).where(eq(segmentRuns.userId, userId)))[0].id;
    await db().insert(sentMessages).values({
      userId,
      templateId: templates[templateKey],
      segmentRunId,
      dueAt: sentAt,
      sentAt,
      telegramMessageId: 100,
      ...overrides,
    });
  }

  async function seedMessages() {
    await seedTemplate("TA", "A", 1, 0, "Salom <b>&amp;</b> xush kelibsiz");
    await seedTemplate("TB1", "B", 1, 0, "Birinchi eslatma");
    await seedTemplate("TB2", "B", 1, 1, "Ikkinchi eslatma");
    await seedTemplate("TC", "C", 1, 0, "Narx haqida");

    const a = await seedUser();
    await seedSend(a.id, "TA", T0, { clickedAt: hoursAfter(1) });
    await db().update(users).set({ channelClickAt: hoursAfter(6) }).where(eq(users.id, a.id));
    await db().insert(events).values({ userId: a.id, type: "price_reached", createdAt: hoursAfter(5) });

    const b = await seedUser();
    await seedSend(b.id, "TB1", T0);
    await seedSend(b.id, "TB2", hoursAfter(3));
    await db().insert(events).values({ userId: b.id, type: "price_reached", createdAt: hoursAfter(4) });

    const c = await seedUser();
    await seedSend(c.id, "TB1", T0);
    await db().insert(events).values({ userId: c.id, type: "price_reached", createdAt: hoursAfter(49) });

    const d = await seedUser();
    await seedSend(d.id, "TB1", T0, { telegramMessageId: null, sendError: "boom" });

    const e = await seedUser();
    await seedSend(e.id, "TC", T0);

    const outside = await seedUser();
    await seedSend(outside.id, "TA", new Date("2026-10-20T06:00:00Z"));
  }

  const request = (path: string, init: RequestInit = {}) =>
    app.request(`/admin/reports${path}`, { ...init, headers: { cookie, ...init.headers } });

  type Report = {
    from: string;
    to: string;
    videos: Record<string, unknown>[];
    messages: Record<string, unknown>[];
  };

  const fetchReport = async (query = RANGE) => (await (await request(`?${query}`)).json()) as Report;

  it("requires an admin session", async () => {
    expect((await app.request(`/admin/reports?${RANGE}`)).status).toBe(401);
    expect((await app.request(`/admin/reports/export.xlsx?${RANGE}`)).status).toBe(401);
  });

  it("rejects a malformed date", async () => {
    const res = await request("?from=bad");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_query" });
  });

  it("swaps a reversed range", async () => {
    const report = await fetchReport("from=2026-10-07&to=2026-10-01");
    expect(report.from).toBe("2026-10-01");
    expect(report.to).toBe("2026-10-07");
  });

  it("reports the video cohort by link given date", async () => {
    const report = await fetchReport();
    const row = (id: number) => report.videos.find((video) => video.videoId === id);

    expect(row(v1.id)).toEqual({
      videoId: v1.id,
      title: "V1",
      isActive: false,
      archived: false,
      given: 6,
      opened: 5,
      leftEarly: 2,
      reachedCourse: 2,
      reachedPrice: 1,
      offerWatched: 1,
      wroteAdmin: 1,
    });
    expect(row(v2.id)).toEqual({
      videoId: v2.id,
      title: "V2",
      isActive: false,
      archived: true,
      given: 1,
      opened: 1,
      leftEarly: 0,
      reachedCourse: null,
      reachedPrice: null,
      offerWatched: null,
      wroteAdmin: 0,
    });
  });

  it("attributes price and admin outcomes inside the per message window", async () => {
    const report = await fetchReport();
    const row = (key: string) => report.messages.find((message) => message.templateId === templates[key]);

    expect(row("TA")).toMatchObject({
      segment: "A",
      day: 1,
      preview: "Salom & xush kelibsiz",
      deleted: false,
      sent: 1,
      clicked: 1,
      priceAfter: 1,
      clickedPriceAfter: 1,
      adminAfter: 1,
      clickedAdminAfter: 1,
    });
    expect(row("TB1")).toMatchObject({ sent: 2, clicked: 0, priceAfter: 0, adminAfter: 0 });
    expect(row("TB2")).toMatchObject({ sent: 1, priceAfter: 1 });
    expect(row("TC")).toMatchObject({ sent: 1, priceAfter: null, clickedPriceAfter: null });
    expect(report.messages.map((message) => message.templateId)).toEqual([
      templates.TA,
      templates.TB1,
      templates.TB2,
      templates.TC,
    ]);
  });

  it("returns empty tables for a range without data", async () => {
    const report = await fetchReport("from=2026-01-01&to=2026-01-02");
    expect(report.videos).toEqual([]);
    expect(report.messages).toEqual([]);
  });

  it("exports the report as xlsx through the query token", async () => {
    const res = await app.request(`/admin/reports/export.xlsx?${RANGE}&token=${token}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="hisobot-2026-10-01-2026-10-07.xlsx"');

    const sheets = await readExcelFile(Buffer.from(await res.arrayBuffer()));
    expect(sheets.map((sheet) => sheet.sheet)).toEqual(["Videolar", "Xabarlar"]);

    const videoRows = sheets[0].data;
    expect(videoRows[0][0]).toBe("Davr: 01.10.2026 – 07.10.2026");
    const v1Row = videoRows.find((row) => row[0] === "V1")!;
    expect(v1Row[videoRows[1].indexOf("Berildi")]).toBe(6);
    expect(v1Row[videoRows[1].indexOf("Ochdi") + 1]).toBeCloseTo(0.833, 5);

    const messageRows = sheets[1].data;
    const tcRow = messageRows.find((row) => row[3] === "Narx haqida")!;
    expect(tcRow[messageRows[1].indexOf("Keyin narxga yetdi")]).toBe("—");
  });
});
