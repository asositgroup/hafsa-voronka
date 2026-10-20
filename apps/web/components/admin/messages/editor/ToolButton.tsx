import type { ReactNode } from "react";

type ToolButtonProps = {
  label: string;
  onClick: () => void;
  pressed?: boolean;
  disabled?: boolean;
  expanded?: boolean;
  children: ReactNode;
  className?: string;
};

export function ToolButton({ label, onClick, pressed, disabled, expanded, children, className = "" }: ToolButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      aria-expanded={expanded}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-siyoh disabled:opacity-35 ${
        pressed || expanded ? "bg-siyoh text-varaq" : "text-siyoh hover:bg-varaq"
      } ${className}`}
    >
      {children}
    </button>
  );
}
