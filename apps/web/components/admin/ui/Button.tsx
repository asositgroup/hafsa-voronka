import type { ButtonHTMLAttributes, ReactNode } from "react";
import { SpinnerIcon } from "@/components/icons";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "dangerGhost";
export type ButtonSize = "md" | "sm";

type ButtonStyle = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
};

const variantClass: Record<ButtonVariant, string> = {
  primary: "bg-siyoh text-varaq font-semibold hover:bg-siyoh-deep",
  secondary: "bg-white border border-chegara/60 text-siyoh font-medium hover:border-siyoh",
  ghost: "bg-transparent text-qalam font-medium hover:bg-varaq hover:text-siyoh",
  danger: "bg-anor text-white font-semibold hover:opacity-90",
  dangerGhost: "bg-transparent text-anor font-medium hover:bg-anor/10",
};

const sizeClass: Record<ButtonSize, string> = {
  md: "h-11 px-4 text-sm",
  sm: "h-9 px-3 text-[13px]",
};

export function buttonClass({ variant = "primary", size = "md", block = false }: ButtonStyle = {}) {
  return [
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[10px] no-underline transition-colors",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-siyoh",
    "disabled:cursor-not-allowed disabled:opacity-40",
    variantClass[variant],
    sizeClass[size],
    block ? "w-full" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  ButtonStyle & {
    loading?: boolean;
    loadingLabel?: string;
    icon?: ReactNode;
  };

export function Button({
  variant,
  size,
  block,
  loading = false,
  loadingLabel,
  icon,
  type = "button",
  disabled,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${buttonClass({ variant, size, block })} ${className}`}
    >
      {loading ? <SpinnerIcon className="h-4 w-4" /> : icon}
      {loading && loadingLabel ? loadingLabel : children}
    </button>
  );
}
