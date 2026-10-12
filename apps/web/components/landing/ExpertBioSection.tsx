import { HarakatWord } from "@/components/brand/HarakatWord";
import { landingContent } from "@/content/landing";

export function ExpertBioSection() {
  const { teacher } = landingContent;

  return (
    <section className="bg-varaq py-[72px] lg:py-28">
      <div className="mx-auto grid w-full max-w-[1180px] grid-cols-1 gap-12 px-5 md:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-24">
        <div className="lg:sticky lg:top-8 lg:self-start">
          <div className="relative flex aspect-[0.85] w-full max-w-[380px] items-center justify-center rounded-[200px_200px_18px_18px] bg-zumrad">
            <HarakatWord word="hafsa" className="h-[120px] max-w-[calc(100%-32px)]" />
            <div className="absolute inset-x-4 bottom-4 flex items-center justify-between gap-3 rounded-[12px] bg-siyoh-deep px-4 py-3 text-[15px] leading-[1.4]">
              <span className="font-semibold text-varaq">{teacher.archLabel}</span>
              <span className="text-kumush">{teacher.archYear}</span>
            </div>
          </div>
          <h2 className="m-0 mt-8 text-[32px] font-bold leading-[1.1] tracking-[-0.02em] text-siyoh lg:text-[48px]">
            {teacher.name}
          </h2>
          <p className="m-0 mt-2 text-[16px] leading-[1.6] text-qalam">
            {teacher.credential}
          </p>
        </div>

        <div className="flex flex-col">
          <p className="m-0 border-b border-chiziq pb-7 text-[20px] font-medium leading-[1.55] text-siyoh">
            {teacher.lead}
          </p>

          <div className="divide-y divide-chiziq">
            {teacher.studyPath.map((item) => (
              <div
                key={item.place}
                className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 py-5 md:grid-cols-[150px_1fr_auto] md:items-baseline"
              >
                <span className="text-[16px] font-semibold leading-[1.5] text-zumrad">{item.place}</span>
                <span className="col-span-2 text-[15px] leading-[1.5] text-qalam md:col-span-1 md:col-start-2 md:row-start-1">
                  {item.detail}
                </span>
                <span
                  dir="rtl"
                  lang="ar"
                  className="col-start-2 row-start-1 text-right font-arabic text-[22px] leading-[1.3] text-zumrad md:col-start-3"
                >
                  {item.arabic}
                </span>
              </div>
            ))}
          </div>

          <p className="m-0 mt-6 text-[16px] leading-[1.6] text-qalam">
            {teacher.ijaza}
          </p>

          <div className="mt-8 grid grid-cols-1 gap-5 rounded-[16px] bg-siyoh p-7 md:grid-cols-[96px_1fr] md:gap-6">
            <span className="text-[40px] font-bold leading-none text-oltin">{teacher.foundedYear}</span>
            <p className="m-0 border-t border-varaq/18 pt-5 text-[16px] leading-[1.6] text-varaq md:border-t-0 md:border-l md:pl-6 md:pt-0">
              {teacher.foundedText}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
