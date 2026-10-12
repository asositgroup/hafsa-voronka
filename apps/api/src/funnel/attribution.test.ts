import { describe, expect, it } from "vitest";
import { parseStartParam } from "./attribution";

describe("parseStartParam", () => {
  it("parses visitor params", () => {
    expect(parseStartParam("v_Ab3-x_9QzK")).toEqual({ kind: "visitor", value: "Ab3-x_9QzK" });
  });

  it("parses campaign params", () => {
    expect(parseStartParam("c_fb_oct_a")).toEqual({ kind: "campaign", value: "fb_oct_a" });
  });

  it("ignores missing, unknown and invalid params", () => {
    expect(parseStartParam(undefined)).toBeNull();
    expect(parseStartParam("")).toBeNull();
    expect(parseStartParam("hello")).toBeNull();
    expect(parseStartParam("v_bad param")).toBeNull();
    expect(parseStartParam(`v_${"a".repeat(64)}`)).toBeNull();
  });
});
