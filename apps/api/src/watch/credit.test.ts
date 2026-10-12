import { describe, expect, it } from "vitest";
import { applyBeat, type WatchConfig, type WatchState } from "./credit";

const config: WatchConfig = {
  duration: 100,
  threshold: 0.95,
};

function initialState(): WatchState {
  return {
    maxPosition: 0,
    watchedSecs: 0,
    lastPosition: 0,
    lastBeatAt: null,
    playing: false,
    completed: false,
  };
}

describe("applyBeat crediting rules", () => {
  it("credits normal 10s ticks to completion", () => {
    let state = initialState();
    let time = 1000000;

    const playResult = applyBeat(
      state,
      { position: 0, event: "play" },
      new Date(time),
      config,
    );
    state = playResult.state;
    expect(state.playing).toBe(true);
    expect(state.watchedSecs).toBe(0);
    expect(state.maxPosition).toBe(0);

    for (let pos = 10; pos <= 90; pos += 10) {
      time += 10000;
      const res = applyBeat(
        state,
        { position: pos, event: "tick" },
        new Date(time),
        config,
      );
      state = res.state;
      expect(state.watchedSecs).toBe(pos);
      expect(state.maxPosition).toBe(pos);
      expect(state.completed).toBe(false);
      expect(res.completedNow).toBe(false);
    }

    time += 10000;
    const finalTick = applyBeat(
      state,
      { position: 100, event: "tick" },
      new Date(time),
      config,
    );
    state = finalTick.state;
    expect(state.watchedSecs).toBe(100);
    expect(state.maxPosition).toBe(100);
    expect(state.completed).toBe(true);
    expect(finalTick.completedNow).toBe(true);

    time += 10000;
    const afterComplete = applyBeat(
      state,
      { position: 100, event: "tick" },
      new Date(time),
      config,
    );
    expect(afterComplete.state.completed).toBe(true);
    expect(afterComplete.completedNow).toBe(false);
  });

  it("completes on ended event once threshold is reached even if position is below threshold", () => {
    let state = initialState();
    let time = 1000000;

    state = applyBeat(
      state,
      { position: 0, event: "play" },
      new Date(time),
      config,
    ).state;

    for (let pos = 10; pos <= 60; pos += 10) {
      time += 10000;
      state = applyBeat(
        state,
        { position: pos, event: "tick" },
        new Date(time),
        config,
      ).state;
    }

    time += 5000;
    state = applyBeat(
      state,
      { position: 10, event: "play" },
      new Date(time),
      config,
    ).state;

    for (let pos = 20; pos <= 50; pos += 10) {
      time += 10000;
      state = applyBeat(
        state,
        { position: pos, event: "tick" },
        new Date(time),
        config,
      ).state;
    }

    expect(state.watchedSecs).toBeGreaterThanOrEqual(95);
    expect(state.lastPosition).toBe(50);
    expect(state.completed).toBe(false);

    time += 1000;
    const endedRes = applyBeat(
      state,
      { position: 50, event: "ended" },
      new Date(time),
      config,
    );
    expect(endedRes.completedNow).toBe(true);
    expect(endedRes.state.completed).toBe(true);
  });

  it("limits a seek-ahead jump to only elapsed time", () => {
    let state = initialState();
    const t0 = new Date(1000000);
    state = applyBeat(
      state,
      { position: 10, event: "play" },
      t0,
      config,
    ).state;

    const t1 = new Date(1010000);
    const res = applyBeat(
      state,
      { position: 80, event: "tick" },
      t1,
      config,
    );

    const expectedCredit = 10 * 1.1 + 2;
    expect(res.state.watchedSecs).toBeCloseTo(expectedCredit);
    expect(res.state.maxPosition).toBeCloseTo(10 + expectedCredit);
    expect(res.state.lastPosition).toBe(80);
    expect(res.completedNow).toBe(false);
  });

  it("earns nothing when seeking after pause and long wait", () => {
    let state = initialState();
    const t0 = new Date(1000000);
    state = applyBeat(
      state,
      { position: 20, event: "play" },
      t0,
      config,
    ).state;

    const t1 = new Date(1010000);
    state = applyBeat(
      state,
      { position: 30, event: "pause" },
      t1,
      config,
    ).state;
    expect(state.playing).toBe(false);
    expect(state.watchedSecs).toBeCloseTo(10);

    const t2 = new Date(1010000 + 1800 * 1000);
    const playRes = applyBeat(
      state,
      { position: 80, event: "play" },
      t2,
      config,
    );

    expect(playRes.state.watchedSecs).toBe(state.watchedSecs);
    expect(playRes.state.maxPosition).toBe(state.maxPosition);
    expect(playRes.state.lastPosition).toBe(80);
    expect(playRes.state.playing).toBe(true);

    const t3 = new Date(t2.getTime() + 1000);
    const tickRes = applyBeat(
      playRes.state,
      { position: 80, event: "tick" },
      t3,
      config,
    );
    expect(tickRes.state.watchedSecs).toBe(state.watchedSecs);
  });

  it("handles tab hidden pause beacon then resume", () => {
    let state = initialState();
    const t0 = new Date(1000000);
    state = applyBeat(
      state,
      { position: 10, event: "play" },
      t0,
      config,
    ).state;

    const t1 = new Date(1010000);
    const pauseBeaconRes = applyBeat(
      state,
      { position: 20, event: "pause" },
      t1,
      config,
    );
    state = pauseBeaconRes.state;
    expect(state.playing).toBe(false);
    const watchedBeforeHide = state.watchedSecs;

    const t2 = new Date(1070000);
    const resumeRes = applyBeat(
      state,
      { position: 20, event: "play" },
      t2,
      config,
    );
    state = resumeRes.state;
    expect(state.playing).toBe(true);
    expect(state.watchedSecs).toBe(watchedBeforeHide);

    const t3 = new Date(1080000);
    const tickRes = applyBeat(
      state,
      { position: 30, event: "tick" },
      t3,
      config,
    );
    expect(tickRes.state.watchedSecs).toBeCloseTo(watchedBeforeHide + 10);
  });

  it("ignores ticks under 3 seconds and leaves state unchanged", () => {
    let state = initialState();
    const t0 = new Date(1000000);
    state = applyBeat(
      state,
      { position: 10, event: "play" },
      t0,
      config,
    ).state;

    const t1 = new Date(1002000);
    const res = applyBeat(
      state,
      { position: 12, event: "tick" },
      t1,
      config,
    );

    expect(res.ignored).toBe(true);
    expect(res.completedNow).toBe(false);
    expect(res.milestones).toEqual([]);
    expect(res.state).toEqual(state);
  });

  it("does not ignore non-tick events under 3 seconds", () => {
    let state = initialState();
    const t0 = new Date(1000000);
    state = applyBeat(
      state,
      { position: 10, event: "play" },
      t0,
      config,
    ).state;

    const t1 = new Date(1001000);
    const res = applyBeat(
      state,
      { position: 11, event: "pause" },
      t1,
      config,
    );

    expect(res.ignored).toBe(false);
    expect(res.state.playing).toBe(false);
  });

  it("earns nothing on rewind and keeps maxPosition", () => {
    let state = initialState();
    const t0 = new Date(1000000);
    state = applyBeat(
      state,
      { position: 50, event: "play" },
      t0,
      config,
    ).state;
    state.maxPosition = 50;

    const t1 = new Date(1010000);
    const res = applyBeat(
      state,
      { position: 20, event: "tick" },
      t1,
      config,
    );

    expect(res.state.watchedSecs).toBe(0);
    expect(res.state.maxPosition).toBe(50);
    expect(res.state.lastPosition).toBe(20);
  });

  it("does not complete on ended without enough watch time", () => {
    let state = initialState();
    const t0 = new Date(1000000);
    state = applyBeat(
      state,
      { position: 0, event: "play" },
      t0,
      config,
    ).state;

    const t1 = new Date(1005000);
    const res = applyBeat(
      state,
      { position: 100, event: "ended" },
      t1,
      config,
    );

    expect(res.completedNow).toBe(false);
    expect(res.state.completed).toBe(false);
  });

  it("fires milestones once each as maxPosition crosses 25, 50, 75 percent", () => {
    let state = initialState();
    let time = 1000000;

    state = applyBeat(
      state,
      { position: 0, event: "play" },
      new Date(time),
      config,
    ).state;

    time += 10000;
    const res1 = applyBeat(
      state,
      { position: 10, event: "tick" },
      new Date(time),
      config,
    );
    state = res1.state;
    expect(res1.milestones).toEqual([]);

    time += 20000;
    const res2 = applyBeat(
      state,
      { position: 30, event: "tick" },
      new Date(time),
      config,
    );
    state = res2.state;
    expect(res2.milestones).toEqual([25]);

    time += 10000;
    const res3 = applyBeat(
      state,
      { position: 35, event: "tick" },
      new Date(time),
      config,
    );
    state = res3.state;
    expect(res3.milestones).toEqual([]);

    time += 30000;
    const res4 = applyBeat(
      state,
      { position: 60, event: "tick" },
      new Date(time),
      config,
    );
    state = res4.state;
    expect(res4.milestones).toEqual([50]);

    time += 20000;
    const res5 = applyBeat(
      state,
      { position: 80, event: "tick" },
      new Date(time),
      config,
    );
    state = res5.state;
    expect(res5.milestones).toEqual([75]);

    time += 10000;
    const res6 = applyBeat(
      state,
      { position: 90, event: "tick" },
      new Date(time),
      config,
    );
    expect(res6.milestones).toEqual([]);
  });

  it("clamps position beyond duration", () => {
    let state = initialState();
    const t0 = new Date(1000000);
    const res = applyBeat(
      state,
      { position: 150, event: "play" },
      t0,
      config,
    );

    expect(res.state.lastPosition).toBe(100);
    expect(res.state.maxPosition).toBe(0);
  });

  it("clamps negative position to 0", () => {
    let state = initialState();
    const t0 = new Date(1000000);
    const res = applyBeat(
      state,
      { position: -10, event: "play" },
      t0,
      config,
    );

    expect(res.state.lastPosition).toBe(0);
  });
});
