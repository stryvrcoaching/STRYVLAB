import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { resolveClientFromUser } from '@/lib/client/resolve-client'
import { notFound, redirect } from 'next/navigation'
import { CheckCircle2, Clock, Layers, BarChart2, ChevronLeft, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import BodyMap from '@/components/client/BodyMap'
import { computeMuscleIntensity } from '@/lib/client/muscleDetection'
import { ct, type ClientLang } from '@/lib/i18n/clientTranslations'
import { loadExerciseNameResolver } from '@/lib/i18n/exerciseDisplayName'
import { getPrimaryMuscleFromCatalog, getSecondaryMusclesFromCatalog } from '@/lib/programs/intelligence/catalog-utils'
import RecapNavButtons from './RecapNavButtons'
import FeedbackThread from '@/components/client/smart/FeedbackThread'
import { computeRobustAverageRestSec } from '@/lib/training/restMetrics'
import PointsEarnedOverlay from '@/components/client/PointsEarnedOverlay'

export default async function SessionRecapPage({ params, searchParams }: { params: { sessionLogId: string }; searchParams?: { points?: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/client/login')

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const client = await resolveClientFromUser(user.id, user.email, service, 'id')
  if (!client) notFound()

  const prefsRes = await service.from('client_preferences').select('language').eq('client_id', client.id).maybeSingle()
  const rawLang = (prefsRes as any)?.data?.language
  const lang: ClientLang = ['fr', 'en', 'es'].includes(rawLang) ? rawLang as ClientLang : 'fr'
  const resolveExerciseName = await loadExerciseNameResolver(service, lang)
  const dateLocale = lang === 'fr' ? 'fr-FR' : lang === 'es' ? 'es-ES' : 'en-GB'

  // Fetch le session log avec ses sets
  const { data: sessionLog } = await service
    .from('client_session_logs')
    .select(`
      id, session_name, logged_at, duration_min, exercise_notes,
      client_set_logs (
        id, exercise_name, exercise_id, set_number, side,
        planned_reps, actual_reps, actual_weight_kg, completed,
        rir_actual, rest_sec_actual, notes,
        primary_muscles, secondary_muscles
      )
    `)
    .eq('id', params.sessionLogId)
    .eq('client_id', client.id)
    .single()

  if (!sessionLog) notFound()
  const pointsEarned = Number(searchParams?.points ?? 0)

  const allSets = (sessionLog.client_set_logs ?? []) as any[]
  const completedSets = allSets.filter((s: any) => s.completed)

  // ── KPIs ──
  const totalVolume = completedSets.reduce((sum: number, s: any) => {
    return sum + (s.actual_reps ?? 0) * (parseFloat(String(s.actual_weight_kg)) || 0)
  }, 0)

  const totalReps = completedSets.reduce((sum: number, s: any) => sum + (s.actual_reps ?? 0), 0)

  const restTimes = completedSets
    .filter((s: any) => s.rest_sec_actual != null)
    .map((s: any) => s.rest_sec_actual as number)
  const avgRestSec = computeRobustAverageRestSec(restTimes)

  // ── Exercices groupés ──
  const exerciseMap: Record<string, { name: string; sets: any[] }> = {}
  for (const s of completedSets) {
    if (!exerciseMap[s.exercise_name]) {
      exerciseMap[s.exercise_name] = {
        name: resolveExerciseName(s.exercise_name),
        sets: [],
      }
    }
    exerciseMap[s.exercise_name].sets.push(s)
  }
  const exercises = Object.values(exerciseMap)

  // ── Schéma corporel — utilise les muscles persistés dans les set_logs (option B) ──
  // Agrège les muscles uniques de tous les sets complétés (dédupliqués par exercice)
  // Agrège par exercice — chaque set a un nombre de reps mais on veut des sets distincts
  const exerciseSetCounts = new Map<string, number>()
  const exerciseMuscles = new Map<string, { primary_muscles: string[]; secondary_muscles: string[] }>()
  for (const s of completedSets) {
    exerciseSetCounts.set(s.exercise_name, (exerciseSetCounts.get(s.exercise_name) ?? 0) + 1)
    if (!exerciseMuscles.has(s.exercise_name)) {
      const dbPrimary: string[] = (s as any).primary_muscles ?? []
      const dbSecondary: string[] = (s as any).secondary_muscles ?? []
      // Fallback to catalog lookup when DB columns are empty (client_set_logs has no muscle cols)
      const primary_muscles = dbPrimary.length > 0 ? dbPrimary
        : [getPrimaryMuscleFromCatalog(s.exercise_name)].filter(Boolean) as string[]
      const secondary_muscles = dbSecondary.length > 0 ? dbSecondary
        : getSecondaryMusclesFromCatalog(s.exercise_name)
      exerciseMuscles.set(s.exercise_name, { primary_muscles, secondary_muscles })
    }
  }
  const muscleInputs = Array.from(exerciseSetCounts.entries()).map(([name, sets]) => ({
    name,
    sets,
    ...(exerciseMuscles.get(name) ?? { primary_muscles: [], secondary_muscles: [] }),
  }))
  const muscleIntensityMap = computeMuscleIntensity(muscleInputs)

  // ── Comparaison dernière séance du même nom ──
  const { data: prevLogs } = await service
    .from('client_session_logs')
    .select(`
      id, logged_at,
      client_set_logs (
        exercise_name, actual_reps, actual_weight_kg, completed
      )
    `)
    .eq('client_id', client.id)
    .eq('session_name', sessionLog.session_name)
    .neq('id', params.sessionLogId)
    .order('logged_at', { ascending: false })
    .limit(1)

  const prevLog = prevLogs?.[0] ?? null
  const prevSets = prevLog ? ((prevLog as any).client_set_logs ?? []).filter((s: any) => s.completed) : []

  // Volume précédent
  const prevVolume = prevSets.reduce((sum: number, s: any) => {
    return sum + (s.actual_reps ?? 0) * (parseFloat(String(s.actual_weight_kg)) || 0)
  }, 0)

  // Charge max par exercice — comparaison
  const maxWeightNow: Record<string, number> = {}
  const maxWeightPrev: Record<string, number> = {}
  for (const s of completedSets) {
    const w = parseFloat(String(s.actual_weight_kg)) || 0
    if (!maxWeightNow[s.exercise_name] || w > maxWeightNow[s.exercise_name]) maxWeightNow[s.exercise_name] = w
  }
  for (const s of prevSets) {
    const w = parseFloat(String(s.actual_weight_kg)) || 0
    if (!maxWeightPrev[s.exercise_name] || w > maxWeightPrev[s.exercise_name]) maxWeightPrev[s.exercise_name] = w
  }

  const volumeDelta = prevVolume > 0 ? Math.round(((totalVolume - prevVolume) / prevVolume) * 100) : null

  return (
    <div className="min-h-dvh bg-[#121212] font-barlow pb-10 overflow-x-hidden">
      <PointsEarnedOverlay open={pointsEarned > 0} points={pointsEarned} />

      {/* Header */}
      <header
        className="sticky top-0 z-40 bg-[#121212]"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <RecapNavButtons icon href="/client/programme" />
          <div>
            <p className="text-[9px] font-barlow-condensed font-bold uppercase tracking-[0.18em] text-white/30">{ct(lang, 'recap.section')}</p>
            <p className="text-[13px] font-bold text-white">{sessionLog.session_name}</p>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-5 pt-4 pb-5 flex flex-col gap-4">

        {/* ── Bannière succès ── */}
        <div className="flex items-center gap-3 bg-[#1a1a1a] rounded-xl px-5 py-4">
          <CheckCircle2 size={20} className="text-[#f2f2f2] shrink-0" />
          <div>
            <p className="text-[13px] font-bold text-white">{ct(lang, 'recap.sessionRecorded')}</p>
            <p className="text-[11px] text-white/40 mt-0.5">
              {ct(lang, 'recap.completedSets', {
                n: completedSets.length,
                pl: completedSets.length > 1 ? 's' : '',
              })}
              {sessionLog.duration_min ? ` · ${sessionLog.duration_min}min` : ''}
            </p>
          </div>
        </div>

        {/* ── Stats globales ── */}
        <div className="grid grid-cols-2 gap-2.5">
          <StatCard
            label={ct(lang, 'recap.volume')}
            value={totalVolume >= 1000 ? `${(totalVolume / 1000).toFixed(1)}t` : `${Math.round(totalVolume)}kg`}
            delta={volumeDelta}
            icon={<BarChart2 size={11} />}
          />
          <StatCard
            label={ct(lang, 'recap.perEx.reps')}
            value={String(totalReps)}
            icon={<Layers size={11} />}
          />
          <StatCard
            label={ct(lang, 'recap.sets')}
            value={String(completedSets.length)}
            sub={ct(lang, 'recap.sets.on', { n: allSets.length })}
            icon={<CheckCircle2 size={11} />}
          />
          {sessionLog.duration_min ? (
            <StatCard
              label={ct(lang, 'recap.duration')}
              value={`${sessionLog.duration_min}min`}
              sub={avgRestSec !== null ? `${ct(lang, 'recap.avgRest.short')} ${avgRestSec >= 60 ? `${Math.floor(avgRestSec / 60)}m${avgRestSec % 60 > 0 ? `${avgRestSec % 60}s` : ''}` : `${avgRestSec}s`}` : undefined}
              icon={<Clock size={11} />}
            />
          ) : avgRestSec !== null ? (
            <StatCard
              label={ct(lang, 'recap.avgRest')}
              value={avgRestSec >= 60 ? `${Math.floor(avgRestSec / 60)}m${avgRestSec % 60 > 0 ? `${avgRestSec % 60}s` : ''}` : `${avgRestSec}s`}
              icon={<Clock size={11} />}
            />
          ) : null}
        </div>

        {/* ── Schéma corporel ── */}
        <div className="bg-white/[0.02] rounded-xl px-5 py-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/30 mb-4">{ct(lang, 'recap.musclesWorked')}</p>
          <BodyMap intensityMap={muscleIntensityMap} />
        </div>

        {/* ── Analyse par exercice ── */}
        {exercises.length > 0 && (
          <div className="bg-white/[0.02] rounded-xl overflow-hidden">
            <div className="px-5 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/30">{ct(lang, 'recap.exercises')}</p>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {exercises.map(({ name, sets }) => {
                const maxW = maxWeightNow[name] ?? 0
                const prevMaxW = maxWeightPrev[name] ?? 0
                const delta = prevMaxW > 0 && maxW > 0 ? maxW - prevMaxW : null
                const totalRepsEx = sets.reduce((sum: number, s: any) => sum + (s.actual_reps ?? 0), 0)

                return (
                  <div key={name} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-white/80 truncate">{name}</p>
                      <p className="text-[10px] text-white/35 mt-0.5">
                        {ct(lang, 'recap.completedSets', {
                          n: sets.length,
                          pl: sets.length > 1 ? 's' : '',
                        })} · {totalRepsEx} {ct(lang, 'recap.perEx.reps').toLowerCase()}
                        {maxW > 0 ? ` · ${maxW}kg ${ct(lang, 'recap.maxShort')}` : ''}
                      </p>
                    </div>
                    {delta !== null && (
                      <div className={`flex items-center gap-1 text-[11px] font-bold shrink-0 ${
                        delta > 0 ? 'text-[#f2f2f2]' : delta < 0 ? 'text-red-400' : 'text-white/30'
                      }`}>
                        {delta > 0 ? <TrendingUp size={12} /> : delta < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
                        {delta > 0 ? '+' : ''}{delta}kg
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Notes libres ── */}
        <div className="bg-white/[0.02] rounded-xl px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/30 mb-3">{ct(lang, 'recap.sessionNotes')}</p>
          {Object.keys(sessionLog.exercise_notes ?? {}).length > 0 ? (
            <div className="flex flex-col gap-2">
              {Object.entries(sessionLog.exercise_notes as Record<string, string>).map(([exId, note]) => {
                const rawName = allSets.find((s: any) => s.exercise_id === exId)?.exercise_name ?? exId
                const exName = resolveExerciseName(rawName)
                return (
                  <div key={exId} className="bg-white/[0.02] rounded-xl px-3 py-2.5">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/30 mb-1">{exName}</p>
                    <p className="text-[12px] text-white/60 leading-relaxed">{note}</p>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-[12px] text-white/25 italic">{ct(lang, 'recap.noNotes')}</p>
          )}
        </div>

        {/* Coach feedback thread */}
        <div className="px-4 pb-2">
          <FeedbackThread entityType="session" entityId={params.sessionLogId} />
        </div>

        {/* ── CTA ── router.refresh() invalide le cache du Server Component /client
              pour que "Séance réalisée ✓" soit visible immédiatement sans reload */}
        <RecapNavButtons label={ct(lang, 'recap.backHome')} href="/client" />
      </main>
    </div>
  )
}

function StatCard({
  label, value, sub, delta, icon
}: {
  label: string
  value: string
  sub?: string
  delta?: number | null
  icon?: React.ReactNode
}) {
  return (
    <div className="bg-white/[0.02] rounded-xl px-4 py-3">
      <div className="flex items-center gap-1 text-white/30 mb-1.5">
        {icon}
        <p className="text-[9px] font-semibold uppercase tracking-[0.12em]">{label}</p>
      </div>
      <div className="flex items-end gap-2">
        <p className="text-[1.4rem] font-black text-white font-mono leading-none">{value}</p>
        {delta !== null && delta !== undefined && (
          <span className={`text-[10px] font-bold mb-0.5 ${delta > 0 ? 'text-[#f2f2f2]' : delta < 0 ? 'text-red-400' : 'text-white/30'}`}>
            {delta > 0 ? '+' : ''}{delta}%
          </span>
        )}
      </div>
      {sub && <p className="text-[9px] text-white/25 mt-0.5">{sub}</p>}
    </div>
  )
}
