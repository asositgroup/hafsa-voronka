"use client";

import { useCallback, useRef } from "react";
import { isSeekBlocked } from "@/lib/video/resume";

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
    if (isSeekBlocked(target, maxReached, seekLocked)) {
      onSeekBlocked();
      return;
    }
    onSeek(target);
  };

  const safeDuration = Math.max(duration, 1);
  const currentPct = Math.min(100, Math.max(0, (currentTime / safeDuration) * 100));
  const maxReachedPct = Math.min(100, Math.max(0, (maxReached / safeDuration) * 100));

  return (
    <div
      ref={barRef}
      onPointerDown={handlePointerDown}
      className="group relative flex h-6 w-full cursor-pointer touch-none items-center select-none"
    >
      <div className="relative h-1 w-full rounded-[2px] bg-varaq/25">
        <div
          className="absolute top-0 bottom-0 left-0 rounded-[2px] bg-zumrad brightness-150"
          style={{ width: `${maxReachedPct}%` }}
        />
        {seekLocked && (
          <div
            className="absolute top-0 right-0 bottom-0 rounded-r-[2px]"
            style={{
              left: `${maxReachedPct}%`,
              backgroundImage:
                "repeating-linear-gradient(135deg, rgba(255,255,255,.32) 0 2px, transparent 2px 5px)",
            }}
          />
        )}
        <div
          className="absolute top-0 bottom-0 left-0 rounded-[2px] bg-oltin"
          style={{ width: `${currentPct}%` }}
        />
      </div>
      <div
        className="pointer-events-none absolute top-1/2 h-3 w-3 -mt-1.5 -ml-1.5 rounded-full bg-oltin"
        style={{ left: `${currentPct}%` }}
      />
    </div>
  );
}
