import { describe, expect, it } from "vitest";
import {
  messageTemplateInputSchema,
  segmentStatuses,
  templateButtonSchema,
  validateTemplateInput,
} from "@funnel/shared";
import { type SeedSegment, seedInputs } from "./seed";

const seedSegments: SeedSegment[] = ["A", "B", "C"];

describe("Seed templates", () => {
  for (const segment of seedSegments) {
    describe(`segment ${segment}`, () => {
      const inputs = seedInputs(segment);

      it("has templates", () => {
        expect(inputs.length).toBeGreaterThan(0);
      });

      it("passes the shared validators", () => {
        for (const input of inputs) {
          expect(validateTemplateInput(input)).toBeNull();
          expect(messageTemplateInputSchema.safeParse(input).success).toBe(true);
          for (const button of input.buttons) expect(templateButtonSchema.safeParse(button).success).toBe(true);
        }
      });

      it("keeps statuses inside the segment", () => {
        for (const input of inputs) {
          for (const status of input.statuses ?? []) expect(segmentStatuses[segment]).toContain(status);
        }
      });

      it("has one night notice for link-bound segments only", () => {
        const notices = inputs.filter((input) => input.timing.type === "night_notice");
        expect(notices).toHaveLength(segment === "C" ? 0 : 1);
      });
    });
  }

  it("covers the TZ reminder counts", () => {
    expect(seedInputs("A").filter((input) => input.timing.type === "before_expiry")).toHaveLength(11);
    expect(seedInputs("B").filter((input) => input.statuses !== null)).toHaveLength(3);
    expect(seedInputs("C")).toHaveLength(4);
  });
});
