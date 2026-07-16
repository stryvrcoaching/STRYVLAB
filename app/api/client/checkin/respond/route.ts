import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { z } from 'zod'
import OpenAI from 'openai'
import { inngest } from '@/lib/inngest/client'
import { resolveClientTimezone } from '@/lib/client/checkin/resolveClientTimezone'
import { buildSystemPrompt } from '@/lib/client/ai-coach/buildSystemPrompt'
import { buildDailyBrief } from '@/lib/client/ai-coach/buildDailyBrief'
import { computePhysiologicalDate } from '@/lib/nutrition/physiological-date'
import { resolveProtocolDayByDate } from '@/lib/nutrition/protocol-schedule'
import {
  computePhysiologicalDateInTimezone,
  getLocalTimeParts,
  isWithinBacklogWindow,
} from '@/lib/client/checkin/timeWindows'
import { formatSleepHours } from '@/lib/client/checkin/sleepTimeFormat'
import { getPointsForAction } from '@/lib/checkins/points'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const bodySchema = z.object({
  config_id: z.string().uuid(),
  moment: z.enum(['morning', 'evening']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  responses: z.record(z.string(), z.number()),
})

type NormalizedCheckinData = {
  sleep_hours?: number
  sleep_quality?: number
  energy_level?: number
  stress_level?: number
  weight_kg?: number
  daily_steps?: number
  hunger_level?: number
  muscle_soreness?: number
  rhr_morning?: number
  mood?: number
}

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured')
  return new OpenAI({ apiKey })
}

function normalizeLegacyResponses(responses: Record<string, number>): NormalizedCheckinData {
  return {
    sleep_hours: responses.sleep_hours ?? responses.sleep_duration,
    sleep_quality: responses.sleep_quality,
    energy_level: responses.energy_level ?? responses.energy,
    stress_level: responses.stress_level ?? responses.stress,
    weight_kg: responses.weight_kg,
    daily_steps: responses.daily_steps,
    hunger_level: responses.hunger_level,
    muscle_soreness: responses.muscle_soreness,
    rhr_morning: responses.rhr_morning,
    mood: responses.mood,
  }
}

function buildSummaryContent(
  moment: 'morning' | 'evening',
  data: NormalizedCheckinData,
): string {
  const QUALITY_LABELS: Record<number, string> = { 1: 'Mauvais', 2: 'Moyen', 3: 'Bien', 4: 'Excellent' }
  const ENERGY_LABELS: Record<number, string> = { 1: 'Épuisé', 2: 'Fatigué', 3: 'Normal', 4: 'Chargé', 5: 'Top ⚡' }
  const STRESS_LABELS: Record<number, string> = { 1: 'Aucun', 2: 'Léger', 3: 'Modéré', 4: 'Élevé', 5: 'Intense' }
  const MOOD_LABELS: Record<number, string> = { 1: 'Bas', 2: 'Moyen-', 3: 'Stable', 4: 'Bon', 5: 'Excellent' }

  if (moment === 'morning') {
    const line1: string[] = []
    const line2: string[] = []

    if (data.sleep_hours != null) line1.push(`Sommeil ${formatSleepHours(data.sleep_hours)}`)
    if (data.sleep_quality != null) line1.push(`Qualité ${QUALITY_LABELS[data.sleep_quality] ?? data.sleep_quality}`)
    if (data.energy_level != null) line2.push(`Énergie : ${ENERGY_LABELS[data.energy_level] ?? data.energy_level}`)
    if (data.weight_kg != null) line2.push(`Poids : ${data.weight_kg} kg`)
    if (data.rhr_morning != null) line2.push(`RHR : ${data.rhr_morning} bpm`)
    if (data.mood != null) line2.push(`Humeur : ${MOOD_LABELS[data.mood] ?? data.mood}`)

    const lines = [
      line1.length ? `Check-in matin · ${line1.join(' · ')}` : 'Check-in matin validé',
      line2.join(' · '),
    ].filter(Boolean)
    return lines.join('\n')
  }

  const parts: string[] = []
  if (data.energy_level != null) parts.push(`Énergie : ${ENERGY_LABELS[data.energy_level] ?? data.energy_level}`)
  if (data.stress_level != null) parts.push(`Stress : ${STRESS_LABELS[data.stress_level] ?? data.stress_level}`)
  if (data.muscle_soreness != null) parts.push(`Courbatures : ${data.muscle_soreness}/4`)
  if (data.hunger_level != null) parts.push(`Faim : ${data.hunger_level}/4`)
  if (data.daily_steps != null) parts.push(`Pas : ${data.daily_steps}`)
  if (data.mood != null) parts.push(`Humeur : ${MOOD_LABELS[data.mood] ?? data.mood}`)

  return parts.length ? `Check-in soir · ${parts.join(' · ')}` : 'Check-in soir validé'
}

async function projectCheckinToAssessment(
  db: ReturnType<typeof service>,
  clientId: string,
  date: string,
  data: NormalizedCheckinData,
) {
  const fields: Array<{ field_key: string; value_number: number | null }> = [
    { field_key: 'weight_kg', value_number: data.weight_kg ?? null },
    { field_key: 'daily_steps', value_number: data.daily_steps ?? null },
    { field_key: 'sleep_duration_h', value_number: data.sleep_hours ?? null },
    { field_key: 'sleep_quality', value_number: data.sleep_quality ?? null },
    { field_key: 'energy_level', value_number: data.energy_level ?? null },
    { field_key: 'stress_level', value_number: data.stress_level ?? null },
  ].filter((field) => field.value_number != null)

  if (fields.length === 0) return

  const { data: owner } = await db
    .from('coach_clients')
    .select('coach_id')
    .eq('id', clientId)
    .maybeSingle()
  if (!owner?.coach_id) return

  const { data: existingTemplate } = await db
    .from('assessment_templates')
    .select('id')
    .eq('coach_id', owner.coach_id)
    .eq('name', '__checkin_realtime__')
    .maybeSingle()

  let templateId = existingTemplate?.id as string | undefined
  if (!templateId) {
    const { data: createdTemplate } = await db
      .from('assessment_templates')
      .insert({
        coach_id: owner.coach_id,
        name: '__checkin_realtime__',
        description: 'Template système — projection temps réel check-in',
        template_type: 'custom',
        blocks: [{ id: 'checkin_realtime_block', module: 'biometrics', title: 'Check-in realtime', fields: [] }],
        is_default: false,
      })
      .select('id')
      .single()
    templateId = createdTemplate?.id
  }
  if (!templateId) return

  const submittedAt = new Date(`${date}T12:00:00Z`).toISOString()
  const { data: existingSubmission } = await db
    .from('assessment_submissions')
    .select('id')
    .eq('client_id', clientId)
    .eq('template_id', templateId)
    .eq('submitted_at', submittedAt)
    .maybeSingle()

  let submissionId = existingSubmission?.id as string | undefined
  if (!submissionId) {
    const { data: createdSubmission } = await db
      .from('assessment_submissions')
      .insert({
        coach_id: owner.coach_id,
        client_id: clientId,
        template_id: templateId,
        template_snapshot: { blocks: [{ id: 'checkin_realtime_block', module: 'biometrics' }] },
        status: 'completed',
        filled_by: 'client',
        submitted_at: submittedAt,
        bilan_date: date,
      })
      .select('id')
      .single()
    submissionId = createdSubmission?.id
  }
  if (!submissionId) return

  for (const field of fields) {
    await db.from('assessment_responses').upsert(
      {
        submission_id: submissionId,
        block_id: 'checkin_realtime_block',
        field_key: field.field_key,
        value_number: field.value_number,
      },
      { onConflict: 'submission_id,block_id,field_key' },
    )
  }
}

// POST /api/client/checkin/respond
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: client } = await service()
    .from('coach_clients')
    .select('id, first_name, timezone')
    .eq('user_id', user.id)
    .single()
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const body = bodySchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error }, { status: 400 })

  // Verify config belongs to this client and is active
  const { data: config } = await service()
    .from('daily_checkin_configs')
    .select('id, is_active, days_of_week')
    .eq('id', body.data.config_id)
    .eq('client_id', client.id)
    .single()
  if (!config || !config.is_active) {
    return NextResponse.json({ error: 'Check-in not active' }, { status: 403 })
  }

  const db = service()
  const timezone = await resolveClientTimezone(db, client.id)
  const now = new Date()
  const localNow = getLocalTimeParts(now, timezone)
  const slotDate = body.data.date ?? computePhysiologicalDateInTimezone(now, timezone)

  if (!isWithinBacklogWindow(now, slotDate, body.data.moment, timezone)) {
    return NextResponse.json({ error: 'Check-in unavailable for this slot' }, { status: 409 })
  }

  // Prevent duplicate response for the exact requested slot
  const { data: existing } = await db
    .from('client_daily_checkins')
    .select('id')
    .eq('client_id', client.id)
    .eq('date', slotDate)
    .eq('flow_type', body.data.moment)
    .maybeSingle()
  if (existing) {
    return NextResponse.json({ error: 'Already responded for this slot' }, { status: 409 })
  }

  const isLate = localNow.hour >= 0 && localNow.hour < 2
  const pointsAwarded = getPointsForAction(isLate ? 'checkin_late' : 'checkin')
  const normalized = normalizeLegacyResponses(body.data.responses)

  const { data: response, error } = await db
    .from('daily_checkin_responses')
    .insert({
      client_id: client.id,
      config_id: body.data.config_id,
      moment: body.data.moment,
      responses: body.data.responses,
      is_late: isLate,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await db
    .from('client_daily_checkins')
    .upsert(
      {
        client_id: client.id,
        date: slotDate,
        flow_type: body.data.moment,
        sleep_hours: normalized.sleep_hours,
        sleep_quality: normalized.sleep_quality,
        energy_level: normalized.energy_level,
        stress_level: normalized.stress_level,
        weight_kg: normalized.weight_kg,
        daily_steps: normalized.daily_steps,
        hunger_level: normalized.hunger_level,
        muscle_soreness: normalized.muscle_soreness,
        rhr_morning: normalized.rhr_morning,
      },
      { onConflict: 'client_id,date,flow_type' },
    )

  await db
    .from('chat_sessions')
    .upsert(
      {
        client_id: client.id,
        date: slotDate,
        flow_type: body.data.moment,
        completed_at: now.toISOString(),
      },
      { onConflict: 'client_id,date,flow_type' },
    )

  // Insert smart_agenda_events (fire and forget)
  void db.from('smart_agenda_events').insert({
    client_id: client.id,
    event_type: 'checkin',
    event_date: slotDate,
    event_time: `${String(localNow.hour).padStart(2, '0')}:${String(localNow.minute).padStart(2, '0')}`,
    source_id: response.id,
    title: body.data.moment === 'morning' ? 'Check-in du matin' : 'Check-in du soir',
    summary: null,
    data: null,
  })

  // Trigger streak evaluation + points attribution asynchronously
  await inngest.send({
    name: 'checkin/streak.evaluate',
    data: {
      client_id: client.id,
      response_id: response.id,
      is_late: isLate,
      days_of_week: config.days_of_week,
    },
  })

  try {
    await projectCheckinToAssessment(db, client.id, slotDate, normalized)
  } catch {
    // Non-blocking — legacy modal check-in remains saved
  }

  const summaryContent = buildSummaryContent(body.data.moment, normalized)

  const { data: summaryMessage } = await db.from('chat_messages').insert({
    client_id: client.id,
    role: 'user',
    message_type: 'checkin_summary',
    content: summaryContent,
    metadata: { checkin_response_id: response.id, automated: true },
  })
    .select('id, role, content, message_type, metadata, seen_at, created_at')
    .single()

  let closingMessage = body.data.moment === 'morning'
    ? 'Check-in matin enregistré ✓'
    : 'Check-in soir enregistré ✓'

  try {
    const openai = getOpenAIClient()
    const systemPrompt = await buildSystemPrompt(client.id)
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 150,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `${summaryContent}\n\nGénère un message de clôture court (2-3 lignes max) personnalisé basé sur ces données. Sois direct et positif.`,
        },
      ],
    })
    closingMessage = completion.choices[0]?.message?.content ?? closingMessage
  } catch {
    // Non-blocking — fallback to default message
  }

  const { data: botMessage } = await db
    .from('chat_messages')
    .insert({
      client_id: client.id,
      role: 'assistant',
      content: closingMessage,
      message_type: 'text',
      metadata: { checkin_response_id: response.id, automated: true },
    })
    .select('id, role, content, message_type, metadata, seen_at, created_at')
    .single()

  try {
    const [programRes, protocolRes] = await Promise.allSettled([
      db.from('programs')
        .select('name, frequency, program_sessions(name, day_of_week, days_of_week)')
        .eq('client_id', client.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      db.from('nutrition_protocols')
        .select('schedule_start_date, nutrition_protocol_days(position, calories, protein_g, hydration_ml), nutrition_protocol_schedule_slots(week_index, dow, protocol_day_position)')
        .eq('client_id', client.id)
        .eq('status', 'shared')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    const activeProgram = programRes.status === 'fulfilled' ? (programRes.value as any)?.data : null
    const protocol = protocolRes.status === 'fulfilled' ? (protocolRes.value as any)?.data : null
    const protocolDay = resolveProtocolDayByDate(
      computePhysiologicalDate(new Date(), client.timezone as string | undefined),
      protocol?.schedule_start_date ?? null,
      protocol?.nutrition_protocol_days ?? [],
      protocol?.nutrition_protocol_schedule_slots ?? [],
    ) as any

    const todayDow = new Date().getDay()
    const sessions: any[] = activeProgram?.program_sessions ?? []
    const todaySession = sessions.find((session: any) => {
      const dows: number[] = Array.isArray(session.days_of_week) && session.days_of_week.length > 0
        ? session.days_of_week
        : session.day_of_week != null ? [session.day_of_week] : []
      return dows.includes(todayDow)
    })

    const briefContent = await buildDailyBrief({
      flowType: body.data.moment,
      sessionName: todaySession?.name ?? null,
      targetKcal: protocolDay?.calories ?? 0,
      targetProtein: protocolDay?.protein_g ?? 0,
      targetWaterMl: protocolDay?.hydration_ml ?? 2500,
      energyLevel: normalized.energy_level ?? null,
      sleepHours: normalized.sleep_hours ?? null,
      sleepQuality: normalized.sleep_quality ?? null,
      muscleSoreness: normalized.muscle_soreness ?? null,
    })

    await db.from('chat_messages').insert({
      client_id: client.id,
      role: 'assistant',
      content: briefContent,
      message_type: 'daily_brief',
      metadata: { checkin_response_id: response.id, automated: true },
    })
  } catch {
    // Non-blocking — brief failure must not affect check-in response
  }

  const today = computePhysiologicalDate(new Date(), client.timezone as string | undefined)
  const { data: usage } = await db
    .from('ai_coach_daily_usage')
    .select('message_count')
    .eq('client_id', client.id)
    .eq('date', today)
    .maybeSingle()

  await db.from('ai_coach_daily_usage').upsert(
    {
      client_id: client.id,
      date: today,
      message_count: (usage?.message_count ?? 0) + 1,
    },
    { onConflict: 'client_id,date' },
  )

  return NextResponse.json({
    ...response,
    points_awarded: pointsAwarded,
    summaryMessage,
    botMessage,
  }, { status: 201 })
}
