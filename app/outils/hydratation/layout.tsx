// app/outils/hydratation/layout.tsx
import { Metadata } from 'next';

// --- SEO METADATA 2025-2026 ---
export const metadata: Metadata = {
  title: 'Calculateur Hydratation Pro : Besoins Eau EFSA Scientifique | STRYV lab',
  description: 'Calculateur hydratation scientifique EFSA 2010 (35ml/kg). Ajustements activité ACSM, climat, genre. Prévention déshydratation & hyponatrémie. Performance optimale. Gratuit.',
  keywords: 'calculateur hydratation, besoins eau, EFSA 2010, déshydratation, hydratation sport, ACSM, performance hydrique, eau quotidienne, hyponatrémie, thermorégulation, hydration calculator',
  authors: [{ name: 'STRYV lab', url: 'https://www.stryvlab.com' }],
  creator: 'STRYV lab',
  publisher: 'STRYV lab',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: 'https://www.stryvlab.com/outils/hydratation',
    title: 'Calculateur Hydratation Pro : Besoins Eau EFSA Scientifique',
    description: 'Calculateur hydratation EFSA 2010. Ajustements ACSM activité & climat. Prévention déshydratation. Gratuit.',
    siteName: 'STRYV lab',
    images: [
      {
        url: '/og-hydratation.jpg',
        width: 1200,
        height: 630,
        alt: 'Calculateur Hydratation Pro STRYV lab',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Calculateur Hydratation Pro : Besoins Eau EFSA Scientifique',
    description: 'Calculateur hydratation EFSA 2010. Ajustements ACSM activité & climat. Prévention déshydratation.',
    images: ['/og-hydratation.jpg'],
    creator: '@stryvlab',
  },
  alternates: {
    canonical: 'https://www.stryvlab.com/outils/hydratation',
  },
};

export default function HydratationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}