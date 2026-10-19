import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
  Object.assign(process.env, {
    BOT_TOKEN: "123456:TEST-token",
    BOT_USERNAME: "test_bot",
    WEBHOOK_SECRET: "test-secret-0123456789",
    API_URL: "https://api.example.com",
    WEB_URL: "https://example.com",
    DATABASE_URL: "postgres://user:pass@localhost:1/none",
    CHANNEL_URL: "https://t.me/example",
    VIDEO_POSTER_URL: "https://video.example.com/poster.webp",
  });
});

describe("POST /bot", () => {
  it("rejects requests without the webhook secret", async () => {
    const { createApp } = await import("./app");
    const response = await createApp().request("/bot", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ update_id: 1 }),
    });
    expect(response.status).toBe(401);
  });

  it("rejects requests with a wrong webhook secret", async () => {
    const { createApp } = await import("./app");
    const response = await createApp().request("/bot", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-telegram-bot-api-secret-token": "wrong-secret-000000000",
      },
      body: JSON.stringify({ update_id: 1 }),
    });
    expect(response.status).toBe(401);
  });
});
