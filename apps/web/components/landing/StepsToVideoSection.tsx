import { CtaButton } from "@/components/landing/CtaButton";
import { TelegramIcon } from "@/components/landing/TelegramIcon";
import { landingContent } from "@/content/landing";

export function StepsToVideoSection() {
  const { steps } = landingContent;

  return (
    <section className="bg-siyoh py-[72px] lg:py-28">
      <div className="mx-auto w-full max-w-[1180px] px-5 md:px-8">
        <h2 className="m-0 text-[32px] font-bold leading-[1.1] tracking-[-0.02em] text-varaq lg:text-[48px]">
          {steps.title}
        </h2>

        <ol className="m-0 mt-10 flex list-none flex-col p-0 lg:mt-14 lg:flex-row lg:items-center">
          {steps.items.map((step, index) => {
            const isLast = index === steps.items.length - 1;
            return (
              <li key={step.number} className="flex flex-col lg:flex-row lg:items-center">
                {index > 0 && (
                  <span
                    aria-hidden="true"
                    className="ml-[33.5px] block h-6 w-px bg-chegara-tun lg:mx-6 lg:h-px lg:w-16 lg:shrink-0"
                  />
                )}
                <div className="flex items-center gap-4">
                  <span className="flex h-[68px] w-[68px] shrink-0 items-center justify-center">
                    <span
                      className={`flex h-12 w-12 rotate-45 items-center justify-center border-[1.5px] ${
                        isLast ? "border-oltin bg-oltin" : "border-varaq/40"
                      }`}
                    >
                      <span
                        className={`-rotate-45 text-[20px] font-bold leading-none ${
                          isLast ? "text-siyoh" : "text-oltin"
                        }`}
                      >
                        {step.number}
                      </span>
                    </span>
                  </span>
                  <div className="flex flex-col gap-1">
                    <span className="text-[17px] font-semibold leading-[1.4] text-varaq">{step.title}</span>
                    <span className="text-[15px] leading-[1.5] text-kumush">{step.description}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="mt-14 flex flex-col gap-6 rounded-[20px] bg-varaq p-7 md:flex-row md:items-center md:justify-between md:gap-8 lg:p-11">
          <div className="flex flex-col gap-2">
            <p className="m-0 text-[32px] font-bold leading-[1.1] tracking-[-0.02em] text-siyoh lg:text-[40px]">
              {steps.finalTitle}
            </p>
            <p className="m-0 text-[16px] leading-[1.6] text-qalam">
              {steps.finalSubline}
            </p>
          </div>
          <CtaButton variant="gold" className="w-full shrink-0 md:w-auto">
            <TelegramIcon className="h-[22px] w-[22px] text-siyoh" />
            {steps.finalButtonText}
          </CtaButton>
        </div>

        <p className="m-0 mt-6 text-[14px] leading-[1.5] text-kumush">
          {steps.privacy}
        </p>
      </div>
    </section>
  );
}
