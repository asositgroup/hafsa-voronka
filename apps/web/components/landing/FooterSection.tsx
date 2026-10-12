import { HarakatWord } from "@/components/brand/HarakatWord";
import { landingContent } from "@/content/landing";

export function FooterSection() {
  const { header, footer } = landingContent;

  return (
    <footer className="bg-siyoh-deep pt-8 pb-28 lg:pb-8">
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-4 px-5 md:flex-row md:items-center md:justify-between md:gap-8 md:px-8">
        <div className="flex items-center gap-3">
          <HarakatWord word="hafsa" className="h-[24px]" />
          <span className="text-[17px] font-semibold text-varaq">{header.brand}</span>
        </div>
        <p className="m-0 text-[13px] leading-[1.5] text-kumush">{footer.disclaimer}</p>
        <p className="m-0 text-[13px] leading-[1.5] text-kumush">{footer.copyright}</p>
      </div>
    </footer>
  );
}
