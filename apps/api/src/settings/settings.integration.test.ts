import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { hashPassword } from "@/admin/auth";
import { closeDb, db } from "@/db";
import { runMigrations } from "@/db/migrate";
import { users } from "@/db/schema";
import { isolatedDatabase } from "@/test/isolatedDb";
import { setTestEnv } from "@/test/env";

const database = isolatedDatabase("vf_settings");
const PASSWORD = "settings-admin-password";

describe.skipIf(!database.url)("Admin settings", () => {
  let app: ReturnType<typeof import("@/app").createApp>;
  let cookie: string;

  beforeAll(async () => {
    await database.create();
    setTestEnv({
      DATABASE_URL: database.url!,
      ADMIN_PASSWORD_HASH: await hashPassword(PASSWORD),
      SESSION_SECRET: "settings-session-secret-0123456789abcdef",
    });
    await runMigrations(database.url!);
    app = (await import("@/app")).createApp();

    const login = await app.request("/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: PASSWORD }),
    });
    cookie = login.headers.get("set-cookie")!.split(";")[0];
  });

  afterAll(async () => {
    await closeDb();
    await database.drop();
  });

  const put = (body: unknown) =>
    app.request("/admin/settings", {
      method: "PUT",
      headers: { cookie, "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });

  it("rejects unauthenticated requests", async () => {
    expect((await app.request("/admin/settings")).status).toBe(401);
    const res = await app.request("/admin/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ linkTtlHours: 48 }),
    });
    expect(res.status).toBe(401);
  });

  it("returns the default link TTL", async () => {
    const res = await app.request("/admin/settings", { headers: { cookie } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ linkTtlHours: 24 });
  });

  it("rejects out-of-range and non-numeric values", async () => {
    for (const body of [{ linkTtlHours: 0 }, { linkTtlHours: 721 }, { linkTtlHours: "abc" }, { linkTtlHours: 1.5 }, "not json"]) {
      const res = await put(body);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "invalid_request" });
    }
  });

  it("saves the TTL and applies it to users registered afterwards", async () => {
    const saved = await put({ linkTtlHours: 48 });
    expect(saved.status).toBe(200);
    expect(await saved.json()).toEqual({ linkTtlHours: 48 });

    const res = await app.request("/admin/settings", { headers: { cookie } });
    expect(await res.json()).toEqual({ linkTtlHours: 48 });

    const { linkTtlHours } = await import("./service");
    expect(await linkTtlHours()).toBe(48);

    const { markRegistered } = await import("@/funnel/users");
    const [created] = await db().insert(users).values({ telegramId: 7_100_001, firstName: "Ttl" }).returning();
    await markRegistered(created.id, { name: "Ttl User", phone: "+998901234567", phoneVerified: true });
    const [registered] = await db().select().from(users).where(eq(users.id, created.id));
    expect(registered.linkExpiresAt!.getTime() - registered.registeredAt!.getTime()).toBe(48 * 3_600_000);
  });
});
