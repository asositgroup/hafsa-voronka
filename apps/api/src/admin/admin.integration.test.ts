import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import {
  adminLeadsResponseSchema,
  adminStatsResponseSchema,
} from "@funnel/shared";
import { closeDb, db } from "@/db";
import { runMigrations } from "@/db/migrate";
import {
  events,
  sheetsQueue,
  users,
  watchProgress,
} from "@/db/schema";
import { hashPassword } from "./auth";

const testDbUrl = process.env.TEST_DATABASE_URL;
const TEST_PASSWORD = "test-admin-password-2026";
const SESSION_SECRET = "supersecret-session-secret-key-32chars!!";

describe.skipIf(!testDbUrl)("Admin Integration Tests", () => {
  let createApp: typeof import("@/app").createApp;
  let testPasswordHash: string;
  let adminSessionCookie: string;

  beforeAll(async () => {
    testPasswordHash = await hashPassword(TEST_PASSWORD);

    Object.assign(process.env, {
      BOT_TOKEN: "123456:TEST-token",
      BOT_USERNAME: "test_bot",
      WEBHOOK_SECRET: "test-secret-0123456789",
      API_URL: "https://api.example.com",
      WEB_URL: "https://example.com",
      DATABASE_URL: testDbUrl,
      CHANNEL_URL: "https://t.me/example",
      VIDEO_URL: "https://video.example.com/master.mp4",
      VIDEO_POSTER_URL: "https://video.example.com/poster.webp",
      VIDEO_DURATION_SEC: "900",
      ADMIN_PASSWORD_HASH: testPasswordHash,
      SESSION_SECRET,
    });

    await runMigrations(testDbUrl!);
    const appModule = await import("@/app");
    createApp = appModule.createApp;

    await db().execute(sql`
      DELETE FROM events WHERE (created_at AT TIME ZONE 'Asia/Tashkent')::date >= '2026-05-01'::date AND (created_at AT TIME ZONE 'Asia/Tashkent')::date <= '2026-05-10'::date;
      DELETE FROM watch_progress WHERE user_id IN (SELECT id FROM users WHERE (registered_at AT TIME ZONE 'Asia/Tashkent')::date >= '2026-05-01'::date AND (registered_at AT TIME ZONE 'Asia/Tashkent')::date <= '2026-05-10'::date);
      DELETE FROM sheets_queue WHERE user_id IN (SELECT id FROM users WHERE (registered_at AT TIME ZONE 'Asia/Tashkent')::date >= '2026-05-01'::date AND (registered_at AT TIME ZONE 'Asia/Tashkent')::date <= '2026-05-10'::date);
      DELETE FROM users WHERE (registered_at AT TIME ZONE 'Asia/Tashkent')::date >= '2026-05-01'::date AND (registered_at AT TIME ZONE 'Asia/Tashkent')::date <= '2026-05-10'::date;
    `);
  });

  afterAll(async () => {
    await closeDb();
  });

  it("returns 503 when admin credentials or secret are missing", async () => {
    const savedHash = process.env.ADMIN_PASSWORD_HASH;
    delete process.env.ADMIN_PASSWORD_HASH;

    const app = createApp();
    const res = await app.request("/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: TEST_PASSWORD }),
    });
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toEqual({ error: "admin_disabled" });

    process.env.ADMIN_PASSWORD_HASH = savedHash;
  });

  it("handles login auth, wrong password, rate limit and cookie verification", async () => {
    const app = createApp();
    const rateLimitedIp = `192.0.2.${Date.now() % 250}`;
    const goodLoginIp = `198.51.100.${Date.now() % 250}`;

    const badLoginRes = await app.request("/admin/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "cf-connecting-ip": rateLimitedIp,
      },
      body: JSON.stringify({ password: "wrong-password" }),
    });
    expect(badLoginRes.status).toBe(401);
    expect(await badLoginRes.json()).toEqual({ error: "unauthorized" });

    const meUnauthorized = await app.request("/admin/me", { method: "GET" });
    expect(meUnauthorized.status).toBe(401);

    for (let i = 0; i < 4; i++) {
      const r = await app.request("/admin/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "cf-connecting-ip": rateLimitedIp,
        },
        body: JSON.stringify({ password: "wrong-password" }),
      });
      expect(r.status).toBe(401);
    }

    const rateLimitedRes = await app.request("/admin/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "cf-connecting-ip": rateLimitedIp,
      },
      body: JSON.stringify({ password: TEST_PASSWORD }),
    });
    expect(rateLimitedRes.status).toBe(429);
    expect(await rateLimitedRes.json()).toEqual({ error: "rate_limited" });

    const goodLoginRes = await app.request("/admin/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "cf-connecting-ip": goodLoginIp,
      },
      body: JSON.stringify({ password: TEST_PASSWORD }),
    });
    expect(goodLoginRes.status).toBe(200);
    expect(await goodLoginRes.json()).toEqual({ ok: true });

    const cookieHeader = goodLoginRes.headers.get("set-cookie");
    expect(cookieHeader).toBeDefined();
    expect(cookieHeader).toContain("admin_session=");
    expect(cookieHeader).toContain("HttpOnly");
    expect(cookieHeader).toContain("SameSite=Lax");
    expect(cookieHeader).toContain("Path=/admin");
    expect(cookieHeader).toContain("Max-Age=604800");

    const cookieMatch = cookieHeader?.match(/admin_session=[^;]+/);
    expect(cookieMatch).toBeTruthy();
    adminSessionCookie = cookieMatch![0];

    const meAuthorized = await app.request("/admin/me", {
      method: "GET",
      headers: { cookie: adminSessionCookie },
    });
    expect(meAuthorized.status).toBe(200);
    expect(await meAuthorized.json()).toEqual({ ok: true });

    const logoutRes = await app.request("/admin/logout", {
      method: "POST",
      headers: { cookie: adminSessionCookie },
    });
    expect(logoutRes.status).toBe(200);
    const logoutCookie = logoutRes.headers.get("set-cookie");
    expect(logoutCookie).toContain("admin_session=");
    expect(logoutCookie).toContain("Max-Age=0");
  });

  it("computes exact funnel counts, midnight boundaries, campaign stats, and dropoff", async () => {
    const app = createApp();

    const fromDate = "2026-05-06";
    const toDate = "2026-05-07";

    const visitorA = "vis_test_may_a";
    const visitorB = "vis_test_may_b";

    const dateMay06BeforeMidnight = new Date("2026-05-06T18:59:00.000Z");
    const dateMay07AfterMidnight = new Date("2026-05-06T19:01:00.000Z");
    const dateMay07Noon = new Date("2026-05-07T07:00:00.000Z");

    await db().insert(events).values([
      {
        type: "landing_view",
        visitorId: visitorA,
        createdAt: dateMay06BeforeMidnight,
        meta: { utm_source: "fb_ad", utm_campaign: "promo_fb" },
      },
      {
        type: "cta_click",
        visitorId: visitorA,
        createdAt: dateMay06BeforeMidnight,
        meta: { utm_source: "fb_ad", utm_campaign: "promo_fb" },
      },
      {
        type: "landing_view",
        visitorId: visitorB,
        createdAt: dateMay07AfterMidnight,
        meta: { utm_source: "tg_ad", utm_campaign: "promo_tg" },
      },
    ]);

    const baseTelegramId = Math.floor(Math.random() * 10000000) + 1000000;
    const tgId1 = baseTelegramId + 1;
    const tgId2 = baseTelegramId + 2;
    const tgId3 = baseTelegramId + 3;

    const [u1] = await db()
      .insert(users)
      .values({
        telegramId: tgId1,
        name: "Ali Valiyev",
        phone: "+998901111111",
        username: "ali_valiyev",
        utmSource: "fb_ad",
        utmCampaign: "promo_fb",
        utmContent: "video_ad",
        registeredAt: dateMay06BeforeMidnight,
        completedAt: dateMay06BeforeMidnight,
        channelClickAt: dateMay06BeforeMidnight,
        createdAt: dateMay06BeforeMidnight,
      })
      .returning();

    const [u2] = await db()
      .insert(users)
      .values({
        telegramId: tgId2,
        name: "Bobur Karimov",
        phone: "+998902222222",
        username: "bobur_k",
        utmSource: "tg_ad",
        utmCampaign: "promo_tg",
        utmContent: "channel_post",
        registeredAt: dateMay07AfterMidnight,
        createdAt: dateMay07AfterMidnight,
      })
      .returning();

    const [u3] = await db()
      .insert(users)
      .values({
        telegramId: tgId3,
        name: "Charos Rahimova",
        phone: "+998903333333",
        username: "charos_r",
        utmSource: "fb_ad",
        utmCampaign: "promo_fb",
        utmContent: "story_ad",
        registeredAt: dateMay07Noon,
        createdAt: dateMay07Noon,
      })
      .returning();

    await db().insert(watchProgress).values([
      {
        userId: u1.id,
        maxPosition: 900,
        watchedSecs: 900,
        completed: true,
      },
      {
        userId: u2.id,
        maxPosition: 450,
        watchedSecs: 450,
        completed: false,
      },
      {
        userId: u3.id,
        maxPosition: 90,
        watchedSecs: 90,
        completed: false,
      },
    ]);

    await db().insert(events).values([
      { type: "bot_start", userId: u1.id, createdAt: dateMay06BeforeMidnight },
      { type: "registered", userId: u1.id, createdAt: dateMay06BeforeMidnight },
      { type: "video_start", userId: u1.id, createdAt: dateMay06BeforeMidnight },
      { type: "progress_25", userId: u1.id, createdAt: dateMay06BeforeMidnight },
      { type: "progress_50", userId: u1.id, createdAt: dateMay06BeforeMidnight },
      { type: "progress_75", userId: u1.id, createdAt: dateMay06BeforeMidnight },
      { type: "video_complete", userId: u1.id, createdAt: dateMay06BeforeMidnight },
      { type: "channel_click", userId: u1.id, createdAt: dateMay06BeforeMidnight },

      { type: "bot_start", userId: u2.id, createdAt: dateMay07AfterMidnight },
      { type: "registered", userId: u2.id, createdAt: dateMay07AfterMidnight },
      { type: "video_start", userId: u2.id, createdAt: dateMay07AfterMidnight },
      { type: "progress_25", userId: u2.id, createdAt: dateMay07AfterMidnight },
      { type: "progress_50", userId: u2.id, createdAt: dateMay07AfterMidnight },

      { type: "bot_start", userId: u3.id, createdAt: dateMay07Noon },
      { type: "registered", userId: u3.id, createdAt: dateMay07Noon },
    ]);

    await db().insert(sheetsQueue).values([
      { userId: u1.id, row: ["Ali"], attempts: 1, sentAt: null },
      { userId: u2.id, row: ["Bobur"], attempts: 2, sentAt: null },
      { userId: u3.id, row: ["Charos"], attempts: 11, sentAt: null, lastError: "Rate limit" },
    ]);

    const statsRes = await app.request(`/admin/stats?from=${fromDate}&to=${toDate}`, {
      method: "GET",
      headers: { cookie: adminSessionCookie },
    });
    expect(statsRes.status).toBe(200);
    const stats = adminStatsResponseSchema.parse(await statsRes.json());

    expect(stats.kpis).toEqual({
      landingViews: 2,
      botStarts: 3,
      registrations: 3,
      completions: 1,
      channelClicks: 1,
      conversionRate: 50,
    });

    const stepCounts = Object.fromEntries(stats.funnel.map((s) => [s.step, s.count]));
    expect(stepCounts).toEqual({
      landing_view: 2,
      cta_click: 1,
      bot_start: 3,
      registered: 3,
      video_start: 2,
      progress_25: 2,
      progress_50: 2,
      progress_75: 1,
      video_complete: 1,
      channel_click: 1,
    });

    const stepConv = Object.fromEntries(stats.funnel.map((s) => [s.step, s.conversionRate]));
    expect(stepConv.landing_view).toBe(100);
    expect(stepConv.cta_click).toBe(50);
    expect(stepConv.bot_start).toBe(300);
    expect(stepConv.registered).toBe(100);
    expect(stepConv.video_start).toBe(66.7);
    expect(stepConv.progress_25).toBe(100);
    expect(stepConv.progress_50).toBe(100);
    expect(stepConv.progress_75).toBe(50);
    expect(stepConv.video_complete).toBe(100);
    expect(stepConv.channel_click).toBe(100);

    const may06Daily = stats.daily.find((d) => d.date === "2026-05-06");
    const may07Daily = stats.daily.find((d) => d.date === "2026-05-07");
    expect(may06Daily).toEqual({ date: "2026-05-06", registrations: 1, completions: 1 });
    expect(may07Daily).toEqual({ date: "2026-05-07", registrations: 2, completions: 0 });

    const p10 = stats.dropoff.find((d) => d.percent === 10);
    const p50 = stats.dropoff.find((d) => d.percent === 50);
    const p100 = stats.dropoff.find((d) => d.percent === 100);
    expect(p10).toEqual({ percent: 10, count: 3, share: 100 });
    expect(p50).toEqual({ percent: 50, count: 2, share: 66.7 });
    expect(p100).toEqual({ percent: 100, count: 1, share: 33.3 });

    expect(stats.campaigns.length).toBe(3);
    const fbCampaign = stats.campaigns.find((c) => c.source === "fb_ad" && c.content === "video_ad");
    expect(fbCampaign).toMatchObject({
      source: "fb_ad",
      campaign: "promo_fb",
      content: "video_ad",
      botStarts: 1,
      registrations: 1,
      completions: 1,
      completionRate: 100,
      channelClicks: 1,
    });

    expect(stats.health.sheetsBacklog).toBeGreaterThanOrEqual(2);
    expect(stats.health.sheetsFailures).toBeGreaterThanOrEqual(1);
    expect(stats.health.lastBotStartAt).not.toBeNull();
    expect(stats.health.lastEventAt).not.toBeNull();

    const filteredStatsRes = await app.request(
      `/admin/stats?from=${fromDate}&to=${toDate}&source=fb_ad&campaign=promo_fb`,
      {
        method: "GET",
        headers: { cookie: adminSessionCookie },
      },
    );
    expect(filteredStatsRes.status).toBe(200);
    const filteredStats = adminStatsResponseSchema.parse(await filteredStatsRes.json());
    expect(filteredStats.kpis.landingViews).toBe(1);
    expect(filteredStats.kpis.botStarts).toBe(2);
    expect(filteredStats.kpis.registrations).toBe(2);
    expect(filteredStats.kpis.completions).toBe(1);
    expect(filteredStats.kpis.channelClicks).toBe(1);
  });

  it("handles leads pagination and CSV export formatting", async () => {
    const app = createApp();
    const fromDate = "2026-05-06";
    const toDate = "2026-05-07";

    const leadsRes = await app.request(`/admin/leads?from=${fromDate}&to=${toDate}&page=1`, {
      method: "GET",
      headers: { cookie: adminSessionCookie },
    });
    expect(leadsRes.status).toBe(200);
    const leadsJson = adminLeadsResponseSchema.parse(await leadsRes.json());

    expect(leadsJson.total).toBe(3);
    expect(leadsJson.page).toBe(1);
    expect(leadsJson.leads.length).toBe(3);

    expect(leadsJson.leads[0].name).toBe("Charos Rahimova");
    expect(leadsJson.leads[0].progressPercent).toBe(10);
    expect(leadsJson.leads[0].completed).toBe(false);

    expect(leadsJson.leads[2].name).toBe("Ali Valiyev");
    expect(leadsJson.leads[2].progressPercent).toBe(100);
    expect(leadsJson.leads[2].completed).toBe(true);
    expect(leadsJson.leads[2].channelClicked).toBe(true);

    const extraUsersBase = Math.floor(Math.random() * 10000000) + 20000000;
    const extraUsers = Array.from({ length: 50 }, (_, i) => ({
      telegramId: extraUsersBase + i,
      name: `User ${i}`,
      registeredAt: new Date("2026-05-07T08:00:00.000Z"),
      createdAt: new Date("2026-05-07T08:00:00.000Z"),
    }));
    await db().insert(users).values(extraUsers);

    const pagedRes = await app.request(`/admin/leads?from=${fromDate}&to=${toDate}&page=2`, {
      method: "GET",
      headers: { cookie: adminSessionCookie },
    });
    expect(pagedRes.status).toBe(200);
    const pagedJson = adminLeadsResponseSchema.parse(await pagedRes.json());
    expect(pagedJson.total).toBe(53);
    expect(pagedJson.page).toBe(2);
    expect(pagedJson.pageSize).toBe(50);
    expect(pagedJson.totalPages).toBe(2);
    expect(pagedJson.leads.length).toBe(3);

    const csvRes = await app.request(`/admin/leads.csv?from=${fromDate}&to=${toDate}`, {
      method: "GET",
      headers: { cookie: adminSessionCookie },
    });
    expect(csvRes.status).toBe(200);
    expect(csvRes.headers.get("content-type")).toContain("text/csv");
    expect(csvRes.headers.get("content-disposition")).toContain("attachment");
    expect(csvRes.headers.get("content-disposition")).toContain(`leads-${fromDate}-${toDate}.csv`);

    const buf = Buffer.from(await csvRes.arrayBuffer());
    expect(buf[0]).toBe(0xef);
    expect(buf[1]).toBe(0xbb);
    expect(buf[2]).toBe(0xbf);

    const csvText = buf.toString("utf-8");
    const lines = csvText.replace(/^\uFEFF/, "").trim().split(/\r?\n/);
    expect(lines[0]).toBe(
      "Ro'yxatdan o'tgan sana,Ism,Telefon,Username,Manba,Kampaniya,Ko'rish foizi,Tugatilgan,Kanalga o'tilgan",
    );
    expect(lines.length).toBe(54);

    const aliLine = lines.find((l) => l.includes("Ali Valiyev"));
    expect(aliLine).toBeDefined();
    expect(aliLine).toContain("2026-05-06 23:59:00");
    expect(aliLine).toContain("+998901111111");
    expect(aliLine).toContain("@ali_valiyev");
    expect(aliLine).toContain("100%");
    expect(aliLine).toContain("Ha");
  });
});
