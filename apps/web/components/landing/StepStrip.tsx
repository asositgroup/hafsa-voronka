import { landingI18n } from "@/lib/i18n/landing";

export function StepStrip() {
  return (
    <div className="w-full border-b border-zinc-800/80 bg-zinc-950/60 backdrop-blur sticky top-0 z-40 py-3 px-4">
      <div className="max-w-md mx-auto flex items-center justify-between text-xs font-semibold tracking-wider uppercase">
        <div className="flex items-center gap-2 text-amber-400">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-zinc-950 text-[11px] font-bold">
            1
          </span>
          <span>{landingI18n.steps.site}</span>
        </div>
        <div className="h-px flex-1 mx-3 bg-zinc-800" />
        <div className="flex items-center gap-2 text-zinc-500">
          <span className="flex h-5 w-5 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-zinc-400 text-[11px]">
            2
          </span>
          <span>{landingI18n.steps.bot}</span>
        </div>
        <div className="h-px flex-1 mx-3 bg-zinc-800" />
        <div className="flex items-center gap-2 text-zinc-500">
          <span className="flex h-5 w-5 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-zinc-400 text-[11px]">
            3
          </span>
          <span>{landingI18n.steps.video}</span>
        </div>
      </div>
    </div>
  );
}
