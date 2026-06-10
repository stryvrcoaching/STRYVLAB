# Superpower Coach Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer la page `/dashboard` existante par un vrai tableau de bord coach — résumé intelligent, alertes, clients segmentés, financier condensé.

**Architecture:** Single scroll — 5 composants isolés dans `components/dashboard/`, orchestrés par `app/dashboard/page.tsx`. Un seul endpoint `GET /api/dashboard/coach` agrège toutes les données en parallèle côté serveur. La page existante est remplacée intégralement.

**Tech Stack:** Next.js App Router, TypeScript strict, Supabase (service role), Tailwind CSS DS v2.0, Framer Motion, Lucide React

---

## File Map

**Créés :**
- `app/api/dashboard/coach/route.ts` — endpoint agrégé unique
- `components/dashboard/HeroSummary.tsx` — phrase narrative + command bar
- `components/dashboard/AlertsFeed.tsx` — fil d'alertes + actions contextuelles
- `components/dashboard/QuickActions.tsx` — grille 6 actions fixes
- `components/dashboard/ClientsSection.tsx` — segmentation + cards + sparkline
- `components/dashboard/FinancialStrip.tsx` — 4 stat cards financières
- `components/dashboard/types.ts` — types partagés DashboardCoachData

**Modifiés :**
- `app/dashboard/page.tsx` — remplacé intégralement par orchestrateur léger

---

## Task 1 : Types partagés

**Files:**
- Create: `components/dashboard/types.ts`

- [ ] **Step 1 : Créer le fichier de types**

```typescript
// components/dashboard/types.ts

export type AlertSeverity = 'critical' | 'urgent' | 'info';

export type DashboardAlert = {
  id: string;
  severity: AlertSeverity;
  message: string;
  actionLabel: string;
  actionHref: string;
  clientId?: string;
  clientName?: string;
};

export type ClientMetrics = {
  weight?: number;
  bodyFatPct?: number;
  delta?: number; // delta poids vs mesure précédente
};

export type WeightPoint = {
  date: string;
  value: number;
};

export type DashboardClient = {
  id: string;
  firstName: string;
  lastName: string;
  status: 'progressing' | 'stagnant' | 'inactive';
  lastActivityDays: number;
  lastMetrics: ClientMetrics | null;
  weightHistory: WeightPoint[]; // pour sparkline, min 3 points
  subscription: { formulaName: string; status: string } | null;
};

export type DashboardHero = {
  coachFirstName: string;
  activeClients: number;
  mrr: number;
  pendingSubmissions: number;
  alertCount: number;
  revenueThisMonth: number;
};

export type DashboardFinancial = {
  mrr: number;
  revenueThisMonth: number;
  pending: number;
  overdue: number;
};

export type DashboardCoachData = {
  hero: DashboardHero;
  alerts: DashboardAlert[];
  clients: DashboardClient[];
  financial: DashboardFinancial;
};
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
npx tsc --noEmit
```

Expected : 0 erreurs.

- [ ] **Step 3 : Commit**

```bash
git add components/dashboard/types.ts
git commit -m "feat(dashboard): add shared types for superpower dashboard"
```

---

## Task 2 : Endpoint API agrégé

**Files:**
- Create: `app/api/dashboard/coach/route.ts`

> Le pattern auth est identique à `app/api/clients/route.ts` : `createServerClient()` pour l'auth, `serviceClient()` (service role) pour les requêtes DB. Les tables clés : `coach_clients`, `assessment_submissions`, `subscription_payments`, `client_subscriptions`, `coach_formulas`.

- [ ] **Step 1 : Créer l'endpoint**

```typescript
// app/api/dashboard/coach/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/utils/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import type {
  DashboardCoachData,
  DashboardAlert,
  DashboardClient,
} from '@/components/dashboard/types';

export const dynamic = 'force-dynamic';

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const billingToMonthly: Record<string, number> = {
  weekly: 4.33,
  monthly: 1,
  quarterly: 1 / 3,
  yearly: 1 / 12,
  one_time: 0,
};

export async function GET(_req: NextRequest) {
  const supabase = createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const coachId = user.id;
  const db = serviceClient();

  // Toutes les requêtes en parallèle
  const [
    clientsRes,
    submissionsRes,
    paymentsRes,
    subscriptionsRes,
    profileRes,
  ] = await Promise.all([
    db.from('coach_clients')
      .select('id, first_name, last_name, status, created_at, last_activity_at')
      .eq('coach_id', coachId),

    db.from('assessment_submissions')
      .select('id, status, client_id, created_at')
      .eq('coach_id', coachId)
      .eq('status', 'sent'),

    db.from('subscription_payments')
      .select('id, amount_eur, status, payment_date, due_date, client_id, coach_clients(first_name, last_name)')
      .eq('coach_id', coachId),

    db.from('client_subscriptions')
      .select('id, status, coach_id, client_id, price_override_eur, coach_formulas(name, price_eur, billing_cycle), coach_clients(first_name, last_name)')
      .eq('coach_id', coachId),

    db.from('user_profiles')
      .select('first_name')
      .eq('id', coachId)
      .single(),
  ]);

  const clients = clientsRes.data ?? [];
  const submissions = submissionsRes.data ?? [];
  const payments = paymentsRes.data ?? [];
  const subscriptions = subscriptionsRes.data ?? [];
  const coachFirstName: string = profileRes.data?.first_name ?? '';

  // ── MRR ──────────────────────────────────────────────────────────────────
  let mrr = 0;
  for (const sub of subscriptions) {
    if (sub.status !== 'active' && sub.status !== 'trial') continue;
    const formula = sub.coach_formulas as { price_eur: number; billing_cycle: string } | null;
    if (!formula) continue;
    const price = (sub.price_override_eur as number | null) ?? formula.price_eur;
    mrr += price * (billingToMonthly[formula.billing_cycle] ?? 0);
  }

  // ── Revenu ce mois ───────────────────────────────────────────────────────
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const revenueThisMonth = payments
    .filter(p => p.status === 'paid' && p.payment_date?.startsWith(monthKey))
    .reduce((sum, p) => sum + (p.amount_eur ?? 0), 0);

  const pending = payments
    .filter(p => p.status === 'pending')
    .reduce((sum, p) => sum + (p.amount_eur ?? 0), 0);

  const overdue = payments
    .filter(p => p.status === 'overdue')
    .reduce((sum, p) => sum + (p.amount_eur ?? 0), 0);

  // ── Alertes ──────────────────────────────────────────────────────────────
  const alerts: DashboardAlert[] = [];

  // Paiements en retard >7j → critique
  for (const p of payments.filter(p => p.status === 'overdue')) {
    const client = p.coach_clients as { first_name: string; last_name: string } | null;
    const clientName = client ? `${client.first_name} ${client.last_name}` : 'Client inconnu';
    alerts.push({
      id: `overdue-${p.id}`,
      severity: 'critical',
      message: `Paiement en retard — ${clientName} (${p.amount_eur}€)`,
      actionLabel: 'Voir facture',
      actionHref: `/coach/comptabilite`,
      clientId: p.client_id ?? undefined,
      clientName,
    });
  }

  // Abonnements expirés → critique
  for (const sub of subscriptions.filter(s => s.status === 'cancelled')) {
    const client = sub.coach_clients as { first_name: string; last_name: string } | null;
    if (!client) continue;
    const clientName = `${client.first_name} ${client.last_name}`;
    alerts.push({
      id: `expired-sub-${sub.id}`,
      severity: 'critical',
      message: `Abonnement expiré — ${clientName}`,
      actionLabel: 'Gérer',
      actionHref: `/coach/comptabilite`,
      clientId: sub.client_id ?? undefined,
      clientName,
    });
  }

  // Bilans sans réponse >5j → urgent
  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
  for (const s of submissions.filter(s => s.created_at < fiveDaysAgo)) {
    const matchClient = clients.find(c => c.id === s.client_id);
    const clientName = matchClient
      ? `${matchClient.first_name} ${matchClient.last_name}`
      : 'Client';
    alerts.push({
      id: `submission-${s.id}`,
      severity: 'urgent',
      message: `Bilan sans réponse depuis >5j — ${clientName}`,
      actionLabel: 'Relancer',
      actionHref: `/coach/assessments`,
      clientId: s.client_id ?? undefined,
      clientName,
    });
  }

  // Clients inactifs >14j → urgent
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  for (const c of clients.filter(c => c.status === 'active')) {
    const lastActivity = c.last_activity_at ?? c.created_at;
    if (lastActivity < fourteenDaysAgo) {
      alerts.push({
        id: `inactive-${c.id}`,
        severity: 'urgent',
        message: `Client inactif depuis >14j — ${c.first_name} ${c.last_name}`,
        actionLabel: 'Voir profil',
        actionHref: `/coach/clients/${c.id}`,
        clientId: c.id,
        clientName: `${c.first_name} ${c.last_name}`,
      });
    }
  }

  // Trier : critical d'abord, puis urgent, puis info
  const severityOrder = { critical: 0, urgent: 1, info: 2 };
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  // ── Clients cards (max 8, triés par activité récente) ───────────────────
  const activeClients = clients.filter(c => c.status === 'active');

  // Fetch dernières métriques et historique poids pour les clients actifs
  const clientIds = activeClients.slice(0, 8).map(c => c.id);

  const [metricsRes, subscriptionsByClient] = await Promise.all([
    clientIds.length > 0
      ? db.from('assessment_responses')
          .select('client_id, field_key, value_number, created_at')
          .in('client_id', clientIds)
          .in('field_key', ['weight_kg', 'body_fat_pct'])
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    clientIds.length > 0
      ? db.from('client_subscriptions')
          .select('client_id, status, coach_formulas(name)')
          .in('client_id', clientIds)
          .in('status', ['active', 'trial'])
      : Promise.resolve({ data: [] }),
  ]);

  const metricsData = metricsRes.data ?? [];
  const subsByClient = subscriptionsByClient.data ?? [];

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const fortyFiveDaysAgo = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();

  const dashboardClients: DashboardClient[] = activeClients
    .slice(0, 8)
    .sort((a, b) => {
      const aAct = a.last_activity_at ?? a.created_at;
      const bAct = b.last_activity_at ?? b.created_at;
      return bAct.localeCompare(aAct);
    })
    .map(c => {
      const clientMetrics = metricsData.filter(m => m.client_id === c.id);

      // Derniers poids pour sparkline
      const weightPoints = clientMetrics
        .filter(m => m.field_key === 'weight_kg' && m.value_number != null)
        .slice(0, 10)
        .map(m => ({ date: m.created_at.slice(0, 10), value: m.value_number as number }))
        .reverse();

      // Dernière mesure poids et BF%
      const lastWeight = clientMetrics.find(m => m.field_key === 'weight_kg');
      const lastBf = clientMetrics.find(m => m.field_key === 'body_fat_pct');

      // Delta poids
      const weightValues = weightPoints.map(p => p.value);
      const delta = weightValues.length >= 2
        ? Math.round((weightValues[weightValues.length - 1] - weightValues[0]) * 10) / 10
        : undefined;

      // Statut client
      const lastActivity = c.last_activity_at ?? c.created_at;
      let status: DashboardClient['status'] = 'progressing';
      if (lastActivity < fortyFiveDaysAgo) {
        status = 'inactive';
      } else if (lastActivity < thirtyDaysAgo) {
        status = 'stagnant';
      }

      // Abonnement actif
      const sub = subsByClient.find(s => s.client_id === c.id);
      const formula = sub?.coach_formulas as { name: string } | null;

      return {
        id: c.id,
        firstName: c.first_name,
        lastName: c.last_name,
        status,
        lastActivityDays: Math.floor(
          (Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24)
        ),
        lastMetrics: lastWeight || lastBf
          ? {
              weight: lastWeight?.value_number ?? undefined,
              bodyFatPct: lastBf?.value_number ?? undefined,
              delta,
            }
          : null,
        weightHistory: weightPoints,
        subscription: sub
          ? { formulaName: formula?.name ?? 'Formule', status: sub.status }
          : null,
      };
    });

  const data: DashboardCoachData = {
    hero: {
      coachFirstName,
      activeClients: activeClients.length,
      mrr: Math.round(mrr),
      pendingSubmissions: submissions.length,
      alertCount: alerts.length,
      revenueThisMonth: Math.round(revenueThisMonth),
    },
    alerts: alerts.slice(0, 10),
    clients: dashboardClients,
    financial: {
      mrr: Math.round(mrr),
      revenueThisMonth: Math.round(revenueThisMonth),
      pending: Math.round(pending),
      overdue: Math.round(overdue),
    },
  };

  return NextResponse.json({ success: true, data });
}
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
npx tsc --noEmit
```

Expected : 0 erreurs.

- [ ] **Step 3 : Tester l'endpoint manuellement**

Avec le serveur dev lancé (`npm run dev`), ouvrir dans le navigateur (connecté en tant que coach) :
```
http://localhost:3000/api/dashboard/coach
```
Expected : `{ "success": true, "data": { "hero": {...}, "alerts": [...], "clients": [...], "financial": {...} } }`

- [ ] **Step 4 : Commit**

```bash
git add app/api/dashboard/coach/route.ts components/dashboard/types.ts
git commit -m "feat(dashboard): add /api/dashboard/coach aggregated endpoint"
```

---

## Task 3 : HeroSummary

**Files:**
- Create: `components/dashboard/HeroSummary.tsx`

- [ ] **Step 1 : Créer le composant**

```tsx
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

  const narrative =
    parts.length > 0
      ? parts.join(' · ')
      : 'Tout est à jour — bonne journée.';

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
              <span className="text-white/15 text-[11px] ml-2">|</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
npx tsc --noEmit
```

Expected : 0 erreurs.

- [ ] **Step 3 : Commit**

```bash
git add components/dashboard/HeroSummary.tsx
git commit -m "feat(dashboard): add HeroSummary component"
```

---

## Task 4 : AlertsFeed + QuickActions

**Files:**
- Create: `components/dashboard/AlertsFeed.tsx`
- Create: `components/dashboard/QuickActions.tsx`

- [ ] **Step 1 : Créer AlertsFeed**

```tsx
// components/dashboard/AlertsFeed.tsx
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
```

- [ ] **Step 2 : Créer QuickActions**

```tsx
// components/dashboard/QuickActions.tsx
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

  // Action contextuelle dynamique
  const hasCritical = alerts.some(a => a.severity === 'critical');
  const pendingBilans = alerts.filter(a => a.id.startsWith('submission-')).length;

  let contextualAction: { label: string; href: string } | null = null;
  if (hasCritical) {
    contextualAction = { label: 'Traiter les retards', href: '/coach/comptabilite?filter=overdue' };
  } else if (pendingBilans > 0) {
    contextualAction = { label: `Traiter les bilans (${pendingBilans})`, href: '/coach/assessments?filter=pending' };
  }

  return (
    <div className="mb-8">
      {/* Action contextuelle */}
      {contextualAction && (
        <button
          onClick={() => router.push(contextualAction!.href)}
          className="w-full mb-4 flex items-center justify-between px-4 py-3 rounded-xl bg-[#1f8a65]/10 border-[0.3px] border-[#1f8a65]/20 hover:bg-[#1f8a65]/15 transition-colors active:scale-[0.99]"
        >
          <span className="text-[12px] font-bold text-[#1f8a65] uppercase tracking-[0.12em]">
            {contextualAction.label}
          </span>
          <ChevronRight size={14} className="text-[#1f8a65]" strokeWidth={2} />
        </button>
      )}

      {/* Grille actions fixes */}
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
```

- [ ] **Step 3 : Vérifier TypeScript**

```bash
npx tsc --noEmit
```

Expected : 0 erreurs.

- [ ] **Step 4 : Commit**

```bash
git add components/dashboard/AlertsFeed.tsx components/dashboard/QuickActions.tsx
git commit -m "feat(dashboard): add AlertsFeed and QuickActions components"
```

---

## Task 5 : ClientsSection

**Files:**
- Create: `components/dashboard/ClientsSection.tsx`

- [ ] **Step 1 : Créer le composant**

```tsx
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
  const d = `M ${pts.join(' L ')}`;

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
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
npx tsc --noEmit
```

Expected : 0 erreurs.

- [ ] **Step 3 : Commit**

```bash
git add components/dashboard/ClientsSection.tsx
git commit -m "feat(dashboard): add ClientsSection with segmentation and sparklines"
```

---

## Task 6 : FinancialStrip

**Files:**
- Create: `components/dashboard/FinancialStrip.tsx`

- [ ] **Step 1 : Créer le composant**

```tsx
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
            <p className={`text-2xl font-black tracking-tight ${alert ? 'text-red-400' : 'text-white'}`}>
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
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
npx tsc --noEmit
```

Expected : 0 erreurs.

- [ ] **Step 3 : Commit**

```bash
git add components/dashboard/FinancialStrip.tsx
git commit -m "feat(dashboard): add FinancialStrip component"
```

---

## Task 7 : Page dashboard — orchestrateur final

**Files:**
- Modify: `app/dashboard/page.tsx` (remplacement intégral)

- [ ] **Step 1 : Remplacer app/dashboard/page.tsx**

```tsx
// app/dashboard/page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { useSetTopBar } from '@/components/layout/useSetTopBar';
import { Skeleton } from '@/components/ui/skeleton';
import { UserPlus } from 'lucide-react';

import HeroSummary from '@/components/dashboard/HeroSummary';
import AlertsFeed from '@/components/dashboard/AlertsFeed';
import QuickActions from '@/components/dashboard/QuickActions';
import ClientsSection from '@/components/dashboard/ClientsSection';
import FinancialStrip from '@/components/dashboard/FinancialStrip';
import type { DashboardCoachData } from '@/components/dashboard/types';

function DashboardSkeleton() {
  return (
    <div className="p-6 max-w-[900px] mx-auto space-y-6">
      {/* Hero */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-80" />
        <div className="flex gap-6">
          {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-8 w-16" />)}
        </div>
      </div>
      {/* Alertes */}
      <div className="space-y-1.5">
        {[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full rounded-xl" />)}
      </div>
      {/* Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}
      </div>
      {/* Clients */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
      </div>
      {/* Financier */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardCoachData | null>(null);
  const [loading, setLoading] = useState(true);
  const [noClients, setNoClients] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/'); return; }

      fetch('/api/dashboard/coach')
        .then(r => r.json())
        .then(json => {
          if (json.success && json.data) {
            setData(json.data);
            setNoClients(json.data.hero.activeClients === 0);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    });
  }, [router]);

  const topBarLeft = useMemo(
    () => (
      <div className="flex flex-col leading-tight">
        <p className="text-[11px] font-medium text-white/35 uppercase tracking-[0.14em]">
          Espace Coach
        </p>
        <p className="text-[13px] font-semibold text-white/80">
          Dashboard
        </p>
      </div>
    ),
    [],
  );

  useSetTopBar(topBarLeft);

  if (loading) return <DashboardSkeleton />;

  return (
    <main className="bg-[#121212] min-h-screen">
      <div className="p-6 max-w-[900px] mx-auto">

        {/* Onboarding banner — si aucun client */}
        {noClients && (
          <div className="mb-8 rounded-2xl bg-white/[0.02] border-[0.3px] border-white/[0.06] p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-[9px] font-bold text-white/30 uppercase tracking-[0.18em] mb-1.5">
                Bienvenue dans l&apos;Espace Coach
              </p>
              <h3 className="text-white text-xl font-bold tracking-tight">
                Tu viens d&apos;entrer dans la{' '}
                <span className="text-[#1f8a65]">nouvelle ère</span> du coaching.
              </h3>
              <p className="text-white/45 text-[13px] mt-1 leading-relaxed">
                Commence par créer ton premier client pour démarrer le suivi.
              </p>
            </div>
            <button
              onClick={() => router.push('/coach/clients')}
              className="flex-shrink-0 flex items-center gap-2 px-5 py-3 bg-[#1f8a65] text-white rounded-xl font-bold text-[13px] hover:bg-[#217356] transition-colors active:scale-[0.98]"
            >
              <UserPlus size={15} />
              Créer un client
            </button>
          </div>
        )}

        {data && (
          <>
            <HeroSummary hero={data.hero} />
            <AlertsFeed alerts={data.alerts} />
            <QuickActions alerts={data.alerts} />
            <ClientsSection clients={data.clients} />
            <FinancialStrip financial={data.financial} />
          </>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
npx tsc --noEmit
```

Expected : 0 erreurs.

- [ ] **Step 3 : Tester visuellement**

Lancer le serveur dev :
```bash
npm run dev
```
Ouvrir `http://localhost:3000/dashboard` connecté en tant que coach.

Vérifier :
- [ ] Hero affiche le prénom du coach + stats command bar
- [ ] Alertes s'affichent si paiements overdue ou bilans en attente
- [ ] Actions contextuelles apparaissent si alertes critiques
- [ ] Grille clients avec badges de statut et sparklines
- [ ] Section financière avec 4 cards
- [ ] Skeleton DS v2.0 visible pendant le chargement
- [ ] Fond `bg-[#121212]` — pas de fond intermédiaire

- [ ] **Step 4 : Mettre à jour CHANGELOG.md**

Ajouter en tête de la section `## 2026-04-12` :
```
FEATURE: Superpower Coach Dashboard — hero summary, alertes priorisées, clients segmentés, financier condensé
```

- [ ] **Step 5 : Commit final**

```bash
git add app/dashboard/page.tsx CHANGELOG.md
git commit -m "feat(dashboard): wire superpower dashboard page with all sections"
```
