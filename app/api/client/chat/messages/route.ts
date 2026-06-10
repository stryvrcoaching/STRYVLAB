import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { resolveClientFromUser } from '@/lib/client/resolve-client'
import { buildSystemPrompt } from '@/lib/client/ai-coach/buildSystemPrompt'
import { callLLM } from '@/lib/llm/callLLM'
import { computePhysiologicalDate } from '@/lib/nutrition/physiological-date'
import { resolveProtocolDayByDate } from '@/lib/nutrition/protocol-schedule'
import { shouldProactiveInitNow } from '@/lib/client/checkin/checkinEngine'
import { resolveClientTimezone, buildCheckinReadyMetadata } from '@/lib/client/checkin/resolveClientTimezone'
import { findExistingInitMessageForDate, shouldUpgradeInitMessageToInteractiveCheckin } from '@/lib/client/checkin/initMessages'
import { isCheckinMomentConfiguredToday } from '@/lib/inngest/chatCheckinInitCron'
import {
  addDaysToDateKey,
  computePhysiologicalDateInTimezone,
  getLocalTimeParts,
  getLocalWeekday,
  utcRangeForLocalDate,
  utcRangeForPhysiologicalDate,
} from '@/lib/client/checkin/timeWindows'
import { computeNutritionAlerts } from '@/lib/client/smart/nutritionAlerts'
import { evaluateSilentEscalation } from '@/lib/client/ai-coach/classifier'
import { sendCoachAlertEmail } from '@/lib/email/mailer'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const DAILY_LIMIT = 20



async function ensureAutomatedChatMessages(
  db: ReturnType<typeof service>,
  clientId: string,
  firstName?: string | null,
) {
  const now = new Date()
  const timezone = await resolveClientTimezone(db, clientId)
  const today = computePhysiologicalDateInTimezone(now, timezone)
  const yesterday = addDaysToDateKey(today, -1)
  const localNow = getLocalTimeParts(now, timezone)
  const localYesterday = addDaysToDateKey(localNow.dateKey, -1)
  const { start: messageWindowStart } = utcRangeForLocalDate(localYesterday, timezone)
  const { start: physiologicalStart, end: physiologicalEnd } = utcRangeForPhysiologicalDate(today, timezone)
  const currentHour = localNow.hour
  // Weekday of the PHYSIOLOGICAL day (not calendar `now`): after midnight but before the
  // 05:00 cutoff we are still debriefing the previous day → its session, not tomorrow's.
  const physioWeekday = getLocalWeekday(new Date(`${today}T12:00:00.000Z`), timezone)

  const [
    { data: checkinRows },
    { data: initMessages },
    { data: todaySessions },
    { data: protocol },
    { data: composerMeals },
    { data: legacyMeals },
    { data: waterRows },
    { data: alertMessages },
  ] = await Promise.all([
    db.from('client_daily_checkins')
      .select('flow_type, date')
      .eq('client_id', clientId)
      .in('date', [yesterday, today]),
    db.from('chat_messages')
      .select('id, message_type, metadata, created_at')
      .eq('client_id', clientId)
      .gte('created_at', messageWindowStart.toISOString())
      .in('message_type', ['morning_init', 'evening_init']),
    db.from('program_sessions')
      .select('name, day_of_week, days_of_week, programs!inner(status, client_id)')
      .eq('programs.client_id', clientId)
      .eq('programs.status', 'active')
      .or(`day_of_week.eq.${physioWeekday},days_of_week.cs.{${physioWeekday}}`),
    db.from('nutrition_protocols')
      .select('schedule_start_date, nutrition_protocol_days(position, calories, protein_g, carbs_g, fat_g, hydration_ml), nutrition_protocol_schedule_slots(week_index, dow, protocol_day_position)')
      .eq('client_id', clientId)
      .eq('status', 'shared')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    db.from('nutrition_meals')
      .select('meal_type, total_protein_g, total_carbs_g, total_fat_g')
      .eq('client_id', clientId)
      .eq('physiological_date', today),
    db.from('meal_logs')
      .select('meal_type, estimated_macros')
      .eq('client_id', clientId)
      .gte('logged_at', physiologicalStart.toISOString())
      .lt('logged_at', new Date(physiologicalEnd.getTime() + 1).toISOString())
      .eq('ai_status', 'done'),
    db.from('client_water_logs')
      .select('amount_ml')
      .eq('client_id', clientId)
      .gte('logged_at', physiologicalStart.toISOString())
      .lte('logged_at', physiologicalEnd.toISOString()),
    db.from('chat_messages')
      .select('metadata')
      .eq('client_id', clientId)
      .eq('message_type', 'nutrition_alert_auto')
      .gte('created_at', messageWindowStart.toISOString()),
  ])

  const sessionRows = ((checkinRows ?? []) as Array<{ flow_type: string; date: string }>).map((row) => ({
    flow_type: row.flow_type,
    date: row.date,
    completed_at: 'done',
  }))
  const todaySessionList = (todaySessions ?? []) as Array<{ name?: string | null }>
  const primarySessionName = todaySessionList[0]?.name ?? null
  const initRows = (initMessages ?? []) as {
    id: string
    message_type: string
    created_at: string
    metadata?: Record<string, unknown>
  }[]

  // Tone + configured fields — personalize the greeting (canonical fields, coach tone)
  const { data: ccRow } = await db.from('coach_clients').select('coach_id').eq('id', clientId).maybeSingle()
  const coachIdForTone = (ccRow as { coach_id?: string } | null)?.coach_id ?? null
  const [{ data: perClientAi }, { data: coachProfileTone }, { data: cfgRow }] = await Promise.all([
    db.from('coach_ai_settings_per_client').select('ai_tone').eq('client_id', clientId).maybeSingle(),
    coachIdForTone
      ? db.from('coach_profiles').select('ai_tone').eq('coach_id', coachIdForTone).maybeSingle()
      : Promise.resolve({ data: null }),
    db.from('daily_checkin_configs').select('client_id, is_active, days_of_week, moments').eq('client_id', clientId).maybeSingle(),
  ])
  const perClientTone = (perClientAi as { ai_tone?: string | null } | null)?.ai_tone ?? null
  const globalTone = (coachProfileTone as { ai_tone?: string | null } | null)?.ai_tone ?? null
  const cfgMoments = ((cfgRow as { moments?: Array<{ moment?: string; fields?: string[] }> } | null)?.moments) ?? []
  const fieldsForFlow = (flow: 'morning' | 'evening'): string[] =>
    cfgMoments.find((m) => m.moment === flow)?.fields ?? []
  const toneOpts = (flow: 'morning' | 'evening') => ({
    tone: perClientTone, globalTone, enabledFields: fieldsForFlow(flow),
  })

  for (const flow of ['morning', 'evening'] as const) {
    const messageType = flow === 'morning' ? 'morning_init' : 'evening_init'
    const existing = findExistingInitMessageForDate(initRows, messageType, timezone, today)
    const isConfiguredToday = isCheckinMomentConfiguredToday(cfgRow ?? undefined, flow, physioWeekday)
    const shouldPromptCheckin = isConfiguredToday && shouldProactiveInitNow(now, timezone, flow, sessionRows)

    // Self-heal: if a same-day init already exists but was created as a routine-only
    // message while a check-in is actually pending, upgrade it to the interactive
    // check-in version instead of leaving the client stuck all day with no CTA.
    if (existing && shouldUpgradeInitMessageToInteractiveCheckin(existing, shouldPromptCheckin)) {
        const readyMeta = buildCheckinReadyMetadata(flow, firstName, {
          hasTrainingToday: todaySessionList.length > 0,
          trainingName: primarySessionName,
        }, toneOpts(flow))
        await db.from('chat_messages').update({
          content: String(readyMeta.greeting),
          metadata: readyMeta,
        }).eq('id', existing.id)
      continue
    }

    // An init message already exists for this day → respect it, including a deferred
    // "Plus tard". Never regenerate or overwrite: the check-in stays reachable via the
    // top-bar button + unread badge. (Prevents the 1am re-nag that rewrote the message.)
    if (existing) continue

    // Respect coach config: only prompt a check-in if this moment is active + configured
    // for today (active flag, day of week, moment enabled). Aligns the on-demand path
    // with the cron — never offer a check-in the coach hasn't enabled.
    if (!isConfiguredToday) continue

    if (!shouldPromptCheckin) continue

    const readyMeta = buildCheckinReadyMetadata(flow, firstName, {
      hasTrainingToday: todaySessionList.length > 0,
      trainingName: primarySessionName,
    }, toneOpts(flow))
    await db.from('chat_messages').insert({
      client_id: clientId,
      role: 'assistant',
      content: String(readyMeta.greeting),
      message_type: messageType,
      metadata: readyMeta,
    })
  }

  const protocolDay = resolveProtocolDayByDate(
    today,
    (protocol as any)?.schedule_start_date ?? null,
    (protocol as any)?.nutrition_protocol_days ?? [],
    (protocol as any)?.nutrition_protocol_schedule_slots ?? [],
  ) as any

  const target = {
    kcal: Number(protocolDay?.calories ?? 0),
    protein_g: Number(protocolDay?.protein_g ?? 0),
    carbs_g: Number(protocolDay?.carbs_g ?? 0),
    fat_g: Number(protocolDay?.fat_g ?? 0),
    water_ml: Number(protocolDay?.hydration_ml ?? 2500),
  }

  const fromComposer = (composerMeals ?? []).reduce((acc: any, m: any) => ({
    protein_g: acc.protein_g + Number(m.total_protein_g ?? 0),
    carbs_g: acc.carbs_g + Number(m.total_carbs_g ?? 0),
    fat_g: acc.fat_g + Number(m.total_fat_g ?? 0),
  }), { protein_g: 0, carbs_g: 0, fat_g: 0 })

  const fromLegacy = (legacyMeals ?? []).reduce((acc: any, m: any) => {
    const em = (m.estimated_macros ?? {}) as Record<string, number>
    return {
      protein_g: acc.protein_g + Number(em.protein_g ?? 0),
      carbs_g: acc.carbs_g + Number(em.carbs_g ?? 0),
      fat_g: acc.fat_g + Number(em.fats_g ?? em.fat_g ?? 0),
    }
  }, { protein_g: 0, carbs_g: 0, fat_g: 0 })

  const consumed = {
    kcal: 0,
    protein_g: fromComposer.protein_g + fromLegacy.protein_g,
    carbs_g: fromComposer.carbs_g + fromLegacy.carbs_g,
    fat_g: fromComposer.fat_g + fromLegacy.fat_g,
    water_ml: (waterRows ?? []).reduce((s: number, w: any) => s + Number(w.amount_ml ?? 0), 0),
  }

  const hasLunchLog = (composerMeals ?? []).some((m: any) => m.meal_type === 'lunch')
    || (legacyMeals ?? []).some((m: any) => m.meal_type === 'lunch')

  const alerts = computeNutritionAlerts({
    consumed,
    target: { ...target, kcal: target.kcal || consumed.kcal },
    currentHour,
    hasLunchLog,
  })

  const sentAlertCodes = new Set(
    (alertMessages ?? [])
      .map((m: any) => String((m.metadata as any)?.code ?? ''))
      .filter(Boolean)
  )

  for (const alert of alerts) {
    if (sentAlertCodes.has(alert.code)) continue
    await db.from('chat_messages').insert({
      client_id: clientId,
      role: 'assistant',
      content: alert.body ? `${alert.title} — ${alert.body}` : alert.title,
      message_type: 'nutrition_alert_auto',
      metadata: {
        code: alert.code,
        severity: alert.severity,
        automated: true,
      },
    })
  }
}

// GET — messages actifs (3 derniers jours, archived_at IS NULL)
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = service()
  const cc = await resolveClientFromUser(user.id, user.email, db, 'id, first_name')
  if (!cc) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  await ensureAutomatedChatMessages(db, cc.id as string, (cc as { first_name?: string }).first_name)

  const { data: messages } = await db
    .from('chat_messages')
    .select('id, role, content, message_type, metadata, seen_at, created_at')
    .eq('client_id', cc.id)
    .is('archived_at', null)
    .order('created_at', { ascending: true })

  return NextResponse.json({ messages: messages ?? [] })
}

// POST — envoie message user → feature flag → (LLM ou escalade) → sauvegarde → retourne
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = service()
  // Inclure coach_id pour le feature flag check
  const cc = await resolveClientFromUser(user.id, user.email, db, 'id, first_name, coach_id')
  if (!cc) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const body = await req.json()
  const content: string = String(body.content ?? '').trim().slice(0, 500)
  const message_type: string = ['text', 'quick_reply', 'slider', 'voice'].includes(body.message_type)
    ? body.message_type
    : 'text'
  if (!content) return NextResponse.json({ error: 'Empty message' }, { status: 400 })

  // Rate limit via ai_coach_daily_usage (existant — conserver)
  const timezone = await resolveClientTimezone(db, cc.id)
  const today = computePhysiologicalDate(new Date(), timezone)
  const { data: usage } = await db
    .from('ai_coach_daily_usage')
    .select('message_count')
    .eq('client_id', cc.id)
    .eq('date', today)
    .single()

  const count = usage?.message_count ?? 0
  if (count >= DAILY_LIMIT) {
    return NextResponse.json({ error: 'Daily limit reached', remaining: 0 }, { status: 429 })
  }

  const metadata = body.metadata || null
  const coachId = (cc as any).coach_id as string | null

  // Sauvegarder message utilisateur
  const { data: userMsg } = await db
    .from('chat_messages')
    .insert({ client_id: cc.id, role: 'user', content, message_type, metadata })
    .select('id, role, content, message_type, metadata, created_at')
    .single()

  // ── Mode Enquête : Interception pattern_reply ───────────────────────────────
  if (metadata?.key === 'pattern_reply') {
    const isPredefined = metadata.value !== 99 // 99 = 'Autre (écrire)'

    if (coachId) {
      // Notifier le coach
      await db.from('coach_notifications').insert({
        coach_id: coachId,
        client_id: cc.id,
        chat_message_id: userMsg?.id,
        category: 'pattern_inquiry',
        status: 'pending',
        priority: 3
      })
    }

    if (isPredefined) {
      // Si réponse prédéfinie, on s'arrête là et on renvoie un message scripté (pas de LLM)
      const botResponse = "Merci pour ce retour. Je le partage avec ton coach."
      const { data: botMsg } = await db
        .from('chat_messages')
        .insert({
          client_id: cc.id,
          role: 'assistant',
          content: botResponse,
          message_type: 'text',
          parent_message_id: userMsg?.id ?? null,
        })
        .select('id, role, content, message_type, metadata, created_at')
        .single()
      
      return NextResponse.json({ userMessage: userMsg, botMessage: botMsg, llmDisabled: true })
    }
  }

  // ── Feature flag check ──────────────────────────────────────────────────────
  let llmEnabled = false

  if (coachId) {
    const [{ data: coachProfile }, { data: clientSettings }] = await Promise.all([
      db.from('coach_profiles')
        .select('has_ai_llm')
        .eq('coach_id', coachId)
        .maybeSingle(),
      db.from('coach_ai_settings_per_client')
        .select('ai_llm_enabled')
        .eq('coach_id', coachId)
        .eq('client_id', cc.id)
        .maybeSingle(),
    ])
    llmEnabled = (coachProfile?.has_ai_llm ?? false) && (clientSettings?.ai_llm_enabled ?? false)
  }

  if (!llmEnabled) {
    // Marquer message comme requérant intervention coach
    if (userMsg) {
      await db
        .from('chat_messages')
        .update({ requires_coach_response: true, coach_response_reason: 'llm_disabled' })
        .eq('id', userMsg.id)

      if (coachId) {
        await db.from('coach_notifications').insert({
          coach_id: coachId,
          client_id: cc.id,
          chat_message_id: userMsg.id,
          category: 'out_of_scope',
          status: 'pending',
          priority: 2
        })
      }
    }
    return NextResponse.json({ userMessage: userMsg, botMessage: null, llmDisabled: true })
  }

  // ── Escalade Silencieuse (Pré-LLM) ──────────────────────────────────────────
  const escalation = evaluateSilentEscalation(content)
  if (escalation.shouldEscalate) {
    if (userMsg) {
      await db
        .from('chat_messages')
        .update({ requires_coach_response: true, coach_response_reason: escalation.reason })
        .eq('id', userMsg.id)

      const isSafety = escalation.reason === 'safety_health' || escalation.reason === 'safety_mental'
      const priority = isSafety ? 1 : 2
      const notificationCategory = isSafety ? 'safety' : 'out_of_scope'

      if (coachId) {
        await db.from('coach_notifications').insert({
          coach_id: coachId,
          client_id: cc.id,
          chat_message_id: userMsg.id,
          category: notificationCategory,
          status: 'pending',
          priority
        })

        if (isSafety) {
          // Send urgent email
          const { data: coachProfileExt } = await db.from('user_profiles').select('email, first_name').eq('id', coachId).single()
          if (coachProfileExt?.email) {
            await sendCoachAlertEmail({
              to: coachProfileExt.email,
              coachFirstName: coachProfileExt.first_name || 'Coach',
              clientFirstName: cc.first_name || 'Client',
              category: 'safety',
              messageExcerpt: content.slice(0, 200),
              inboxUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://stryvlab.com'}/coach/inbox`
            }).catch(e => console.error('[sendCoachAlertEmail] error:', e))
          }
        }
      }
    }
    return NextResponse.json({ userMessage: userMsg, botMessage: null, escalated: true })
  }

  // ── Appel LLM via wrapper centralisé ────────────────────────────────────────
  const { data: history } = await db
    .from('chat_messages')
    .select('role, content')
    .eq('client_id', cc.id)
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(20)

  const systemPrompt = await buildSystemPrompt(cc.id)

  const llmResult = await callLLM({
    systemPrompt,
    userMessage: content,
    conversationHistory: (history ?? [])
      .reverse()
      .map((m: any) => ({ role: m.role as 'user' | 'assistant', content: String(m.content) })),
    clientId: cc.id,
    coachId: coachId ?? undefined,
    chatMessageId: userMsg?.id,
    maxTokens: 300,
  })

  let botMsg = null
  if (llmResult) {
    const { data: inserted } = await db
      .from('chat_messages')
      .insert({
        client_id: cc.id,
        role: 'assistant',
        content: llmResult.content,
        message_type: 'text',
        parent_message_id: userMsg?.id ?? null,
        trace_id: llmResult.traceId || null,
      })
      .select('id, role, content, message_type, metadata, created_at')
      .single()
    botMsg = inserted
  }

  // Upsert usage (conserver comportement existant)
  await db.from('ai_coach_daily_usage').upsert(
    { client_id: cc.id, date: today, message_count: count + 1 },
    { onConflict: 'client_id,date' }
  )

  return NextResponse.json({
    userMessage: userMsg,
    botMessage: botMsg,
    remaining: DAILY_LIMIT - count - 1,
  })
}
