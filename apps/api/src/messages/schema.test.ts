import { describe, expect, it } from "vitest";
import { messageTemplateInputSchema, normalizeStatuses } from "@funnel/shared";

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

  it("defaults the audience filter to everyone", () => {
    const parsed = messageTemplateInputSchema.parse(base);
    expect(parsed.statuses).toBeNull();
  });

  it("accepts a stop-point filter only in segment B", () => {
    const inB = { ...base, segment: "B", statuses: ["korishni_boshladi", "sotuvda_toxtadi"] };
    expect(messageTemplateInputSchema.safeParse(inB).success).toBe(true);
    const inA = messageTemplateInputSchema.safeParse({ ...base, statuses: ["korishni_boshladi"] });
    expect(inA.success ? null : inA.error.issues[0]).toMatchObject({ message: "statuses_invalid", path: ["statuses"] });
    const wrong = messageTemplateInputSchema.safeParse({ ...base, segment: "B", statuses: ["narxni_kurdi"] });
    expect(wrong.success ? null : wrong.error.issues[0]).toMatchObject({ message: "statuses_invalid", path: ["statuses"] });
    expect(messageTemplateInputSchema.safeParse({ ...base, segment: "B", statuses: [] }).success).toBe(false);
    expect(messageTemplateInputSchema.safeParse({ ...base, segment: "B", statuses: ["nimadir"] }).success).toBe(false);
  });

  it("stores a filter that covers every stop point as everyone", () => {
    expect(normalizeStatuses("B", ["sotuvda_toxtadi", "korishni_boshladi", "dars_yarmida"])).toBeNull();
    expect(normalizeStatuses("B", ["sotuvda_toxtadi", "korishni_boshladi", "sotuvda_toxtadi"])).toEqual([
      "korishni_boshladi",
      "sotuvda_toxtadi",
    ]);
    expect(normalizeStatuses("B", null)).toBeNull();
  });
});
