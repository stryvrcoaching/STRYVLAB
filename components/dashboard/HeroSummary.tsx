// components/dashboard/HeroSummary.tsx
'use client';

import type { DashboardHero } from './types';

type Props = {
  hero: DashboardHero;
};

function formatEur(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.0', '')}k€`;
  return `${n}€`;
}

export default function HeroSummary({ hero }: Props) {
  const { coachFirstName, activeClients, mrr, pendingSubmissions, alertCount, revenueThisMonth } = hero;

  // Phrase narrative
  const parts: string[] = [];
  if (alertCount > 0) parts.push(`${alertCount} action${alertCount > 1 ? 's' : ''} requise${alertCount > 1 ? 's' : ''}`);
  if (mrr > 0) parts.push(`MRR ${formatEur(mrr)}`);
  if (pendingSubmissions > 0) parts.push(`${pendingSubmissions} bilan${pendingSubmissions > 1 ? 's' : ''} en attente`);

  const greeting = coachFirstName ? `Bonjour, ${coachFirstName}` : 'Bonjour';

  const stats = [
    { label: 'Clients actifs', value: String(activeClients) },
    { label: 'MRR', value: formatEur(mrr) },
    { label: 'Bilans en attente', value: String(pendingSubmissions) },
    { label: 'Alertes', value: String(alertCount) },
    { label: 'Ce mois', value: formatEur(revenueThisMonth) },
  ];

  return (
    <div className="mb-6">
      {/* Phrase narrative */}
      <div className="mb-3">
        <span className="text-[13px] text-white/50 font-medium">
          {greeting}
          {parts.length > 0 && (
            <>
              {' — '}
              {parts.map((part, i) => (
                <span key={i}>
                  <span className="text-[#1f8a65] font-bold">{part}</span>
                  {i < parts.length - 1 && (
                    <span className="text-white/30"> · </span>
                  )}
                </span>
              ))}
            </>
          )}
          {parts.length === 0 && (
            <span className="text-white/50"> — Tout est à jour.</span>
          )}
        </span>
      </div>

      {/* Command bar */}
      <div className="flex items-center gap-4 flex-wrap">
        {stats.map((stat, i) => (
          <div key={stat.label} className="flex items-center gap-2">
            <div>
              <p className="text-[10px] text-white/35 uppercase tracking-[0.14em] leading-none mb-0.5">
                {stat.label}
              </p>
              <p className="text-[13px] text-white font-bold leading-none">
                {stat.value}
              </p>
            </div>
            {i < stats.length - 1 && (
              <span className="text-white/20 text-[11px] ml-2">·</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
