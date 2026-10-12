"use client";

import { useEffect, useState } from "react";
import { CtaButton } from "@/components/landing/CtaButton";
import { landingContent } from "@/content/landing";

import { HERO_CTA_ID } from "@/components/landing/ids";

export function StickyBottomCta() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const heroCta = document.getElementById(HERO_CTA_ID);
    if (!heroCta) return;
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0);
    });
    observer.observe(heroCta);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      aria-hidden={!visible}
      inert={!visible}
      className={`block lg:hidden fixed inset-x-0 bottom-0 z-40 bg-varaq/94 backdrop-blur border-t border-chiziq px-4 pt-3 pb-[max(20px,env(safe-area-inset-bottom))] transition-transform duration-200 ease-out motion-reduce:transition-none ${
        visible ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <CtaButton variant="ink" className="w-full min-h-[54px] text-[17px]">
        {landingContent.stickyBar.buttonText}
      </CtaButton>
    </div>
  );
}
