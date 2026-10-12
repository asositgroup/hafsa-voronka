import {
  ExpertBioSection,
  FacebookPixel,
  FooterSection,
  HeroSection,
  LandingTracker,
  ResultsSection,
  StepsToVideoSection,
  StepStrip,
  StickyBottomCta,
  WhatYouWillLearn,
  WhoIsThisFor,
} from "@/components/landing";

export default function Page() {
  return (
    <>
      <FacebookPixel />
      <LandingTracker />
      <div className="flex min-h-screen flex-col bg-[#09090B] text-zinc-100">
        <StepStrip />
        <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-12 px-4 pb-28 pt-2 md:gap-16 md:pb-16">
          <HeroSection />
          <WhatYouWillLearn />
          <WhoIsThisFor />
          <ResultsSection />
          <StepsToVideoSection />
          <ExpertBioSection />
        </main>
        <FooterSection />
        <StickyBottomCta />
      </div>
    </>
  );
}
