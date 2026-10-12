"use client";

type ToastProps = {
  message: string;
  visible: boolean;
};

export function Toast({ message, visible }: ToastProps) {
  if (!visible) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-4 z-30 flex justify-center px-4 transition-all duration-200">
      <div className="flex items-center rounded-full border border-zumrad bg-siyoh-deep px-4 py-2 text-xs sm:text-sm font-medium text-varaq">
        <span>{message}</span>
      </div>
    </div>
  );
}
