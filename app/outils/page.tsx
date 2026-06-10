import type { Metadata } from 'next';
import { Suspense } from 'react';
import ToolsGrid from './ToolsGrid';

export const metadata: Metadata = {
  title: 'Lab Open Source',
  description: 'Accédez aux calculateurs de précision pour l\'optimisation métabolique, hormonale et de la performance (Macros, Body Fat, Cycle Sync...).',
  openGraph: {
    title: 'Lab Open Source | STRYV lab',
    description: 'La suite d\'outils pour transformer votre physique.',
    url: 'https://www.stryvlab.com/outils',
    siteName: 'STRYV lab',
    images: [
      {
        url: '/og-toolshub.jpg', // L'image que tu as fournie
        width: 1200,
        height: 630,
        alt: 'STRYV lab Tools Hub',
      },
    ],
    locale: 'fr_FR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Lab Open Source',
    description: 'La suite d\'outils métaboliques pour transformer votre physique.',
    images: ['/og-toolshub.png'],
  },
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ToolsGrid />
    </Suspense>
  );
}