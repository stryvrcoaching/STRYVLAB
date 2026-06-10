'use client';

import { useRouter } from 'next/navigation';
import { AlertTriangle, Clock, Info, ChevronRight } from 'lucide-react';
import type { DashboardAlert } from './types';

type Props = {
  alerts: DashboardAlert[];
};

const severityConfig = {
  critical: {
    icon: AlertTriangle,
    borderClass: 'border-red-500/20',
    iconClass: 'text-red-400',
    bgClass: 'bg-red-500/5',
  },
  urgent: {
    icon: Clock,
    borderClass: 'border-amber-500/20',
    iconClass: 'text-amber-400',
    bgClass: 'bg-amber-500/5',
  },
  info: {
    icon: Info,
    borderClass: 'border-white/[0.06]',
    iconClass: 'text-white/40',
    bgClass: 'bg-white/[0.02]',
  },
};

export default function AlertsFeed({ alerts }: Props) {
  const router = useRouter();

  if (alerts.length === 0) return null;

  const displayed = alerts.slice(0, 5);
  const hasMore = alerts.length > 5;

  return (
    <div className="mb-6">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40 mb-3">
        Alertes
      </p>
      <div className="space-y-1.5">
        {displayed.map(alert => {
          const config = severityConfig[alert.severity];
          const Icon = config.icon;
          return (
            <div
              key={alert.id}
              className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border-[0.3px] ${config.borderClass} ${config.bgClass}`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon size={13} className={`shrink-0 ${config.iconClass}`} strokeWidth={1.75} />
                <p className="text-[12px] text-white/70 truncate">{alert.message}</p>
              </div>
              <button
                onClick={() => router.push(alert.actionHref)}
                className="shrink-0 flex items-center gap-1 text-[11px] text-white/40 hover:text-white/70 transition-colors"
              >
                {alert.actionLabel}
                <ChevronRight size={11} strokeWidth={2} />
              </button>
            </div>
          );
        })}
        {hasMore && (
          <button
            onClick={() => router.push('/coach/comptabilite')}
            className="text-[11px] text-white/35 hover:text-white/60 transition-colors pl-1 pt-1"
          >
            + {alerts.length - 5} autres alertes →
          </button>
        )}
      </div>
    </div>
  );
}
