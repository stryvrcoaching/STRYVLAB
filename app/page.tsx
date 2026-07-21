import type { Metadata } from "next";

import OperatingSystemLanding from "@/components/landing/OperatingSystemLanding";

export const metadata: Metadata = {
  title: "STRYV lab | Plateforme de coaching sportif pour coachs",
  description:
    "STRYV lab relie dossiers coachés, bilans, programmes, nutrition, données de suivi et STRYVR, l’application client. Un système de travail pour décider plus vite, avec le contexte au bon endroit.",
  keywords: [
    "plateforme coaching sportif",
    "logiciel coach sportif",
    "suivi client coach",
    "application client coaching",
    "programme entraînement coach",
    "nutrition coaching",
    "STRYV lab",
    "STRYVR",
  ],
  openGraph: {
    title: "STRYV lab | Le système de travail du coach sportif",
    description:
      "Profil, bilan, prescription, expérience client et données dans une seule boucle. Réservez une démo de 40 minutes.",
    url: "/",
    type: "website",
    locale: "fr_FR",
  },
  twitter: {
    card: "summary_large_image",
    title: "STRYV lab | Plateforme de coaching sportif",
    description:
      "Un environnement connecté pour piloter le coaching personnalisé — du dossier coaché à la prochaine décision.",
  },
  alternates: {
    canonical: "/",
  },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "STRYV lab et STRYVR, c’est quoi la différence ?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "STRYV lab est l’espace de travail du coach : dossiers, bilans, programmes, nutrition, données et organisation. STRYVR est l’application client connectée : le coaché y exécute le protocole et renvoie séances, repas, check-ins et retours utiles.",
      },
    },
    {
      "@type": "Question",
      name: "Pour qui est faite la plateforme STRYV lab ?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Pour le coach sportif indépendant ou en équipe qui suit plusieurs personnes, le préparateur physique, le coach nutrition, et les studios qui veulent un suivi plus structuré sans disperser l’information.",
      },
    },
    {
      "@type": "Question",
      name: "Qu’est-ce qu’on voit pendant la démo de 40 minutes ?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Votre méthode de travail, un parcours coaché de bout en bout, les studios d’entraînement et de nutrition, la boucle avec STRYVR, et les niveaux d’accès adaptés à votre activité.",
      },
    },
    {
      "@type": "Question",
      name: "Le coach garde-t-il la main sur les décisions ?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Oui. Les intelligences du système rapprochent le contexte et préparent une lecture. Elles n’imposent pas de protocole à la place du coach : la décision reste professionnelle.",
      },
    },
    {
      "@type": "Question",
      name: "Combien coûtent Solo, Pro et Studio ?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Solo : 29 €/mois jusqu’à 5 coachés. Pro : 79 €/mois jusqu’à 30 coachés avec STRYVR. Studio : 129 €/mois pour un volume étendu. La démo aide à confirmer le niveau adapté.",
      },
    },
  ],
};

const softwareJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "STRYV lab",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "Plateforme de pilotage du coaching sportif personnalisé pour coachs : dossiers coachés, bilans, programmes, nutrition, données de suivi et application client STRYVR.",
  offers: [
    {
      "@type": "Offer",
      name: "Solo",
      price: "29",
      priceCurrency: "EUR",
      description: "Jusqu’à 5 coachés — espace coach sans application client",
    },
    {
      "@type": "Offer",
      name: "Pro",
      price: "79",
      priceCurrency: "EUR",
      description: "Jusqu’à 30 coachés — écosystème complet avec STRYVR",
    },
    {
      "@type": "Offer",
      name: "Studio",
      price: "129",
      priceCurrency: "EUR",
      description: "Volume étendu — activité de coaching structurée",
    },
  ],
};

export default function HomePage() {
  return (
    <>
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        type="application/ld+json"
      />
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }}
        type="application/ld+json"
      />
      <OperatingSystemLanding />
    </>
  );
}
