import { BusinessSection } from "./BusinessSection";
import { DecisionSection } from "./DecisionSection";
import { DifferentiationSection } from "./DifferentiationSection";
import { EarlyAccessSection } from "./EarlyAccessSection";
import { FaqSection } from "./FaqSection";
import { FinalCtaAndFooter } from "./FinalCta";
import { FragmentationSection } from "./FragmentationSection";
import { HeroSystem } from "./HeroSystem";
import { LandingNav } from "./LandingNav";
import { StudiosSection } from "./StudiosSection";
import { StryvrSection } from "./StryvrSection";
import { SystemLoop } from "./SystemLoop";

export function LandingV2() {
  return (
    <main className="min-h-screen overflow-x-clip bg-[#0d0d0d] text-white selection:bg-[#c6b48b] selection:text-[#0d0d0d]">
      <LandingNav />
      <HeroSystem />
      <FragmentationSection />
      <SystemLoop />
      <StudiosSection />
      <StryvrSection />
      <DecisionSection />
      <BusinessSection />
      <DifferentiationSection />
      <EarlyAccessSection />
      <FaqSection />
      <FinalCtaAndFooter />
    </main>
  );
}
