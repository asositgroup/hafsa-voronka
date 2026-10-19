import { describe, expect, it } from "vitest";
import { effectiveUnlockSec } from "./unlock";

describe("effectiveUnlockSec", () => {
  it("prefers the explicit unlock point", () => {
    expect(effectiveUnlockSec({ unlockSec: 120, priceSec: 300 })).toBe(120);
  });

  it("falls back to the price point", () => {
    expect(effectiveUnlockSec({ unlockSec: null, priceSec: 300 })).toBe(300);
  });

  it("is null when neither is set or there is no video", () => {
    expect(effectiveUnlockSec({ unlockSec: null, priceSec: null })).toBeNull();
    expect(effectiveUnlockSec(null)).toBeNull();
  });
});
