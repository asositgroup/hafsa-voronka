import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { trackRequestSchema } from "@funnel/shared";
import { closeDb } from "@/db";
import { runMigrations } from "@/db/migrate";
import { resolveAttribution } from "@/funnel/attribution";
import { setTestEnv } from "@/test/env";

const testDbUrl = process.env.TEST_DATABASE_URL;

describe("trackRequestSchema validation", () => {
  it("accepts valid visitor_id and types", () => {
    const valid = {
      visitor_id: "Abc123_-99",
      type: "landing_view",
      utm_source: "fb_ad",
      utm_campaign: "promo",
      utm_content: "creative_1",
      fbclid: "click_123",
      referrer: "https://instagram.com",
    };
    expect(trackRequestSchema.safeParse(valid).success).toBe(true);

    expect(
      trackRequestSchema.safeParse({
        visitor_id: "1234567890",
        type: "cta_click",
      }).success,
    ).toBe(true);
  });

  it("rejects invalid visitor_id", () => {
    expect(
      trackRequestSchema.safeParse({
        visitor_id: "short",
        type: "landing_view",
      }).success,
    ).toBe(false);

    expect(
      trackRequestSchema.safeParse({
        visitor_id: "toolongvisitorid",
        type: "landing_view",
      }).success,
    ).toBe(false);

    expect(
      trackRequestSchema.safeParse({
        visitor_id: "invalid!@#$",
        type: "landing_view",
      }).success,
    ).toBe(false);
  });

  it("rejects invalid type", () => {
    expect(
      trackRequestSchema.safeParse({
        visitor_id: "Abc123_-99",
        type: "registered",
      }).success,
    ).toBe(false);
  });

  it("rejects strings exceeding max lengths", () => {
    expect(
      trackRequestSchema.safeParse({
        visitor_id: "Abc123_-99",
        type: "landing_view",
        utm_source: "a".repeat(201),
      }).success,
    ).toBe(false);

    expect(
      trackRequestSchema.safeParse({
        visitor_id: "Abc123_-99",
        type: "landing_view",
        fbclid: "a".repeat(501),
      }).success,
    ).toBe(false);
  });
});

describe.skipIf(!testDbUrl)("/track route integration", () => {
  let createApp: typeof import("@/app").createApp;

  beforeAll(async () => {
    setTestEnv({ DATABASE_URL: testDbUrl! });
    await runMigrations(testDbUrl!);
    const appModule = await import("@/app");
    createApp = appModule.createApp;
  });

  afterAll(async () => {
    await closeDb();
  });

  it("returns 400 for invalid bodies", async () => {
    const app = createApp();

    const resMalformed = await app.request("/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{invalid json",
    });
    expect(resMalformed.status).toBe(400);

    const resInvalidSchema = await app.request("/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitor_id: "bad", type: "invalid" }),
    });
    expect(resInvalidSchema.status).toBe(400);
  });

  it("stores flat meta and allows resolveAttribution to read it back", async () => {
    const app = createApp();
    const vid = "TestVid_01";

    const res = await app.request("/track", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({
        visitor_id: vid,
        type: "landing_view",
        utm_source: "google_search",
        utm_campaign: "brand_campaign",
        utm_content: "text_ad",
        fbclid: "fb_click_id_abc",
        referrer: "https://google.com/",
      }),
    });

    expect(res.status).toBe(204);

    const attribution = await resolveAttribution(`v_${vid}`);
    expect(attribution.visitorId).toBe(vid);
    expect(attribution.utm_source).toBe("google_search");
    expect(attribution.utm_campaign).toBe("brand_campaign");
    expect(attribution.utm_content).toBe("text_ad");
    expect(attribution.fbclid).toBe("fb_click_id_abc");
  });

  it("limits a single visitor but not many visitors behind one shared IP", async () => {
    const app = createApp();
    const ip = `198.51.100.${Math.floor(Math.random() * 200) + 10}`;
    const runId = Math.random().toString(36).slice(2, 6);

    const sendTrack = (visitorId: string) =>
      app.request("/track", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
        body: JSON.stringify({ visitor_id: visitorId, type: "landing_view" }),
      });

    for (let i = 0; i < 50; i++) {
      const res = await sendTrack(`s${runId}${String(i).padStart(5, "0")}`);
      expect(res.status).toBe(204);
    }

    const single = `r${runId}abcde`;
    for (let i = 0; i < 20; i++) {
      expect((await sendTrack(single)).status).toBe(204);
    }
    expect((await sendTrack(single)).status).toBe(429);
  });
});
