import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { resolveClientFromUser } from '@/lib/client/resolve-client'
import { notFound, redirect } from 'next/navigation'
import { CheckCircle2, Clock, Layers, BarChart2 } from 'lucide-react'
import BodyMap from '@/components/client/BodyMap'
import { computeMuscleIntensity } from '@/lib/client/muscleDetection'
import { ct, type ClientLang } from '@/lib/i18n/clientTranslations'
import RecapNavButtons from '@/app/client/programme/recap/[sessionLogId]/RecapNavButtons'
import FeedbackThread from '@/components/client/smart/FeedbackThread'
import { fetchFlexWorkoutSession } from '@/lib/training/flexTraining/queries'
import { summarizeFlexWorkoutSession } from '@/lib/training/flexTraining/summary'
import { resolveCatalogExerciseName } from '@/lib/training/flexTraining/catalog'
import { loadExerciseNameResolver } from '@/lib/i18n/exerciseDisplayName'
import { computeRobustAverageRestSec } from '@/lib/training/restMetrics'

function resolveRecapTitle(type: string, relation: string | null, lang: ClientLang) {
  if (relation === 'replace' || type === 'replacement') return `${ct(lang, 'logger.session.single')} ${ct(lang, 'logger.free.relation.replace').toLowerCase()}`
  if (relation === 'bonus' || type === 'bonus') return `${ct(lang, 'logger.session.single')} ${ct(lang, 'logger.free.relation.bonus').toLowerCase()}`
  return ct(lang, 'logger.free.title')
}

function formatVolume(totalVolume: number) {
  return totalVolume >= 1000 ? `${(totalVolume / 1000).toFixed(1)}t` : `${Math.round(totalVolume)}kg`
}

export default async function FlexWorkoutRecapPage({ params }: { params: { sessionId: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/client/login')

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const client = await resolveClientFromUser(user.id, user.email, service, 'id')
  if (!client) notFound()

  const prefsRes = await service.from('client_preferences').select('language').eq('client_id', client.id).maybeSingle()
  const rawLang = (prefsRes as { data?: { language?: string | null } } | null)?.data?.language
  const lang: ClientLang = ['fr', 'en', 'es'].includes(rawLang ?? '') ? rawLang as ClientLang : 'fr'
  const resolveExerciseName = await loadExerciseNameResolver(service, lang)

  const { session, exercises } = await fetchFlexWorkoutSession(service, params.sessionId)
  if (!session || session.client_id !== client.id) notFound()

  const summary = summarizeFlexWorkoutSession(session, exercises)
  const allSets = exercises.flatMap((exercise) =>
    exercise.sets.map((set) => ({
      ...set,
      exercise_name: exercise.custom_exercise_name
        ?? (resolveCatalogExerciseName(exercise.exercise_id)
          ? resolveExerciseName(resolveCatalogExerciseName(exercise.exercise_id)!, exercise.exercise_id)
          : 'Exercice'),
      muscle_groups: exercise.muscle_groups ?? [],
    })),
  )
  const completedSets = allSets.filter((set) => set.completed)
  const totalReps = completedSets.reduce((sum, set) => sum + (set.reps ?? 0), 0)

  const restTimes = completedSets
    .filter((set) => set.rest_seconds != null)
    .map((set) => set.rest_seconds as number)
  const avgRestSec = computeRobustAverageRestSec(restTimes)

  const exerciseMap: Record<string, { name: string; sets: typeof completedSets }> = {}
  for (const set of completedSets) {
    if (!exerciseMap[set.exercise_name]) exerciseMap[set.exercise_name] = { name: set.exercise_name, sets: [] }
    exerciseMap[set.exercise_name].sets.push(set)
  }
  const groupedExercises = Object.values(exerciseMap)

  const muscleInputs = exercises.map((exercise) => ({
    name: exercise.custom_exercise_name
      ?? (resolveCatalogExerciseName(exercise.exercise_id)
        ? resolveExerciseName(resolveCatalogExerciseName(exercise.exercise_id)!, exercise.exercise_id)
        : 'Exercice'),
    sets: exercise.sets.filter((set) => set.completed).length,
    primary_muscles: exercise.muscle_groups ?? [],
    secondary_muscles: [],
  })).filter((exercise) => exercise.sets > 0)
  const muscleIntensityMap = computeMuscleIntensity(muscleInputs)

  const maxWeightNow: Record<string, number> = {}
  for (const set of completedSets) {
    const weight = Number(set.weight ?? 0)
    if (!Number.isFinite(weight) || weight <= 0) continue
    if (!maxWeightNow[set.exercise_name] || weight > maxWeightNow[set.exercise_name]) {
      maxWeightNow[set.exercise_name] = weight
    }
  }

  const { data: legacySessionLog } = await service
    .from('client_session_logs')
    .select('id')
    .eq('client_id', client.id)
    .eq('flex_session_id', session.id)
    .maybeSingle()

  if (legacySessionLog?.id) {
    redirect(`/client/programme/recap/${legacySessionLog.id}`)
  }

  return (
    <div className="min-h-dvh bg-[#121212] font-barlow pb-10 overflow-x-hidden">
      <header
        className="sticky top-0 z-40 bg-[#121212]"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <RecapNavButtons icon href="/client/programme" />
          <div>
            <p className="text-[9px] font-barlow-condensed font-bold uppercase tracking-[0.18em] text-white/30">{ct(lang, 'recap.section')}</p>
            <p className="text-[13px] font-bold text-white">{resolveRecapTitle(session.type, session.relation_to_planned_workout, lang)}</p>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-5 pt-4 pb-5 flex flex-col gap-4">
        <div className="flex items-center gap-3 bg-[#1a1a1a] rounded-xl px-5 py-4">
          <CheckCircle2 size={20} className="text-[#f2f2f2] shrink-0" />
          <div>
            <p className="text-[13px] font-bold text-white">{ct(lang, 'recap.sessionRecorded')}</p>
            <p className="text-[11px] text-white/40 mt-0.5">
              {ct(lang, 'recap.completedSets', {
                n: completedSets.length,
                pl: completedSets.length > 1 ? 's' : '',
              })}
              {summary.duration_seconds != null ? ` · ${Math.round(summary.duration_seconds / 60)}min` : ''}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <StatCard
            label={ct(lang, 'recap.volume')}
            value={formatVolume(summary.tonnage)}
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
          {summary.duration_seconds != null ? (
            <StatCard
              label={ct(lang, 'recap.duration')}
              value={`${Math.round(summary.duration_seconds / 60)}min`}
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

        <div className="bg-white/[0.02] rounded-xl px-5 py-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/30 mb-4">{ct(lang, 'recap.musclesWorked')}</p>
          <BodyMap intensityMap={muscleIntensityMap} />
        </div>

        {groupedExercises.length > 0 && (
          <div className="bg-white/[0.02] rounded-xl overflow-hidden">
            <div className="px-5 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/30">{ct(lang, 'recap.exercises')}</p>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {groupedExercises.map(({ name, sets }) => {
                const maxW = maxWeightNow[name] ?? 0
                const totalRepsEx = sets.reduce((sum, set) => sum + (set.reps ?? 0), 0)

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
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="bg-white/[0.02] rounded-xl px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/30 mb-3">{ct(lang, 'recap.sessionNotes')}</p>
          {exercises.some((exercise) => exercise.notes?.trim()) ? (
            <div className="flex flex-col gap-2">
              {exercises.filter((exercise) => exercise.notes?.trim()).map((exercise) => (
                <div key={exercise.id} className="bg-white/[0.02] rounded-xl px-3 py-2.5">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/30 mb-1">
                    {exercise.custom_exercise_name
                      ?? (resolveCatalogExerciseName(exercise.exercise_id)
                        ? resolveExerciseName(resolveCatalogExerciseName(exercise.exercise_id)!, exercise.exercise_id)
                        : 'Exercice')}
                  </p>
                  <p className="text-[12px] text-white/60 leading-relaxed">{exercise.notes}</p>
                </div>
              ))}
              {session.notes?.trim() ? (
                <div className="bg-white/[0.02] rounded-xl px-3 py-2.5">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/30 mb-1">Global</p>
                  <p className="text-[12px] text-white/60 leading-relaxed">{session.notes}</p>
                </div>
              ) : null}
            </div>
          ) : session.notes?.trim() ? (
            <p className="text-[12px] text-white/60 leading-relaxed">{session.notes}</p>
          ) : (
            <p className="text-[12px] text-white/25 italic">{ct(lang, 'recap.noNotes')}</p>
          )}
        </div>

        {legacySessionLog?.id ? (
          <div className="px-4 pb-2">
            <FeedbackThread entityType="session" entityId={legacySessionLog.id} />
          </div>
        ) : null}

        <RecapNavButtons label={ct(lang, 'recap.backHome')} href="/client" />
      </main>
    </div>
  )
}

function StatCard({
  label, value, sub, icon,
}: {
  label: string
  value: string
  sub?: string
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
      </div>
      {sub && <p className="text-[9px] text-white/25 mt-0.5">{sub}</p>}
    </div>
  )
}
