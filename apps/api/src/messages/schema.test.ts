import { describe, expect, it } from "vitest";
import { messageTemplateInputSchema, normalizeAttempts, normalizeStatuses } from "@funnel/shared";

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

  describe("second chance pages (segment D)", () => {
    const page = {
      ...base,
      segment: "D",
      day: 3,
      timing: { type: "occasion", value: 0 },
      statuses: ["link_berildi"],
      buttons: [
        { kind: "again", text: "Ha, ko'raman" },
        { kind: "later", text: "Keyinroq, ko'raman" },
      ],
    };
    const issue = (input: unknown) => {
      const result = messageTemplateInputSchema.safeParse(input);
      return result.success ? null : result.error.issues[0];
    };

    it("accepts the not-opened and the §3.8 variant pages", () => {
      expect(issue(page)).toBeNull();
      expect(issue({ ...page, statuses: ["sotuvda_toxtadi", "korishni_boshladi", "dars_yarmida"] })).toBeNull();
    });

    it("requires a variant and the occasion timing", () => {
      expect(issue({ ...page, statuses: null })).toMatchObject({ message: "statuses_invalid" });
      expect(issue({ ...page, statuses: ["link_berildi", "dars_yarmida"] })).toMatchObject({ message: "statuses_invalid" });
      expect(issue({ ...page, timing: { type: "after_entry", value: 2880 } })).toMatchObject({ message: "occasion_only" });
      expect(issue({ ...base, timing: { type: "occasion", value: 0 } })).toMatchObject({ message: "occasion_only" });
    });

    it("allows only the second-chance buttons there, and «Ha» nowhere else", () => {
      expect(issue({ ...page, buttons: [{ kind: "resume", text: "Davom" }] })).toMatchObject({
        message: "button_not_allowed",
        path: ["buttons"],
      });
      expect(issue({ ...base, buttons: [{ kind: "again", text: "Ha" }] })).toMatchObject({ message: "button_not_allowed" });
      expect(issue({ ...base, buttons: [{ kind: "when_menu", text: "Qachon?" }] })).not.toBeNull();
    });
  });

  describe("link attempts", () => {
    it("targets texts at specific links in A and B only", () => {
      expect(messageTemplateInputSchema.safeParse({ ...base, attempts: [1] }).success).toBe(true);
      expect(messageTemplateInputSchema.safeParse({ ...base, segment: "B", attempts: [2, 3] }).success).toBe(true);
      const inC = messageTemplateInputSchema.safeParse({ ...base, segment: "C", attempts: [1] });
      expect(inC.success ? null : inC.error.issues[0]).toMatchObject({ message: "attempts_invalid", path: ["attempts"] });
      expect(messageTemplateInputSchema.safeParse({ ...base, attempts: [9] }).success).toBe(false);
      expect(messageTemplateInputSchema.safeParse({ ...base, attempts: [] }).success).toBe(false);
    });

    it("stores every link as everyone", () => {
      expect(normalizeAttempts("A", [3, 1, 3])).toEqual([1, 3]);
      expect(normalizeAttempts("A", [8, 7, 6, 5, 4, 3, 2, 1])).toBeNull();
      expect(normalizeAttempts("C", [1])).toBeNull();
    });
  });
});
