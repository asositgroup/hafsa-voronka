import Image from "next/image";
import { HarakatWord } from "@/components/brand/HarakatWord";
import { CtaButton } from "@/components/landing/CtaButton";
import { TelegramIcon } from "@/components/landing/TelegramIcon";
import { HERO_CTA_ID } from "@/components/landing/ids";
import { landingContent } from "@/content/landing";

export function HeroSection() {
  const { hero } = landingContent;

  return (
    <section className="bg-siyoh pt-[92px] pb-14 lg:pt-[140px] lg:pb-24">
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-5 px-5 md:px-8 lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16">
        <div className="contents lg:flex lg:flex-col lg:gap-6">
          <p className="order-1 m-0 flex items-center gap-3 text-[14px] font-semibold leading-[1.5] text-kumush">
            <span aria-hidden="true" className="h-2 w-2 shrink-0 rotate-45 bg-oltin" />
            {hero.fact}
          </p>

          <h1 className="order-2 m-0 text-[40px] font-bold leading-[1.05] tracking-[-0.03em] text-varaq lg:text-[64px] lg:leading-[1.02]">
            {hero.title}
          </h1>

          <p className="order-4 m-0 text-[18px] leading-[1.55] text-varaq lg:text-[20px]">
            {hero.lead}
          </p>

          <p className="order-4 hidden lg:block m-0 text-[16px] leading-[1.6] text-kumush">
            {hero.paragraph}
          </p>

          <div
            id={HERO_CTA_ID}
            className="order-5 flex flex-col gap-4 md:flex-row md:items-center md:gap-6 lg:pt-2"
          >
            <CtaButton variant="gold" surface="ink" className="w-full md:w-auto">
              {hero.buttonText}
            </CtaButton>
            <div className="flex items-center gap-3">
              <TelegramIcon className="h-[22px] w-[22px] text-telegram" />
              <p className="m-0 flex flex-col text-[14px] leading-[1.5]">
                <span className="font-semibold text-varaq">{hero.telegramNote}</span>
                <span className="text-kumush">{hero.telegramSubnote}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="order-3 mt-4 mb-6 lg:mt-0 lg:justify-self-end lg:w-full lg:max-w-[480px] lg:mb-8">
          <div className="relative lg:aspect-[0.82] lg:w-full lg:rounded-[240px_240px_24px_24px] lg:border lg:border-varaq/18 lg:bg-zumrad">
            <HarakatWord word="iqra" className="hidden lg:block absolute right-10 top-[18%] h-[150px]" />

            <CtaButton
              variant="visual"
              ariaLabel={`${hero.posterLabel}, ${hero.duration}`}
              className="aspect-video w-full overflow-hidden rounded-[18px] bg-siyoh-deep lg:absolute lg:inset-x-8 lg:-bottom-8 lg:w-auto lg:shadow-[0_24px_48px_rgba(0,0,0,.28)]"
            >
              <Image
                src="/landing/lesson-poster.webp"
                alt=""
                fill
                preload
                sizes="(min-width:1024px) 480px, 100vw"
                className="object-cover"
              />
              <span className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-varaq/92">
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="ml-1 h-6 w-6 fill-siyoh">
                  <path d="M6 3.5v17a1 1 0 0 0 1.52.85l13.6-8.5a1 1 0 0 0 0-1.7L7.52 2.65A1 1 0 0 0 6 3.5Z" />
                </svg>
              </span>
              <span className="absolute bottom-3 right-3 rounded-[8px] bg-siyoh-deep px-2 py-1 text-[14px] leading-none tabular-nums text-varaq">
                {hero.duration}
              </span>
            </CtaButton>

            <div className="absolute -bottom-8 -left-2 z-10 flex h-24 w-24 flex-col items-center justify-center rounded-full bg-varaq px-2 text-center lg:bottom-auto lg:-left-10 lg:top-[40%] lg:h-32 lg:w-32 lg:-translate-y-1/2 lg:px-3">
              <span className="text-[36px] font-bold leading-none text-siyoh lg:text-[40px]">
                {hero.badgeValue}
              </span>
              <span className="mt-1 text-[13px] leading-[1.2] text-qalam lg:text-[14px]">
                {hero.badgeLabel}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
