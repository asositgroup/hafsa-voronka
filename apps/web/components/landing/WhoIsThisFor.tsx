import { CtaButton } from "@/components/landing/CtaButton";
import { landingContent } from "@/content/landing";

export function WhoIsThisFor() {
  const { audience } = landingContent;

  return (
    <section className="bg-qumloq py-[72px] lg:py-28">
      <div className="mx-auto w-full max-w-[1180px] px-5 md:px-8">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-24">
          <div className="flex flex-col gap-5">
            <h2 className="m-0 text-[32px] font-bold leading-[1.1] tracking-[-0.02em] text-siyoh lg:text-[48px]">
              {audience.title}
            </h2>
            <p className="m-0 text-[17px] leading-[1.6] text-siyoh">
              {audience.intro}
            </p>
            <p className="m-0 text-[16px] font-semibold leading-[1.6] text-siyoh">
              {audience.leadIn}
            </p>
          </div>

          <ul className="m-0 list-none border-t border-chiziq p-0 divide-y divide-chiziq">
            {audience.items.map((item) => (
              <li key={item} className="flex min-h-16 items-center gap-4 py-3">
                <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rotate-45 bg-zumrad" />
                <span className="text-[17px] font-medium leading-[1.4] text-siyoh">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-14 flex flex-col gap-5 rounded-[16px] border border-siyoh/18 p-6 md:flex-row md:items-center md:justify-between md:gap-8 lg:p-8">
          <p className="m-0 text-[18px] font-semibold leading-[1.5] text-siyoh">
            {audience.closing}
          </p>
          <CtaButton variant="ink" className="w-full shrink-0 md:w-auto">
            {audience.buttonText}
          </CtaButton>
        </div>
      </div>
    </section>
  );
}
