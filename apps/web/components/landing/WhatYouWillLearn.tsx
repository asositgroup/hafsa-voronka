import { CtaButton } from "@/components/landing/CtaButton";
import { landingContent } from "@/content/landing";

export function WhatYouWillLearn() {
  const { lesson } = landingContent;

  return (
    <section className="bg-varaq py-[72px] lg:py-28">
      <div className="mx-auto w-full max-w-[1180px] px-5 md:px-8">
        <h2 className="m-0 text-[32px] font-bold leading-[1.1] tracking-[-0.02em] text-siyoh lg:text-[48px]">
          {lesson.title}
        </h2>
        <p className="m-0 mt-4 max-w-[560px] text-[16px] leading-[1.6] text-qalam">
          {lesson.intro}
        </p>

        <div className="mt-10 lg:mt-14 rounded-[18px] bg-white p-6 lg:p-0 grid grid-cols-1 divide-y divide-chiziq lg:grid-cols-3 lg:divide-y-0 lg:divide-x">
          {lesson.cards.map((card) => (
            <div
              key={card.numeral}
              className="flex flex-col gap-3 py-6 first:pt-0 last:pb-0 lg:min-h-[320px] lg:p-10 lg:first:pt-10 lg:last:pb-10"
            >
              <span
                aria-hidden="true"
                className="self-end font-arabic text-[44px] leading-none text-zumrad lg:text-[52px]"
              >
                {card.numeral}
              </span>
              <h3 className="m-0 text-[20px] font-semibold leading-[1.25] text-siyoh lg:text-[22px]">
                {card.title}
              </h3>
              <p className="m-0 text-[16px] leading-[1.6] text-qalam lg:text-[17px]">
                {card.description}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-8">
          <CtaButton variant="gold" className="w-full md:w-auto">
            {lesson.buttonText}
          </CtaButton>
        </div>
      </div>
    </section>
  );
}
