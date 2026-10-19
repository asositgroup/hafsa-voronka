import { beforeAll, describe, expect, it } from "vitest";
import { Hono } from "hono";
import { initDataAuth, type AuthVariables } from "./auth";
import { signInitData } from "./telegram/initData";

const BOT_TOKEN = "123456:TEST-token";

beforeAll(() => {
  Object.assign(process.env, {
    BOT_TOKEN,
    BOT_USERNAME: "test_bot",
    WEBHOOK_SECRET: "test-secret-0123456789",
    API_URL: "https://api.example.com",
    WEB_URL: "https://example.com",
    DATABASE_URL: "postgres://user:pass@localhost:1/none",
    CHANNEL_URL: "https://t.me/example",
    VIDEO_POSTER_URL: "https://video.example.com/poster.webp",
  });
});

function createTestApp() {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use("/app/*", initDataAuth);
  app.get("/app/me", (c) => {
    return c.json({
      user: c.get("telegramUser"),
      startParam: c.get("startParam"),
    });
  });
  app.post("/app/beacon", async (c) => {
    const body = await c.req.json();
    return c.json({ user: c.get("telegramUser"), type: body.type });
  });
  return app;
}

function makeInitData(overrides: Record<string, string> = {}) {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id: 98765, first_name: "TestUser" }),
    ...overrides,
  });
  const hash = signInitData(params, BOT_TOKEN);
  params.set("hash", hash);
  return params.toString();
}

describe("initDataAuth middleware", () => {
  it("allows valid initData and attaches telegramUser", async () => {
    const app = createTestApp();
    const initData = makeInitData({ start_param: "test_start" });
    const res = await app.request("/app/me", {
      headers: { authorization: `tma ${initData}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.id).toBe(98765);
    expect(body.user.first_name).toBe("TestUser");
    expect(body.startParam).toBe("test_start");
  });

  it("returns 401 when authorization header is missing", async () => {
    const app = createTestApp();
    const res = await app.request("/app/me");
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("missing");
  });

  it("returns 401 on bad hash", async () => {
    const app = createTestApp();
    const valid = makeInitData();
    const corrupted = valid.replace(/hash=[0-9a-f]{64}/, `hash=${"0".repeat(64)}`);
    const res = await app.request("/app/me", {
      headers: { authorization: `tma ${corrupted}` },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("bad_hash");
  });

  it("returns 401 on expired initData", async () => {
    const app = createTestApp();
    const expiredAuthDate = String(Math.floor(Date.now() / 1000) - 25 * 3600);
    const expiredData = makeInitData({ auth_date: expiredAuthDate });
    const res = await app.request("/app/me", {
      headers: { authorization: `tma ${expiredData}` },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("expired");
  });

  it("returns 401 on bad user JSON", async () => {
    const app = createTestApp();
    const badParams = new URLSearchParams({
      auth_date: String(Math.floor(Date.now() / 1000)),
      user: "not-json",
    });
    badParams.set("hash", signInitData(badParams, BOT_TOKEN));
    const res = await app.request("/app/me", {
      headers: { authorization: `tma ${badParams.toString()}` },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("bad_user");
  });

  it("accepts initData from a beacon body and keeps the body readable", async () => {
    const app = createTestApp();
    const res = await app.request("/app/beacon", {
      method: "POST",
      headers: { "content-type": "text/plain;charset=UTF-8" },
      body: JSON.stringify({ initData: makeInitData(), type: "channel_click" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.id).toBe(98765);
    expect(body.type).toBe("channel_click");
  });

  it("rejects a beacon body with forged initData", async () => {
    const app = createTestApp();
    const forged = makeInitData().replace(/hash=[0-9a-f]{64}/, `hash=${"1".repeat(64)}`);
    const res = await app.request("/app/beacon", {
      method: "POST",
      headers: { "content-type": "text/plain;charset=UTF-8" },
      body: JSON.stringify({ initData: forged, type: "channel_click" }),
    });
    expect(res.status).toBe(401);
  });
});
