import { describe, expect, it } from "vitest";
import { type DraftState, transition } from "./machine";

function draft(overrides: Partial<DraftState> = {}): DraftState {
  return {
    step: "confirm",
    duration: 600,
    courseStartSec: null,
    priceSec: null,
    introEndSec: null,
    unlockSec: null,
    ...overrides,
  };
}

describe("transition", () => {
  it("skips the duration question and asks the lesson start first", () => {
    const result = transition(draft(), { type: "confirm", yes: true });
    expect(result).toEqual({
      patch: { step: "intro", uploadStatus: "pending" },
      reply: "askIntro",
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

  it("stores the duration and moves to the lesson start question", () => {
    expect(transition(draft({ step: "duration", duration: null }), { type: "text", value: "10:00" })).toEqual({
      patch: { step: "intro", duration: 600 },
      reply: "askIntro",
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

  it("walks the marks in chronological order", () => {
    let state = draft({ step: "intro", duration: 40 });
    const replies: string[] = [];
    for (const value of ["00:05", "00:20", "00:22", "00:10"]) {
      const result = transition(state, { type: "text", value });
      if ("error" in result) throw new Error(result.error);
      replies.push(result.reply);
      state = { ...state, ...result.patch };
    }
    expect(replies).toEqual(["askCourse", "askPrice", "askUnlock", "summary"]);
    expect(state).toMatchObject({ step: "summary", introEndSec: 5, courseStartSec: 20, priceSec: 22, unlockSec: 10 });
  });

  it("checks the lesson start against the video only", () => {
    const state = draft({ step: "intro", duration: 40, courseStartSec: 20, priceSec: 22 });
    expect(transition(state, { type: "text", value: "00:30" })).toMatchObject({ patch: { introEndSec: 30 } });
    expect(transition(state, { type: "text", value: "00:40" })).toEqual({ error: "outOfRange", value: 40 });
  });

  it("rejects a course start at or before the lesson start", () => {
    const state = draft({ step: "course", duration: 40, introEndSec: 5 });
    expect(transition(state, { type: "text", value: "00:05" })).toEqual({ error: "outOfRange", value: 5 });
    expect(transition(state, { type: "text", value: "00:06" })).toMatchObject({ patch: { courseStartSec: 6 } });
  });

  it("rejects a course start that is zero or not before the duration", () => {
    expect(transition(draft({ step: "course" }), { type: "text", value: "0:00" })).toEqual({ error: "outOfRange", value: 0 });
    expect(transition(draft({ step: "course" }), { type: "text", value: "10:00" })).toEqual({
      error: "outOfRange",
      value: 600,
    });
  });

  it("ignores later marks kept from before going back", () => {
    const state = draft({ step: "course", introEndSec: 60, courseStartSec: 120, priceSec: 300 });
    expect(transition(state, { type: "text", value: "06:00" })).toMatchObject({ patch: { step: "price", courseStartSec: 360 } });
  });

  it("rejects a price mark at or before the course start or at the duration", () => {
    const state = draft({ step: "price", courseStartSec: 120 });
    expect(transition(state, { type: "text", value: "02:00" })).toEqual({ error: "outOfRange", value: 120 });
    expect(transition(state, { type: "text", value: "10:00" })).toEqual({ error: "outOfRange", value: 600 });
    expect(transition(state, { type: "text", value: "05:00" })).toEqual({
      patch: { step: "unlock", priceSec: 300 },
      reply: "askUnlock",
      effects: [],
    });
  });

  it("rejects an unlock point outside the video", () => {
    const state = draft({ step: "unlock", courseStartSec: 120, priceSec: 300 });
    expect(transition(state, { type: "text", value: "10:00" })).toEqual({ error: "outOfRange", value: 600 });
    expect(transition(state, { type: "text", value: "00:00" })).toEqual({ error: "outOfRange", value: 0 });
    expect(transition(state, { type: "text", value: "09:00" })).toEqual({
      patch: { step: "summary", unlockSec: 540 },
      reply: "summary",
      effects: [],
    });
  });

  it("rejects malformed marks", () => {
    expect(transition(draft({ step: "price" }), { type: "text", value: "5 min" })).toEqual({ error: "invalidTime" });
  });

  it("skips the optional marks one by one", () => {
    expect(transition(draft({ step: "intro" }), { type: "skip" })).toEqual({
      patch: { step: "course", introEndSec: null },
      reply: "askCourse",
      effects: [],
    });
    expect(transition(draft({ step: "unlock", priceSec: 300 }), { type: "skip" })).toEqual({
      patch: { step: "summary", unlockSec: null },
      reply: "summary",
      effects: [],
    });
  });

  it("does not skip a required step", () => {
    for (const step of ["confirm", "duration", "course", "price", "summary"] as const) {
      expect(transition(draft({ step }), { type: "skip" })).toEqual({ error: "wrongStep" });
    }
  });

  it("steps back one mark and keeps the entered values", () => {
    const state = { courseStartSec: 120, priceSec: 300, introEndSec: 60 };
    expect(transition(draft({ ...state, step: "price" }), { type: "back" })).toEqual({
      patch: { step: "course" },
      reply: "askCourse",
      effects: [],
    });
    expect(transition(draft({ ...state, step: "course" }), { type: "back" })).toMatchObject({ patch: { step: "intro" } });
    expect(transition(draft({ ...state, step: "unlock" }), { type: "back" })).toMatchObject({ patch: { step: "price" } });
    expect(transition(draft({ ...state, step: "summary" }), { type: "back" })).toMatchObject({ patch: { step: "unlock" } });
  });

  it("does not step back from the first question", () => {
    for (const step of ["confirm", "duration", "intro", "done"] as const) {
      expect(transition(draft({ step }), { type: "back" })).toEqual({ error: "wrongStep" });
    }
  });

  it("keeps a previously entered value when it still fits", () => {
    expect(transition(draft({ step: "price", courseStartSec: 120, priceSec: 300 }), { type: "keep" })).toEqual({
      patch: { step: "unlock", priceSec: 300 },
      reply: "askUnlock",
      effects: [],
    });
    expect(transition(draft({ step: "price", courseStartSec: 400, priceSec: 300 }), { type: "keep" })).toEqual({
      error: "outOfRange",
      value: 300,
    });
    expect(transition(draft({ step: "price", courseStartSec: 120 }), { type: "keep" })).toEqual({ error: "wrongStep" });
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
    for (const step of ["confirm", "duration", "course", "price", "intro", "unlock", "summary"] as const) {
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
