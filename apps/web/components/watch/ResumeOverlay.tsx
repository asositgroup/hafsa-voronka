"use client";

import { watchUz } from "@/lib/i18n/watch";
import { formatTime } from "@/lib/video/format";
import { PlayTriangleIcon, RestartIcon } from "@/components/icons";

type ResumeOverlayProps = {
  position: number;
  onContinue: () => void;
  onRestart: () => void;
};

export function ResumeOverlay({ position, onContinue, onRestart }: ResumeOverlayProps) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/72 px-5 text-center">
      <p className="m-0 text-[17px] leading-[1.3] font-semibold text-varaq">
        {watchUz.resumedAt(formatTime(position))}
      </p>
      <div className="flex w-full max-w-[300px] flex-col gap-2">
        <button
          type="button"
          onClick={onContinue}
          className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[14px] bg-oltin text-[16px] font-semibold text-siyoh transition active:scale-[0.98]"
        >
          <PlayTriangleIcon className="h-4 w-4" />
          {watchUz.resumeContinue}
        </button>
        <button
          type="button"
          onClick={onRestart}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[14px] border border-varaq/40 bg-transparent text-[15px] font-semibold text-varaq transition active:scale-[0.98]"
        >
          <RestartIcon className="h-4 w-4" />
          {watchUz.resumeRestart}
        </button>
      </div>
    </div>
  );
}
