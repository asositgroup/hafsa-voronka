"use client";

import { useCallback, useRef } from "react";

type ProgressBarProps = {
  currentTime: number;
  duration: number;
  maxReached: number;
  seekLocked: boolean;
  onSeek: (targetTime: number) => void;
  onSeekBlocked: () => void;
};

export function ProgressBar({
  currentTime,
  duration,
  maxReached,
  seekLocked,
  onSeek,
  onSeekBlocked,
}: ProgressBarProps) {
  const barRef = useRef<HTMLDivElement>(null);

  const calculateTargetTime = useCallback(
    (clientX: number) => {
      const bar = barRef.current;
      if (!bar || duration <= 0) return 0;
      const rect = bar.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return fraction * duration;
    },
    [duration],
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const target = calculateTargetTime(e.clientX);
    if (seekLocked && target > maxReached + 1) {
      onSeekBlocked();
      return;
    }
    onSeek(target);
  };

  const safeDuration = Math.max(duration, 1);
  const currentPct = Math.min(100, Math.max(0, (currentTime / safeDuration) * 100));
  const watchedPct = Math.min(100, Math.max(0, (maxReached / safeDuration) * 100));

  return (
    <div
      ref={barRef}
      onPointerDown={handlePointerDown}
      className="group relative flex h-7 w-full cursor-pointer touch-none items-center select-none"
    >
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-zinc-800 transition-all group-hover:h-2">
        <div
          className="absolute top-0 bottom-0 left-0 bg-zinc-600 transition-all"
          style={{ width: `${watchedPct}%` }}
        />
        <div
          className="absolute top-0 bottom-0 left-0 bg-blue-500"
          style={{ width: `${currentPct}%` }}
        />
      </div>
      <div
        className="pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 -translate-x-1/2 rounded-full bg-white shadow-md transition-transform group-hover:scale-125"
        style={{ left: `${currentPct}%` }}
      />
    </div>
  );
}
