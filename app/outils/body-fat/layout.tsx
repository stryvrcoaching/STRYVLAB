// app/outils/body-fat/layout.tsx
import { Metadata } from 'next';

// --- SEO METADATA 2025-2026 ---
export const metadata: Metadata = {
  title: 'Calculateur Body Fat % : Masse Grasse US Navy & Jackson-Pollock | STRYV lab',
  description: 'Calculateur body fat scientifique. Méthodes US Navy (1984) & Jackson-Pollock (1978). Catégorisation ACE Standards. Précision ±3-5%. Composition corporelle optimale. Gratuit.',
  keywords: 'body fat calculator, calculateur masse grasse, US Navy body fat, Jackson-Pollock, composition corporelle, LBM, ACE standards, pourcentage graisse, DEXA alternative, bf%',
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
    url: 'https://www.stryvlab.com/outils/body-fat',
    title: 'Calculateur Body Fat % : Masse Grasse US Navy & Jackson-Pollock',
    description: 'Calculateur body fat scientifique. US Navy (1984) & Jackson-Pollock (1978). ACE Standards. Gratuit.',
    siteName: 'STRYV lab',
    images: [
      {
        url: '/og-body-fat.jpg',
        width: 1200,
        height: 630,
        alt: 'Calculateur Body Fat % Pro STRYV lab',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Calculateur Body Fat % : Masse Grasse US Navy & Jackson-Pollock',
    description: 'Calculateur body fat scientifique. US Navy (1984) & Jackson-Pollock (1978). ACE Standards.',
    images: ['/og-body-fat.jpg'],
    creator: '@stryvlab',
  },
  alternates: {
    canonical: 'https://www.stryvlab.com/outils/body-fat',
  },
};

export default function BodyFatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}