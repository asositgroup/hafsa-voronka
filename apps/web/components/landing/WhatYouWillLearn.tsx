import { landingContent } from "@/content/landing";
import { landingI18n } from "@/lib/i18n/landing";
import { CtaButton } from "./CtaButton";

export function WhatYouWillLearn() {
  const { whatYouWillLearn } = landingContent;

  return (
    <section className="w-full max-w-md mx-auto">
      <h2 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-100 text-center">
        {whatYouWillLearn.title}
      </h2>

      <div className="mt-6 flex flex-col gap-3">
        {whatYouWillLearn.items.map((item) => (
          <div
            key={item.number}
            className="flex items-start gap-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 transition-colors hover:border-zinc-700"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-400/10 border border-amber-400/30 text-amber-400 font-bold text-sm">
              {item.number}
            </span>
            <div className="flex-1 text-sm md:text-base text-zinc-200 leading-relaxed font-medium">
              {item.title}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-col items-center">
        <CtaButton>{whatYouWillLearn.ctaText}</CtaButton>
        <p className="mt-2.5 text-xs text-zinc-400">
          {landingI18n.price.label}{" "}
          <strong className="text-zinc-200 font-bold">{landingI18n.price.value}</strong> ·{" "}
          {whatYouWillLearn.priceNote}
        </p>
      </div>
    </section>
  );
}
