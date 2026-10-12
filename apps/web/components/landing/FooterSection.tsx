import { landingContent } from "@/content/landing";

export function FooterSection() {
  const { footer } = landingContent;

  return (
    <footer className="w-full border-t border-zinc-850 py-8 px-4 text-center text-xs text-zinc-400 space-y-2">
      <p className="max-w-md mx-auto leading-relaxed">
        {footer.disclaimer}
      </p>
      <p className="font-medium text-zinc-400">
        {footer.copyright}
      </p>
    </footer>
  );
}
