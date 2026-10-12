import { CtaButton } from "@/components/landing/CtaButton";
import { landingContent } from "@/content/landing";

export function WhatYouWillLearn() {
  const { whatYouWillLearn } = landingContent;

  return (
    <section className="pt-10 flex flex-col">
      <h2 className="text-2xl font-bold leading-[1.2] text-siyoh mb-3 m-0">
        {whatYouWillLearn.title}
      </h2>

      <div className="flex flex-col">
        {whatYouWillLearn.items.map((item, index) => (
          <div
            key={index}
            className="flex items-start justify-between gap-4 py-4 border-t border-chiziq"
          >
            <div className="flex-1 flex flex-col gap-1">
              <h3 className="text-lg sm:text-[20px] font-semibold leading-[1.3] text-siyoh m-0">
                {item.title}
              </h3>
              <p className="text-[15px] sm:text-[16px] leading-[1.55] text-qalam m-0">
                {item.description}
              </p>
            </div>
            <span
              dir="rtl"
              className="font-arabic text-[40px] leading-[0.9] text-zumrad min-w-[32px] text-right shrink-0 select-none pt-0.5"
            >
              {item.numeral}
            </span>
          </div>
        ))}
      </div>

      <div className="pt-6">
        <CtaButton variant="gold" className="w-full sm:w-auto">
          {whatYouWillLearn.buttonText}
        </CtaButton>
      </div>
    </section>
  );
}
