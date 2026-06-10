'use client';

import { useRouter } from 'next/navigation';
import {
  UserPlus,
  ClipboardList,
  Dumbbell,
  Clock,
  BellRing,
  Calculator,
  ChevronRight,
} from 'lucide-react';
import type { DashboardAlert } from './types';

type Props = {
  alerts: DashboardAlert[];
};

const FIXED_ACTIONS = [
  { icon: UserPlus, label: 'Nouveau client', desc: 'Ajouter un profil', href: '/coach/clients' },
  { icon: ClipboardList, label: 'Envoyer un bilan', desc: 'Choisir un template', href: '/coach/assessments' },
  { icon: Dumbbell, label: 'Nouveau programme', desc: 'Créer un template', href: '/coach/programs/templates' },
  { icon: Clock, label: 'Bilans en attente', desc: 'Traiter les réponses', href: '/coach/assessments?filter=pending' },
  { icon: BellRing, label: 'Rappels paiement', desc: 'Relancer les impayés', href: '/coach/comptabilite?filter=overdue' },
  { icon: Calculator, label: 'Calculer', desc: 'Ouvrir un outil', href: '/outils?from=dashboard' },
];

export default function QuickActions({ alerts }: Props) {
  const router = useRouter();

  const hasCritical = alerts.some(a => a.severity === 'critical');
  const pendingBilans = alerts.filter(a => a.id.startsWith('submission-')).length;

  let contextualAction: { label: string; href: string };
  if (hasCritical) {
    contextualAction = { label: 'Traiter les retards', href: '/coach/comptabilite?filter=overdue' };
  } else if (pendingBilans > 0) {
    contextualAction = { label: `Traiter les bilans (${pendingBilans})`, href: '/coach/assessments?filter=pending' };
  } else {
    contextualAction = { label: 'Nouveau client', href: '/coach/clients' };
  }

  return (
    <div className="mb-8">
      <button
          onClick={() => router.push(contextualAction.href)}
          className="w-full mb-4 flex items-center justify-between px-4 py-3 rounded-xl bg-[#1f8a65]/10 border-[0.3px] border-[#1f8a65]/20 hover:bg-[#1f8a65]/15 transition-colors active:scale-[0.99]"
        >
          <span className="text-[12px] font-bold text-[#1f8a65] uppercase tracking-[0.12em]">
            {contextualAction.label}
          </span>
          <ChevronRight size={14} className="text-[#1f8a65]" strokeWidth={2} />
      </button>

      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40 mb-3">
        Actions rapides
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {FIXED_ACTIONS.map(({ icon: Icon, label, desc, href }) => (
          <button
            key={label}
            onClick={() => router.push(href)}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/[0.02] border-[0.3px] border-white/[0.06] hover:bg-white/[0.05] transition-colors text-left active:scale-[0.98]"
          >
            <div className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0">
              <Icon size={13} className="text-white/55" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-white/85 leading-snug truncate">{label}</p>
              <p className="text-[10px] text-white/40 leading-snug truncate">{desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
