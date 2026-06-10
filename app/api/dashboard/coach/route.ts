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
      .select('id, first_name, last_name, status, created_at')
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
    const formula = sub.coach_formulas as unknown as { price_eur: number; billing_cycle: string } | null;
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

  // Paiements en retard → critique
  for (const p of payments.filter(p => p.status === 'overdue')) {
    const client = p.coach_clients as unknown as { first_name: string; last_name: string } | null;
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
    const client = sub.coach_clients as unknown as { first_name: string; last_name: string } | null;
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
    const lastActivity = c.created_at;
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
  const sortedActiveClients = [...activeClients].sort((a, b) => {
    const aAct = a.last_activity_at ?? a.created_at;
    const bAct = b.last_activity_at ?? b.created_at;
    return bAct.localeCompare(aAct);
  });
  const clientIds = sortedActiveClients.slice(0, 8).map(c => c.id);

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

  const dashboardClients: DashboardClient[] = sortedActiveClients
    .slice(0, 8)
    .map(c => {
      const clientMetrics = metricsData.filter(m => m.client_id === c.id);

      const weightPoints = clientMetrics
        .filter(m => m.field_key === 'weight_kg' && m.value_number != null)
        .slice(0, 10)
        .map(m => ({ date: m.created_at.slice(0, 10), value: m.value_number as number }))
        .reverse();

      const lastWeight = clientMetrics.find(m => m.field_key === 'weight_kg');
      const lastBf = clientMetrics.find(m => m.field_key === 'body_fat_pct');

      const weightValues = weightPoints.map(p => p.value);
      const delta = weightValues.length >= 2
        ? Math.round((weightValues[weightValues.length - 1] - weightValues[0]) * 10) / 10
        : undefined;

      const lastActivity = c.created_at;
      let status: DashboardClient['status'] = 'progressing';
      if (lastActivity < fortyFiveDaysAgo) {
        status = 'inactive';
      } else if (lastActivity < thirtyDaysAgo) {
        status = 'stagnant';
      }

      const sub = subsByClient.find(s => s.client_id === c.id);
      const formula = sub?.coach_formulas as unknown as { name: string } | null;

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
