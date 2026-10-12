"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { getOrCreateVisitorId } from "@/lib/tracking/visitor";
import { trackCtaClick } from "@/lib/tracking/client";

type CtaButtonProps = {
  children?: ReactNode;
  className?: string;
};

const subscribe = () => () => {};
const getSnapshot = () => getOrCreateVisitorId();
const getServerSnapshot = () => "";

export function CtaButton({
  children = "VIDEONI BEPUL KO'RISH →",
  className = "",
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

  const defaultClasses =
    "inline-flex items-center justify-center font-bold tracking-wide rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 shadow-lg shadow-amber-500/20 px-6 py-4 text-base md:text-lg w-full text-center transition-all duration-200 active:scale-[0.98]";

  return (
    <a
      href={href}
      onClick={handleClick}
      className={className ? `${defaultClasses} ${className}` : defaultClasses}
    >
      {children}
    </a>
  );
}
