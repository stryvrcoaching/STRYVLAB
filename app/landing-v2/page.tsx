import type { Metadata } from "next";
import { LandingV2 } from "@/components/marketing/landing-v2/LandingV2";

export const metadata: Metadata = {
  title: "STRYVLAB | Plateforme de pilotage pour coachs sportifs",
  description: "Reliez chaque prescription à ce qui se passe réellement.",
  robots: { index: false, follow: false },
};

export default function LandingV2Page() {
  return <LandingV2 />;
}
