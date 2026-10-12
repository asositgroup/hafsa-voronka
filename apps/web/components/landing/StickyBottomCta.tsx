import { CtaButton } from "@/components/landing/CtaButton";
import { landingContent } from "@/content/landing";

export function StickyBottomCta() {
  return (
    <div className="block lg:hidden fixed inset-x-0 bottom-0 z-40 bg-varaq/94 backdrop-blur border-t border-chiziq px-4 pt-3 pb-[max(20px,env(safe-area-inset-bottom))]">
      <CtaButton variant="ink" className="w-full min-h-[54px] text-[17px]">
        {landingContent.stickyBar.buttonText}
      </CtaButton>
    </div>
  );
}
