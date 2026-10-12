import { landingContent } from "@/content/landing";
import { landingI18n } from "@/lib/i18n/landing";
import { CtaButton } from "./CtaButton";

export function StepsToVideoSection() {
  const { stepsToVideo } = landingContent;

  return (
    <section className="w-full max-w-md mx-auto">
      <h2 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-100 text-center">
        {stepsToVideo.title}
      </h2>

      <div className="mt-6 flex flex-col gap-3">
        {stepsToVideo.items.map((item) => (
          <div
            key={item.step}
            className="flex items-start gap-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-400 text-zinc-950 font-bold text-sm">
              {item.step}
            </span>
            <div className="flex-1">
              <strong className="block text-sm md:text-base font-bold text-zinc-100">
                {item.title}
              </strong>
              <span className="mt-0.5 block text-xs md:text-sm text-zinc-400">
                {item.description}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-col items-center">
        <CtaButton>{stepsToVideo.ctaText}</CtaButton>
        <p className="mt-2.5 text-xs text-zinc-400">
          {landingI18n.price.label}{" "}
          <strong className="text-zinc-200 font-bold">{landingI18n.price.value}</strong> ·{" "}
          {stepsToVideo.priceNote}
        </p>
      </div>
    </section>
  );
}
