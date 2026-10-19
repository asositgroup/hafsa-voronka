import type { ButtonHTMLAttributes, ReactNode } from "react";

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  label: string;
  icon: ReactNode;
  variant?: "ghost" | "secondary";
  size?: "md" | "sm";
};

export function IconButton({
  label,
  icon,
  variant = "ghost",
  size = "md",
  type = "button",
  className = "",
  ...rest
}: IconButtonProps) {
  const look =
    variant === "secondary"
      ? "border border-chegara/60 bg-white text-siyoh hover:border-siyoh"
      : "text-qalam hover:bg-varaq hover:text-siyoh";
  const box = size === "md" ? "h-11 w-11" : "h-9 w-9";

  return (
    <button
      {...rest}
      type={type}
      aria-label={label}
      title={label}
      className={`inline-flex shrink-0 items-center justify-center rounded-[10px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-siyoh disabled:cursor-not-allowed disabled:opacity-40 ${look} ${box} ${className}`}
    >
      {icon}
    </button>
  );
}
