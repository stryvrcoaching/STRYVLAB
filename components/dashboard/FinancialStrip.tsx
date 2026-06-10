// components/dashboard/FinancialStrip.tsx
'use client';

import { useRouter } from 'next/navigation';
import type { DashboardFinancial } from './types';

type Props = {
  financial: DashboardFinancial;
};

function formatEur(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.0', '')}k€`;
  return `${n}€`;
}

export default function FinancialStrip({ financial }: Props) {
  const router = useRouter();
  const { mrr, revenueThisMonth, pending, overdue } = financial;

  const cards = [
    { label: 'MRR', value: formatEur(mrr), alert: false },
    { label: 'Ce mois', value: formatEur(revenueThisMonth), alert: false },
    { label: 'En attente', value: formatEur(pending), alert: false },
    { label: 'En retard', value: formatEur(overdue), alert: overdue > 0 },
  ];

  return (
    <div className="mb-8">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40 mb-3">
        Financier
      </p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {cards.map(({ label, value, alert }) => (
          <div
            key={label}
            className={`bg-white/[0.02] rounded-2xl p-4 border-[0.3px] ${
              alert ? 'border-red-500/20' : 'border-white/[0.06]'
            }`}
          >
            <p className="text-[9px] font-bold text-white/30 uppercase tracking-[0.16em] mb-2">
              {label}
            </p>
            <p className={`text-3xl font-black tracking-tight ${alert ? 'text-red-400' : 'text-white'}`}>
              {value}
            </p>
          </div>
        ))}
      </div>
      <button
        onClick={() => router.push('/coach/comptabilite')}
        className="mt-3 text-[11px] text-white/35 hover:text-white/60 transition-colors"
      >
        → Voir la comptabilité complète
      </button>
    </div>
  );
}
