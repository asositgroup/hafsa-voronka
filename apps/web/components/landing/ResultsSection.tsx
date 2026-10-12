import { landingContent } from "@/content/landing";

export function ResultsSection() {
  const { results } = landingContent;

  return (
    <section className="w-full max-w-md mx-auto">
      <h2 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-100 text-center">
        {results.title}
      </h2>
      <p className="mt-2 text-xs md:text-sm text-zinc-400 text-center">
        {results.subtitle}
      </p>

      <div className="mt-6 flex flex-col gap-4">
        {results.items.map((card, index) => (
          <div
            key={index}
            className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 shadow-lg relative overflow-hidden"
          >
            <div className="inline-block rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-300">
              {card.tag}
            </div>
            <h3 className="mt-3 text-base md:text-lg font-bold text-zinc-100">
              {card.title}
            </h3>
            <p className="mt-2 text-sm text-zinc-300 leading-relaxed">
              {card.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
