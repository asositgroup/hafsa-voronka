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
