import {
  ExpertBioSection,
  FacebookPixel,
  FooterSection,
  HeroSection,
  LandingHeader,
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
      <div className="relative flex min-h-screen flex-col bg-varaq text-siyoh">
        <LandingHeader />
        <main className="flex flex-col">
          <HeroSection />
          <WhatYouWillLearn />
          <WhoIsThisFor />
          <ExpertBioSection />
          <StepsToVideoSection />
        </main>
        <FooterSection />
        <StickyBottomCta />
      </div>
    </>
  );
}
