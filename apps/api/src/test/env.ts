export const TEST_BOT_TOKEN = "123456:TEST-token";

export function setTestEnv(overrides: Record<string, string> = {}) {
  Object.assign(process.env, {
    BOT_TOKEN: TEST_BOT_TOKEN,
    BOT_USERNAME: "test_bot",
    WEBHOOK_SECRET: "test-secret-0123456789",
    API_URL: "https://api.example.com",
    WEB_URL: "https://example.com",
    DATABASE_URL: "postgres://user:pass@localhost:1/none",
    CHANNEL_URL: "https://t.me/example",
    VIDEO_POSTER_URL: "https://video.example.com/poster.webp",
    ...overrides,
  });
}
