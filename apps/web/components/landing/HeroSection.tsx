import { HarakatWord } from "@/components/brand/HarakatWord";
import { CtaButton } from "@/components/landing/CtaButton";
import { HERO_CTA_ID } from "@/components/landing/ids";
import { landingContent } from "@/content/landing";

export function HeroSection() {
  const { hero } = landingContent;

  return (
    <section className="bg-siyoh text-varaq px-5 pt-6 pb-10 sm:px-8 lg:px-12 xl:px-20 lg:py-16">
      <div className="mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-16 items-end">
        <div className="flex flex-col gap-5">
          <p className="text-kumush text-[15px] sm:text-lg font-semibold m-0">
            {hero.tag}
          </p>

          <div className="flex justify-end lg:hidden">
            <HarakatWord word="iqra" className="h-[150px]" />
          </div>

          <h1 className="text-[34px] leading-[1.1] font-bold tracking-[-0.01em] m-0">
            {hero.title}
          </h1>

          <p className="text-[17px] leading-[1.5] text-varaq/90 m-0">
            {hero.lead}
          </p>

          <p className="text-[16px] leading-[1.55] text-varaq/80 m-0">
            {hero.paragraph}
          </p>

          <div id={HERO_CTA_ID} className="flex flex-col gap-2 pt-2">
            <CtaButton variant="gold" className="w-full sm:w-auto self-start">
              {hero.buttonText}
            </CtaButton>
            <p className="text-kumush text-sm m-0">
              {hero.factText}
            </p>
          </div>
        </div>

        <div className="hidden lg:flex justify-end pb-2">
          <HarakatWord word="iqra" className="h-[230px]" />
        </div>
      </div>
    </section>
  );
}
