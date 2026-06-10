import type { Metadata } from 'next';
import { Urbanist } from 'next/font/google';
import { getBetaCount } from './actions';
import { BetaLandingClient } from './components/BetaLandingClient';

const urbanist = Urbanist({
  subsets: ['latin'],
  variable: '--font-urbanist',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'STRYVR — Accès Bêta · Ton moteur physiologique',
  description: 'STRYVR comprend ta physiologie et adapte chaque recommandation à ta biologie réelle. Rejoins la liste bêta — Belgique & France.',
  openGraph: {
    title: 'STRYVR — Accès Bêta',
    description: 'Pas un tracker. Un moteur physiologique. Rejoins la bêta.',
    siteName: 'STRYVR',
  },
};

export default async function StryvrLandingPage() {
  const betaCount = await getBetaCount();
  return (
    <div className={`${urbanist.variable} font-[family-name:var(--font-urbanist)]`}>
      <BetaLandingClient betaCount={betaCount} />
    </div>
  );
}
