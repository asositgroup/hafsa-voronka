"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { getOrCreateVisitorId } from "@/lib/tracking/visitor";
import { trackCtaClick } from "@/lib/tracking/client";

type CtaButtonProps = {
  children?: ReactNode;
  className?: string;
  variant?: "gold" | "ink" | "header" | "visual";
  surface?: "ink" | "paper";
  ariaLabel?: string;
};

const subscribe = () => () => {};
const getSnapshot = () => getOrCreateVisitorId();
const getServerSnapshot = () => "";

const variantClasses = {
  gold: "min-h-[56px] px-7 rounded-[14px] text-[18px] bg-oltin text-siyoh hover:bg-[color-mix(in_oklab,var(--color-oltin)_90%,black)]",
  ink: "min-h-[56px] px-7 rounded-[14px] text-[18px] bg-siyoh text-varaq hover:bg-[color-mix(in_oklab,var(--color-siyoh)_85%,black)]",
  header: "min-h-[44px] px-5 rounded-[12px] text-[15px] bg-oltin text-siyoh hover:bg-[color-mix(in_oklab,var(--color-oltin)_90%,black)]",
  visual: "",
};

const surfaceClasses = {
  ink: "focus-visible:outline-oltin",
  paper: "focus-visible:outline-siyoh",
};

const defaultSurface = {
  gold: "paper",
  ink: "paper",
  header: "ink",
  visual: "ink",
} as const;

export function CtaButton({
  children = "Bepul darsni ko‘rish",
  className = "",
  variant = "gold",
  surface,
  ariaLabel,
}: CtaButtonProps) {
  const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || "";
  const vid = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const href = vid
    ? `https://t.me/${botUsername}?start=v_${vid}`
    : `https://t.me/${botUsername}`;

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    trackCtaClick();
    const visitorId = getOrCreateVisitorId();
    e.currentTarget.href = `https://t.me/${botUsername}?start=v_${visitorId}`;
  };

  const baseClasses =
    variant === "visual"
      ? "relative block"
      : "inline-flex items-center justify-center gap-3 font-semibold text-center leading-tight transition-colors motion-reduce:transition-none select-none";

  return (
    <a
      href={href}
      onClick={handleClick}
      aria-label={ariaLabel}
      className={`${baseClasses} ${variantClasses[variant]} focus-visible:outline-2 focus-visible:outline-offset-2 ${surfaceClasses[surface ?? defaultSurface[variant]]} ${className}`}
    >
      {children}
    </a>
  );
}
