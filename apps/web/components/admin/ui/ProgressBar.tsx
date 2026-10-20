export function ProgressBar({ value, label }: { value: number; label: string }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      className="h-2 overflow-hidden rounded-full bg-varaq"
    >
      <div className="h-full bg-zumrad transition-[width]" style={{ width: `${value}%` }} />
    </div>
  );
}
