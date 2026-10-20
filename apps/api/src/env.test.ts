import { beforeEach, describe, expect, it, vi } from "vitest";
import { setTestEnv } from "./test/env";

async function loadKey(raw: string) {
  vi.resetModules();
  setTestEnv({ GOOGLE_SA_KEY: raw });
  const { loadEnv } = await import("./env");
  return loadEnv().GOOGLE_SA_KEY;
}

describe("GOOGLE_SA_KEY", () => {
  beforeEach(() => {
    delete process.env.GOOGLE_SA_KEY;
  });

  it("turns escaped newlines into real newlines", async () => {
    expect(await loadKey("-----BEGIN-----\\nabc\\n-----END-----\\n")).toBe("-----BEGIN-----\nabc\n-----END-----\n");
  });

  it("handles newlines escaped twice by the deploy platform", async () => {
    expect(await loadKey("-----BEGIN-----\\\\nabc\\\\n-----END-----\\\\n")).toBe("-----BEGIN-----\nabc\n-----END-----\n");
  });

  it("keeps real newlines as they are", async () => {
    expect(await loadKey("-----BEGIN-----\nabc\n-----END-----\n")).toBe("-----BEGIN-----\nabc\n-----END-----\n");
  });
});

describe("video env", () => {
  async function load(overrides: Record<string, string> = {}) {
    vi.resetModules();
    delete process.env.VIDEO_URL;
    delete process.env.VIDEO_DURATION_SEC;
    setTestEnv(overrides);
    const { loadEnv } = await import("./env");
    return loadEnv();
  }

  it("parses without VIDEO_URL and VIDEO_DURATION_SEC", async () => {
    const loaded = await load();
    expect(loaded.VIDEO_URL).toBeUndefined();
    expect(loaded.VIDEO_DURATION_SEC).toBeUndefined();
  });

  it("still rejects an invalid VIDEO_URL", async () => {
    await expect(load({ VIDEO_URL: "not-a-url" })).rejects.toThrow();
  });

  it("parses VIDEO_URL and VIDEO_DURATION_SEC when given", async () => {
    const loaded = await load({ VIDEO_URL: "https://video.example.com/a.mp4", VIDEO_DURATION_SEC: "600" });
    expect(loaded.VIDEO_URL).toBe("https://video.example.com/a.mp4");
    expect(loaded.VIDEO_DURATION_SEC).toBe(600);
  });
});

describe("R2 env", () => {
  const r2 = {
    R2_ACCOUNT_ID: "acc",
    R2_BUCKET: "funnel-video",
    R2_ACCESS_KEY_ID: "key",
    R2_SECRET_ACCESS_KEY: "secret",
    R2_PUBLIC_BASE_URL: "https://video.example.com/",
  };

  async function load(overrides: Record<string, string> = {}) {
    vi.resetModules();
    for (const name of Object.keys(r2)) delete process.env[name];
    setTestEnv(overrides);
    const { loadEnv } = await import("./env");
    return loadEnv();
  }

  it("parses without any R2 variable", async () => {
    expect((await load()).R2_BUCKET).toBeUndefined();
  });

  it("accepts all five and strips the trailing slash", async () => {
    expect((await load(r2)).R2_PUBLIC_BASE_URL).toBe("https://video.example.com");
  });

  it("fails when only some are set", async () => {
    await expect(load({ R2_BUCKET: "funnel-video" })).rejects.toThrow();
    const { R2_SECRET_ACCESS_KEY: _omitted, ...partial } = r2;
    await expect(load(partial)).rejects.toThrow();
  });
});
