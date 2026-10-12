"use client";

type ToastProps = {
  message: string;
  visible: boolean;
};

export function Toast({ message, visible }: ToastProps) {
  if (!visible) return null;

  return (
    <div className="pointer-events-none absolute top-4 left-1/2 z-30 -translate-x-1/2 px-4 transition-all duration-200">
      <div className="flex items-center gap-2 rounded-full border border-zinc-700/60 bg-zinc-950/90 px-4 py-2 text-xs sm:text-sm font-medium text-zinc-100 shadow-xl backdrop-blur-md">
        <span>🔒</span>
        <span>{message}</span>
      </div>
    </div>
  );
}
