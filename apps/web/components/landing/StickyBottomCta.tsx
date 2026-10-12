import { landingContent } from "@/content/landing";
import { CtaButton } from "./CtaButton";

export function StickyBottomCta() {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-800/90 bg-zinc-950/95 p-3 backdrop-blur-lg md:hidden">
      <div className="mx-auto max-w-md">
        <CtaButton className="py-3.5 text-base shadow-md">
          {landingContent.hero.ctaText}
        </CtaButton>
      </div>
    </div>
  );
}
