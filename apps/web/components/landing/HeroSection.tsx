import Image from "next/image";
import { landingContent } from "@/content/landing";
import { landingI18n } from "@/lib/i18n/landing";
import { CtaButton } from "./CtaButton";

export function HeroSection() {
  const { hero, features } = landingContent;

  return (
    <section className="flex flex-col items-center text-center pt-8 md:pt-12">
      <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs font-medium text-amber-300">
        <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
        {hero.badge}
      </div>

      <h1 className="mt-5 text-2xl md:text-4xl font-extrabold tracking-tight text-zinc-100 max-w-lg leading-tight">
        {hero.title}
      </h1>

      <p className="mt-3 text-sm md:text-base text-zinc-400 max-w-md">
        {hero.subtitle}
      </p>

      <div className="mt-6 w-full max-w-md overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/80 shadow-2xl">
        <div className="relative aspect-video w-full overflow-hidden bg-gradient-to-tr from-zinc-950 via-zinc-900 to-amber-950/30 flex items-center justify-center">
          {hero.coverImage ? (
            <Image
              src={hero.coverImage}
              alt={hero.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 448px"
              priority
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-950 to-amber-950/20">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-400 text-zinc-950 shadow-xl shadow-amber-400/20 transition-transform hover:scale-105">
                <svg
                  className="h-8 w-8 translate-x-0.5 fill-current"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-zinc-800/80 bg-zinc-950/80 p-3.5 text-left">
          <div>
            <div className="text-xs font-bold tracking-wide text-zinc-200">
              {hero.featureTag}
            </div>
            <div className="text-[11px] text-zinc-400">
              {hero.featureDesc}
            </div>
          </div>
          <div className="rounded-md border border-amber-500/40 bg-amber-400/10 px-2.5 py-1 text-[11px] font-bold text-amber-300">
            {landingI18n.badges.free}
          </div>
        </div>
      </div>

      <div className="mt-6 w-full max-w-md flex flex-col items-center">
        <CtaButton>{hero.ctaText}</CtaButton>
        <p className="mt-3 text-xs text-zinc-400">
          {landingI18n.price.label}{" "}
          <strong className="text-zinc-200 font-bold">{landingI18n.price.value}</strong> ·{" "}
          {hero.priceNote}
        </p>
      </div>

      {features && features.length > 0 && (
        <div className="mt-8 grid grid-cols-3 gap-2 w-full max-w-md">
          {features.map((feat) => (
            <div
              key={feat.title}
              className="flex items-center justify-center rounded-xl border border-zinc-800/80 bg-zinc-900/40 py-2.5 px-2 text-center text-xs font-medium text-zinc-300"
            >
              <span>{feat.title}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
