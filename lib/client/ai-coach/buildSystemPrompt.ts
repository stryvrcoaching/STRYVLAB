import { createClient as createServiceClient } from '@supabase/supabase-js'
import { computePhysiologicalDate } from '@/lib/nutrition/physiological-date'
import { resolveClientTimezone } from '@/lib/client/checkin/resolveClientTimezone'
import { utcRangeForPhysiologicalDate } from '@/lib/client/checkin/timeWindows'
import { computeDailySignals } from '@/lib/client/ai-coach/chatSignals'
import { resolveTone } from '@/lib/client/ai-coach/resolveTone'
import { resolveClientLanguage } from '@/lib/client/resolve-language'

function svc() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function pct(val: number, total: number): string {
  if (!total) return '0%'
  return `${Math.round((val / total) * 100)}%`
}

function fmtDate(date: string): string {
  const [, m, d] = date.split('-')
  const months = ['jan', 'fév', 'mar', 'avr', 'mai', 'jun', 'jul', 'aoû', 'sep', 'oct', 'nov', 'déc']
  return `${parseInt(d)} ${months[parseInt(m) - 1]}`
}

export async function buildSystemPrompt(clientId: string): Promise<string> {
  const db = svc()
  const timezone = await resolveClientTimezone(db, clientId)
  const today = computePhysiologicalDate(new Date(), timezone)
  const { start: physiologicalStart, end: physiologicalEnd } = utcRangeForPhysiologicalDate(today, timezone)
  const dayStart = physiologicalStart.toISOString()
  const dayEnd   = physiologicalEnd.toISOString()
  const nowTime  = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const nextPhysioStart = new Date(physiologicalEnd.getTime() + 1).toISOString()

  const threeDaysAgo = (() => {
    const d = new Date(`${today}T00:00:00`)
    d.setDate(d.getDate() - 3)
    return d.toISOString().split('T')[0]
  })()

  // Sequential first: need coach_id before running parallel queries
  const { data: profileData } = await db
    .from('coach_clients')
    .select('first_name, goal, tdee, fitness_level, coach_id, display_lang')
    .eq('id', clientId)
    .single()

  const firstName    = profileData?.first_name   ?? 'le client'
  const goal         = profileData?.goal          ?? 'non renseigné'
  const tdee         = profileData?.tdee          ?? 0
  const fitnessLevel = profileData?.fitness_level ?? 'intermédiaire'
  const coachId      = profileData?.coach_id      ?? null
  const clientDisplayLang = await resolveClientLanguage(db, clientId, profileData?.display_lang ?? 'fr')

  const [
    coachProfileResult,
    nutritionProtocol,
    mealsResult,
    legacyMealsResult,
    waterResult,
    sessionResult,
    activitiesResult,
    restrictionsResult,
    bodyCompResult,
    nutritionTrendsResult,
    checkinsResult,
    activeProgramResult,
    perClientToneResult,
    globalToneResult,
    plannedPrepsResult,
  ] = await Promise.allSettled([
    coachId
      ? db.from('coach_profiles').select('full_name').eq('coach_id', coachId).maybeSingle()
      : Promise.resolve({ data: null }),
    db.from('nutrition_protocols')
      .select('name, nutrition_protocol_days(calories, protein_g, fat_g, carbs_g, hydration_ml)')
      .eq('client_id', clientId)
      .eq('status', 'shared')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Nutrition Composer meals (correct columns)
    db.from('nutrition_meals')
      .select('total_calories, total_protein_g, total_fat_g, total_carbs_g, meal_type, title, logged_at')
      .eq('client_id', clientId)
      .eq('physiological_date', today)
      .order('logged_at', { ascending: true }),
    // Legacy meal_logs
    db.from('meal_logs')
      .select('estimated_macros, logged_at, meal_name')
      .eq('client_id', clientId)
      .gte('logged_at', physiologicalStart.toISOString())
      .lt('logged_at', nextPhysioStart)
      .eq('ai_status', 'done'),
    db.from('client_water_logs')
      .select('amount_ml, caffeine_mg')
      .eq('client_id', clientId)
      .gte('logged_at', dayStart)
      .lte('logged_at', dayEnd),
    db.from('client_session_logs')
      .select('id, completed_at')
      .eq('client_id', clientId)
      .not('completed_at', 'is', null)
      .gte('completed_at', dayStart)
      .lte('completed_at', dayEnd)
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    db.from('client_activity_logs')
      .select('activity_type, custom_label, duration_min')
      .eq('client_id', clientId)
      .gte('started_at', dayStart)
      .lte('started_at', dayEnd),
    db.from('metric_annotations')
      .select('label, body_part, severity')
      .eq('client_id', clientId)
      .eq('event_type', 'injury')
      .not('body_part', 'is', null),
    // Full bilan history — ascending (oldest first) for correct progression delta
    db.from('assessment_submissions')
      .select('bilan_date, assessment_responses(field_key, value_number)')
      .eq('client_id', clientId)
      .eq('status', 'completed')
      .order('bilan_date', { ascending: true })
      .limit(10),
    // 3-day nutrition trends
    db.from('nutrition_meals')
      .select('physiological_date, total_calories, total_protein_g')
      .eq('client_id', clientId)
      .gte('physiological_date', threeDaysAgo)
      .lt('physiological_date', today)
      .order('physiological_date', { ascending: false }),
    // Check-ins of the past 3 days
    db.from('client_daily_checkins')
      .select('date, flow_type, sleep_hours, sleep_quality, energy_level, stress_level, weight_kg, hunger_level, muscle_soreness')
      .eq('client_id', clientId)
      .gte('date', threeDaysAgo)
      .lte('date', today),
    // Active program with sessions
    db.from('programs')
      .select('name, weeks, frequency, program_sessions(id, name, day_of_week, days_of_week)')
      .eq('client_id', clientId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Tone — per-client override + coach global
    db.from('coach_ai_settings_per_client').select('ai_tone, ai_chat_lang').eq('client_id', clientId).maybeSingle(),
    coachId
      ? db.from('coach_profiles').select('ai_tone').eq('coach_id', coachId).maybeSingle()
      : Promise.resolve({ data: null }),
    // Planned preps for today
    db.from('client_nutrition_preps')
      .select('meal_slot, total_calories, total_protein_g, scenario_label, title')
      .eq('client_id', clientId)
      .eq('physiological_date', today)
      .eq('status', 'planned'),
  ])

  // ── Tone (D5) ──────────────────────────────────────────────────────────────
  const perClientTone = perClientToneResult.status === 'fulfilled' ? (perClientToneResult.value as any)?.data?.ai_tone ?? null : null
  const globalTone = globalToneResult.status === 'fulfilled' ? (globalToneResult.value as any)?.data?.ai_tone ?? null : null
  const tone = resolveTone(perClientTone, globalTone)
  const TONE_DIRECTIVE: Record<typeof tone, string> = {
    strict: 'Ton strict, direct, sans complaisance. Pas de flatterie.',
    bienveillant: 'Ton bienveillant et direct. Encourageant sans flatterie.',
    motivant: 'Ton motivant et énergique. Pas de flatterie creuse.',
    neutre: 'Ton neutre et factuel. Sobre.',
  }

  // ── Chat language ─────────────────────────────────────
  const perClientSettings = perClientToneResult.status === 'fulfilled' ? (perClientToneResult.value as any)?.data : null
  const coachLangOverride = perClientSettings?.ai_chat_lang as 'fr' | 'es' | 'en' | null ?? null
  const chatLang: 'fr' | 'es' | 'en' = coachLangOverride ?? clientDisplayLang

  const LANG_DIRECTIVE: Record<'fr' | 'es' | 'en', string> = {
    fr: "Tu réponds TOUJOURS en français, quelle que soit la langue utilisée par le client.",
    es: "Respondes SIEMPRE en español, sin importar el idioma que use el cliente.",
    en: "You ALWAYS reply in English, regardless of the language used by the client.",
  }

  // ── Coach identity ─────────────────────────────────────────────────────────
  const coachProfile = coachProfileResult.status === 'fulfilled' ? (coachProfileResult.value as any)?.data : null
  const coachName = coachProfile?.full_name?.trim() || 'ton coach'

  // ── Macros targets ────────────────────────────────────────────────────────
  const protocol = nutritionProtocol.status === 'fulfilled' ? nutritionProtocol.value.data : null
  const protocolDay = (protocol as any)?.nutrition_protocol_days?.[0]
  const targetKcal: number     = protocolDay?.calories     ?? tdee
  const targetProtein: number  = protocolDay?.protein_g    ?? 0
  const targetFat: number      = protocolDay?.fat_g        ?? 0
  const targetCarbs: number    = protocolDay?.carbs_g      ?? 0
  const targetWaterMl: number  = protocolDay?.hydration_ml ?? 2500

  // ── Today nutrition (both sources) ────────────────────────────────────────
  const composerMeals    = mealsResult.status       === 'fulfilled' ? (mealsResult.value.data       ?? []) : []
  const legacyMealsData  = legacyMealsResult.status === 'fulfilled' ? (legacyMealsResult.value.data ?? []) : []

  const totalKcal =
    composerMeals.reduce((s, m) => s + Number((m as any).total_calories ?? 0), 0) +
    legacyMealsData.reduce((s: number, m: any) => s + Number(m.estimated_macros?.calories_kcal ?? 0), 0)

  const totalProtein =
    composerMeals.reduce((s, m) => s + Number((m as any).total_protein_g ?? 0), 0) +
    legacyMealsData.reduce((s: number, m: any) => s + Number(m.estimated_macros?.protein_g ?? 0), 0)

  const totalFat =
    composerMeals.reduce((s, m) => s + Number((m as any).total_fat_g ?? 0), 0) +
    legacyMealsData.reduce((s: number, m: any) => s + Number(m.estimated_macros?.fat_g ?? 0), 0)

  const totalCarbs =
    composerMeals.reduce((s, m) => s + Number((m as any).total_carbs_g ?? 0), 0) +
    legacyMealsData.reduce((s: number, m: any) => s + Number(m.estimated_macros?.carbs_g ?? 0), 0)

  const MEAL_LABELS: Record<string, string> = {
    breakfast: 'Petit-déjeuner', lunch: 'Déjeuner',
    dinner: 'Dîner', snack: 'Collation',
  }

  const mealsLines = composerMeals.length > 0 || legacyMealsData.length > 0
    ? [
        ...composerMeals.map((m: any) => {
          const time  = new Date(m.logged_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
          const label = m.title ?? MEAL_LABELS[m.meal_type as string] ?? 'Repas'
          return `  - ${time} ${label}: ${Math.round(Number(m.total_calories ?? 0))} kcal`
        }),
        ...legacyMealsData.map((m: any) => {
          const time = new Date(m.logged_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
          return `  - ${time} ${m.meal_name ?? 'Repas'}: ${Math.round(Number(m.estimated_macros?.calories_kcal ?? 0))} kcal`
        }),
      ].join('\n')
    : '  - Aucun repas loggé'

  // ── Water ─────────────────────────────────────────────────────────────────
  const water        = waterResult.status === 'fulfilled' ? (waterResult.value.data ?? []) : []
  const totalWaterMl = water.reduce((s, w) => s + Number(w.amount_ml ?? 0), 0)
  const totalCaffeineMg = water.reduce((s, w) => s + Number(w.caffeine_mg ?? 0), 0)

  // ── Session (completed today) ─────────────────────────────────────────────
  const session     = sessionResult.status === 'fulfilled' ? sessionResult.value.data : null
  const sessionLine = session
    ? `Séance complétée à ${new Date(session.completed_at as string).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
    : "Aucune séance complétée aujourd'hui"

  // ── Activities ────────────────────────────────────────────────────────────
  const activities      = activitiesResult.status === 'fulfilled' ? (activitiesResult.value.data ?? []) : []
  const activitiesLine  = activities.length > 0
    ? activities.map(a => `  - ${a.custom_label ?? a.activity_type} ${a.duration_min}min`).join('\n')
    : '  Aucune'

  // ── Restrictions ──────────────────────────────────────────────────────────
  const restrictions     = restrictionsResult.status === 'fulfilled' ? (restrictionsResult.value.data ?? []) : []
  const restrictionsLine = restrictions.length > 0
    ? restrictions.map(r => `${r.label ?? r.body_part} (${r.severity})`).join(', ')
    : 'aucune'

  // ── Body composition — full history ───────────────────────────────────────
  const bilans = bodyCompResult.status === 'fulfilled' ? (bodyCompResult.value.data ?? []) : []
  type AssessmentResponse = { field_key: string; value_number: number | null }
  const extractValues = (bilan: any): Record<string, number> => {
    const out: Record<string, number> = {}
    for (const r of (bilan?.assessment_responses ?? []) as AssessmentResponse[]) {
      if (r.value_number != null) out[r.field_key] = r.value_number
    }
    return out
  }

  const firstBilanData  = bilans[0]     ? extractValues(bilans[0])                : {}
  const latestBilanData = bilans.length ? extractValues(bilans[bilans.length - 1]) : {}

  const firstWeight  = firstBilanData['weight_kg']    ?? null
  const firstBF      = firstBilanData['body_fat_pct'] ?? null
  const latestWeight = latestBilanData['weight_kg']    ?? null
  const latestBF     = latestBilanData['body_fat_pct'] ?? null
  const latestLBM    = latestBilanData['lean_mass_kg'] ?? null

  const totalWeightDelta = latestWeight != null && firstWeight != null
    ? +(latestWeight - firstWeight).toFixed(1) : null
  const totalBFDelta     = latestBF != null && firstBF != null
    ? +(latestBF - firstBF).toFixed(1) : null

  let bodyCompLines: string
  if (latestWeight == null) {
    bodyCompLines = 'Aucun bilan corporel enregistré'
  } else {
    const lines: string[] = []
    if (bilans[0]?.bilan_date && bilans.length > 1) {
      lines.push(`Début du suivi (${fmtDate(bilans[0].bilan_date)}): ${firstWeight ?? '?'}kg${firstBF != null ? ` | MG ${firstBF}%` : ''}`)
    }
    // Intermediate bilans
    if (bilans.length > 2) {
      bilans.slice(1, -1).forEach((b: any) => {
        const v  = extractValues(b)
        const w  = v['weight_kg'] ?? '?'
        const bf = v['body_fat_pct']
        lines.push(`  ${fmtDate(b.bilan_date)}: ${w}kg${bf != null ? ` | MG ${bf}%` : ''}`)
      })
    }
    const lastBilan = bilans[bilans.length - 1]
    lines.push(`Actuel (${fmtDate(lastBilan.bilan_date)}): ${latestWeight}kg${latestBF != null ? ` | MG ${latestBF}%` : ''}${latestLBM != null ? ` | MM ${latestLBM}kg` : ''}`)
    if (totalWeightDelta !== null) {
      const sign = totalWeightDelta > 0 ? '+' : ''
      lines.push(`PROGRESSION TOTALE: ${sign}${totalWeightDelta}kg poids${totalBFDelta !== null ? ` | ${totalBFDelta > 0 ? '+' : ''}${totalBFDelta}% MG` : ''}`)
    }
    bodyCompLines = lines.join('\n')
  }

  // ── Nutrition trends (3 derniers jours) ───────────────────────────────────
  const trendRows = nutritionTrendsResult.status === 'fulfilled'
    ? (nutritionTrendsResult.value.data ?? [])
    : []

  const trendBlock = trendRows.length > 0
    ? trendRows.map((row: any) => {
        const kcal      = Math.round(Number(row.total_calories ?? 0))
        const protein   = Math.round(Number(row.total_protein_g ?? 0))
        const kcalPct   = targetKcal > 0 ? Math.round((kcal / targetKcal) * 100) : 0
        const proteinOk = targetProtein > 0 ? protein >= targetProtein : true
        const d         = new Date(row.physiological_date + 'T12:00:00')
        const dayLabel  = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })
        return `  ${dayLabel}: ${kcal} kcal / ${targetKcal} (${kcalPct}%) | P ${protein}g / ${targetProtein}g ${proteinOk ? '✓' : '❌'}`
      }).join('\n')
    : '  Aucune donnée'

  // ── Check-ins du jour ─────────────────────────────────────────────────────
  const checkins       = checkinsResult.status === 'fulfilled' ? (checkinsResult.value.data ?? []) : []
  const todayCheckins  = checkins.filter((c: any) => c.date === today)
  const morningCheckin = todayCheckins.find((c: any) => c.flow_type === 'morning')
  const eveningCheckin = todayCheckins.find((c: any) => c.flow_type === 'evening')

  const QUALITY_LABELS: Record<number, string> = { 1: 'Mauvais', 2: 'Moyen', 3: 'Bien', 4: 'Excellent' }
  const ENERGY_LABELS:  Record<number, string> = { 1: 'Épuisé', 2: 'Fatigué', 3: 'Normal', 4: 'Chargé', 5: 'Top' }
  const STRESS_LABELS:  Record<number, string> = { 1: 'Aucun', 2: 'Léger', 3: 'Modéré', 4: 'Élevé', 5: 'Intense' }

  const morningLine = morningCheckin
    ? [
        morningCheckin.sleep_hours   != null ? `sommeil ${morningCheckin.sleep_hours}h`                                     : null,
        morningCheckin.sleep_quality != null ? `qualité ${QUALITY_LABELS[morningCheckin.sleep_quality] ?? morningCheckin.sleep_quality}` : null,
        morningCheckin.energy_level  != null ? `énergie ${ENERGY_LABELS[morningCheckin.energy_level]  ?? morningCheckin.energy_level}/5`  : null,
        morningCheckin.weight_kg     != null ? `poids ${morningCheckin.weight_kg}kg`                                        : null,
      ].filter(Boolean).join(', ')
    : 'non fait'

  const eveningLine = eveningCheckin
    ? [
        eveningCheckin.energy_level    != null ? `énergie ${ENERGY_LABELS[eveningCheckin.energy_level]   ?? eveningCheckin.energy_level}/5`   : null,
        eveningCheckin.stress_level    != null ? `stress ${STRESS_LABELS[eveningCheckin.stress_level]    ?? eveningCheckin.stress_level}`      : null,
        eveningCheckin.muscle_soreness != null ? `courbatures ${eveningCheckin.muscle_soreness}/4`                                            : null,
        eveningCheckin.hunger_level    != null ? `faim ${eveningCheckin.hunger_level}/4`                                                      : null,
      ].filter(Boolean).join(', ')
    : 'non fait'

  // ── Active program ────────────────────────────────────────────────────────
  const activeProgram = activeProgramResult.status === 'fulfilled'
    ? (activeProgramResult.value as any)?.data
    : null

  const todayDow = new Date().getDay() // 0=Sun, 1=Mon, ..., 6=Sat

  let programBlock = ''
  if (activeProgram) {
    const sessions: any[] = activeProgram.program_sessions ?? []
    const todaySession = sessions.find((s: any) => {
      const dows: number[] = Array.isArray(s.days_of_week) && s.days_of_week.length > 0
        ? s.days_of_week
        : s.day_of_week != null ? [s.day_of_week] : []
      return dows.includes(todayDow)
    })
    const plannedSessionLine = todaySession
      ? `Séance prévue aujourd'hui: ${todaySession.name}`
      : "Séance prévue aujourd'hui: Repos / récupération active"

    programBlock = `[PROGRAMME ACTIF]
Nom: ${activeProgram.name} | ${activeProgram.frequency ?? '?'} séances/semaine | ${activeProgram.weeks ?? '?'} semaines
${plannedSessionLine}`
  }

  // ── Planned preps ──────────────────────────────────────────────────────────
  const plannedPreps = plannedPrepsResult.status === 'fulfilled' ? (plannedPrepsResult.value.data ?? []) : []
  const prepKcalPlanned = plannedPreps.reduce((s: number, p: any) => s + Number(p.total_calories ?? 0), 0)
  const prepProteinPlanned = plannedPreps.reduce((s: number, p: any) => s + Number(p.total_protein_g ?? 0), 0)
  const prepLine = plannedPreps.length > 0
    ? `${plannedPreps.length} repas planifié(s) (Smart Nutrition) pour aujourd'hui — total prévu : ${Math.round(prepKcalPlanned)} kcal, ${Math.round(prepProteinPlanned)}g protéines.`
    : null

  // ── Signals ───────────────────────────────────────────────────────────────
  const signals = computeDailySignals({
    targetKcal,
    targetProtein,
    targetWaterMl,
    totalKcal,
    totalProtein,
    totalWaterMl,
    bilans,
    checkinsPast3Days: checkinsResult.status === 'fulfilled' ? (checkinsResult.value.data ?? []) : [], // Wait, the checkins query is only for today. Let's fix this.
    session,
  })

  // ── System prompt ─────────────────────────────────────────────────────────
  const identityBlock = `Tu ES ${coachName}, le coach de ${firstName} (assistant qui parle en son nom, jamais une entité séparée).
RÈGLES STRICTES :
1. Pas d'hallucinations : base-toi UNIQUEMENT sur les signaux ci-dessous. Ne mentionne pas de symptômes ou de données que le client n'a pas.
2. Tu ne renvoies JAMAIS le client vers le coach ("vois ça avec ton coach" est interdit) — tu ES le coach. Si un sujet dépasse ton périmètre (programme, médical), reste neutre et factuel ; le coach est alerté en arrière-plan.
3. Tu ne touches JAMAIS à la programmation (ne dis pas "baisse la charge", "décale ta séance", "repose-toi", "reprogramme"). Conseils = tips lifestyle uniquement, sans présumer d'habitudes inconnues.
4. Honnêteté : jamais de fausse louange. Nomme les faits tels qu'ils sont (séance non faite, dépassement calorique, etc.).
5. Le prénom du client est ${firstName}. Ne l'appelle JAMAIS "le client". S'il n'est pas renseigné, dis "toi".
6. Ne modifie pas les macros cibles. Ne dis pas "le programme que ton coach t'a préparé", dis "ton programme".
7. Réponses courtes, 2 à 3 phrases maximum. ${TONE_DIRECTIVE[tone]}`

  let checkinMatinSentences = "Le check-in du matin n'a pas encore été fait."
  if (morningCheckin) {
    const s = []
    if (morningCheckin.sleep_hours != null) s.push(`a dormi ${morningCheckin.sleep_hours}h`)
    if (morningCheckin.energy_level != null) s.push(`a une énergie de niveau ${morningCheckin.energy_level}/5`)
    checkinMatinSentences = `Ce matin, ${firstName} ` + s.join(' et ') + '.'
  }

  let checkinSoirSentences = "Le check-in du soir n'a pas encore été fait."
  if (eveningCheckin) {
    const s = []
    if (eveningCheckin.stress_level != null) s.push(`un stress de niveau ${eveningCheckin.stress_level}/5`)
    if (eveningCheckin.muscle_soreness != null) s.push(`des courbatures à ${eveningCheckin.muscle_soreness}/4`)
    if (eveningCheckin.energy_level != null) s.push(`une énergie à ${eveningCheckin.energy_level}/5`)
    checkinSoirSentences = `Ce soir, ${firstName} signale ` + s.join(', ') + '.'
  }

  let weightSignal = ""
  if (signals.weightDelta7d !== null) {
    weightSignal = `Le poids a ${signals.weightDelta7d > 0 ? 'augmenté' : 'baissé'} de ${Math.abs(signals.weightDelta7d)}kg par rapport au début du suivi.`
  }

  return `${identityBlock}

SIGNAUX CLIENT (pour ta compréhension, ne répète pas tout bêtement) :
- Objectif : ${goal} (Niveau: ${fitnessLevel})
- Restrictions : ${restrictionsLine}
- Nutrition du jour : ${signals.caloriesPct}% des calories atteintes, ${signals.proteinPct}% des protéines.${prepLine ? `\n- Plan Smart Nutrition : ${prepLine}` : ''}
- Hydratation : ${signals.hydrationPct}% de l'objectif atteint.
- Caféine / théine du jour : ${totalCaffeineMg}mg.
- ${weightSignal}
- Séance : ${session ? "Séance complétée aujourd'hui." : "Pas de séance complétée aujourd'hui."}

${checkinMatinSentences}
${checkinSoirSentences}

${LANG_DIRECTIVE[chatLang]}
`
}
