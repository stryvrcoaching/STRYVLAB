import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { z } from 'zod'
import {
  isCoachInboxNotificationEnabled,
  type CoachInboxPreferences,
} from '@/lib/notifications/coach-inbox-preferences'

export const dynamic = 'force-dynamic'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const bulkPatchSchema = z.object({
  ids: z.array(z.string()).optional(),
  clientId: z.string().uuid().optional(),
  markAll: z.boolean().optional(),
})

const COACH_NOTIFICATION_CATEGORIES = [
  'assessment',
  'training',
  'nutrition_trend',
  'engagement',
  'weight_off_track',
  'program_signal',
  'recovery_flag',
  'admin',
  'safety',
  'out_of_scope',
  'pattern_inquiry',
] as const
const SHARED_COACH_NOTIFICATION_TYPES = ['tdee_coach_alert', 'client_reaction'] as const
const LEGACY_COACH_NOTIFICATION_TYPES = ['session_reminder', 'assessment_completed', 'payment_received'] as const

function buildClientName(row: any) {
  const firstName = String(row?.first_name ?? '').trim()
  const lastName = String(row?.last_name ?? '').trim()
  return [firstName, lastName].filter(Boolean).join(' ') || 'Client'
}

function toSentenceCase(value: string) {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function normalizeNotificationFrench(value: string | null | undefined) {
  if (!value) return value ?? null

  return value
    .replace(/\bTDE\b/g, 'TDEE')
    .replace(/\brecalcule\b/gi, 'recalculé')
    .replace(/\breaction\b/gi, 'réaction')
    .replace(/\breference\b/gi, 'référence')
    .replace(/\ba confirmer\b/gi, 'à confirmer')
    .replace(/\bConfirmez l'application\b/g, 'Confirmez l’application')
    .replace(/\bNouveau TDEE : ([0-9]+) kcal \(([-+0-9]+) vs référence\)\./g, 'Nouveau TDEE : $1 kcal ($2 vs référence).')
}

function isGenericNotificationCopy(value: string | null | undefined) {
  if (!value) return true

  const normalized = value.trim().toLowerCase()
  return [
    'alerte nutrition à vérifier',
    'un signal nutrition a été détecté sur plusieurs jours. ouvrez nutrition pour voir l\'origine exacte.',
    'un signal nutrition a été détecté chez',
    'notification coach',
    'notification',
    'nouvelle alerte coach',
    'le client a validé un repas prévu dans son planning nutritionnel.',
  ].some((snippet) => normalized.includes(snippet))
}

function formatMetricLabel(value: string) {
  return value
    .replace(/(\d)\.(\d)/g, '$1,$2')
    .replace(/\bbpm\b/g, 'BPM')
}

function formatMacroValue(value: unknown) {
  if (typeof value !== 'number' || Number.isNaN(value)) return null
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value)
}

function getMealTypeLabel(mealType: unknown) {
  switch (mealType) {
    case 'breakfast':
      return 'petit-déjeuner'
    case 'lunch':
      return 'déjeuner'
    case 'dinner':
      return 'dîner'
    case 'snack':
      return 'collation'
    default:
      return 'repas'
  }
}

function buildCoachNotificationPresentation(row: any) {
  const clientName = buildClientName(row.coach_clients)
  const chatExcerpt = row.chat_messages?.content ? String(row.chat_messages.content).slice(0, 200) : null
  const payload = (row.payload ?? null) as Record<string, unknown> | null
  const subcategory = String(row.subcategory ?? '')
  const sessionName = typeof payload?.program_session_name === 'string' ? payload.program_session_name : null
  const scheduledDate = typeof payload?.scheduled_date === 'string' ? payload.scheduled_date : null
  const reasonLabel = typeof payload?.reason_label === 'string' ? payload.reason_label : null
  const note = typeof payload?.note === 'string' ? payload.note : null
  const smoothableDelta = typeof payload?.smoothable_delta_kcal === 'number' ? Math.abs(payload.smoothable_delta_kcal) : null
  const durationDays = typeof payload?.duration_days === 'number' ? payload.duration_days : null
  const smoothingDirection = typeof payload?.direction === 'string' ? payload.direction : null
  const prepTitle = typeof payload?.prep_title === 'string' ? payload.prep_title.trim() : ''
  const prepCalories = typeof payload?.total_calories === 'number' ? payload.total_calories : null
  const prepProtein = formatMacroValue(payload?.total_protein_g)
  const prepCarbs = formatMacroValue(payload?.total_carbs_g)
  const prepFat = formatMacroValue(payload?.total_fat_g)
  const checkinMetrics = Array.isArray(payload?.metrics)
    ? payload.metrics.filter((item): item is string => typeof item === 'string').map(formatMetricLabel)
    : []

  const config = (() => {
    if (['safety', 'out_of_scope', 'pattern_inquiry'].includes(row.category)) {
      const criticalTitleMap: Record<string, string> = {
        safety: 'Alerte sécurité à traiter',
        out_of_scope: 'Intervention coach requise',
        pattern_inquiry: 'Question client à examiner',
      }
      return {
        category: 'critical',
        categoryLabel: 'À traiter',
        title: row.title ?? criticalTitleMap[row.category] ?? 'Alerte à traiter',
        body: row.body ?? chatExcerpt ?? `${clientName} requiert votre attention.`,
      }
    }

    if (row.category === 'engagement' && subcategory === 'coach_message_reply') {
      return {
        category: 'feedback',
        categoryLabel: 'Message client',
        title: 'Réponse du client',
        body: chatExcerpt ?? `${clientName} a répondu à votre message.`,
      }
    }

    if (row.category === 'engagement' && subcategory === 'reward_redemption') {
      return {
        category: 'engagement',
        categoryLabel: 'Récompenses',
        title: row.title ?? 'Nouvelle demande de récompense',
        body: row.body ?? `${clientName} a demandé une récompense.`,
      }
    }

    if (row.category === 'assessment') {
      return {
        category: 'assessment',
        categoryLabel: 'Bilans',
        title: row.title ?? 'Bilan complété',
        body: row.body ?? `${clientName} a complété un bilan.`,
      }
    }

    if (row.category === 'training' && subcategory === 'session_completed') {
      return {
        category: 'training',
        categoryLabel: 'Entraînement',
        title: row.title ?? 'Séance complétée',
        body: row.body ?? `${clientName} a terminé${sessionName ? ` la séance "${sessionName}"` : ' sa séance du jour'}.`,
      }
    }

    if (row.category === 'training' && subcategory === 'exercise_comment') {
      return {
        category: 'training',
        categoryLabel: 'Entraînement',
        title: row.title ?? 'Nouveau commentaire client',
        body: row.body ?? `${clientName} a laissé un commentaire sur un exercice.`,
      }
    }

    if ((row.category === 'engagement' && subcategory === 'session_skip') || (row.category === 'program_signal' && subcategory === 'session_not_done')) {
      return {
        category: 'engagement',
        categoryLabel: 'Engagement',
        title: row.title ?? 'Séance non réalisée',
        body: row.body ?? [
          sessionName ? `${clientName} n'a pas réalisé la séance "${sessionName}".` : `${clientName} n'a pas réalisé sa séance prévue.`,
          scheduledDate ? `Prévue le ${scheduledDate}.` : null,
          reasonLabel ? `Motif : ${reasonLabel}.` : null,
          note ? `Note : ${note}.` : null,
        ].filter(Boolean).join(' '),
      }
    }

    if (row.category === 'engagement' && (subcategory === 'morning_checkin_completed' || subcategory === 'evening_checkin_completed')) {
      return {
        category: 'engagement',
        categoryLabel: 'Engagement',
        title: row.title ?? (subcategory === 'morning_checkin_completed' ? 'Check-in matin reçu' : 'Check-in soir reçu'),
        body: `${clientName} a rempli son ${subcategory === 'morning_checkin_completed' ? 'check-in du matin' : 'check-in du soir'}${checkinMetrics.length > 0 ? ` · ${checkinMetrics.join(' · ')}` : ''}.`,
      }
    }

    if (row.category === 'recovery_flag') {
      const recoveryTitleMap: Record<string, string> = {
        soreness_high: 'Récupération à surveiller',
        rhr_elevated: 'Fréquence cardiaque élevée',
      }
      const recoveryBodyMap: Record<string, string> = {
        soreness_high: `${clientName} a signalé des courbatures marquées dans son check-in du jour.`,
        rhr_elevated: `${clientName} présente une fréquence cardiaque au repos élevée ce jour.`,
      }
      return {
        category: 'recovery',
        categoryLabel: 'Récupération',
        title: row.title ?? recoveryTitleMap[subcategory] ?? 'Signal de récupération',
        body: row.body ?? recoveryBodyMap[subcategory] ?? `${clientName} présente un signal de récupération à surveiller.`,
      }
    }

    if (row.category === 'nutrition_trend') {
      const nutritionTitleMap: Record<string, string> = {
        prep_validated: 'Repas validé',
        calorie_smoothing_activated: 'Lissage calorique activé',
        calorie_smoothing_recommended: 'Lissage calorique recommandé',
        kcal_over_3d: 'Apport calorique au-dessus de la cible',
        protein_short_3d: 'Protéines sous la cible',
        tdee_coach_alert: 'TDEE recalculé',
      }
      const nutritionBodyMap: Record<string, string> = {
        prep_validated: [
          `${clientName} a validé ${prepTitle ? `le repas "${prepTitle}"` : `son ${getMealTypeLabel(payload?.meal_type)}`} prévu dans son planning nutritionnel.`,
          [
            prepCalories !== null ? `${prepCalories} kcal` : null,
            prepProtein ? `P ${prepProtein} g` : null,
            prepCarbs ? `G ${prepCarbs} g` : null,
            prepFat ? `L ${prepFat} g` : null,
          ].filter(Boolean).join(' · '),
        ].filter(Boolean).join(' · '),
        calorie_smoothing_activated: smoothableDelta && durationDays
          ? `${clientName} a activé un lissage calorique pour répartir ${smoothingDirection === 'surplus' ? 'un excédent' : smoothingDirection === 'deficit' ? 'un déficit' : 'un écart'} de ${smoothableDelta} kcal sur ${durationDays} jours.`
          : `${clientName} a activé un lissage calorique sur son protocole nutritionnel.`,
        calorie_smoothing_recommended: smoothableDelta && durationDays
          ? `Un lissage coach est recommandé pour répartir ${smoothingDirection === 'surplus' ? 'un excédent' : smoothingDirection === 'deficit' ? 'un déficit' : 'un écart'} de ${smoothableDelta} kcal sur ${durationDays} jours.`
          : `Un lissage coach est recommandé dans Nutrition Studio.`,
        kcal_over_3d: `${clientName} dépasse sa cible calorique depuis 3 jours.`,
        protein_short_3d: `${clientName} reste sous sa cible protéines depuis 3 jours.`,
        tdee_coach_alert: `Un nouveau TDEE de ${clientName} est prêt à être confirmé dans Nutrition Studio.`,
      }
      const resolvedTitle = !isGenericNotificationCopy(row.title) ? row.title : null
      const resolvedBody = !isGenericNotificationCopy(row.body) ? row.body : null
      return {
        category: 'nutrition',
        categoryLabel: 'Nutrition',
        title: resolvedTitle ?? nutritionTitleMap[subcategory] ?? 'Alerte nutrition à analyser',
        body: resolvedBody ?? nutritionBodyMap[subcategory] ?? `Un signal nutrition a été détecté chez ${clientName}. Ouvrez l’espace nutrition pour voir l’origine exacte.`,
      }
    }

    if (row.category === 'weight_off_track') {
      return {
        category: 'progress',
        categoryLabel: 'Évolution',
        title: row.title ?? 'Poids hors trajectoire',
        body: row.body ?? `${clientName} s'éloigne de sa trajectoire de poids attendue.`,
      }
    }

    if (row.category === 'admin') {
      const adminTitleMap: Record<string, string> = {
        payment_received: 'Paiement reçu',
      }
      return {
        category: 'admin',
        categoryLabel: 'Administratif',
        title: row.title ?? adminTitleMap[subcategory] ?? 'Notification administrative',
        body: row.body ?? `${clientName} a généré une notification administrative.`,
      }
    }

    if (row.category === 'engagement') {
      return {
        category: 'engagement',
        categoryLabel: 'Engagement',
        title: row.title ?? 'Engagement à surveiller',
        body: row.body ?? `${clientName} montre un signal d'engagement à surveiller.`,
      }
    }

    return {
      category: 'system',
      categoryLabel: 'Suivi',
      title: row.title ?? 'Notification coach',
      body: row.body ?? chatExcerpt ?? `${clientName} a généré une nouvelle notification coach.`,
    }
  })()

  const actionUrl = (() => {
    if (payload && typeof payload.action_url === 'string') return payload.action_url
    if (config.category === 'nutrition') return `/coach/clients/${row.client_id}/data/nutrition`
    if (config.category === 'recovery' || config.category === 'engagement' || config.category === 'training') return `/coach/clients/${row.client_id}/data/performances`
    if (config.category === 'assessment') return `/coach/clients/${row.client_id}/data/bilans`
    if (config.category === 'admin') return `/coach/clients/${row.client_id}`
    return `/coach/clients/${row.client_id}`
  })()

  return {
    id: `coach:${row.id}`,
    rawId: row.id,
    source: 'coach',
    clientId: row.client_id,
    clientName,
    chatMessageId: row.chat_message_id ?? null,
    title: toSentenceCase(normalizeNotificationFrench(config.title) ?? config.title),
    body: normalizeNotificationFrench(config.body) ?? config.body,
    payload,
    messageExcerpt: config.body ?? chatExcerpt,
    category: config.category,
    categoryLabel: config.categoryLabel,
    subcategory: row.subcategory as string | null,
    eventLabel: null,
    priority: row.priority as number,
    status: row.status as string,
    read: false,
    emailSent: row.email_sent as boolean,
    actionUrl,
    createdAt: row.created_at as string,
  }
}

function buildLegacyCoachNotificationPresentation(row: any) {
  const clientName = buildClientName(row.coach_clients)
  const message = String(row.message ?? '').trim()
  const type = String(row.type ?? '')

  const config = (() => {
    if (type === 'session_reminder') {
      return {
        category: 'training',
        categoryLabel: 'Entraînement',
        title: 'Séance complétée',
        body: message || `${clientName} a complété sa séance.`,
        actionUrl: `/coach/clients/${row.client_id}/data/performances`,
      }
    }

    if (type === 'payment_received') {
      return {
        category: 'admin',
        categoryLabel: 'Administratif',
        title: 'Paiement reçu',
        body: message || `${clientName} a généré un paiement.`,
        actionUrl: row.submission_id
          ? `/coach/comptabilite?payment=${row.submission_id}`
          : `/coach/clients/${row.client_id}`,
      }
    }

    return {
      category: 'assessment',
      categoryLabel: 'Bilans',
      title: 'Bilan complété',
      body: message || `${clientName} a complété un bilan.`,
      actionUrl: `/coach/clients/${row.client_id}/data/bilans`,
    }
  })()

  return {
    id: `legacy:${row.id}`,
    rawId: row.id,
    source: 'legacy',
    clientId: row.client_id,
    clientName,
    chatMessageId: null,
    title: normalizeNotificationFrench(config.title) ?? config.title,
    body: normalizeNotificationFrench(config.body) ?? config.body,
    payload: null,
    messageExcerpt: config.body,
    category: config.category,
    categoryLabel: config.categoryLabel,
    subcategory: type,
    eventLabel: null,
    priority: 3,
    status: 'pending',
    read: false,
    emailSent: false,
    actionUrl: config.actionUrl,
    createdAt: row.created_at as string,
  }
}

function buildSharedCoachNotificationPresentation(row: any) {
  const clientName = buildClientName(row.coach_clients)
  const payload = (row.payload ?? null) as Record<string, unknown> | null
  const type = String(row.type ?? '')

  const config = {
    tdee_coach_alert: {
      category: 'nutrition',
      categoryLabel: 'Nutrition',
      title: row.title ?? 'TDEE recalculé',
      body: row.body ?? `Un nouveau TDEE de ${clientName} est prêt à être confirmé dans Nutrition Studio.`,
    },
    client_reaction: {
      category: 'feedback',
      categoryLabel: 'Retour',
      title: row.title ?? 'Nouvelle réaction client',
      body: row.body ?? `${clientName} a envoyé un nouveau retour.`,
    },
  }[type] ?? {
    category: 'system',
    categoryLabel: 'Suivi',
    title: row.title ?? 'Notification',
    body: row.body ?? `${clientName} a généré une nouvelle notification coach.`,
  }

  return {
    id: `shared:${row.id}`,
    rawId: row.id,
    source: 'shared',
    clientId: row.client_id,
    clientName,
    chatMessageId: null,
    title: normalizeNotificationFrench(config.title) ?? config.title,
    body: normalizeNotificationFrench(config.body) ?? config.body,
    payload,
    messageExcerpt: row.body ? String(row.body).slice(0, 200) : null,
    category: config.category,
    categoryLabel: config.categoryLabel,
    subcategory: type,
    eventLabel: null,
    priority: 3,
    status: 'pending',
    read: false,
    emailSent: false,
    actionUrl:
      payload && typeof payload.action_url === 'string'
        ? payload.action_url
        : `/coach/clients/${row.client_id}`,
    createdAt: row.created_at as string,
  }
}

// GET /api/coach/inbox
// ?summary=true  → uniquement { pending: Map<clientId, count> }
// ?count=true    → uniquement { total: number }
// (défaut)       → liste complète des notifications avec client + excerpt
export async function GET(req: Request) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const summaryMode = searchParams.get('summary') === 'true'
  const countMode   = searchParams.get('count') === 'true'
  const clientFilter = searchParams.get('client') // filtrer par client

  const db = service()
  const { data: coachProfile } = await db
    .from('coach_profiles')
    .select(`
      id,
      notif_inbox_assessments,
      notif_inbox_training,
      notif_inbox_messages,
      notif_inbox_checkins,
      notif_inbox_nutrition,
      notif_inbox_health_progress,
      notif_inbox_administrative
    `)
    .eq('coach_id', user.id)
    .maybeSingle()

  const { data: clientRecord } = await db
    .from('coach_clients')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (clientRecord && !coachProfile) {
    return NextResponse.json({ error: 'Accès coach refusé' }, { status: 403 })
  }

  let query = db
    .from('coach_notifications')
    .select(`
      id,
      client_id,
      chat_message_id,
      category,
      subcategory,
      title,
      body,
      payload,
      priority,
      status,
      email_sent,
      created_at,
      coach_clients!inner(id, first_name, last_name),
      chat_messages(content)
    `)
    .eq('coach_id', user.id)
    .in('category', [...COACH_NOTIFICATION_CATEGORIES])
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (clientFilter) query = query.eq('client_id', clientFilter)

  let sharedQuery = db
    .from('coach_client_notifications')
    .select(`
      id,
      client_id,
      type,
      title,
      body,
      payload,
      read_at,
      dismissed_at,
      created_at,
      coach_clients!inner(id, first_name, last_name)
    `)
    .eq('coach_id', user.id)
    .in('type', [...SHARED_COACH_NOTIFICATION_TYPES])
    .is('dismissed_at', null)
    .is('read_at', null)
    .order('created_at', { ascending: false })

  if (clientFilter) sharedQuery = sharedQuery.eq('client_id', clientFilter)

  let legacyQuery = db
    .from('client_notifications')
    .select(`
      id,
      client_id,
      submission_id,
      type,
      message,
      read,
      created_at,
      coach_clients!inner(id, first_name, last_name)
    `)
    .eq('coach_id', user.id)
    .in('type', [...LEGACY_COACH_NOTIFICATION_TYPES])
    .eq('read', false)
    .order('created_at', { ascending: false })

  if (clientFilter) legacyQuery = legacyQuery.eq('client_id', clientFilter)

  const [
    { data: notifications, error },
    { data: sharedNotifications, error: sharedError },
    { data: legacyNotifications, error: legacyError },
  ] = await Promise.all([
    query,
    sharedQuery,
    legacyQuery,
  ])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (sharedError) return NextResponse.json({ error: sharedError.message }, { status: 500 })
  if (legacyError) return NextResponse.json({ error: legacyError.message }, { status: 500 })

  const rows = (notifications ?? []).map(buildCoachNotificationPresentation)
  const sharedRows = (sharedNotifications ?? []).map(buildSharedCoachNotificationPresentation)
  const legacyRows = (legacyNotifications ?? [])
    .filter((row: any) => !(row.type === 'assessment_completed' && /par le coach|rempli par le coach/i.test(String(row.message ?? ''))))
    .map(buildLegacyCoachNotificationPresentation)
  const preferences = (coachProfile ?? {}) as Partial<CoachInboxPreferences>
  const merged = [...rows, ...sharedRows, ...legacyRows]
    .filter((notification) => isCoachInboxNotificationEnabled(notification, preferences))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  // count mode — juste le total pour le badge NavDock
  if (countMode) {
    return NextResponse.json({ total: merged.length })
  }

  // summary mode — Map<clientId, count> pour les pastilles sur la liste clients
  if (summaryMode) {
    const pending: Record<string, number> = {}
    for (const n of merged) {
      pending[n.clientId] = (pending[n.clientId] ?? 0) + 1
    }
    return NextResponse.json({ pending, total: merged.length })
  }

  return NextResponse.json({ notifications: merged, total: merged.length })
}

export async function PATCH(req: Request) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const parsed = bulkPatchSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { ids, clientId, markAll } = parsed.data
  const db = service()

  const coachIds: string[] = []
  const sharedIds: string[] = []
  const legacyIds: string[] = []

  for (const id of ids ?? []) {
    if (id.startsWith('coach:')) coachIds.push(id.slice(6))
    if (id.startsWith('shared:')) sharedIds.push(id.slice(7))
    if (id.startsWith('legacy:')) legacyIds.push(id.slice(7))
  }

  if (markAll || clientId) {
    const now = new Date().toISOString()
    const coachQuery = db
      .from('coach_notifications')
      .update({ status: 'resolved' })
      .eq('coach_id', user.id)
      .in('category', [...COACH_NOTIFICATION_CATEGORIES])
      .eq('status', 'pending')

    const sharedQuery = db
      .from('coach_client_notifications')
      .update({ read_at: now })
      .eq('coach_id', user.id)
      .in('type', [...SHARED_COACH_NOTIFICATION_TYPES])
      .is('dismissed_at', null)
      .is('read_at', null)

    const legacyQuery = db
      .from('client_notifications')
      .update({ read: true })
      .eq('coach_id', user.id)
      .in('type', [...LEGACY_COACH_NOTIFICATION_TYPES])
      .eq('read', false)

    if (clientId) {
      await Promise.all([
        coachQuery.eq('client_id', clientId),
        sharedQuery.eq('client_id', clientId),
        legacyQuery.eq('client_id', clientId),
      ])
    } else {
      await Promise.all([coachQuery, sharedQuery, legacyQuery])
    }

    return NextResponse.json({ ok: true })
  }

  if (coachIds.length > 0) {
    await db
      .from('coach_notifications')
      .update({ status: 'resolved' })
      .in('id', coachIds)
      .eq('coach_id', user.id)
      .in('category', [...COACH_NOTIFICATION_CATEGORIES])
      .eq('status', 'pending')
  }

  if (sharedIds.length > 0) {
    await db
      .from('coach_client_notifications')
      .update({ read_at: new Date().toISOString() })
      .in('id', sharedIds)
      .eq('coach_id', user.id)
      .in('type', [...SHARED_COACH_NOTIFICATION_TYPES])
      .is('dismissed_at', null)
      .is('read_at', null)
  }

  if (legacyIds.length > 0) {
    await db
      .from('client_notifications')
      .update({ read: true })
      .in('id', legacyIds)
      .eq('coach_id', user.id)
      .in('type', [...LEGACY_COACH_NOTIFICATION_TYPES])
  }

  return NextResponse.json({ ok: true })
}
