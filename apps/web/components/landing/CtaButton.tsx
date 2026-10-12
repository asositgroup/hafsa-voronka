"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { getOrCreateVisitorId } from "@/lib/tracking/visitor";
import { trackCtaClick } from "@/lib/tracking/client";

type CtaButtonProps = {
  children?: ReactNode;
  className?: string;
  variant?: "gold" | "ink";
};

const subscribe = () => () => {};
const getSnapshot = () => getOrCreateVisitorId();
const getServerSnapshot = () => "";

export function CtaButton({
  children = "Videoni Telegramda ko‘rish",
  className = "",
  variant = "gold",
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

  const variantClasses =
    variant === "ink"
      ? "bg-siyoh text-varaq focus-visible:ring-siyoh"
      : "bg-oltin text-siyoh focus-visible:ring-siyoh";

  const baseClasses =
    "inline-flex items-center justify-center min-h-[56px] px-7 rounded-[14px] font-semibold text-[18px] text-center transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 select-none";

  return (
    <a
      href={href}
      onClick={handleClick}
      className={`${baseClasses} ${variantClasses} ${className}`}
    >
      {children}
    </a>
  );
}
