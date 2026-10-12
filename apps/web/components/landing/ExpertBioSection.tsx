import { HarakatWord } from "@/components/brand/HarakatWord";
import { landingContent } from "@/content/landing";

export function ExpertBioSection() {
  const { teacher } = landingContent;

  return (
    <section className="pt-10">
      <div className="rounded-[18px] bg-white p-6 sm:p-7 flex flex-col gap-5 text-siyoh">
        <div className="flex gap-4 items-center">
          <div className="w-[72px] h-[72px] rounded-[14px] bg-varaq flex items-center justify-center shrink-0">
            <HarakatWord word="hafsa" lettersClassName="fill-siyoh" className="h-[30px]" />
          </div>
          <div className="flex flex-col gap-0.5">
            <h2 className="text-xl font-bold text-siyoh m-0">{teacher.name}</h2>
            <span className="text-[15px] text-qalam">{teacher.title}</span>
          </div>
        </div>

        <p className="text-[16px] leading-[1.55] text-siyoh m-0">
          {teacher.intro}
        </p>

        <div className="flex flex-col">
          {teacher.studyPath.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between gap-4 py-3 border-t border-chiziq text-[15px] sm:text-[16px]"
            >
              <span className="text-siyoh">{item.uzbek}</span>
              <span
                dir="rtl"
                className="font-arabic text-zumrad text-xl shrink-0 text-right select-none"
              >
                {item.arabic}
              </span>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          {teacher.bioParagraphs.map((para, idx) => (
            <p key={idx} className="text-[16px] leading-[1.55] text-siyoh m-0">
              {para}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}
