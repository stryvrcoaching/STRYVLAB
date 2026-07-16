import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireInternalDashboardAccess } from '@/lib/dashboard/internal-access'
import { sendSalesPartnerInvitationEmail } from '@/lib/email/mailer'
import { createDashboardServiceClient } from '@/lib/dashboard/service'
import { sendSalesPartnerPush } from '@/lib/sales/push-notification'
import { stripe } from '@/lib/stripe/client'

const inviteSchema = z.object({
  action: z.literal('invite'),
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
})

const statusSchema = z.object({
  action: z.literal('set_status'),
  partnerId: z.string().uuid(),
  status: z.enum(['active', 'suspended']),
})

const closerSchema = z.object({
  action: z.literal('assign_closer'),
  leadId: z.string().uuid(),
  closingPartnerId: z.string().uuid().nullable(),
})

const resendActivationSchema = z.object({
  action: z.literal('resend_activation'),
  partnerId: z.string().uuid(),
})

const linkCoachSchema = z.object({
  action: z.literal('link_coach'),
  leadId: z.string().uuid(),
  coachId: z.string().uuid().nullable(),
})

const markPaidSchema = z.object({
  action: z.literal('mark_paid'),
  commissionId: z.string().uuid(),
  status: z.enum(['approved', 'paid']),
})

const deletePartnerSchema = z.object({
  partnerId: z.string().uuid(),
})

const updateSchema = z.discriminatedUnion('action', [
  statusSchema,
  closerSchema,
  resendActivationSchema,
  linkCoachSchema,
  markPaidSchema,
])

export const dynamic = 'force-dynamic'

function createConnectActivationUrl(siteUrl: string, actionLink: string) {
  return `${siteUrl}/sales/activate/continue?target=${encodeURIComponent(actionLink)}`
}

async function findAuthUserByEmail(
  db: ReturnType<typeof createDashboardServiceClient>,
  email: string,
) {
  const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) throw error

  return data.users.find((user) => user.email?.toLowerCase() === email) ?? null
}

export async function GET(req: NextRequest) {
  const access = await requireInternalDashboardAccess(req, 'sales-partners')
  if ('error' in access) return access.error

  try {
    const [partnersResult, leadsResult, commissionsResult, authUsersResult, coachesResult] = await Promise.all([
      access.db
        .from('sales_partners')
        .select('id, user_id, full_name, email, status, created_at')
        .order('created_at', { ascending: false }),
      access.db
        .from('sales_leads')
        .select('id, contact_name, email, company_name, status, sales_partner_id, closing_partner_id, next_follow_up_at, created_at, coach_id')
        .order('created_at', { ascending: false })
        .limit(100),
      access.db
        .from('sales_commissions')
        .select('id, sales_partner_id, lead_id, coach_id, coach_plan, commission_kind, amount_eur, status, description, created_at, paid_at')
        .order('created_at', { ascending: false }),
      access.db.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      access.db
        .from('coach_profiles')
        .select('coach_id, full_name, pro_email')
        .order('full_name', { ascending: true }),
    ])

    if (partnersResult.error) throw partnersResult.error
    if (leadsResult.error) throw leadsResult.error
    if (commissionsResult.error) throw commissionsResult.error
    if (authUsersResult.error) throw authUsersResult.error
    if (coachesResult.error) throw coachesResult.error

    const leads = leadsResult.data ?? []
    const rawCommissions = commissionsResult.data ?? []
    const authUsersById = new Map((authUsersResult.data.users ?? []).map((user) => [user.id, user]))
    const partners = (partnersResult.data ?? []).map((partner) => ({
      id: partner.id,
      fullName: partner.full_name,
      email: partner.email,
      status: partner.status,
      createdAt: partner.created_at,
      introducedLeads: leads.filter((lead) => lead.sales_partner_id === partner.id).length,
      closingAssignments: leads.filter((lead) => lead.closing_partner_id === partner.id).length,
      pendingCommission: rawCommissions
        .filter((commission) => commission.sales_partner_id === partner.id && ['pending', 'approved'].includes(commission.status))
        .reduce((total, commission) => total + Number(commission.amount_eur), 0),
      paidCommission: rawCommissions
        .filter((commission) => commission.sales_partner_id === partner.id && commission.status === 'paid')
        .reduce((total, commission) => total + Number(commission.amount_eur), 0),
      needsActivation: !authUsersById.get(partner.user_id)?.last_sign_in_at,
    }))

    return NextResponse.json({
      partners,
      leads: leads.map((lead) => ({
        id: lead.id,
        contactName: lead.contact_name,
        email: lead.email,
        companyName: lead.company_name,
        status: lead.status,
        introducerId: lead.sales_partner_id,
        closingPartnerId: lead.closing_partner_id,
        nextFollowUpAt: lead.next_follow_up_at,
        createdAt: lead.created_at,
        coachId: lead.coach_id,
      })),
      commissions: rawCommissions,
      coaches: coachesResult.data ?? [],
      summary: {
        activePartners: partners.filter((partner) => partner.status === 'active').length,
        openLeads: leads.filter((lead) => !['active', 'lost', 'archived'].includes(lead.status)).length,
        trialingLeads: leads.filter((lead) => lead.status === 'trialing').length,
        activeCoaches: leads.filter((lead) => lead.status === 'active').length,
      },
    })
  } catch (error) {
    console.error('[dashboard/sales-partners] read failed', error)
    return NextResponse.json({ error: 'Chargement commercial impossible' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const access = await requireInternalDashboardAccess(req, 'sales-partners')
  if ('error' in access) return access.error

  const parsed = inviteSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'Invitation invalide' }, { status: 400 })

  const email = parsed.data.email.toLowerCase()
  const existing = await access.db
    .from('sales_partners')
    .select('id')
    .ilike('email', email)
    .maybeSingle()

  if (existing.error) return NextResponse.json({ error: 'Vérification impossible' }, { status: 500 })
  if (existing.data) return NextResponse.json({ error: 'Ce partenaire commercial existe déjà.' }, { status: 409 })

  let userId: string
  let mode: 'existing_account' | 'invitation_sent'
  let activationUrl: string | null = null

  try {
    const existingUser = await findAuthUserByEmail(access.db, email)

    if (existingUser) {
      userId = existingUser.id
      mode = 'existing_account'
    } else {
      const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '')
      const { data: invitation, error: invitationError } = await access.db.auth.admin.generateLink({
        type: 'invite',
        email,
        options: {
          redirectTo: `${siteUrl}/auth/confirm?next=${encodeURIComponent('/sales/activate')}`,
          data: { full_name: parsed.data.fullName, workspace: 'stryv_connect' },
        },
      })

      if (invitationError || !invitation.user || !invitation.properties.action_link) {
        throw invitationError ?? new Error('Invitation impossible')
      }

      userId = invitation.user.id
      mode = 'invitation_sent'
      activationUrl = createConnectActivationUrl(siteUrl, invitation.properties.action_link)
    }
  } catch (error) {
    console.error('[dashboard/sales-partners] user lookup or invitation failed', error)
    return NextResponse.json({ error: 'Impossible de préparer l’accès STRYV Connect.' }, { status: 422 })
  }

  const { data: partner, error: partnerError } = await access.db
    .from('sales_partners')
    .insert({
      user_id: userId,
      full_name: parsed.data.fullName,
      email,
    })
    .select('id, full_name, email, status, created_at')
    .single()

  if (partnerError) {
    if (mode === 'invitation_sent') await access.db.auth.admin.deleteUser(userId)
    console.error('[dashboard/sales-partners] partner creation failed', partnerError)
    return NextResponse.json({ error: 'Création de l’accès STRYV Connect impossible.' }, { status: 500 })
  }

  if (mode === 'invitation_sent' && activationUrl) {
    try {
      await sendSalesPartnerInvitationEmail({
        to: email,
        partnerName: parsed.data.fullName,
        activationUrl,
      })
    } catch (error) {
      console.error('[dashboard/sales-partners] invitation email failed', error)
      await access.db.from('sales_partners').delete().eq('id', partner.id)
      await access.db.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: 'L’e-mail STRYV Connect n’a pas pu être envoyé. Aucun accès n’a été créé.' }, { status: 500 })
    }
  }

  return NextResponse.json({
    partner: {
      id: partner.id,
      fullName: partner.full_name,
      email: partner.email,
      status: partner.status,
      createdAt: partner.created_at,
      introducedLeads: 0,
      closingAssignments: 0,
      pendingCommission: 0,
      paidCommission: 0,
      needsActivation: mode === 'invitation_sent',
    },
    mode,
  }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const access = await requireInternalDashboardAccess(req, 'sales-partners')
  if ('error' in access) return access.error

  const parsed = updateSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'Mise à jour invalide' }, { status: 400 })

  if (parsed.data.action === 'set_status') {
    const { data, error } = await access.db
      .from('sales_partners')
      .update({ status: parsed.data.status })
      .eq('id', parsed.data.partnerId)
      .select('id, full_name, email, status, created_at')
      .maybeSingle()

    if (error) return NextResponse.json({ error: 'Mise à jour impossible' }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Partenaire introuvable' }, { status: 404 })
    return NextResponse.json({ partner: data })
  }

  if (parsed.data.action === 'resend_activation') {
    const { data: partner, error: partnerError } = await access.db
      .from('sales_partners')
      .select('id, user_id, full_name, email, status')
      .eq('id', parsed.data.partnerId)
      .maybeSingle()

    if (partnerError) return NextResponse.json({ error: 'Vérification impossible' }, { status: 500 })
    if (!partner) return NextResponse.json({ error: 'Partenaire introuvable' }, { status: 404 })
    if (partner.status !== 'active') return NextResponse.json({ error: 'Réactivez d’abord ce partenaire avant de renvoyer son accès.' }, { status: 422 })

    const { data: authUserData, error: authUserError } = await access.db.auth.admin.getUserById(partner.user_id)
    if (authUserError || !authUserData.user) return NextResponse.json({ error: 'Compte STRYV introuvable.' }, { status: 404 })
    if (authUserData.user.last_sign_in_at) return NextResponse.json({ error: 'Ce partenaire a déjà activé son accès.' }, { status: 409 })

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '')
    const { data: linkData, error: linkError } = await access.db.auth.admin.generateLink({
      type: 'recovery',
      email: partner.email,
      options: { redirectTo: `${siteUrl}/sales/activate` },
    })

    if (linkError || !linkData?.properties.action_link) {
      console.error('[dashboard/sales-partners] activation link failed', linkError)
      return NextResponse.json({ error: 'Impossible de générer un nouveau lien d’activation.' }, { status: 500 })
    }

    try {
      await sendSalesPartnerInvitationEmail({
        to: partner.email,
        partnerName: partner.full_name,
        activationUrl: createConnectActivationUrl(siteUrl, linkData.properties.action_link),
      })
    } catch (error) {
      console.error('[dashboard/sales-partners] activation resend failed', error)
      return NextResponse.json({ error: 'L’e-mail STRYV Connect n’a pas pu être envoyé.' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  }

  if (parsed.data.action === 'link_coach') {
    const { error } = await access.db
      .from('sales_leads')
      .update({
        coach_id: parsed.data.coachId || null,
        status: parsed.data.coachId ? 'active' : 'open',
        converted_at: parsed.data.coachId ? new Date().toISOString() : null,
      })
      .eq('id', parsed.data.leadId)

    if (error) {
      console.error('[dashboard/sales-partners] link_coach failed:', error)
      return NextResponse.json({ error: 'Liaison impossible' }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  }

  if (parsed.data.action === 'mark_paid') {
    // 1. Fetch commission and partner info
    const { data: commission, error: fetchErr } = await access.db
      .from('sales_commissions')
      .select('amount_eur, description, sales_partners (id, stripe_account_id, stripe_account_status)')
      .eq('id', parsed.data.commissionId)
      .maybeSingle()

    if (fetchErr || !commission) {
      console.error('[dashboard/sales-partners] fetch commission failed:', fetchErr)
      return NextResponse.json({ error: 'Commission introuvable' }, { status: 404 })
    }

    const partner = commission.sales_partners as any

    // 2. Trigger Stripe Connect Transfer if partner has linked ready account
    if (parsed.data.status === 'paid' && partner && partner.stripe_account_id && partner.stripe_account_status === 'ready') {
      try {
        await stripe.transfers.create({
          amount: Math.round(Number(commission.amount_eur) * 100), // cents
          currency: 'eur',
          destination: partner.stripe_account_id,
          description: commission.description,
        })
      } catch (stripeError) {
        console.error('[dashboard/sales-partners] Stripe transfer failed:', stripeError)
        return NextResponse.json({
          error: `Le virement Stripe automatique a échoué : ${stripeError instanceof Error ? stripeError.message : 'erreur inconnue'}. Le statut de la commission n'a pas été modifié.`
        }, { status: 422 })
      }
    }

    // 3. Update commission status
    const { error: updateErr } = await access.db
      .from('sales_commissions')
      .update({
        status: parsed.data.status,
        paid_at: parsed.data.status === 'paid' ? new Date().toISOString() : null,
      })
      .eq('id', parsed.data.commissionId)

    if (updateErr) {
      console.error('[dashboard/sales-partners] mark_paid update failed:', updateErr)
      return NextResponse.json({ error: 'Mise à jour de la commission impossible' }, { status: 500 })
    }

    // 4. Notify partner of payout
    if (parsed.data.status === 'paid') {
      try {
        await sendSalesPartnerPush(access.db, partner.id, {
          title: 'Versement effectué ! 💳',
          body: `Votre commission de ${commission.amount_eur} € (${commission.description}) a été marquée comme versée.`,
          url: '/sales/commissions',
        })
      } catch (pushErr) {
        console.error('[dashboard/sales-partners] mark_paid push failed:', pushErr)
      }
    }

    return NextResponse.json({ success: true })
  }

  if (parsed.data.closingPartnerId) {
    const { data: partner, error: partnerError } = await access.db
      .from('sales_partners')
      .select('id')
      .eq('id', parsed.data.closingPartnerId)
      .eq('status', 'active')
      .maybeSingle()

    if (partnerError) return NextResponse.json({ error: 'Vérification impossible' }, { status: 500 })
    if (!partner) return NextResponse.json({ error: 'Le closer doit être un partenaire commercial actif.' }, { status: 422 })
  }

  const { data, error } = await access.db
    .from('sales_leads')
    .update({ closing_partner_id: parsed.data.closingPartnerId })
    .eq('id', parsed.data.leadId)
    .select('id, closing_partner_id')
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'Attribution impossible' }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Prospect introuvable' }, { status: 404 })
  return NextResponse.json({ lead: { id: data.id, closingPartnerId: data.closing_partner_id } })
}

export async function DELETE(req: NextRequest) {
  const access = await requireInternalDashboardAccess(req, 'sales-partners')
  if ('error' in access) return access.error

  const parsed = deletePartnerSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Suppression invalide' }, { status: 400 })

  const partnerId = parsed.data.partnerId
  const { data: partner, error: partnerError } = await access.db
    .from('sales_partners')
    .select('id, full_name')
    .eq('id', partnerId)
    .maybeSingle()

  if (partnerError) return NextResponse.json({ error: 'Vérification impossible' }, { status: 500 })
  if (!partner) return NextResponse.json({ error: 'Partenaire introuvable' }, { status: 404 })

  const [leadsResult, activitiesResult, commissionsResult] = await Promise.all([
    access.db
      .from('sales_leads')
      .select('id', { count: 'exact', head: true })
      .or(`sales_partner_id.eq.${partnerId},closing_partner_id.eq.${partnerId}`),
    access.db
      .from('sales_activities')
      .select('id', { count: 'exact', head: true })
      .eq('sales_partner_id', partnerId),
    access.db
      .from('sales_commissions')
      .select('id', { count: 'exact', head: true })
      .eq('sales_partner_id', partnerId),
  ])

  if (leadsResult.error || activitiesResult.error || commissionsResult.error) {
    return NextResponse.json({ error: 'Vérification de l’historique impossible' }, { status: 500 })
  }

  const linkedRecords = (leadsResult.count ?? 0) + (activitiesResult.count ?? 0) + (commissionsResult.count ?? 0)
  if (linkedRecords > 0) {
    return NextResponse.json({
      error: 'Ce partenaire possède déjà un historique commercial. Suspendez son accès pour conserver les prospects et commissions.',
      dependencies: {
        leads: leadsResult.count ?? 0,
        activities: activitiesResult.count ?? 0,
        commissions: commissionsResult.count ?? 0,
      },
    }, { status: 409 })
  }

  const { error: deleteError } = await access.db
    .from('sales_partners')
    .delete()
    .eq('id', partnerId)

  if (deleteError) {
    console.error('[dashboard/sales-partners] delete failed', deleteError)
    return NextResponse.json({ error: 'Suppression impossible' }, { status: 500 })
  }

  return NextResponse.json({ deletedPartnerId: partnerId, deletedPartnerName: partner.full_name })
}
