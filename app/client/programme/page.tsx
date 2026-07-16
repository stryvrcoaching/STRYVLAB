import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { resolveClientFromUser } from "@/lib/client/resolve-client";
import { ct, cta, type ClientLang } from "@/lib/i18n/clientTranslations";
import {
  buildPRs,
  buildSessionList,
  calculateStreaks,
  type SessionLog,
} from "@/lib/client/progressTypes";
import ProgrammeClientPage from "./ProgrammeClientPage";
import {
  getPrimaryMuscleFromCatalog,
  getSecondaryMusclesFromCatalog,
  getBiomechData,
} from "@/lib/programs/intelligence/catalog-utils";
import { fetchRecentFlexWorkouts } from "@/lib/training/flexTraining/queries";
import {
  getVolumeTargets,
  VOLUME_GROUP_LABELS,
  MUSCLE_TO_VOLUME_GROUP,
} from "@/lib/programs/intelligence/volume-targets";
import { fetchClientDayOverride } from '@/lib/client/day-kind'
import { computePhysiologicalDateInTimezone, utcRangeForPhysiologicalDate, getLocalWeekday } from '@/lib/client/checkin/timeWindows'
import { resolveClientTimezone } from '@/lib/client/checkin/resolveClientTimezone'
import { sessionMatchesProgrammeDow } from '@/lib/client/plannedSessions'
import {
  resolveProgramCycleSchedule,
  selectSessionsForProgramWeek,
  type ProgramCompletionBehavior,
} from '@/lib/programs/cycleSchedule'

function getTodayDow(dateIso?: string) {
  const jsDay = dateIso ? new Date(`${dateIso}T12:00:00Z`).getUTCDay() : new Date().getDay();
  return jsDay === 0 ? 7 : jsDay;
}

function getCurrentWeekBounds() {
  const now = new Date()
  const jsDay = now.getDay()
  const daysSinceMonday = jsDay === 0 ? 6 : jsDay - 1
  const monday = new Date(now)
  monday.setDate(now.getDate() - daysSinceMonday)
  monday.setHours(0, 0, 0, 0)

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)

  return { monday, sunday }
}

type VolumeWindowKey = 'current_week' | '7d' | '14d' | '30d'

function getWindowStart(now: Date, key: VolumeWindowKey, monday: Date) {
  if (key === 'current_week') return new Date(monday)
  const start = new Date(now)
  const days = key === '7d' ? 6 : key === '14d' ? 13 : 29
  start.setDate(now.getDate() - days)
  start.setHours(0, 0, 0, 0)
  return start
}

export default async function ClientProgrammePage({
  searchParams,
}: {
  searchParams?: { dow?: string; tab?: string };
}) {
  const activeTab = searchParams?.tab ?? "seance";

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/client/login');

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const client = await resolveClientFromUser(
    user.id,
    user.email,
    service,
    "id, first_name",
  );
  if (!client) return <NoProgramPage lang="fr" />;

  const timezone = String(client.timezone ?? '').trim() || await resolveClientTimezone(service, client.id)
  const todayIso = computePhysiologicalDateInTimezone(new Date(), timezone);
  const { start: todayStart, end: todayEnd } = utcRangeForPhysiologicalDate(todayIso, timezone)

  const { monday, sunday } = getCurrentWeekBounds()

  const [
    programsResult,
    prefsLangResult,
    completedTodayResult,
    startedTodayResult,
    skippedTodayResult,
    progressLogsResult,
    weekSessionsResult,
    recentFlexSessionsResult,
  ] = await Promise.all([
    service
      .from("programs")
      .select(
        `
        id, name, description, weeks, status, created_at,
        program_sessions (
          id, name, day_of_week, days_of_week, position, notes,
          program_exercises (
            id, name, sets, reps, rest_sec, rir, notes, position,
            primary_muscles, secondary_muscles, movement_pattern, tempo,
            is_unilateral, is_compound, rep_min, rep_max,
            primary_muscle, primary_activation, secondary_muscles_detail, secondary_activations
          )
        )
      `,
      )
      .eq("client_id", client.id)
      .eq("status", "active")
      .eq("is_client_visible", true)
      .order("created_at", { ascending: false })
      .limit(1),

    service
      .from("client_preferences")
      .select("language")
      .eq("client_id", client.id)
      .maybeSingle(),

    service
      .from("client_session_logs")
      .select("program_session_id, session_name")
      .eq("client_id", client.id)
      .not("completed_at", "is", null)
      .gte("completed_at", todayStart.toISOString())
      .lte("completed_at", todayEnd.toISOString()),

    service
      .from("client_session_logs")
      .select("program_session_id, session_name")
      .eq("client_id", client.id)
      .is("completed_at", null)
      .gte("logged_at", todayStart.toISOString())
      .lte("logged_at", todayEnd.toISOString()),

    service
      .from("client_workout_skips")
      .select("program_session_id, scheduled_date, skip_reason_key, skip_note")
      .eq("client_id", client.id)
      .eq("scheduled_date", todayIso),

    service
      .from("client_session_logs")
      .select(
        `
        id, session_name, logged_at, completed_at, duration_min,
        client_set_logs (
          exercise_id, exercise_name, set_number, actual_reps, actual_weight_kg,
          completed, rpe, rir_actual
        )
      `,
      )
      .eq("client_id", client.id)
      .not("completed_at", "is", null)
      .order("logged_at", { ascending: true }),

    // This week's sessions for volume coverage
    service
      .from("client_session_logs")
      .select("id, client_set_logs(exercise_name, completed, actual_reps, actual_weight_kg)")
      .eq("client_id", client.id)
      .not("completed_at", "is", null)
      .gte("completed_at", monday.toISOString())
      .lte("completed_at", sunday.toISOString()),

    fetchRecentFlexWorkouts(service, client.id, 30),
  ]);

  const programs = programsResult?.data;
  const rawLang = (prefsLangResult as any)?.data?.language;
  const lang: ClientLang = ["fr", "en", "es"].includes(rawLang)
    ? (rawLang as ClientLang)
    : "fr";
  const daysShort = cta(lang, "programme.days.short");
  const daysFull = cta(lang, "programme.days.full");

  // Fetch exercise translations for dynamic lookups
  const { data: exTrans } = await service
    .from('exercise_translations')
    .select('exerciseId, name')
    .eq('lang', lang.toUpperCase());

  const exerciseDict = (exTrans || []).reduce((acc: any, row: any) => {
    acc[row.exerciseId] = row.name;
    return acc;
  }, {} as Record<string, string>);

  const program = programs?.[0] as any;
  if (!program) return <NoProgramPage lang={lang} />;

  const [
    explicitWeeksResult,
    sessionWeekLinksResult,
    completionBehaviorResult,
  ] = await Promise.all([
    service
      .from('program_weeks')
      .select('id, position, label, week_type')
      .eq('program_id', program.id)
      .order('position', { ascending: true }),
    service
      .from('program_sessions')
      .select('id, program_week_id')
      .eq('program_id', program.id),
    service
      .from('programs')
      .select('completion_behavior')
      .eq('id', program.id)
      .maybeSingle(),
  ])

  const sessionWeekById = new Map<string, string | null>(
    ((sessionWeekLinksResult.data ?? []) as any[]).map((session) => [
      String(session.id),
      session.program_week_id ? String(session.program_week_id) : null,
    ]),
  )
  program.program_sessions = ((program.program_sessions ?? []) as any[]).map(
    (session) => ({
      ...session,
      program_week_id: sessionWeekById.get(String(session.id)) ?? null,
    }),
  )

  const { data: activeAssignment } = await service
    .from('client_workout_program_assignments')
    .select('id, started_at')
    .eq('client_id', client.id)
    .eq('program_id', program.id)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: assignmentSchedule } = activeAssignment?.id
    ? await service
        .from('client_workout_program_assignments')
        .select('schedule_start_date')
        .eq('id', activeAssignment.id)
        .maybeSingle()
    : { data: null }

  const programmeStartDate = assignmentSchedule?.schedule_start_date
    ?? computePhysiologicalDateInTimezone(
      new Date(activeAssignment?.started_at ?? program.created_at),
      timezone,
    )
  const explicitWeeks = ((explicitWeeksResult.data ?? []) as any[])
    .map((week) => ({ id: String(week.id), position: Number(week.position) }))
    .sort((first, second) => first.position - second.position)
  const cycleSchedule = resolveProgramCycleSchedule({
    dateIso: todayIso,
    startDateIso: programmeStartDate,
    explicitWeekCount: explicitWeeks.length,
    durationWeeks: program.weeks,
    completionBehavior: (
      completionBehaviorResult.data?.completion_behavior ?? 'repeat'
    ) as ProgramCompletionBehavior,
  })

  const GENERIC_SLUGS = new Set([
    "dos",
    "biceps",
    "triceps",
    "epaules",
    "pectoraux",
    "abdos",
    "quadriceps",
    "fessiers",
    "ischio-jambiers",
    "ischio_jambiers",
    "mollets",
    "avant_bras",
  ]);

  const allSessions = ((program.program_sessions ?? []) as any[])
    .sort((a, b) => a.position - b.position)
    .map((session: any) => ({
      ...session,
      program_exercises: ((session.program_exercises ?? []) as any[]).map(
        (ex: any) => {
          const primaryMuscles: string[] = ex.primary_muscles ?? [];
          const isAllGeneric =
            primaryMuscles.length > 0 &&
            primaryMuscles.every((m: string) =>
              GENERIC_SLUGS.has(m.toLowerCase()),
            );
          // Si primary_muscle singulier absent en DB, lookup catalog
          const resolvedPrimaryMuscle =
            ex.primary_muscle ?? getPrimaryMuscleFromCatalog(ex.name);
          // Si secondary_muscles vide, lookup catalog
          const resolvedSecondary =
            (ex.secondary_muscles ?? []).length > 0
              ? ex.secondary_muscles
              : getSecondaryMusclesFromCatalog(ex.name);
          return {
            ...ex,
            primary_muscle: resolvedPrimaryMuscle,
            // Si primary_muscles[] générique → remplacer par primaryMuscle précis
            primary_muscles:
              isAllGeneric && resolvedPrimaryMuscle
                ? [resolvedPrimaryMuscle]
                : primaryMuscles,
            secondary_muscles: resolvedSecondary,
          };
        },
      ),
    }));
  const sessions = selectSessionsForProgramWeek(
    allSessions,
    explicitWeeks,
    cycleSchedule.activeWeekPosition,
  )

  const rawLocalWeekday = getLocalWeekday(new Date(`${todayIso}T12:00:00.000Z`), timezone)
  const todayDow = rawLocalWeekday === 0 ? 7 : rawLocalWeekday;
  const requestedDow = searchParams?.dow ? parseInt(searchParams.dow, 10) : NaN
  const selectedDow = Number.isInteger(requestedDow) && requestedDow >= 1 && requestedDow <= 7
    ? requestedDow
    : todayDow;

  const completedRows = (completedTodayResult?.data ?? []) as any[];
  const completedTodayIds = new Set<string>(
    completedRows.map((r: any) => r.program_session_id).filter(Boolean),
  );
  const completedTodayNames = new Set<string>(
    completedRows.map((r: any) => r.session_name).filter(Boolean),
  );
  const startedRows = (startedTodayResult?.data ?? []) as any[]
  const startedTodayIds = new Set<string>(
    startedRows.map((r: any) => r.program_session_id).filter(Boolean),
  )
  const skippedRows = (skippedTodayResult?.data ?? []) as any[]
  const skippedTodayIds = new Set<string>(
    skippedRows.map((r: any) => r.program_session_id).filter(Boolean),
  )
  const todayDayOverride = await fetchClientDayOverride(service, client.id, todayIso)
  const todayScheduledSessionIds = new Set<string>(
    sessions
      .filter((session: any) => sessionMatchesProgrammeDow(session, todayDow))
      .map((session: any) => session.id)
      .filter(Boolean),
  )

  // Performance data
  const rawLogs: SessionLog[] = (progressLogsResult?.data ?? []) as any[];

  // Translate exercise names in logs
  if (lang !== 'fr' && Object.keys(exerciseDict).length > 0) {
    rawLogs.forEach(log => {
      if (log.client_set_logs) {
        log.client_set_logs.forEach(set => {
          if (set.exercise_name && exerciseDict[set.exercise_name]) {
            set.exercise_name = exerciseDict[set.exercise_name];
          }
        });
      }
    });
  }

  const sessionDates = Array.from(
    new Set(rawLogs.map((l) => l.logged_at.split("T")[0])),
  ).sort() as string[];
  const { streak, bestStreak } = calculateStreaks(sessionDates);
  const allTimePRs = buildPRs(rawLogs);
  const sessionList = buildSessionList(rawLogs, allTimePRs);

  // ── Volume coverage (inline, no HTTP) ─────────────────────────────────────
  const weekSetRows = ((weekSessionsResult as any)?.data ?? []).flatMap(
    (s: any) => ((s.client_set_logs ?? []) as any[]).filter((set: any) => {
      const reps = Number(set.actual_reps ?? 0)
      const weight = Number(set.actual_weight_kg ?? 0)
      return set.completed === true || reps > 0 || weight > 0
    }),
  );
  const volumeByGroup: Record<string, number> = {};
  for (const set of weekSetRows) {
    const biomech = getBiomechData(set.exercise_name);
    if (biomech) {
      // Enriched exercise: use biomech activation coefficients
      if (biomech.primaryMuscle) {
        const g = (MUSCLE_TO_VOLUME_GROUP as Record<string, string>)[biomech.primaryMuscle];
        if (g) volumeByGroup[g] = (volumeByGroup[g] ?? 0) + (biomech.primaryActivation ?? 1);
      }
      (biomech.secondaryMuscles ?? []).forEach((m: string, i: number) => {
        const g = (MUSCLE_TO_VOLUME_GROUP as Record<string, string>)[m];
        if (!g) return;
        volumeByGroup[g] = (volumeByGroup[g] ?? 0) + ((biomech.secondaryActivations ?? [])[i] ?? 0.5);
      });
    } else {
      // Non-enriched exercise: fallback to catalog primary muscle, count 1 set
      const primaryMuscle = getPrimaryMuscleFromCatalog(set.exercise_name);
      if (primaryMuscle) {
        const g = (MUSCLE_TO_VOLUME_GROUP as Record<string, string>)[primaryMuscle];
        if (g) volumeByGroup[g] = (volumeByGroup[g] ?? 0) + 1;
      }
    }
  }
  const volumeCoverage = {
    week_start: monday.toISOString().slice(0, 10),
    sessions_count: ((weekSessionsResult as any)?.data ?? []).length,
    groups: Object.keys(VOLUME_GROUP_LABELS).map((g) => {
      const [mev, mav, mrv] = getVolumeTargets(
        g,
        "hypertrophy",
        "intermediate",
      );
      return {
        group: g,
        label: (VOLUME_GROUP_LABELS as Record<string, string>)[g],
        actual: Math.round((volumeByGroup[g] ?? 0) * 10) / 10,
        mev,
        mav,
        mrv,
      };
    }),
  };

  const allCompletedSessions = ((progressLogsResult as any)?.data ?? []) as any[]
  const volumeCoverageByWindow = (['current_week', '7d', '14d', '30d'] as VolumeWindowKey[]).reduce((acc, key) => {
    const rangeStart = getWindowStart(new Date(), key, monday)
    const rangeEnd = new Date()
    rangeEnd.setHours(23, 59, 59, 999)

    const windowSessions = allCompletedSessions.filter((session: any) => {
      const completedAt = session.completed_at ? new Date(session.completed_at) : null
      if (!completedAt || Number.isNaN(completedAt.getTime())) return false
      return completedAt >= rangeStart && completedAt <= rangeEnd
    })

    const windowSetRows = windowSessions.flatMap((session: any) =>
      ((session.client_set_logs ?? []) as any[]).filter((set: any) => {
        const reps = Number(set.actual_reps ?? 0)
        const weight = Number(set.actual_weight_kg ?? 0)
        return set.completed === true || reps > 0 || weight > 0
      }),
    )

    const volumeByGroupWindow: Record<string, number> = {}
    for (const set of windowSetRows) {
      const biomech = getBiomechData(set.exercise_name)
      if (biomech) {
        if (biomech.primaryMuscle) {
          const g = (MUSCLE_TO_VOLUME_GROUP as Record<string, string>)[biomech.primaryMuscle]
          if (g) volumeByGroupWindow[g] = (volumeByGroupWindow[g] ?? 0) + (biomech.primaryActivation ?? 1)
        }
        ;(biomech.secondaryMuscles ?? []).forEach((m: string, i: number) => {
          const g = (MUSCLE_TO_VOLUME_GROUP as Record<string, string>)[m]
          if (!g) return
          volumeByGroupWindow[g] = (volumeByGroupWindow[g] ?? 0) + ((biomech.secondaryActivations ?? [])[i] ?? 0.5)
        })
      } else {
        const primaryMuscle = getPrimaryMuscleFromCatalog(set.exercise_name)
        if (primaryMuscle) {
          const g = (MUSCLE_TO_VOLUME_GROUP as Record<string, string>)[primaryMuscle]
          if (g) volumeByGroupWindow[g] = (volumeByGroupWindow[g] ?? 0) + 1
        }
      }
    }

    acc[key] = {
      range_start: rangeStart.toISOString().slice(0, 10),
      sessions_count: windowSessions.length,
      groups: Object.keys(VOLUME_GROUP_LABELS).map((g) => {
        const [mev, mav, mrv] = getVolumeTargets(g, 'hypertrophy', 'intermediate')
        return {
          group: g,
          label: (VOLUME_GROUP_LABELS as Record<string, string>)[g],
          actual: Math.round((volumeByGroupWindow[g] ?? 0) * 10) / 10,
          mev,
          mav,
          mrv,
        }
      }),
    }
    return acc
  }, {} as Record<VolumeWindowKey, { range_start: string; sessions_count: number; groups: any[] }>)

  const recentFlexSessions = (recentFlexSessionsResult ?? []).filter((item) =>
    item.session.status === 'completed'
    && item.session.ended_at != null
    && item.summary.total_sets > 0
  )
  const recentFlexHistory = recentFlexSessions.map((item) => ({
    id: item.session.id,
    name:
      item.session.relation_to_planned_workout === 'replace' || item.session.type === 'replacement'
        ? `${ct(lang, 'logger.session.single')} ${ct(lang, 'logger.free.relation.replace').toLowerCase()}`
        : item.session.relation_to_planned_workout === 'bonus' || item.session.type === 'bonus'
          ? `${ct(lang, 'logger.session.single')} ${ct(lang, 'logger.free.relation.bonus').toLowerCase()}`
          : ct(lang, 'logger.free.title'),
    date: (item.session.ended_at ?? item.session.started_at).split('T')[0],
    volume: Math.round(item.summary.tonnage),
    setsCompleted: item.summary.total_sets,
    durationMin: item.summary.duration_seconds != null ? Math.round(item.summary.duration_seconds / 60) : null,
    kind: 'flex' as const,
    href: `/client/flex-workout/recap/${item.session.id}`,
  }))

  return (
    <ProgrammeClientPage
      program={program}
      sessions={sessions}
      todayDow={todayDow}
      selectedDow={selectedDow}
      activeTab={activeTab}
      currentDateIso={todayIso}
      completedTodayIds={Array.from(completedTodayIds)}
      completedTodayNames={Array.from(completedTodayNames)}
      startedTodayIds={Array.from(startedTodayIds)}
      skippedTodayIds={Array.from(skippedTodayIds)}
      todayScheduledSessionIds={Array.from(todayScheduledSessionIds)}
      todayDayOverrideKind={todayDayOverride?.kind ?? null}
      daysShort={daysShort}
      daysFull={daysFull}
      lang={lang}
      streak={streak}
      bestStreak={bestStreak}
      allTimePRs={allTimePRs}
      sessionList={sessionList}
      rawLogs={rawLogs}
      volumeCoverage={{ ...volumeCoverage, windows: volumeCoverageByWindow }}
      recentFlexHistory={recentFlexHistory}
      exerciseDict={exerciseDict}
    />
  );
}

import { Dumbbell } from "lucide-react";

function NoProgramPage({ lang }: { lang: ClientLang }) {
  return (
    <div className="min-h-dvh bg-[#0d0d0d] font-barlow overflow-x-hidden">
      <div className="max-w-lg mx-auto px-5 pt-24 py-16 text-center">
        <Dumbbell size={36} className="text-white/10 mx-auto mb-4" />
        <p className="text-[13px] text-white/40">
          {ct(lang, "programme.noProgram.desc")}
        </p>
      </div>
    </div>
  );
}
