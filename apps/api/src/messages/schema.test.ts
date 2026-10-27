import { describe, expect, it } from "vitest";
import {
  messageTemplateBaseSchema,
  messageTemplateInputSchema,
  normalizeStatuses,
  validateTemplateInput,
} from "@funnel/shared";

const base = {
  segment: "A",
  day: 1,
  text: "Salom {ism}",
  media: null,
  minute: 60,
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
    const timing = messageTemplateInputSchema.safeParse({ ...base, minute: 1440 });
    expect(timing.success ? null : timing.error.issues[0]).toMatchObject({ message: "out_of_range", path: ["minute"] });
  });

  it("accepts a night clock time", () => {
    expect(messageTemplateInputSchema.safeParse({ ...base, day: 3, minute: 30 }).success).toBe(true);
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

  it("allows «Ha» and «Keyinroq» in every stage", () => {
    for (const segment of ["A", "B", "C"]) {
      const buttons = [
        { kind: "again", text: "Ha, ko'raman" },
        { kind: "later", text: "Keyinroq, ko'raman" },
      ];
      const parsed = messageTemplateBaseSchema.parse({ ...base, segment, buttons });
      expect(validateTemplateInput(parsed)).toBeNull();
    }
  });

  it("rejects segment D", () => {
    expect(messageTemplateBaseSchema.safeParse({ ...base, segment: "D" }).success).toBe(false);
  });

  it("allows triggers only in A/B on days 2 to 7 and at-expiry only on triggers", () => {
    const trigger = { ...base, day: 2, kind: "trigger" };
    expect(messageTemplateInputSchema.safeParse(trigger).success).toBe(true);
    expect(messageTemplateInputSchema.safeParse({ ...trigger, segment: "B", day: 7, atExpiry: true }).success).toBe(true);
    for (const wrong of [{ ...trigger, day: 1 }, { ...trigger, segment: "C" }]) {
      const parsed = messageTemplateInputSchema.safeParse(wrong);
      expect(parsed.success ? null : parsed.error.issues[0]).toMatchObject({ message: "trigger_not_allowed", path: ["kind"] });
    }
    const reminder = messageTemplateInputSchema.safeParse({ ...base, atExpiry: true });
    expect(reminder.success ? null : reminder.error.issues[0]).toMatchObject({
      message: "at_expiry_trigger_only",
      path: ["atExpiry"],
    });
  });
});
