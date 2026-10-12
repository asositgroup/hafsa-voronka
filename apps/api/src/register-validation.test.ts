import { beforeAll, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { normalizeUzPhone } from "@funnel/shared";
import { uz } from "./i18n/uz";
import { signInitData } from "./telegram/initData";
import { initDataAuth, type AuthVariables } from "./auth";

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
    VIDEO_URL: "https://video.example.com/master.mp4",
    VIDEO_POSTER_URL: "https://video.example.com/poster.webp",
    VIDEO_DURATION_SEC: "900",
  });
});

function makeAuthHeader(userId = 55555) {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id: userId, first_name: "Vali" }),
  });
  params.set("hash", signInitData(params, BOT_TOKEN));
  return `tma ${params.toString()}`;
}

function createValidationApp(mockUser: { phoneVerified: boolean; phone: string | null } | null) {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use("/app/*", initDataAuth);

  app.post("/app/register", async (c) => {
    let body: { name?: unknown; phone?: unknown } = {};
    try {
      body = await c.req.json();
    } catch {
      return c.json({ field: "name", message: uz.validation.nameRequired }, 422);
    }

    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (name.length < 2 || name.length > 60) {
      return c.json({ field: "name", message: uz.validation.nameRequired }, 422);
    }

    const user = mockUser;
    let phoneToSave: string;
    let verifiedToSave: boolean;

    if (user?.phoneVerified && user.phone) {
      phoneToSave = user.phone;
      verifiedToSave = true;
    } else {
      const rawPhone = typeof body?.phone === "string" ? body.phone : "";
      const normalized = normalizeUzPhone(rawPhone);
      if (!normalized) {
        return c.json({ field: "phone", message: uz.validation.phoneRequired }, 422);
      }
      phoneToSave = normalized;
      verifiedToSave = false;
    }

    return c.json({ ok: true, phoneToSave, verifiedToSave });
  });

  return app;
}

describe("POST /app/register validation", () => {
  it("rejects names shorter than 2 characters", async () => {
    const app = createValidationApp(null);
    const res = await app.request("/app/register", {
      method: "POST",
      headers: {
        authorization: makeAuthHeader(),
        "content-type": "application/json",
      },
      body: JSON.stringify({ name: "A", phone: "+998901234567" }),
    });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.field).toBe("name");
    expect(body.message).toBe(uz.validation.nameRequired);
  });

  it("rejects names longer than 60 characters", async () => {
    const app = createValidationApp(null);
    const res = await app.request("/app/register", {
      method: "POST",
      headers: {
        authorization: makeAuthHeader(),
        "content-type": "application/json",
      },
      body: JSON.stringify({ name: "A".repeat(61), phone: "+998901234567" }),
    });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.field).toBe("name");
    expect(body.message).toBe(uz.validation.nameRequired);
  });

  it("rejects missing phone when user has no verified phone", async () => {
    const app = createValidationApp({ phoneVerified: false, phone: null });
    const res = await app.request("/app/register", {
      method: "POST",
      headers: {
        authorization: makeAuthHeader(),
        "content-type": "application/json",
      },
      body: JSON.stringify({ name: "Valid Name" }),
    });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.field).toBe("phone");
    expect(body.message).toBe(uz.validation.phoneRequired);
  });

  it("rejects invalid operator in phone number", async () => {
    const app = createValidationApp({ phoneVerified: false, phone: null });
    const res = await app.request("/app/register", {
      method: "POST",
      headers: {
        authorization: makeAuthHeader(),
        "content-type": "application/json",
      },
      body: JSON.stringify({ name: "Valid Name", phone: "+998921234567" }),
    });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.field).toBe("phone");
    expect(body.message).toBe(uz.validation.phoneRequired);
  });

  it("accepts valid name and valid phone", async () => {
    const app = createValidationApp({ phoneVerified: false, phone: null });
    const res = await app.request("/app/register", {
      method: "POST",
      headers: {
        authorization: makeAuthHeader(),
        "content-type": "application/json",
      },
      body: JSON.stringify({ name: "Valid Name", phone: "90 123 45 67" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.phoneToSave).toBe("+998901234567");
    expect(body.verifiedToSave).toBe(false);
  });

  it("ignores invalid body phone if user already has verified phone", async () => {
    const app = createValidationApp({ phoneVerified: true, phone: "+998931112233" });
    const res = await app.request("/app/register", {
      method: "POST",
      headers: {
        authorization: makeAuthHeader(),
        "content-type": "application/json",
      },
      body: JSON.stringify({ name: "Valid Name", phone: "invalid-phone" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.phoneToSave).toBe("+998931112233");
    expect(body.verifiedToSave).toBe(true);
  });
});
