// app/outils/macro-calculator/layout.tsx
import { Metadata } from 'next';

// --- SEO METADATA 2025-2026 ---
export const metadata: Metadata = {
  title: 'Calculateur Macro & Calories : Mifflin-St Jeor + Helms LBM | STRYV lab',
  description: 'Calculateur macronutriments scientifique. BMR Mifflin-St Jeor (1990). TDEE multi-composantes. Protéines Helms (2014) LBM-based. Déficit/Surplus optimisés. Gratuit.',
  keywords: 'calculateur macro, macronutriments, calories, Mifflin-St Jeor, TDEE, BMR, protéines, lipides, glucides, déficit calorique, surplus, Helms, LBM, macro calculator',
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
    url: 'https://www.stryvlab.com/outils/macro-calculator',
    title: 'Calculateur Macro & Calories : Mifflin-St Jeor + Helms LBM',
    description: 'Calculateur macronutriments scientifique. BMR Mifflin-St Jeor. TDEE complet. Protéines Helms LBM. Gratuit.',
    siteName: 'STRYV lab',
    images: [
      {
        url: '/og-macro-calculator.jpg',
        width: 1200,
        height: 630,
        alt: 'Calculateur Macro & Calories Pro STRYV lab',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Calculateur Macro & Calories : Mifflin-St Jeor + Helms LBM',
    description: 'Calculateur macronutriments scientifique. BMR Mifflin-St Jeor. TDEE complet. Protéines Helms LBM.',
    images: ['/og-macro-calculator.jpg'],
    creator: '@stryvlab',
  },
  alternates: {
    canonical: 'https://www.stryvlab.com/outils/macro-calculator',
  },
};

export default function MacroCalculatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}