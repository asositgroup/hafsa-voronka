import { landingContent } from "@/content/landing";

export function WhoIsThisFor() {
  const { whoIsThisFor } = landingContent;

  return (
    <section className="w-full max-w-md mx-auto">
      <h2 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-100 text-center">
        {whoIsThisFor.title}
      </h2>

      <div className="mt-6 flex flex-col gap-3">
        {whoIsThisFor.items.map((bullet, index) => (
          <div
            key={index}
            className="flex items-start gap-3.5 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4"
          >
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400/10 text-amber-400 mt-0.5">
              <svg
                className="h-3.5 w-3.5 stroke-amber-400 fill-none"
                viewBox="0 0 24 24"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p className="text-sm md:text-base text-zinc-300 leading-relaxed">
              {bullet}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
