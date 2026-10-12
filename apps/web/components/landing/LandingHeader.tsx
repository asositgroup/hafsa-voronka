import { HarakatWord } from "@/components/brand/HarakatWord";
import { CtaButton } from "@/components/landing/CtaButton";
import { landingContent } from "@/content/landing";

export function LandingHeader() {
  const { header } = landingContent;

  return (
    <header className="absolute inset-x-0 top-0 z-10 h-16 lg:h-[84px] border-b border-varaq/14">
      <div className="mx-auto flex h-full w-full max-w-[1180px] items-center justify-between gap-4 px-5 md:px-8">
        <div className="flex items-center gap-3">
          <HarakatWord word="hafsa" className="h-[28px]" />
          <span className="text-[17px] font-semibold text-varaq">{header.brand}</span>
        </div>
        <CtaButton variant="header">{header.buttonText}</CtaButton>
      </div>
    </header>
  );
}
