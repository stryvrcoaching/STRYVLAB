// app/outils/carb-cycling/layout.tsx
import { Metadata } from 'next';

// --- SEO METADATA 2025-2026 ---
export const metadata: Metadata = {
  title: 'Calculateur Carb Cycling Pro : Sèche Sans Perdre du Muscle | STRYV lab',
  description: 'Protocole carb cycling ultra-précis basé sur votre masse maigre (LBM). Calculez vos jours hauts/bas selon standards ISSN & Dr. Layne Norton. Brûlez du gras, gardez le muscle. Gratuit.',
  keywords: 'carb cycling, calculateur glucides, sèche musculaire, masse maigre, protocole ISSN, nutrition cyclique, recomp, bodybuilding, LBM, Layne Norton, carb cycling calculator, calculateur macro',
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
    url: 'https://www.stryvlab.com/outils/carb-cycling',
    title: 'Calculateur Carb Cycling Pro : Sèche Sans Perdre du Muscle',
    description: 'Protocole carb cycling ultra-précis basé sur votre masse maigre. Standards ISSN & Dr. Layne Norton. Gratuit.',
    siteName: 'STRYV lab',
    images: [
      {
        url: '/og-carb-cycling.jpg',
        width: 1200,
        height: 630,
        alt: 'Calculateur Carb Cycling Pro STRYV lab',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Calculateur Carb Cycling Pro : Sèche Sans Perdre du Muscle',
    description: 'Protocole carb cycling ultra-précis basé sur votre masse maigre. Standards ISSN & Dr. Layne Norton.',
    images: ['/og-carb-cycling.jpg'],
    creator: '@stryvlab',
  },
  alternates: {
    canonical: 'https://www.stryvlab.com/outils/carb-cycling',
  },
};

export default function CarbCyclingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}