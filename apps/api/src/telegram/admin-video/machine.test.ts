import { describe, expect, it } from "vitest";
import { type DraftState, transition } from "./machine";

function draft(overrides: Partial<DraftState> = {}): DraftState {
  return { step: "confirm", duration: 600, courseStartSec: null, priceSec: null, ...overrides };
}

describe("transition", () => {
  it("skips the duration question when the video already has one", () => {
    const result = transition(draft(), { type: "confirm", yes: true });
    expect(result).toEqual({
      patch: { step: "course", uploadStatus: "pending" },
      reply: "askCourse",
      effects: ["startUpload"],
    });
  });

  it("asks for the duration of a document", () => {
    const result = transition(draft({ duration: null }), { type: "confirm", yes: true });
    expect(result).toEqual({
      patch: { step: "duration", uploadStatus: "pending" },
      reply: "askDuration",
      effects: ["startUpload"],
    });
  });

  it("cancels on No without starting an upload", () => {
    expect(transition(draft(), { type: "confirm", yes: false })).toEqual({
      patch: { step: "cancelled" },
      reply: "cancelled",
      effects: [],
    });
  });

  it("stores the duration and moves to the course question", () => {
    expect(transition(draft({ step: "duration", duration: null }), { type: "text", value: "10:00" })).toEqual({
      patch: { step: "course", duration: 600 },
      reply: "askCourse",
      effects: [],
    });
  });

  it("rejects a zero or malformed duration", () => {
    expect(transition(draft({ step: "duration", duration: null }), { type: "text", value: "00:00" })).toEqual({
      error: "durationNotPositive",
    });
    expect(transition(draft({ step: "duration", duration: null }), { type: "text", value: "abc" })).toEqual({
      error: "invalidTime",
    });
  });

  it("stores the course start and moves to the price question", () => {
    expect(transition(draft({ step: "course" }), { type: "text", value: "02:00" })).toEqual({
      patch: { step: "price", courseStartSec: 120 },
      reply: "askPrice",
      effects: [],
    });
  });

  it("rejects a course start that is zero or not before the duration", () => {
    expect(transition(draft({ step: "course" }), { type: "text", value: "0:00" })).toEqual({
      error: "courseOutOfRange",
    });
    expect(transition(draft({ step: "course" }), { type: "text", value: "10:00" })).toEqual({
      error: "courseOutOfRange",
    });
  });

  it("stores the price mark and shows the summary", () => {
    expect(transition(draft({ step: "price", courseStartSec: 120 }), { type: "text", value: "05:00" })).toEqual({
      patch: { step: "summary", priceSec: 300 },
      reply: "summary",
      effects: [],
    });
  });

  it("rejects a price mark at or before the course start", () => {
    const state = draft({ step: "price", courseStartSec: 120 });
    expect(transition(state, { type: "text", value: "02:00" })).toEqual({ error: "priceBeforeCourse" });
    expect(transition(state, { type: "text", value: "01:00" })).toEqual({ error: "priceBeforeCourse" });
  });

  it("rejects a price mark at or after the duration", () => {
    const state = draft({ step: "price", courseStartSec: 120 });
    expect(transition(state, { type: "text", value: "10:00" })).toEqual({ error: "priceOutOfRange" });
    expect(transition(state, { type: "text", value: "11:00" })).toEqual({ error: "priceOutOfRange" });
  });

  it("emits activate from the summary", () => {
    expect(transition(draft({ step: "summary" }), { type: "activate" })).toEqual({
      patch: {},
      reply: "activating",
      effects: ["activate"],
    });
  });

  it("ignores activate outside the summary", () => {
    expect(transition(draft({ step: "price" }), { type: "activate" })).toEqual({ error: "wrongStep" });
    expect(transition(draft({ step: "done" }), { type: "activate" })).toEqual({ error: "wrongStep" });
  });

  it("cancels from any open step", () => {
    for (const step of ["confirm", "duration", "course", "price", "summary"] as const) {
      expect(transition(draft({ step }), { type: "cancel" })).toEqual({
        patch: { step: "cancelled" },
        reply: "cancelled",
        effects: [],
      });
    }
  });

  it("does not cancel a closed draft", () => {
    expect(transition(draft({ step: "done" }), { type: "cancel" })).toEqual({ error: "wrongStep" });
    expect(transition(draft({ step: "cancelled" }), { type: "cancel" })).toEqual({ error: "wrongStep" });
  });

  it("ignores text outside the text steps", () => {
    expect(transition(draft({ step: "confirm" }), { type: "text", value: "05:00" })).toEqual({ error: "wrongStep" });
  });
});
