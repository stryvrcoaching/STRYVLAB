import type { SupabaseClient } from '@supabase/supabase-js'
import { sendSalesPartnerPush } from './push-notification'

type CoachPlan = 'solo' | 'pro' | 'studio'
type CommissionKind = 'referral' | 'closing_bonus'

const PLAN_MONTHLY_PRICE_EUR: Record<CoachPlan, number> = {
  solo: 29,
  pro: 79,
  studio: 129,
}

type CommissionRule = {
  coach_plan: CoachPlan
  referral_amount_eur: number
  full_sale_total_amount_eur: number
}

type SalesLead = {
  id: string
  sales_partner_id: string
  closing_partner_id: string | null
  coach_id: string | null
}

function isCoachPlan(value: string | null | undefined): value is CoachPlan {
  return value === 'solo' || value === 'pro' || value === 'studio'
}

export async function registerPaidCoachInvoice(
  db: SupabaseClient,
  input: {
    invoiceId: string
    subscriptionId: string | null
    coachId: string | null
    coachEmail: string | null
    plan: string | null | undefined
    amountPaidEur: number
    paidAt: string
  },
) {
  if (
    !input.subscriptionId
    || !input.coachId
    || !input.coachEmail
    || !isCoachPlan(input.plan)
    || input.amountPaidEur <= 0
  ) return

  const normalizedEmail = input.coachEmail.trim().toLowerCase()
  if (!normalizedEmail) return

  const linkedLead = await findOrLinkLead(db, {
    coachId: input.coachId,
    normalizedEmail,
  })
  if (!linkedLead) return

  const { data: rule, error: ruleError } = await db
    .from('sales_commission_rules')
    .select('coach_plan, referral_amount_eur, full_sale_total_amount_eur')
    .eq('coach_plan', input.plan)
    .eq('is_active', true)
    .maybeSingle()

  if (ruleError || !rule) {
    if (ruleError) console.error('[sales/commission] rule lookup failed', ruleError)
    return
  }

  const multiplier = Math.min(1, input.amountPaidEur / PLAN_MONTHLY_PRICE_EUR[input.plan])
  const referralAmount = roundCurrency(Number((rule as CommissionRule).referral_amount_eur) * multiplier)

  const { data: existingReferral, error: referralError } = await db
    .from('sales_commissions')
    .select('id')
    .eq('lead_id', linkedLead.id)
    .eq('commission_kind', 'referral')
    .maybeSingle()

  if (referralError) throw referralError

  if (!existingReferral) {
    await createCommission(db, {
      partnerId: linkedLead.sales_partner_id,
      leadId: linkedLead.id,
      coachId: input.coachId,
      plan: input.plan,
      kind: 'referral',
      amount: referralAmount,
      invoiceId: input.invoiceId,
      eligibleAt: input.paidAt,
      description: `Apport validé — ${labelForPlan(input.plan)}`,
    })
    return
  }

  if (!linkedLead.closing_partner_id) return

  const bonus = roundCurrency(
    (Number((rule as CommissionRule).full_sale_total_amount_eur) - Number((rule as CommissionRule).referral_amount_eur)) * multiplier,
  )
  if (bonus <= 0) return

  await createCommission(db, {
    partnerId: linkedLead.closing_partner_id,
    leadId: linkedLead.id,
    coachId: input.coachId,
    plan: input.plan,
    kind: 'closing_bonus',
    amount: bonus,
    invoiceId: input.invoiceId,
    eligibleAt: input.paidAt,
    description: `Bonus vente complète — ${labelForPlan(input.plan)}`,
  })
}

async function findOrLinkLead(
  db: SupabaseClient,
  input: { coachId: string; normalizedEmail: string },
): Promise<SalesLead | null> {
  const byCoach = await db
    .from('sales_leads')
    .select('id, sales_partner_id, closing_partner_id, coach_id')
    .eq('coach_id', input.coachId)
    .maybeSingle()

  if (byCoach.error) throw byCoach.error
  if (byCoach.data) return byCoach.data as SalesLead

  const byEmail = await db
    .from('sales_leads')
    .select('id, sales_partner_id, closing_partner_id, coach_id')
    .eq('normalized_email', input.normalizedEmail)
    .is('coach_id', null)
    .neq('status', 'lost')
    .neq('status', 'archived')
    .maybeSingle()

  if (byEmail.error) throw byEmail.error
  if (!byEmail.data) return null

  const { data, error } = await db
    .from('sales_leads')
    .update({
      coach_id: input.coachId,
      status: 'active',
      converted_at: new Date().toISOString(),
    })
    .eq('id', byEmail.data.id)
    .is('coach_id', null)
    .select('id, sales_partner_id, closing_partner_id, coach_id')
    .maybeSingle()

  if (error) throw error
  return (data as SalesLead | null) ?? null
}

async function createCommission(
  db: SupabaseClient,
  input: {
    partnerId: string
    leadId: string
    coachId: string
    plan: CoachPlan
    kind: CommissionKind
    amount: number
    invoiceId: string
    eligibleAt: string
    description: string
  },
) {
  const { error } = await db
    .from('sales_commissions')
    .insert({
      sales_partner_id: input.partnerId,
      lead_id: input.leadId,
      coach_id: input.coachId,
      coach_plan: input.plan,
      commission_kind: input.kind,
      amount_eur: input.amount,
      status: 'approved',
      description: input.description,
      source_invoice_id: input.invoiceId,
      eligible_at: input.eligibleAt,
      approved_at: input.eligibleAt,
    })

  if (error?.code === '23505') return
  if (error) throw error

  // Notify partner of the new commission
  void sendSalesPartnerPush(db, input.partnerId, {
    title: input.kind === 'referral' ? 'Nouvelle commission d\'apport ! 💸' : 'Bonus de closing validé ! 💰',
    body: `${input.description} : ${input.amount} € ont été enregistrés sur votre compte.`,
    url: '/sales/commissions',
  }).catch((err) => console.error('[sales-push] failed to send commission notif', err))
}

function labelForPlan(plan: CoachPlan) {
  return plan[0].toUpperCase() + plan.slice(1)
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100
}
