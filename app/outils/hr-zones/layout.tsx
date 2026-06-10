// app/outils/hr-zones/layout.tsx
import { Metadata } from 'next';

// --- SEO METADATA 2025-2026 ---
export const metadata: Metadata = {
  title: 'Calculateur Zones FC Pro : Méthode Karvonen Scientifique | STRYV lab',
  description: 'Calculateur zones fréquence cardiaque Karvonen. Formules Tanaka (2001) & Gulati (2010). 6 zones physiologiques validées ACSM. Optimisez votre entraînement cardio. Gratuit.',
  keywords: 'zones fréquence cardiaque, calculateur fc, méthode karvonen, fc max, tanaka, gulati, zones cardio, entraînement cardiovasculaire, VO2 max, seuil lactique, ACSM, heart rate zones calculator',
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
    url: 'https://www.stryvlab.com/outils/hr-zones',
    title: 'Calculateur Zones FC Pro : Méthode Karvonen Scientifique',
    description: 'Calculateur zones fréquence cardiaque Karvonen. Formules Tanaka & Gulati. 6 zones validées ACSM. Gratuit.',
    siteName: 'STRYV lab',
    images: [
      {
        url: '/og-hr-zones.jpg',
        width: 1200,
        height: 630,
        alt: 'Calculateur Zones FC Pro STRYV lab',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Calculateur Zones FC Pro : Méthode Karvonen Scientifique',
    description: 'Calculateur zones fréquence cardiaque Karvonen. Formules Tanaka & Gulati. 6 zones validées ACSM.',
    images: ['/og-hr-zones.jpg'],
    creator: '@stryvlab',
  },
  alternates: {
    canonical: 'https://www.stryvlab.com/outils/hr-zones',
  },
};

export default function HRZonesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}