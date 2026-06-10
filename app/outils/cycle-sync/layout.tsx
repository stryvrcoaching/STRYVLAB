// app/outils/cycle-sync/layout.tsx
import { Metadata } from 'next';

// --- SEO METADATA 2025-2026 ---
export const metadata: Metadata = {
  title: 'Cycle Sync : Optimisation Training & Nutrition Cycle Menstruel | STRYV lab',
  description: 'Protocole scientifique synchronisation cycle menstruel. Ajustements training/nutrition 4 phases (Folliculaire, Ovulation, Lutéale, Menstruation). Recherche Davidsen 2007, Oosthuyse 2010. Gratuit.',
  keywords: 'cycle sync, cycle menstruel training, nutrition cycle hormonal, phase folliculaire, phase lutéale, œstrogène, progestérone, Davidsen, Oosthuyse, femme fitness',
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
    url: 'https://www.stryvlab.com/outils/cycle-sync',
    title: 'Cycle Sync : Optimisation Training & Nutrition Cycle Menstruel',
    description: 'Protocole scientifique synchronisation cycle menstruel. 4 phases optimisées. Davidsen 2007, Oosthuyse 2010. Gratuit.',
    siteName: 'STRYV lab',
    images: [
      {
        url: '/og-cycle-sync.jpg',
        width: 1200,
        height: 630,
        alt: 'Cycle Sync Pro STRYV lab',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cycle Sync : Optimisation Training & Nutrition Cycle Menstruel',
    description: 'Protocole scientifique synchronisation cycle menstruel. 4 phases optimisées. Davidsen 2007, Oosthuyse 2010.',
    images: ['/og-cycle-sync.jpg'],
    creator: '@stryvlab',
  },
  alternates: {
    canonical: 'https://www.stryvlab.com/outils/cycle-sync',
  },
};

export default function CycleSyncLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}