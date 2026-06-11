import type { Metadata } from 'next';
import PublicTdeeWizard from '@/components/nutrition/public-tdee/PublicTdeeWizard';

export const metadata: Metadata = {
  title: 'TDEE Expert | STRYV lab',
  description: 'Wizard expert public pour calculer BMR, NEAT, EAT, TEF, TDEE et programmer déficit, maintenance ou surplus.',
};

export default function Page() {
  return <PublicTdeeWizard />;
}
