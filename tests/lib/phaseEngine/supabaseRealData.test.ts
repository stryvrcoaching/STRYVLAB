import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { buildPhaseClientProfile } from '@/lib/coach/phaseEngine/clientProfile'
import { buildCoachDecision } from '@/lib/coach/phaseEngine/coachDecision'
import { computePhaseOptimization } from '@/lib/coach/phaseEngine/engine'
import { buildDerivedSignals } from '@/lib/coach/phaseEngine/signals'
import type { RawSignalInput } from '@/lib/coach/phaseEngine/types'
import { makeRawInput } from './testFixtures'

const DEFAULT_CLIENT_ID = '2e33b381-0e74-4e8d-828a-a853ed6fd9f0'
const describeIfReal = process.env.PHASE_SUPABASE_REAL === '1' ? describe : describe.skip

function loadLocalEnv() {
  for (const file of ['.env', '.env.local']) {
    const fullPath = path.join(process.cwd(), file)
    if (!fs.existsSync(fullPath)) continue

    const lines = fs.readFileSync(fullPath, 'utf8').split(/\r?\n/)
    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) continue
      const eq = line.indexOf('=')
      if (eq === -1) continue

      const key = line.slice(0, eq).trim()
      let value = line.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (key) process.env[key] = value
    }
  }
}

function daysAgo(anchorDate: string, n: number): string {
  const d = new Date(`${anchorDate}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

function average(values: number[]): number | null {
  if (values.length === 0) return null
  return Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 10) / 10
}

function checkinAverages(rows: CheckinRow[], windowStart: string) {
  const filtered = rows.filter((row) => row.date >= windowStart)
  return {
    energy: average(filtered.map((row) => row.energy_level).filter((v): v is number => v != null)),
    sleep_quality: average(filtered.map((row) => row.sleep_quality).filter((v): v is number => v != null)),
    sleep_duration: average(filtered.map((row) => row.sleep_hours).filter((v): v is number => v != null)),
    stress: average(filtered.map((row) => row.stress_level).filter((v): v is number => v != null)),
    muscle_soreness: average(filtered.map((row) => row.muscle_soreness).filter((v): v is number => v != null)),
  }
}

type CheckinRow = {
  date: string
  flow_type: string | null
  sleep_hours: number | null
  sleep_quality: number | null
  energy_level: number | null
  stress_level: number | null
  muscle_soreness: number | null
  rhr_morning: number | null
}

type AssessmentRow = {
  bilan_date?: string | null
  submitted_at?: string | null
  assessment_responses?: {
    field_key: string
    value_number: number | null
    value_text?: string | null
  }[]
}

function buildBodySeries(submissions: AssessmentRow[]) {
  const weightSeries: RawSignalInput['weightSeries'] = []
  const bodyFatSeries: RawSignalInput['bodyFatSeries'] = []
  const leanMassSeries: RawSignalInput['leanMassSeries'] = []
  const waistSeries: RawSignalInput['waistSeries'] = []

  for (const sub of submissions) {
    const date = (sub.bilan_date ?? sub.submitted_at ?? '').split('T')[0]
    if (!date) continue
    for (const response of sub.assessment_responses ?? []) {
      if (response.value_number == null) continue
      if (response.field_key === 'weight_kg') {
        weightSeries.push({ date, value: response.value_number, source: 'manual' })
      }
      if (response.field_key === 'body_fat_pct') {
        bodyFatSeries.push({ date, value: response.value_number, source: 'bioimpedance' })
      }
      if (response.field_key === 'lean_mass_kg') {
        leanMassSeries.push({ date, value: response.value_number })
      }
      if (response.field_key === 'waist_cm') {
        waistSeries.push({ date, value: response.value_number })
      }
    }
  }

  return { weightSeries, bodyFatSeries, leanMassSeries, waistSeries }
}

describeIfReal('phase engine Supabase real-data runner', () => {
  it('replays the real Supabase client data through Phase Optimale', async () => {
    loadLocalEnv()

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const clientId = process.env.PHASE_TEST_CLIENT_ID ?? DEFAULT_CLIENT_ID
    const anchorDate =
      process.env.PHASE_TEST_ANCHOR_DATE ?? new Date().toISOString().slice(0, 10)

    expect(supabaseUrl, 'NEXT_PUBLIC_SUPABASE_URL is required').toBeTruthy()
    expect(serviceRoleKey, 'SUPABASE_SERVICE_ROLE_KEY is required').toBeTruthy()
    expect(supabaseUrl).not.toBe('https://test.supabase.co')
    expect(serviceRoleKey).not.toBe('test-service-role-key')

    const db = createClient(supabaseUrl!, serviceRoleKey!, {
      auth: { persistSession: false },
    })
    const windowDays = 30
    const checkinStart = daysAgo(anchorDate, 60)
    const windowStart = daysAgo(anchorDate, windowDays)

    const [{ data: client, error: clientError }, { data: checkins, error: checkinError }, { data: submissions, error: submissionsError }] =
      await Promise.all([
        db
          .from('coach_clients')
          .select('id, first_name, last_name, training_goal, weekly_frequency, gender, fitness_level')
          .eq('id', clientId)
          .single(),
        db
          .from('client_daily_checkins')
          .select('date, flow_type, sleep_hours, sleep_quality, energy_level, stress_level, muscle_soreness, rhr_morning')
          .eq('client_id', clientId)
          .gte('date', checkinStart)
          .lte('date', anchorDate)
          .order('date', { ascending: true }),
        db
          .from('assessment_submissions')
          .select('submitted_at, bilan_date, assessment_responses(field_key, value_number, value_text)')
          .eq('client_id', clientId)
          .eq('status', 'completed')
          .lte('submitted_at', `${anchorDate}T23:59:59.999Z`)
          .order('bilan_date', { ascending: true })
          .limit(20),
      ])

    expect(clientError).toBeNull()
    expect(checkinError).toBeNull()
    expect(submissionsError).toBeNull()
    expect(client).toBeTruthy()

    const checkinRows = (checkins ?? []) as CheckinRow[]
    const submissionRows = (submissions ?? []) as AssessmentRow[]
    const avg = checkinAverages(checkinRows, windowStart)
    const uniqueCheckinDays = new Set(checkinRows.filter((row) => row.date >= windowStart).map((row) => row.date))
    const rhrSeries = checkinRows
      .filter((row) => row.rhr_morning != null && row.rhr_morning > 0)
      .map((row) => ({ date: row.date, value: row.rhr_morning as number }))
    const body = buildBodySeries(submissionRows)
    const profile = buildPhaseClientProfile({
      fitnessLevel: client!.fitness_level,
      trainingGoal: client!.training_goal,
      cyclicProtocolMode: null,
    })

    const raw = makeRawInput({
      ...body,
      anchorDate,
      checkin: avg,
      checkinResponseRate: Math.round((uniqueCheckinDays.size / windowDays) * 100),
      rhrSeries,
      clientProfile: profile,
      gender: client!.gender === 'male' || client!.gender === 'female' ? client!.gender : null,
      latestBodyFat: body.bodyFatSeries.at(-1)?.value ?? null,
      windowDays,
      performance: {
        exercises: [],
        global_overreaching: false,
        sessionsCount: 0,
        weeklyFrequency: Number(client!.weekly_frequency ?? 3),
      },
    })

    const signals = buildDerivedSignals(raw)
    const result = computePhaseOptimization(signals, {
      latestBodyFat: raw.latestBodyFat,
      gender: raw.gender,
      locale: 'fr',
    })
    const decision = buildCoachDecision(result, signals, raw, 'fr')

    console.table([
      {
        client: `${client!.first_name ?? ''} ${client!.last_name ?? ''}`.trim() || clientId,
        anchorDate,
        checkins: checkinRows.length,
        rhrPoints: rhrSeries.length,
        rhrStatus: decision.baselines.rhr.status,
        currentRhr: decision.baselines.rhr.current,
        baselineRhr: decision.baselines.rhr.baseline,
        confidence: decision.confidenceModel.scorePct,
        direction: result.currentState.direction,
        adaptive: result.currentState.adaptiveState,
        trajectory: decision.sevenDayTrajectory.strategy,
        days: decision.sevenDayTrajectory.days.length,
        headline: decision.headline,
      },
    ])

    expect(rhrSeries.length).toBeGreaterThan(0)
    expect(decision.sevenDayTrajectory.days).toHaveLength(7)
    expect(decision.confidenceModel.scorePct).toBeGreaterThanOrEqual(0)
    expect(decision.confidenceModel.scorePct).toBeLessThanOrEqual(100)
  }, 30_000)
})
