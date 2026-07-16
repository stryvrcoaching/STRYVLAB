
export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { z } from 'zod'
import OpenAI from 'openai'
import { resolveClientFromUser } from '@/lib/client/resolve-client'
import { buildSystemPrompt } from '@/lib/client/ai-coach/buildSystemPrompt'
import { buildDailyBrief } from '@/lib/client/ai-coach/buildDailyBrief'
import { buildMorningPreparationReminder } from '@/lib/client/ai-coach/routineMessages'
import { loadDailyCoachContext } from '@/lib/client/ai-coach/loadDailyFacts'
import { composeClosingMessage } from '@/lib/client/ai-coach/messageComposer'
import { selectAdvice } from '@/lib/client/ai-coach/adviceRules'
import { inngest } from '@/lib/inngest/client'
import { computePhysiologicalDate } from '@/lib/nutrition/physiological-date'
import { resolveProtocolDayByDate } from '@/lib/nutrition/protocol-schedule'
import { getCycleStateFromLogs } from '@/lib/cycle/cycleEngine'
import type { CycleLog } from '@/lib/cycle/cycleEngine'
import { computePhysiologicalDateInTimezone, getLocalWeekday } from '@/lib/client/checkin/timeWindows'
import { filterSessionsForJsWeekday } from '@/lib/client/plannedSessions'
import { assertClientAppEnabledForCoach, ClientAppAccessError } from '@/lib/billing/assertClientAppEnabled'
import { resolveClientLanguage } from '@/lib/client/resolve-language'
import { getCheckinRecordedMessage } from '@/lib/client/checkin/flows'

function svc() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function buildCoachAlertPresentation(clientId: string, clientFirstName: string, alert: { category: string; reason: string }) {
  if (alert.category === 'program_signal' && alert.reason === 'session_not_done') {
    return {
      subcategory: alert.reason,
      title: 'Séance non réalisée',
      body: `${clientFirstName} n'a pas réalisé sa séance prévue aujourd'hui.`,
      payload: {
        reason: alert.reason,
        action_url: `/coach/clients/${clientId}/data/performances`,
      },
    }
  }

  if (alert.category === 'recovery_flag' && alert.reason === 'soreness_high') {
    return {
      subcategory: alert.reason,
      title: 'Récupération à surveiller',
      body: `${clientFirstName} a signalé des courbatures marquées dans son check-in du jour.`,
      payload: {
        reason: alert.reason,
        action_url: `/coach/clients/${clientId}/data/performances`,
      },
    }
  }

  if (alert.category === 'recovery_flag' && alert.reason === 'rhr_elevated') {
    return {
      subcategory: alert.reason,
      title: 'Fréquence cardiaque élevée',
      body: `${clientFirstName} présente une fréquence cardiaque au repos élevée ce jour.`,
      payload: {
        reason: alert.reason,
        action_url: `/coach/clients/${clientId}/data/performances`,
      },
    }
  }

  if (alert.category === 'nutrition_trend' && alert.reason === 'kcal_over_3d') {
    return {
      subcategory: alert.reason,
      title: 'Apport calorique au-dessus de la cible',
      body: `${clientFirstName} dépasse sa cible calorique depuis 3 jours.`,
      payload: {
        reason: alert.reason,
        action_url: `/coach/clients/${clientId}/data/nutrition`,
      },
    }
  }

  if (alert.category === 'nutrition_trend' && alert.reason === 'protein_short_3d') {
    return {
      subcategory: alert.reason,
      title: 'Protéines sous la cible',
      body: `${clientFirstName} reste sous sa cible protéines depuis 3 jours.`,
      payload: {
        reason: alert.reason,
        action_url: `/coach/clients/${clientId}/data/nutrition`,
      },
    }
  }

  return {
    subcategory: alert.reason,
    title: 'Signal à analyser',
    body: `${clientFirstName} a généré un signal de suivi à analyser.`,
    payload: {
      reason: alert.reason,
      action_url: `/coach/clients/${clientId}`,
    },
  }
}

function buildCheckinCompletionPresentation(
  clientId: string,
  clientFirstName: string,
  flowType: 'morning' | 'evening',
  date: string,
  data: {
    sleep_hours?: number
    sleep_quality?: number
    energy_level?: number
    stress_level?: number
    weight_kg?: number
    daily_steps?: number
    muscle_soreness?: number
    rhr_morning?: number
  },
) {
  const formatMetricNumber = (value: number) => value.toLocaleString('fr-FR', { maximumFractionDigits: 1 })

  const metrics = [
    flowType === 'morning' && typeof data.sleep_hours === 'number' ? `Sommeil ${formatMetricNumber(data.sleep_hours)} h` : null,
    flowType === 'morning' && typeof data.rhr_morning === 'number' ? `FC repos ${formatMetricNumber(data.rhr_morning)} bpm` : null,
    typeof data.energy_level === 'number' ? `Énergie ${data.energy_level}/5` : null,
    typeof data.stress_level === 'number' ? `Stress ${data.stress_level}/5` : null,
    typeof data.weight_kg === 'number' ? `Poids ${formatMetricNumber(data.weight_kg)} kg` : null,
    flowType === 'evening' && typeof data.daily_steps === 'number' ? `${data.daily_steps.toLocaleString('fr-FR')} pas` : null,
    flowType === 'evening' && typeof data.muscle_soreness === 'number' ? `Courbatures ${data.muscle_soreness}/4` : null,
  ].filter(Boolean)

  return {
    subcategory: flowType === 'morning' ? 'morning_checkin_completed' : 'evening_checkin_completed',
    title: flowType === 'morning' ? 'Check-in matin reçu' : 'Check-in soir reçu',
    body: `${clientFirstName} a rempli son ${flowType === 'morning' ? 'check-in du matin' : 'check-in du soir'}${metrics.length > 0 ? ` · ${metrics.join(' · ')}` : ''}.`,
    payload: {
      checkin_date: date,
      flow_type: flowType,
      metrics,
      action_url: `/coach/clients/${clientId}/data/performances`,
    },
  }
}

const checkinSchema = z.object({
  flow_type: z.enum(['morning', 'evening']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  data: z.object({
    sleep_hours:     z.number().min(0).max(24).optional(),
    sleep_quality:   z.number().int().min(1).max(4).optional(),
    energy_level:    z.number().int().min(1).max(5).optional(),
    stress_level:    z.number().int().min(1).max(5).optional(),
    weight_kg:       z.number().min(20).max(300).optional(),
    daily_steps:     z.number().int().min(0).max(200000).optional(),
    hunger_level:    z.number().int().min(1).max(4).optional(),
    muscle_soreness: z.number().int().min(1).max(4).optional(),
    rhr_morning:   z.number().int().min(30).max(200).optional(),

  }),
  summary: z.string().max(500),
})

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured')
  return new OpenAI({ apiKey })
}

const CHECKIN_TEMPLATE_NAME = '__checkin_realtime__'

async function projectCheckinToAssessment(
  db: ReturnType<typeof svc>,
  clientId: string,
  date: string,
  data: {
    sleep_hours?: number
    sleep_quality?: number
    energy_level?: number
    stress_level?: number
    weight_kg?: number
    daily_steps?: number
  },
) {
  const fields: Array<{ field_key: string; value_number: number | null }> = [
    { field_key: 'weight_kg', value_number: data.weight_kg ?? null },
    { field_key: 'daily_steps', value_number: data.daily_steps ?? null },
    { field_key: 'sleep_duration_h', value_number: data.sleep_hours ?? null },
    { field_key: 'sleep_quality', value_number: data.sleep_quality ?? null },
    { field_key: 'energy_level', value_number: data.energy_level ?? null },
    { field_key: 'stress_level', value_number: data.stress_level ?? null },
  ].filter((f) => f.value_number != null)

  if (fields.length === 0) return

  const { data: owner } = await db
    .from('coach_clients')
    .select('coach_id')
    .eq('id', clientId)
    .maybeSingle()
  if (!owner?.coach_id) return

  const { data: existingTpl } = await db
    .from('assessment_templates')
    .select('id')
    .eq('coach_id', owner.coach_id)
    .eq('name', CHECKIN_TEMPLATE_NAME)
    .maybeSingle()

  let templateId = existingTpl?.id as string | undefined
  if (!templateId) {
    const { data: createdTpl } = await db
      .from('assessment_templates')
      .insert({
        coach_id: owner.coach_id,
        name: CHECKIN_TEMPLATE_NAME,
        description: 'Template système — projection temps réel check-in',
        template_type: 'custom',
        blocks: [{ id: 'checkin_realtime_block', module: 'biometrics', title: 'Check-in realtime', fields: [] }],
        is_default: false,
      })
      .select('id')
      .single()
    templateId = createdTpl?.id
  }
  if (!templateId) return

  const submittedAt = new Date(`${date}T12:00:00Z`).toISOString()
  const { data: existingSub } = await db
    .from('assessment_submissions')
    .select('id')
    .eq('client_id', clientId)
    .eq('template_id', templateId)
    .eq('submitted_at', submittedAt)
    .maybeSingle()

  let submissionId = existingSub?.id as string | undefined
  if (!submissionId) {
    const { data: createdSub } = await db
      .from('assessment_submissions')
      .insert({
        coach_id: owner.coach_id,
        client_id: clientId,
        template_id: templateId,
        template_snapshot: [{ id: 'checkin_realtime_block', module: 'biometrics', label: 'Check-in realtime', order: 0, fields: [] }],
        status: 'completed',
        filled_by: 'client',
        submitted_at: submittedAt,
        bilan_date: date,
      })
      .select('id')
      .single()
    submissionId = createdSub?.id
  }
  if (!submissionId) return

  for (const f of fields) {
    await db.from('assessment_responses').upsert(
      {
        submission_id: submissionId,
        block_id: 'checkin_realtime_block',
        field_key: f.field_key,
        value_number: f.value_number,
      },
      { onConflict: 'submission_id,block_id,field_key' }
    )
  }
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = svc()
  const cc = await resolveClientFromUser(user.id, user.email, db, 'id, first_name, timezone, coach_id')
  if (!cc) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  const lang = await resolveClientLanguage(db, cc.id as string)
  try {
    const coachId = (cc as any).coach_id as string | null
    if (coachId) {
      await assertClientAppEnabledForCoach(db, coachId)
    }
  } catch (error) {
    if (error instanceof ClientAppAccessError) {
      return NextResponse.json({ error: 'L’espace client n’est pas activé pour ce suivi.' }, { status: 403 })
    }
    throw error
  }

  // Fetch data for daily brief in parallel with checkin processing (best-effort)
  const briefDataPromise = (async () => {
    try {
      const [programRes, protocolRes] = await Promise.allSettled([
        db.from('programs')
          .select('name, frequency, program_sessions(name, day_of_week, days_of_week)')
          .eq('client_id', cc.id as string)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        db.from('nutrition_protocols')
          .select('schedule_start_date, nutrition_protocol_days(position, calories, protein_g, hydration_ml), nutrition_protocol_schedule_slots(week_index, dow, protocol_day_position)')
          .eq('client_id', cc.id as string)
          .eq('status', 'shared')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])

      const activeProgram = programRes.status === 'fulfilled' ? (programRes.value as any)?.data : null
      const protocol      = protocolRes.status === 'fulfilled' ? (protocolRes.value as any)?.data : null
      const todayPhysio = computePhysiologicalDateInTimezone(new Date(), cc.timezone ?? 'Europe/Paris')
      const todayDow = getLocalWeekday(new Date(`${todayPhysio}T12:00:00.000Z`), cc.timezone ?? 'Europe/Paris')
      const protocolDay   = resolveProtocolDayByDate(
        todayPhysio,
        protocol?.schedule_start_date ?? null,
        protocol?.nutrition_protocol_days ?? [],
        protocol?.nutrition_protocol_schedule_slots ?? [],
      ) as any

      const sessions: any[] = activeProgram?.program_sessions ?? []
      const todaySession = filterSessionsForJsWeekday(sessions, todayDow)[0]

      return {
        sessionName:   todaySession?.name    ?? null,
        targetKcal:    protocolDay?.calories  ?? 0,
        targetProtein: protocolDay?.protein_g ?? 0,
        targetWaterMl: protocolDay?.hydration_ml ?? 2500,
      }
    } catch {
      return { sessionName: null, targetKcal: 0, targetProtein: 0, targetWaterMl: 2500 }
    }
  })()

  const parsed = checkinSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', details: parsed.error }, { status: 400 })
  }
  const { flow_type, date, data, summary } = parsed.data

  const configuredMorningFieldsPromise = (async () => {
    if (flow_type !== 'evening') return [] as string[]
    const { data: config } = await db
      .from('daily_checkin_configs')
      .select('moments')
      .eq('client_id', cc.id)
      .eq('is_active', true)
      .maybeSingle()

    const moments = (config?.moments ?? []) as Array<{ moment?: string; fields?: string[] }>
    return moments.find((moment) => moment.moment === 'morning')?.fields ?? []
  })()

  // Upsert check-in data
  const { data: savedCheckin, error: checkinError } = await db
    .from('client_daily_checkins')
    .upsert(
      { client_id: cc.id, date, flow_type, ...data },
      { onConflict: 'client_id,date,flow_type' }
    )
    .select('id')
    .single()
  if (checkinError) {
    return NextResponse.json({ error: 'Failed to save check-in' }, { status: 500 })
  }

  // Streak + points (PWA/chat check-in path — mirrors checkin/respond). Non-blocking.
  try {
    const { data: streakCfg } = await db
      .from('daily_checkin_configs')
      .select('days_of_week')
      .eq('client_id', cc.id)
      .maybeSingle()
    await inngest.send({
      name: 'checkin/streak.evaluate',
      data: {
        client_id: cc.id,
        response_id: savedCheckin?.id ?? `${cc.id}:${date}:${flow_type}`,
        is_late: false,
        days_of_week: (streakCfg?.days_of_week as number[] | null) ?? [],
      },
    })
  } catch {
    // Non-blocking — streak/points must not fail the check-in save
  }

  // Log cycle phase for historical analytics — best-effort, non-blocking
  ;(async () => {
    try {
      const { data: cycleLogs } = await db
        .from('menstrual_cycle_logs')
        .select('period_start_date, period_end_date, computed_cycle_length_days')
        .eq('client_id', cc.id)
        .order('period_start_date', { ascending: false })
        .limit(7)

      const cs = getCycleStateFromLogs((cycleLogs ?? []) as CycleLog[], null)
      if (cs.currentPhase && cs.currentCycleDay) {
        await db
          .from('client_daily_checkins')
          .update({ cycle_phase: cs.currentPhase, cycle_day: cs.currentCycleDay })
          .eq('client_id', cc.id)
          .eq('date', date)
          .eq('flow_type', flow_type)
      }
    } catch {
      // non-blocking — checkin already saved
    }
  })()

  // Mirror latest check-in metrics into assessment responses (best-effort).
  try {
    await projectCheckinToAssessment(db, cc.id as string, date, data)
  } catch {
    // Non-blocking — check-in save remains source transaction
  }

  // Mark chat_session completed
  await db
    .from('chat_sessions')
    .upsert(
      { client_id: cc.id, date, flow_type, completed_at: new Date().toISOString() },
      { onConflict: 'client_id,date,flow_type' }
    )

  // Deterministic, honest closing built on DailyFacts (no false praise, no program-touching).
  let closingMessage = flow_type === 'morning'
    ? getCheckinRecordedMessage(lang, 'morning')
    : getCheckinRecordedMessage(lang, 'evening')

  try {
    const clientFirstName = (cc as { first_name?: string }).first_name ?? 'Client'
    const checkinPresentation = buildCheckinCompletionPresentation(
      cc.id as string,
      clientFirstName,
      flow_type,
      date,
      data,
    )

    if ((cc as { coach_id?: string | null }).coach_id) {
      const coachId = (cc as { coach_id?: string | null }).coach_id as string
      const { data: existingCheckinNotif } = await db
        .from('coach_notifications')
        .select('id')
        .eq('coach_id', coachId)
        .eq('client_id', cc.id)
        .eq('category', 'engagement')
        .eq('subcategory', checkinPresentation.subcategory)
        .contains('payload', { checkin_date: date, flow_type })
        .eq('status', 'pending')
        .maybeSingle()

      if (existingCheckinNotif?.id) {
        await db
          .from('coach_notifications')
          .update({
            title: checkinPresentation.title,
            body: checkinPresentation.body,
            payload: checkinPresentation.payload,
          })
          .eq('id', existingCheckinNotif.id)
      } else {
        await db.from('coach_notifications').insert({
          coach_id: coachId,
          client_id: cc.id,
          category: 'engagement',
          subcategory: checkinPresentation.subcategory,
          title: checkinPresentation.title,
          body: checkinPresentation.body,
          payload: checkinPresentation.payload,
          status: 'pending',
          priority: 4,
          email_sent: false,
        })
      }
    }

    const checkinSignals = {
      sleepHours: data.sleep_hours,
      sleepQuality: data.sleep_quality,
      energy: data.energy_level,
      stress: data.stress_level,
      soreness: data.muscle_soreness,
      rhr: data.rhr_morning,
      weight: data.weight_kg,
    }
    const ctx = await loadDailyCoachContext(
      db, cc.id as string, date, (cc.timezone as string) || 'Europe/Paris', checkinSignals, data.daily_steps ?? null,
    )
    const { tips, coachAlerts } = selectAdvice({ lang, facts: ctx.facts, trend: ctx.trend, freedom: ctx.freedom, flow: flow_type })
    closingMessage = composeClosingMessage({
      facts: ctx.facts,
      tips,
      tone: ctx.tone,
      flow: flow_type,
      name: (cc as { first_name?: string }).first_name ?? '',
      lang,
    })

    // Silent coach alerts (D10) — back-end only, never shown to the client.
    if (ctx.coachId && coachAlerts.length > 0) {
      await db.from('coach_notifications').insert(
        coachAlerts.map((a) => {
          const presentation = buildCoachAlertPresentation(cc.id as string, clientFirstName, a)
          return {
            coach_id: ctx.coachId,
            client_id: cc.id,
            category: a.category,
            subcategory: presentation.subcategory,
            title: presentation.title,
            body: presentation.body,
            payload: presentation.payload,
            status: 'pending',
            priority: a.priority,
          }
        }),
      )
    }
  } catch {
    // Non-blocking — fallback to default ack message
  }

  if (flow_type === 'evening') {
    const reminderMarker = lang === 'es'
      ? 'Pequeño recordatorio para mañana por la mañana'
      : lang === 'en'
        ? 'Quick reminder for tomorrow morning'
        : 'Petit rappel pour demain matin'
    try {
      const morningFields = await configuredMorningFieldsPromise
      const reminder = buildMorningPreparationReminder(lang, morningFields)
      if (!closingMessage.includes(reminderMarker)) {
        closingMessage = `${closingMessage}\n\n${reminder}`
      }
    } catch {
      const reminder = buildMorningPreparationReminder(lang)
      if (!closingMessage.includes(reminderMarker)) {
        closingMessage = `${closingMessage}\n\n${reminder}`
      }
    }
  }

  // Persist closing message to chat_messages
  const { data: savedMsg } = await db
    .from('chat_messages')
    .insert({
      client_id: cc.id,
      role: 'assistant',
      content: closingMessage,
      message_type: 'text',
    })
    .select('id, role, content, message_type, metadata, seen_at, created_at')
    .single()

  // Daily brief — structured day summary after check-in (non-blocking)
  try {
    const briefData = await briefDataPromise
    const briefContent = await buildDailyBrief({
      lang,
      flowType:       flow_type,
      sessionName:    briefData.sessionName,
      targetKcal:     briefData.targetKcal,
      targetProtein:  briefData.targetProtein,
      targetWaterMl:  briefData.targetWaterMl,
      energyLevel:    data.energy_level    ?? null,
      sleepHours:     data.sleep_hours     ?? null,
      sleepQuality:   data.sleep_quality   ?? null,
      muscleSoreness: data.muscle_soreness ?? null,
    })

    await db.from('chat_messages').insert({
      client_id:    cc.id,
      role:         'assistant',
      content:      briefContent,
      message_type: 'daily_brief',
    })
  } catch {
    // Non-blocking — brief failure must not affect checkin response
  }

  // Update rate limit counter
  const today = computePhysiologicalDate(new Date(), cc.timezone)
  const { data: usage } = await db
    .from('ai_coach_daily_usage')
    .select('message_count')
    .eq('client_id', cc.id)
    .eq('date', today)
    .maybeSingle()
  const count = usage?.message_count ?? 0
  await db.from('ai_coach_daily_usage').upsert(
    { client_id: cc.id, date: today, message_count: count + 1 },
    { onConflict: 'client_id,date' }
  )

  return NextResponse.json({
    closingMessage,
    botMessage: savedMsg,
    remaining: Math.max(0, 20 - (count + 1)),
  })
}
