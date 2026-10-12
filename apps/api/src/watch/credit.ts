export type WatchState = {
  maxPosition: number;
  watchedSecs: number;
  lastPosition: number;
  lastBeatAt: Date | null;
  playing: boolean;
  completed: boolean;
};

export type WatchBeat = {
  position: number;
  event: "play" | "tick" | "pause" | "ended";
};

export type WatchConfig = {
  duration: number;
  threshold: number;
};

export type Milestone = 25 | 50 | 75;

export const MAX_BEAT_GAP_SECS = 30;

export type BeatResult = {
  state: WatchState;
  milestones: Milestone[];
  completedNow: boolean;
  ignored: boolean;
};

export function applyBeat(
  state: WatchState,
  beat: WatchBeat,
  now: Date,
  config: WatchConfig,
): BeatResult {
  const position = Math.max(0, Math.min(beat.position, config.duration));

  if (
    beat.event === "tick" &&
    state.lastBeatAt !== null &&
    (now.getTime() - state.lastBeatAt.getTime()) / 1000 < 3
  ) {
    return {
      state: { ...state },
      milestones: [],
      completedNow: false,
      ignored: true,
    };
  }

  let credit = 0;
  if (state.playing && state.lastBeatAt !== null && beat.event !== "play") {
    const wall = (now.getTime() - state.lastBeatAt.getTime()) / 1000;
    if (wall <= MAX_BEAT_GAP_SECS) {
      const jump = position - state.lastPosition;
      const maxCredit = wall * 1.1 + 2;
      credit = Math.max(0, Math.min(jump, maxCredit));
    }
  }

  const watchedSecs = state.watchedSecs + credit;
  const maxPosition = Math.max(
    state.maxPosition,
    Math.min(state.lastPosition + credit, position),
  );
  const playing = beat.event === "play" || beat.event === "tick";
  const lastPosition = position;
  const lastBeatAt = now;

  const milestones: Milestone[] = [];
  const marks: Milestone[] = [25, 50, 75];
  for (const pct of marks) {
    const mark = (config.duration * pct) / 100;
    if (state.maxPosition < mark && maxPosition >= mark) {
      milestones.push(pct);
    }
  }

  const thresholdSecs = config.threshold * config.duration;
  const completedNow =
    !state.completed &&
    watchedSecs >= thresholdSecs &&
    (beat.event === "ended" || position >= thresholdSecs);

  const completed = state.completed || completedNow;

  return {
    state: {
      maxPosition,
      watchedSecs,
      lastPosition,
      lastBeatAt,
      playing,
      completed,
    },
    milestones,
    completedNow,
    ignored: false,
  };
}
