import Image from "next/image";
import { landingContent } from "@/content/landing";

export function ExpertBioSection() {
  const { expert } = landingContent;

  return (
    <section className="w-full max-w-md mx-auto rounded-3xl border border-zinc-800 bg-zinc-900/40 p-6 text-center shadow-xl">
      <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-amber-400/80 bg-gradient-to-br from-zinc-800 via-zinc-900 to-amber-950/50 shadow-lg shadow-amber-400/10">
        {expert.image ? (
          <Image
            src={expert.image}
            alt={expert.name}
            width={96}
            height={96}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-2xl font-extrabold tracking-wider text-amber-300">
            {expert.name
              .split(" ")
              .map((n) => n[0])
              .join("")}
          </span>
        )}
      </div>

      <h2 className="text-xl font-bold tracking-tight text-zinc-100">
        {expert.name}
      </h2>
      <p className="mt-1 text-xs text-amber-400/90 font-medium">
        {expert.title}
      </p>

      <div className="mt-5 space-y-2.5 text-left text-xs md:text-sm text-zinc-300 leading-relaxed border-t border-b border-zinc-800/80 py-4">
        {expert.bio.map((paragraph, index) => (
          <p key={index} className="flex items-start gap-2">
            <span className="text-amber-400 shrink-0">•</span>
            <span>{paragraph}</span>
          </p>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        {expert.stats.map((stat, index) => (
          <div
            key={index}
            className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-2.5 text-center"
          >
            <strong className="block text-sm md:text-base font-extrabold text-amber-400">
              {stat.value}
            </strong>
            <span className="mt-0.5 block text-[11px] text-zinc-400 font-medium">
              {stat.label}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
