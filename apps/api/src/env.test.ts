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
