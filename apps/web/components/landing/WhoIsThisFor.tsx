import { landingContent } from "@/content/landing";

export function WhoIsThisFor() {
  const { whoIsThisFor } = landingContent;

  return (
    <section className="pt-10 flex flex-col gap-4">
      <h2 className="text-2xl font-bold leading-[1.2] text-siyoh m-0">
        {whoIsThisFor.title}
      </h2>

      <p className="text-[16px] leading-[1.55] text-siyoh m-0">
        {whoIsThisFor.intro}
      </p>

      <p className="text-[16px] leading-[1.55] font-semibold text-siyoh m-0">
        {whoIsThisFor.leadIn}
      </p>

      <ul className="m-0 p-0 list-none flex flex-col gap-3 text-[16px] sm:text-[17px] leading-[1.5] text-siyoh">
        {whoIsThisFor.bullets.map((bullet, idx) => (
          <li key={idx} className="flex gap-3 items-baseline">
            <span
              aria-hidden="true"
              className="shrink-0 w-2 h-2 rotate-45 bg-oltin relative -top-0.5"
            />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>

      <p className="text-[16px] leading-[1.55] font-medium text-siyoh pt-1 m-0">
        {whoIsThisFor.closing}
      </p>
    </section>
  );
}
