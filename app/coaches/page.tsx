import type { Metadata } from 'next';
import { getCoachLandingLeadCount } from './actions';
import { CoachEcosystemLandingClient } from './components/CoachEcosystemLandingClient';

export const metadata: Metadata = {
  title: 'STRYV pour les coachs',
  description:
    "STRYV structure un coaching plus pro, centralise le suivi, et améliore la personnalisation, l'adhérence et les résultats client.",
  openGraph: {
    title: 'STRYV pour les coachs',
    description:
      "Une plateforme smart pour structurer le coaching, centraliser l'écosystème et mieux piloter les résultats client.",
    siteName: 'STRYV lab',
  },
};

export default async function CoachesLandingPage() {
  const leadCount = await getCoachLandingLeadCount();

  return <CoachEcosystemLandingClient leadCount={leadCount} />;
}
