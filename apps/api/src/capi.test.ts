import { createHash } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import type { User } from "@/db/schema";
import { setTestEnv } from "@/test/env";
import { buildCapiPayload, GRAPH_API_VERSION, sendCapiEvent, type CapiEvent } from "./capi";

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    telegramId: 987654321,
    username: "testuser",
    firstName: "Test",
    languageCode: "uz",
    name: "Test User",
    phone: "+998901234567",
    phoneVerified: true,
    startParam: "v_abcdefghij",
    visitorId: "abcdefghij",
    utmSource: "fb",
    utmCampaign: "spring",
    utmContent: "video",
    fbclid: "fbclid_12345",
    registeredAt: new Date("2026-03-01T10:00:00Z"),
    linkGivenAt: null,
    linkExpiresAt: null,
    completedAt: null,
    channelClickAt: null,
    botBlocked: false,
    videoId: null,
    createdAt: new Date("2026-03-01T09:00:00Z"),
    ...overrides,
  };
}

describe("Facebook Conversions API", () => {
  beforeAll(() => {
    setTestEnv();
  });

  it("pins Graph API version as constant", () => {
    expect(GRAPH_API_VERSION).toBe("v26.0");
  });

  it("hashes phone, telegramId and country correctly", () => {
    const user = makeUser({ phone: "+998 90 123 45 67", telegramId: 123456789 });
    const event: CapiEvent = {
      name: "CompleteRegistration",
      eventId: "reg_1",
      user,
    };

    const payload = buildCapiPayload(event, {
      webUrl: "https://example.com",
      eventTime: 1700000000,
    });

    const expectedPh = createHash("sha256").update("998901234567").digest("hex");
    const expectedExtId = createHash("sha256").update("123456789").digest("hex");
    const expectedCountry = createHash("sha256").update("uz").digest("hex");

    expect(payload.data[0].user_data.ph).toBe(expectedPh);
    expect(payload.data[0].user_data.external_id).toBe(expectedExtId);
    expect(payload.data[0].user_data.country).toBe(expectedCountry);
    expect(payload.data[0].event_name).toBe("CompleteRegistration");
    expect(payload.data[0].event_id).toBe("reg_1");
    expect(payload.data[0].event_time).toBe(1700000000);
    expect(payload.data[0].action_source).toBe("website");
    expect(payload.data[0].event_source_url).toBe("https://example.com");
  });

  it("formats fbc using landingViewCreatedAt and falls back to user.createdAt", () => {
    const landingDate = new Date("2026-02-28T12:00:00Z");
    const user = makeUser({
      fbclid: "test_fbclid_val",
      createdAt: new Date("2026-03-01T09:00:00Z"),
    });
    const event: CapiEvent = {
      name: "VideoComplete",
      eventId: "vc_1",
      user,
    };

    const payloadWithLanding = buildCapiPayload(event, {
      landingViewCreatedAt: landingDate,
      webUrl: "https://example.com",
    });

    expect(payloadWithLanding.data[0].user_data.fbc).toBe(
      `fb.1.${landingDate.getTime()}.test_fbclid_val`,
    );

    const payloadFallback = buildCapiPayload(event, {
      landingViewCreatedAt: null,
      webUrl: "https://example.com",
    });

    expect(payloadFallback.data[0].user_data.fbc).toBe(
      `fb.1.${user.createdAt.getTime()}.test_fbclid_val`,
    );
  });

  it("omits optional fields when absent", () => {
    const user = makeUser({
      phone: null,
      fbclid: null,
    });
    const event: CapiEvent = {
      name: "CompleteRegistration",
      eventId: "reg_2",
      user,
    };

    const payload = buildCapiPayload(event, {
      webUrl: "https://example.com",
      testEventCode: undefined,
    });

    expect(payload.data[0].user_data.ph).toBeUndefined();
    expect(payload.data[0].user_data.fbc).toBeUndefined();
    expect(payload.test_event_code).toBeUndefined();
  });

  it("includes test_event_code when set", () => {
    const user = makeUser();
    const event: CapiEvent = {
      name: "CompleteRegistration",
      eventId: "reg_3",
      user,
    };

    const payload = buildCapiPayload(event, {
      webUrl: "https://example.com",
      testEventCode: "TEST99999",
    });

    expect(payload.test_event_code).toBe("TEST99999");
  });

  it("is a no-op when credentials are unset and never throws", async () => {
    const user = makeUser();
    const event: CapiEvent = {
      name: "CompleteRegistration",
      eventId: "reg_4",
      user,
    };

    await expect(sendCapiEvent(event)).resolves.toBeUndefined();
  });

  it("passes the client user agent and IP unhashed, as Meta requires for website events", () => {
    const payload = buildCapiPayload(
      {
        name: "CompleteRegistration",
        eventId: "reg_1",
        user: makeUser(),
        client: { userAgent: "Mozilla/5.0 Telegram-Android", ip: "84.54.70.1" },
      },
      { webUrl: "https://example.com" },
    );
    expect(payload.data[0].user_data.client_user_agent).toBe("Mozilla/5.0 Telegram-Android");
    expect(payload.data[0].user_data.client_ip_address).toBe("84.54.70.1");
  });
});

