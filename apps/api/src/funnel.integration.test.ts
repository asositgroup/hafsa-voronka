import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { sessionResponseSchema } from "@funnel/shared";
import { closeDb, db } from "./db";
import { events, users } from "./db/schema";
import { runMigrations } from "./db/migrate";
import { saveContactPhone } from "./funnel/users";
import { signInitData } from "./telegram/initData";

const testDbUrl = process.env.TEST_DATABASE_URL;
const BOT_TOKEN = "123456:TEST-token";

describe.skipIf(!testDbUrl)("Funnel Integration Tests", () => {
  let createApp: typeof import("./app").createApp;

  beforeAll(async () => {
    Object.assign(process.env, {
      BOT_TOKEN,
      BOT_USERNAME: "test_bot",
      WEBHOOK_SECRET: "test-secret-0123456789",
      API_URL: "https://api.example.com",
      WEB_URL: "https://example.com",
      DATABASE_URL: testDbUrl,
      CHANNEL_URL: "https://t.me/example",
      VIDEO_URL: "https://video.example.com/master.mp4",
      VIDEO_POSTER_URL: "https://video.example.com/poster.webp",
      VIDEO_DURATION_SEC: "900",
    });

    await runMigrations(testDbUrl!);
    const appModule = await import("./app");
    createApp = appModule.createApp;
  });

  afterAll(async () => {
    await closeDb();
  });

  function makeAuthHeader(userId: number, startParam?: string) {
    const params = new URLSearchParams({
      auth_date: String(Math.floor(Date.now() / 1000)),
      user: JSON.stringify({ id: userId, first_name: "TestUser" }),
    });
    if (startParam) {
      params.set("start_param", startParam);
    }
    params.set("hash", signInitData(params, BOT_TOKEN));
    return `tma ${params.toString()}`;
  }

  it("upserts user, attributes from landing visitor, logs app_open, returns session", async () => {
    const app = createApp();
    const visitorId = `vis_${Date.now()}`;
    const testUserId = Math.floor(Math.random() * 1000000) + 10000;

    await db().insert(events).values({
      type: "landing_view",
      visitorId,
      meta: {
        utm_source: "fb_ad",
        utm_campaign: "promo_2026",
        utm_content: "banner_1",
      },
    });

    const sessionRes = await app.request("/app/session", {
      method: "POST",
      headers: {
        authorization: makeAuthHeader(testUserId, `v_${visitorId}`),
      },
    });

    expect(sessionRes.status).toBe(200);
    const sessionJson = await sessionRes.json();
    const parsed = sessionResponseSchema.safeParse(sessionJson);
    expect(parsed.success).toBe(true);
    expect(sessionJson.registered).toBe(false);
    expect(sessionJson.phoneSet).toBe(false);
    expect(sessionJson.config.duration).toBe(900);

    const [createdUser] = await db()
      .select()
      .from(users)
      .where(eq(users.telegramId, testUserId))
      .limit(1);

    expect(createdUser).toBeDefined();
    expect(createdUser.visitorId).toBe(visitorId);
    expect(createdUser.utmSource).toBe("fb_ad");
    expect(createdUser.utmCampaign).toBe("promo_2026");
    expect(createdUser.utmContent).toBe("banner_1");

    const appOpenEvents = await db()
      .select()
      .from(events)
      .where(eq(events.userId, createdUser.id));

    expect(appOpenEvents.some((e) => e.type === "app_open")).toBe(true);
  });

  it("completes registration happy path and is idempotent", async () => {
    const app = createApp();
    const testUserId = Math.floor(Math.random() * 1000000) + 20000;
    const authHeader = makeAuthHeader(testUserId);

    await app.request("/app/session", {
      method: "POST",
      headers: { authorization: authHeader },
    });

    const regRes = await app.request("/app/register", {
      method: "POST",
      headers: {
        authorization: authHeader,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "Ali Valiyev",
        phone: "+998 90 123 45 67",
      }),
    });

    expect(regRes.status).toBe(200);
    const regJson = await regRes.json();
    expect(regJson).toEqual({ ok: true });

    const [user] = await db()
      .select()
      .from(users)
      .where(eq(users.telegramId, testUserId))
      .limit(1);

    expect(user.name).toBe("Ali Valiyev");
    expect(user.phone).toBe("+998901234567");
    expect(user.phoneVerified).toBe(false);
    expect(user.registeredAt).not.toBeNull();

    const userEvents = await db()
      .select()
      .from(events)
      .where(eq(events.userId, user.id));

    const regEvents = userEvents.filter((e) => e.type === "registered");
    expect(regEvents.length).toBe(1);

    const repeatRes = await app.request("/app/register", {
      method: "POST",
      headers: {
        authorization: authHeader,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "Different Name",
        phone: "+998 90 999 99 99",
      }),
    });

    expect(repeatRes.status).toBe(200);
    expect(await repeatRes.json()).toEqual({ ok: true });

    const [userAfterRepeat] = await db()
      .select()
      .from(users)
      .where(eq(users.telegramId, testUserId))
      .limit(1);

    expect(userAfterRepeat.name).toBe("Ali Valiyev");
    expect(userAfterRepeat.phone).toBe("+998901234567");

    const eventsAfterRepeat = await db()
      .select()
      .from(events)
      .where(eq(events.userId, user.id));

    const regEventsAfter = eventsAfterRepeat.filter((e) => e.type === "registered");
    expect(regEventsAfter.length).toBe(1);
  });

  it("records a single registration when submitted twice concurrently", async () => {
    const app = createApp();
    const testUserId = Math.floor(Math.random() * 1000000) + 3000000;
    const authHeader = makeAuthHeader(testUserId);
    await app.request("/app/session", { method: "POST", headers: { authorization: authHeader } });

    const submit = () =>
      app.request("/app/register", {
        method: "POST",
        headers: { authorization: authHeader, "content-type": "application/json" },
        body: JSON.stringify({ name: "Ali", phone: "901234567" }),
      });
    const responses = await Promise.all([submit(), submit()]);
    expect(responses.map((r) => r.status)).toEqual([200, 200]);

    const [user] = await db().select().from(users).where(eq(users.telegramId, testUserId)).limit(1);
    const regEvents = (await db().select().from(events).where(eq(events.userId, user.id))).filter(
      (e) => e.type === "registered",
    );
    expect(regEvents.length).toBe(1);
  });

  it("does not log app_open for polling session calls", async () => {
    const app = createApp();
    const testUserId = Math.floor(Math.random() * 1000000) + 4000000;
    const authHeader = makeAuthHeader(testUserId);
    const session = (body?: unknown) =>
      app.request("/app/session", {
        method: "POST",
        headers: { authorization: authHeader, "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });

    await session();
    await session({ reason: "poll" });
    await session({ reason: "poll" });

    const [user] = await db().select().from(users).where(eq(users.telegramId, testUserId)).limit(1);
    const opens = (await db().select().from(events).where(eq(events.userId, user.id))).filter(
      (e) => e.type === "app_open",
    );
    expect(opens.length).toBe(1);
  });

  it("preserves verified phone when registering with a different phone", async () => {
    const app = createApp();
    const testUserId = Math.floor(Math.random() * 1000000) + 30000;
    const authHeader = makeAuthHeader(testUserId);

    await saveContactPhone(
      { id: testUserId, first_name: "VerifiedUser" },
      "+998935554433",
    );

    const regRes = await app.request("/app/register", {
      method: "POST",
      headers: {
        authorization: authHeader,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "Verified Lead",
        phone: "+998 90 111 22 33",
      }),
    });

    expect(regRes.status).toBe(200);
    expect(await regRes.json()).toEqual({ ok: true });

    const [user] = await db()
      .select()
      .from(users)
      .where(eq(users.telegramId, testUserId))
      .limit(1);

    expect(user.name).toBe("Verified Lead");
    expect(user.phone).toBe("+998935554433");
    expect(user.phoneVerified).toBe(true);
    expect(user.registeredAt).not.toBeNull();
  });
});
