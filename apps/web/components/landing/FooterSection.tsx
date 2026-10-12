import { landingContent } from "@/content/landing";

export function FooterSection() {
  const { footer } = landingContent;

  return (
    <footer className="mt-10 pt-7 pb-28 lg:pb-12 border-t border-chiziq flex flex-col gap-2 text-[13px] leading-[1.5] text-qalam">
      <p className="m-0">{footer.disclaimer}</p>
      <p className="m-0">{footer.copyright}</p>
    </footer>
  );
}
