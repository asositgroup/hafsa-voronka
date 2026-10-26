import { describe, expect, it } from "vitest";
import {
  type FunnelSegment,
  messageTemplateInputSchema,
  segmentStatuses,
  templateButtonSchema,
  validateTemplateInput,
} from "@funnel/shared";
import { seedInputs } from "./seed";

const seedSegments: FunnelSegment[] = ["A", "B", "C"];

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
    });
  }

  it("covers the TZ reminder counts", () => {
    expect(seedInputs("A").filter((input) => input.day === 1)).toHaveLength(11);
    expect(seedInputs("B").filter((input) => input.statuses !== null)).toHaveLength(3);
    expect(seedInputs("C")).toHaveLength(4);
  });
});
