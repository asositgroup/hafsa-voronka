type SwitchProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  showLabel?: boolean;
  disabled?: boolean;
};

export function Switch({ checked, onChange, label, showLabel = false, disabled = false }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={showLabel ? undefined : label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="inline-flex h-11 shrink-0 items-center gap-2.5 rounded-[10px] px-1 text-sm font-medium text-siyoh focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-siyoh disabled:opacity-40"
    >
      <span
        aria-hidden="true"
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-zumrad" : "bg-chegara"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${checked ? "left-[22px]" : "left-0.5"}`}
        />
      </span>
      {showLabel && label}
    </button>
  );
}
