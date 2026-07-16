import type { SupabaseClient } from '@supabase/supabase-js'

export type SalesLeadStatus = 'new' | 'contacted' | 'qualified' | 'demo_scheduled' | 'trialing' | 'active' | 'lost' | 'archived'

const ACTIVE_PIPELINE_STATUSES: SalesLeadStatus[] = ['new', 'contacted', 'qualified', 'demo_scheduled', 'trialing']

export async function getSalesDashboardData(db: SupabaseClient, partnerId: string) {
  const now = new Date()
  const [leadsResult, activitiesResult, commissionsResult] = await Promise.all([
    db
      .from('sales_leads')
      .select('id, contact_name, email, company_name, status, next_follow_up_at, demo_scheduled_at, created_at')
      .or(`sales_partner_id.eq.${partnerId},closing_partner_id.eq.${partnerId}`)
      .order('created_at', { ascending: false }),
    db
      .from('sales_activities')
      .select('id, title, kind, due_at, completed_at, lead_id')
      .eq('sales_partner_id', partnerId)
      .is('completed_at', null)
      .order('due_at', { ascending: true, nullsFirst: false })
      .limit(8),
    db
      .from('sales_commissions')
      .select('id, amount_eur, status, description, eligible_at, paid_at, created_at')
      .eq('sales_partner_id', partnerId)
      .order('created_at', { ascending: false })
      .limit(8),
  ])

  if (leadsResult.error) throw leadsResult.error
  if (activitiesResult.error) throw activitiesResult.error
  if (commissionsResult.error) throw commissionsResult.error

  const leads = leadsResult.data ?? []
  const commissions = commissionsResult.data ?? []
  const byStatus = Object.fromEntries(
    (['new', 'contacted', 'qualified', 'demo_scheduled', 'trialing', 'active', 'lost'] as SalesLeadStatus[]).map((status) => [
      status,
      leads.filter((lead) => lead.status === status).length,
    ]),
  ) as Record<SalesLeadStatus, number>

  const pendingCommissions = commissions
    .filter((commission) => commission.status === 'pending' || commission.status === 'approved')
    .reduce((total, commission) => total + Number(commission.amount_eur), 0)
  const paidCommissions = commissions
    .filter((commission) => commission.status === 'paid')
    .reduce((total, commission) => total + Number(commission.amount_eur), 0)

  return {
    generatedAt: now.toISOString(),
    kpis: {
      openPipeline: leads.filter((lead) => ACTIVE_PIPELINE_STATUSES.includes(lead.status as SalesLeadStatus)).length,
      demosScheduled: byStatus.demo_scheduled,
      coachesInTrial: byStatus.trialing,
      activeCoaches: byStatus.active,
      pendingCommissions,
      paidCommissions,
    },
    pipeline: byStatus,
    upcomingTasks: activitiesResult.data ?? [],
    recentLeads: leads.slice(0, 6),
    recentCommissions: commissions,
  }
}
