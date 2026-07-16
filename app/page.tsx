import type { Metadata } from "next";

import OperatingSystemLanding from "@/components/landing/OperatingSystemLanding";

export const metadata: Metadata = {
  title: "Plateforme de coaching sportif pour coachs",
  description:
    "STRYVLAB est une plateforme de coaching sportif qui réunit dossiers coachés, programmes d’entraînement, Nutrition Studio, suivi des données et STRYVR, l’application client.",
  openGraph: {
    title: "STRYVLAB | Plateforme de coaching sportif",
    description:
      "Dossiers coachés, programmes d’entraînement, nutrition, suivi des données et application client : un environnement de travail connecté pour le coach sportif.",
    url: "/",
  },
};

export default function HomePage() {
  return <OperatingSystemLanding />;
}
