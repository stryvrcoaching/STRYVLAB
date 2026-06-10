// components/dashboard/ClientsSection.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { DashboardClient, WeightPoint } from './types';

type Props = {
  clients: DashboardClient[];
};

type Filter = 'all' | 'progressing' | 'stagnant' | 'inactive';

function Sparkline({ points }: { points: WeightPoint[] }) {
  if (points.length < 3) return null;

  const values = points.map(p => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const w = 64;
  const h = 24;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  });

  return (
    <svg width={w} height={h} className="opacity-50">
      <polyline points={pts.join(' ')} fill="none" stroke="#1f8a65" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const statusConfig = {
  progressing: { label: 'En progrès', color: 'text-[#1f8a65]', dot: 'bg-[#1f8a65]' },
  stagnant: { label: 'Stagnant', color: 'text-amber-400', dot: 'bg-amber-400' },
  inactive: { label: 'Inactif', color: 'text-red-400', dot: 'bg-red-400' },
};

export default function ClientsSection({ clients }: Props) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');

  if (clients.length === 0) return null;

  const counts = {
    progressing: clients.filter(c => c.status === 'progressing').length,
    stagnant: clients.filter(c => c.status === 'stagnant').length,
    inactive: clients.filter(c => c.status === 'inactive').length,
  };

  const filtered = filter === 'all' ? clients : clients.filter(c => c.status === filter);

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
          Clients
        </p>
        <button
          onClick={() => router.push('/coach/clients')}
          className="text-[11px] text-white/35 hover:text-white/60 transition-colors"
        >
          Voir tous →
        </button>
      </div>

      {/* Filtres segmentation */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setFilter('all')}
          className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors ${
            filter === 'all'
              ? 'bg-white/[0.08] text-white/80'
              : 'bg-white/[0.02] text-white/35 hover:bg-white/[0.05]'
          }`}
        >
          Tous ({clients.length})
        </button>
        {(['progressing', 'stagnant', 'inactive'] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors ${
              filter === s
                ? 'bg-white/[0.08] text-white/80'
                : 'bg-white/[0.02] text-white/35 hover:bg-white/[0.05]'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${statusConfig[s].dot}`} />
            {statusConfig[s].label} ({counts[s]})
          </button>
        ))}
      </div>

      {/* Grid clients */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {filtered.map(client => {
          const initials =
            (client.firstName[0] ?? '') + (client.lastName[0] ?? '');
          const cfg = statusConfig[client.status];
          const delta = client.lastMetrics?.delta;

          return (
            <div
              key={client.id}
              onClick={() => router.push(`/coach/clients/${client.id}`)}
              className="flex items-center gap-3 px-3.5 py-3 rounded-xl bg-white/[0.02] border-[0.3px] border-white/[0.06] hover:bg-white/[0.05] transition-colors cursor-pointer active:scale-[0.99]"
            >
              {/* Avatar */}
              <div className="w-9 h-9 rounded-lg bg-[#1f8a65]/15 flex items-center justify-center shrink-0">
                <span className="text-[11px] font-bold text-[#1f8a65] uppercase">
                  {initials}
                </span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-[12px] font-semibold text-white/85 truncate">
                    {client.firstName} {client.lastName}
                  </p>
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                </div>
                <p className="text-[10px] text-white/35 mb-1">
                  {client.lastActivityDays === 0
                    ? "Aujourd'hui"
                    : `Il y a ${client.lastActivityDays}j`}
                  {client.subscription && (
                    <span className={`ml-2 ${client.subscription.status === 'active' ? 'text-[#1f8a65]/70' : 'text-red-400/70'}`}>
                      · {client.subscription.formulaName}
                    </span>
                  )}
                </p>
                {client.lastMetrics && (
                  <div className="flex items-center gap-3 text-[10px] text-white/45">
                    {client.lastMetrics.weight != null && (
                      <span>{client.lastMetrics.weight}kg</span>
                    )}
                    {client.lastMetrics.bodyFatPct != null && (
                      <span>BF {client.lastMetrics.bodyFatPct}%</span>
                    )}
                    {delta != null && (
                      <span className={`flex items-center gap-0.5 ${delta < 0 ? 'text-[#1f8a65]' : delta > 0 ? 'text-red-400' : 'text-white/35'}`}>
                        {delta < 0 ? <TrendingDown size={10} /> : delta > 0 ? <TrendingUp size={10} /> : <Minus size={10} />}
                        {delta > 0 ? '+' : ''}{delta}kg
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Sparkline + flèche */}
              <div className="flex items-center gap-2 shrink-0">
                <Sparkline points={client.weightHistory} />
                <ChevronRight size={13} className="text-white/20" strokeWidth={1.75} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
