import { SupabaseClient } from '@supabase/supabase-js'
import { computePhysiologicalDate } from '@/lib/nutrition/physiological-date'
import { resolveClientTimezone } from '@/lib/client/checkin/resolveClientTimezone'
import { utcRangeForPhysiologicalDate } from '@/lib/client/checkin/timeWindows'
import { resolveProtocolDayByDate } from '@/lib/nutrition/protocol-schedule'

export interface PatternResult {
  code: string
  statement: string
  question: string
  options: { label: string; value: number }[]
}

/**
 * Returns a date string YYYY-MM-DD offset by X days
 */
function getOffsetDateStr(dateStr: string, offsetDays: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().split('T')[0]
}

export async function evaluateClientPatterns(clientId: string, db: SupabaseClient): Promise<PatternResult | null> {
  const timezone = await resolveClientTimezone(db as any, clientId)
  const today = computePhysiologicalDate(new Date(), timezone)
  const todayDateObj = new Date(today)
  const sevenDaysAgoObj = new Date(today)
  sevenDaysAgoObj.setDate(sevenDaysAgoObj.getDate() - 7)
  const sevenDaysAgo = sevenDaysAgoObj.toISOString().split('T')[0]
  const { start: sevenDaysAgoStart } = utcRangeForPhysiologicalDate(sevenDaysAgo, timezone)
  const { start: todayStart } = utcRangeForPhysiologicalDate(today, timezone)

  // 1. Fetch data
  const [
    { data: protocol },
    { data: meals },
    { data: legacyMeals },
    { data: checkins },
    { data: waterLogs },
    { data: activeProgram },
    { data: sessionLogs },
  ] = await Promise.all([
    db.from('nutrition_protocols')
      .select('schedule_start_date, nutrition_protocol_days(position, calories, protein_g, carbs_g, fat_g, hydration_ml), nutrition_protocol_schedule_slots(week_index, dow, protocol_day_position)')
      .eq('client_id', clientId)
      .eq('status', 'shared')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    db.from('nutrition_meals')
      .select('physiological_date, total_calories, total_protein_g, total_carbs_g, total_fat_g')
      .eq('client_id', clientId)
      .gte('physiological_date', sevenDaysAgo)
      .lt('physiological_date', today),
    db.from('meal_logs')
      .select('logged_at, estimated_macros')
      .eq('client_id', clientId)
      .gte('logged_at', sevenDaysAgoStart.toISOString())
      .lt('logged_at', todayStart.toISOString())
      .eq('ai_status', 'done'),
    db.from('client_daily_checkins')
      .select('date, flow_type, sleep_hours, energy_level, stress_level')
      .eq('client_id', clientId)
      .gte('date', sevenDaysAgo)
      .lte('date', today), // we include today for check-ins (e.g., morning checkin already done)
    db.from('client_water_logs')
      .select('logged_at, amount_ml')
      .eq('client_id', clientId)
      .gte('logged_at', `${sevenDaysAgo}T00:00:00.000Z`),
    db.from('programs')
      .select('id, name, weeks, frequency, program_sessions(id, name, day_of_week, days_of_week)')
      .eq('client_id', clientId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    db.from('client_session_logs')
      .select('completed_at')
      .eq('client_id', clientId)
      .not('completed_at', 'is', null)
      .gte('completed_at', `${sevenDaysAgo}T00:00:00.000Z`)
      .order('completed_at', { ascending: false }),
  ])

  // 2. Aggregate Data per day
  const dailyStats: Record<string, any> = {}
  for (let i = 1; i <= 7; i++) {
    const d = getOffsetDateStr(today, -i)
    dailyStats[d] = {
      target: null, consumedKcal: 0, consumedProt: 0, consumedCarbs: 0, consumedFat: 0, consumedWater: 0,
      sleep: null, energy: null, stress: null,
    }
  }

  // Assign targets
  const pDays = (protocol as any)?.nutrition_protocol_days ?? []
  const pSlots = (protocol as any)?.nutrition_protocol_schedule_slots ?? []
  const startDate = (protocol as any)?.schedule_start_date ?? null

  for (const d of Object.keys(dailyStats)) {
    const dayProtocol = resolveProtocolDayByDate(d, startDate, pDays, pSlots) as any
    if (dayProtocol) {
      dailyStats[d].target = {
        kcal: Number(dayProtocol.calories ?? 0),
        prot: Number(dayProtocol.protein_g ?? 0),
        carbs: Number(dayProtocol.carbs_g ?? 0),
        fat: Number(dayProtocol.fat_g ?? 0),
        water: Number(dayProtocol.hydration_ml ?? 2500)
      }
    }
  }

  // Aggregate macros
  for (const m of (meals ?? [])) {
    const d = m.physiological_date
    if (dailyStats[d]) {
      dailyStats[d].consumedKcal += Number(m.total_calories ?? 0)
      dailyStats[d].consumedProt += Number(m.total_protein_g ?? 0)
      dailyStats[d].consumedCarbs += Number(m.total_carbs_g ?? 0)
      dailyStats[d].consumedFat += Number(m.total_fat_g ?? 0)
    }
  }
  for (const m of (legacyMeals ?? [])) {
    const d = computePhysiologicalDate(new Date(m.logged_at), timezone)
    if (dailyStats[d]) {
      const em = (m.estimated_macros ?? {}) as any
      dailyStats[d].consumedKcal += Number(em.calories ?? 0)
      dailyStats[d].consumedProt += Number(em.protein_g ?? 0)
      dailyStats[d].consumedCarbs += Number(em.carbs_g ?? 0)
      dailyStats[d].consumedFat += Number(em.fats_g ?? em.fat_g ?? 0)
    }
  }
  for (const w of (waterLogs ?? [])) {
    const d = computePhysiologicalDate(new Date(w.logged_at))
    if (dailyStats[d]) {
      dailyStats[d].consumedWater += Number(w.amount_ml ?? 0)
    }
  }
  for (const c of (checkins ?? [])) {
    const d = c.date
    if (dailyStats[d] || d === today) {
      const target = dailyStats[d] || {}
      if (c.flow_type === 'morning') {
        if (c.sleep_hours != null) target.sleep = c.sleep_hours
        if (c.energy_level != null) target.energy = c.energy_level
      } else if (c.flow_type === 'evening') {
        if (c.stress_level != null) target.stress = c.stress_level
      }
    }
  }

  // 3. Evaluate Patterns
  const daysDesc = Array.from({ length: 7 }, (_, i) => getOffsetDateStr(today, -(i + 1)))

  const checkSequence = (count: number, condition: (stats: any) => boolean) => {
    for (let i = 0; i < count; i++) {
      const d = daysDesc[i]
      const st = dailyStats[d]
      if (!st || !st.target) return false // Missing data prevents triggering
      if (!condition(st)) return false
    }
    return true
  }

  const checkCheckinsSequence = (count: number, flow: 'morning'|'evening', condition: (c: any) => boolean) => {
    // Collect the last `count` days where checkin was supposed to happen, we look at the last `count` days chronologically ending today or yesterday.
    const relevantDates = [today, ...daysDesc].slice(0, count + 1)
    let validDays = 0
    let matchDays = 0
    for (const d of relevantDates) {
      const st = dailyStats[d] || {}
      const c = checkins?.find(x => x.date === d && x.flow_type === flow)
      if (c) {
        validDays++
        if (condition(c)) matchDays++
      }
    }
    return validDays >= count && matchDays >= count
  }

  // 1. Calories dépassées > 110% (3j)
  if (checkSequence(3, s => s.consumedKcal > s.target.kcal * 1.1)) {
    return {
      code: 'calories_high', statement: "J'ai vu que tes calories dépassaient ta cible ces 3 derniers jours.",
      question: "Qu'est-ce qui se passe en ce moment ?",
      options: [
        { label: "Beaucoup de restos/sorties", value: 1 },
        { label: "J'ai souvent faim", value: 2 },
        { label: "Du mal à peser/logger", value: 3 },
        { label: "Autre (écrire)", value: 99 }
      ]
    }
  }

  // 2. Calories en deçà < 80% (3j)
  if (checkSequence(3, s => s.target.kcal > 0 && s.consumedKcal > 0 && s.consumedKcal < s.target.kcal * 0.8)) {
    return {
      code: 'calories_low', statement: "J'ai vu que tu étais bien en dessous de tes calories cibles ces 3 derniers jours.",
      question: "Quelle en est la raison principale ?",
      options: [
        { label: "Pas très faim", value: 1 },
        { label: "Pas le temps de manger", value: 2 },
        { label: "J'oublie de logger", value: 3 },
        { label: "Autre (écrire)", value: 99 }
      ]
    }
  }

  // 3. Protéines en deçà < 85% (5j)
  if (checkSequence(5, s => s.target.prot > 0 && s.consumedProt > 0 && s.consumedProt < s.target.prot * 0.85)) {
    return {
      code: 'protein_low', statement: "Tes protéines sont en dessous de la cible depuis 5 jours.",
      question: "Est-ce qu'on peut t'aider là-dessus ?",
      options: [
        { label: "Manque d'inspiration repas", value: 1 },
        { label: "Trop compliqué à cuisiner", value: 2 },
        { label: "Budget serré en ce moment", value: 3 },
        { label: "Autre (écrire)", value: 99 }
      ]
    }
  }

  // 4. Glucides dépassés > 115% (3j)
  if (checkSequence(3, s => s.target.carbs > 0 && s.consumedCarbs > s.target.carbs * 1.15)) {
    return {
      code: 'carbs_high', statement: "Tu as consommé pas mal de glucides au-dessus de la cible ces 3 derniers jours.",
      question: "Une idée de ce qui bloque ?",
      options: [
        { label: "Envies de sucre fréquentes", value: 1 },
        { label: "Repas imprévus", value: 2 },
        { label: "Autre (écrire)", value: 99 }
      ]
    }
  }

  // 6. Lipides dépassés > 115% (3j)
  if (checkSequence(3, s => s.target.fat > 0 && s.consumedFat > s.target.fat * 1.15)) {
    return {
      code: 'fat_high', statement: "J'ai vu que tes lipides étaient au-dessus de la cible ces 3 derniers jours.",
      question: "Qu'est-ce qui explique cela ?",
      options: [
        { label: "Je mange souvent dehors", value: 1 },
        { label: "Des craquages récents", value: 2 },
        { label: "Repas habituels trop riches", value: 3 },
        { label: "Autre (écrire)", value: 99 }
      ]
    }
  }

  // 7. Hydratation < 70% (5j)
  if (checkSequence(5, s => s.target.water > 0 && s.consumedWater > 0 && s.consumedWater < s.target.water * 0.7)) {
    return {
      code: 'hydration_low', statement: "Tu n'as pas atteint tes objectifs d'hydratation ces 5 derniers jours.",
      question: "Qu'est-ce qui t'empêche de boire plus ?",
      options: [
        { label: "J'y pense pas", value: 1 },
        { label: "Pas de gourde sous la main", value: 2 },
        { label: "J'oublie de logger", value: 3 },
        { label: "Autre (écrire)", value: 99 }
      ]
    }
  }

  // 8. Sommeil < 6h (3j)
  if (checkCheckinsSequence(3, 'morning', c => c.sleep_hours != null && c.sleep_hours < 6)) {
    return {
      code: 'sleep_low', statement: "Tu as dormi moins de 6 heures sur tes 3 dernières nuits.",
      question: "Qu'est-ce qui perturbe ton sommeil ?",
      options: [
        { label: "Beaucoup de travail/stress", value: 1 },
        { label: "Je me couche trop tard", value: 2 },
        { label: "Insomnies/Réveils", value: 3 },
        { label: "Autre (écrire)", value: 99 }
      ]
    }
  }

  // 9. Sommeil > 9h (3j)
  if (checkCheckinsSequence(3, 'morning', c => c.sleep_hours != null && c.sleep_hours > 9)) {
    return {
      code: 'sleep_high', statement: "Tu dors plus de 9 heures depuis 3 jours, c'est pas dans tes habitudes.",
      question: "Tu te sens fatigué(e) en ce moment ?",
      options: [
        { label: "Oui, très fatigué(e)", value: 1 },
        { label: "Non, je récupère de ma semaine", value: 2 },
        { label: "Autre (écrire)", value: 99 }
      ]
    }
  }

  // 10. Energie <= 2/5 (3j)
  if (checkCheckinsSequence(3, 'morning', c => c.energy_level != null && c.energy_level <= 2)) {
    return {
      code: 'energy_low', statement: "Ton niveau d'énergie est au plus bas depuis 3 jours.",
      question: "Comment on peut t'aider ?",
      options: [
        { label: "J'ai besoin de repos", value: 1 },
        { label: "Je mange peut-être pas assez", value: 2 },
        { label: "Trop de stress externe", value: 3 },
        { label: "Autre (écrire)", value: 99 }
      ]
    }
  }

  // 11. Stress >= 4/5 (3j)
  if (checkCheckinsSequence(3, 'evening', c => c.stress_level != null && c.stress_level >= 4)) {
    return {
      code: 'stress_high', statement: "Tu as signalé un niveau de stress élevé ces 3 derniers jours.",
      question: "Est-ce que ça impacte ta récupération ?",
      options: [
        { label: "Oui, je dors mal", value: 1 },
        { label: "Oui, mon appétit change", value: 2 },
        { label: "Non, je gère", value: 3 },
        { label: "Autre (écrire)", value: 99 }
      ]
    }
  }

  // 12. Séance manquée (on regarde si hier il y avait une séance, et si elle a été loggée)
  // Simplification: si hier était un jour de séance (selon le protocole) et pas de log hier.
  // Note: R1 ne gère pas parfaitement les cycles glissants pour ce détecteur sans charger tout le cycle, 
  // on check le day of week ou le protocol_day d'hier
  const yesterday = daysDesc[0]
  if (yesterday) {
    const yTarget = dailyStats[yesterday]
    if (yTarget) {
      // Find session mapped to yesterday in activeProgram
      const sessions = (activeProgram as any)?.program_sessions ?? []
      const yDateObj = new Date(yesterday)
      const dows = [7,1,2,3,4,5,6] // 1=Mon, 7=Sun
      const yDow = dows[yDateObj.getDay()]
      const expectedSession = sessions.find((s: any) => s.day_of_week === yDow || (s.days_of_week && s.days_of_week.includes(yDow)))
      
      if (expectedSession) {
        // Was it logged?
        const loggedYesterday = sessionLogs?.some(log => log.completed_at && log.completed_at.startsWith(yesterday))
        if (!loggedYesterday) {
          return {
            code: 'session_missed', statement: "Il semble que la séance prévue hier n'a pas été loggée.",
            question: "Un imprévu ?",
            options: [
              { label: "Pas eu le temps", value: 1 },
              { label: "Trop fatigué(e)", value: 2 },
              { label: "J'ai oublié de logger", value: 3 },
              { label: "Je l'ai décalée", value: 4 },
              { label: "Autre (écrire)", value: 99 }
            ]
          }
        }
      }
    }
  }

  return null
}
