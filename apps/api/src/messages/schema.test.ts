import { describe, expect, it } from "vitest";
import { messageTemplateInputSchema } from "@funnel/shared";

const base = {
  segment: "A",
  day: 1,
  text: "Salom {ism}",
  media: null,
  timing: { type: "after_entry", value: 60 },
  buttons: [],
  isActive: true,
};

describe("messageTemplateInputSchema", () => {
  it("accepts a valid template", () => {
    expect(messageTemplateInputSchema.safeParse(base).success).toBe(true);
  });

  it("allows at most three buttons", () => {
    const button = { kind: "later", text: "Keyinroq" };
    expect(messageTemplateInputSchema.safeParse({ ...base, buttons: [button, button, button] }).success).toBe(true);
    expect(messageTemplateInputSchema.safeParse({ ...base, buttons: [button, button, button, button] }).success).toBe(false);
  });

  it("surfaces text and timing errors", () => {
    const text = messageTemplateInputSchema.safeParse({ ...base, text: "{x}" });
    expect(text.success ? null : text.error.issues[0]).toMatchObject({ message: "unknown_variable", path: ["text"] });
    const timing = messageTemplateInputSchema.safeParse({ ...base, timing: { type: "day_time", value: 1410 } });
    expect(timing.success ? null : timing.error.issues[0]).toMatchObject({ message: "night", path: ["timing", "value"] });
  });
});
