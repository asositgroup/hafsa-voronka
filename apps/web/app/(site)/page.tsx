import {
  ExpertBioSection,
  FacebookPixel,
  FooterSection,
  HeroSection,
  LandingTracker,
  StepsToVideoSection,
  StickyBottomCta,
  WhatYouWillLearn,
  WhoIsThisFor,
} from "@/components/landing";

export default function Page() {
  return (
    <>
      <FacebookPixel />
      <LandingTracker />
      <div className="flex min-h-screen flex-col bg-varaq text-siyoh">
        <HeroSection />
        <main className="w-full max-w-6xl mx-auto px-5">
          <div className="w-full max-w-[560px]">
            <WhatYouWillLearn />
            <WhoIsThisFor />
            <ExpertBioSection />
            <StepsToVideoSection />
            <FooterSection />
          </div>
        </main>
        <StickyBottomCta />
      </div>
    </>
  );
}
