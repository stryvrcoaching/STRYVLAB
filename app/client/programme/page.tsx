import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { resolveClientFromUser } from "@/lib/client/resolve-client";
import { ct, cta, type ClientLang } from "@/lib/i18n/clientTranslations";
import {
  buildHeatmap,
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
import {
  analyzeExercisePerformance,
  type SessionPerf,
  type OverloadEvent,
  type SetLogEntry,
} from "@/lib/performance/analyzer";
import { computeWorkoutAlerts } from "@/lib/client/smart/workoutAlerts";
import {
  getVolumeTargets,
  VOLUME_GROUP_LABELS,
  MUSCLE_TO_VOLUME_GROUP,
} from "@/lib/programs/intelligence/volume-targets";
import type { GenericAlert } from "@/components/client/smart/SmartAlertsFeed";
import { fetchClientDayOverride } from '@/lib/client/day-kind'
import { computePhysiologicalDateInTimezone, utcRangeForPhysiologicalDate, getLocalWeekday } from '@/lib/client/checkin/timeWindows'
import { resolveClientTimezone } from '@/lib/client/checkin/resolveClientTimezone'

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

  const timezone = await resolveClientTimezone(service, client.id)
  const todayIso = computePhysiologicalDateInTimezone(new Date(), timezone);
  const { start: todayStart, end: todayEnd } = utcRangeForPhysiologicalDate(todayIso, timezone)
  const eightWeeksAgo = new Date();
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

  const { monday, sunday } = getCurrentWeekBounds()

  const [
    programsResult,
    prefsLangResult,
    completedTodayResult,
    startedTodayResult,
    skippedTodayResult,
    sessionLogsResult,
    perfSessionsResult,
    progressionEventsResult,
    weekSessionsResult,
    recentSessionsResult,
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

    // For workout alerts (last 8 weeks sessions with sets)
    service
      .from("client_session_logs")
      .select(
        "id, completed_at, client_set_logs(id, exercise_id, exercise_name, set_number, actual_reps, rir_actual, completed)",
      )
      .eq("client_id", client.id)
      .not("completed_at", "is", null)
      .gte("completed_at", eightWeeksAgo.toISOString()),

    // Progression events for overload counting
    service
      .from("progression_events")
      .select("exercise_id, created_at, trigger_type")
      .eq("client_id", client.id)
      .gte("created_at", eightWeeksAgo.toISOString()),

    // This week's sessions for volume coverage
    service
      .from("client_session_logs")
      .select("id, client_set_logs(exercise_name, completed, actual_reps, actual_weight_kg)")
      .eq("client_id", client.id)
      .not("completed_at", "is", null)
      .gte("completed_at", monday.toISOString())
      .lte("completed_at", sunday.toISOString()),

    // Recent sessions (last 3)
    service
      .from("client_session_logs")
      .select(
        "id, completed_at, program_session_id, client_set_logs(actual_weight_kg, actual_reps, rir_actual)",
      )
      .eq("client_id", client.id)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(3),
  ]);

  const programs = programsResult?.data;
  const rawLang = (prefsLangResult as any)?.data?.language;
  const lang: ClientLang = ["fr", "en", "es"].includes(rawLang)
    ? (rawLang as ClientLang)
    : "fr";
  const daysShort = cta(lang, "programme.days.short");
  const daysFull = cta(lang, "programme.days.full");

  const program = programs?.[0];
  if (!program) return <NoProgramPage lang={lang} />;

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

  const sessions = ((program.program_sessions ?? []) as any[])
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

  const rawLocalWeekday = getLocalWeekday(new Date(), timezone)
  const todayDow = rawLocalWeekday === 0 ? 7 : rawLocalWeekday;
  const selectedDow = searchParams?.dow
    ? parseInt(searchParams.dow, 10)
    : todayDow;
  const activeTab = searchParams?.tab ?? "seance";

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

  // Performance data
  const rawLogs: SessionLog[] = (sessionLogsResult?.data ?? []) as any[];
  const sessionDates = Array.from(
    new Set(rawLogs.map((l) => l.logged_at.split("T")[0])),
  ).sort() as string[];
  const { streak, bestStreak } = calculateStreaks(sessionDates);
  const heatmapData = buildHeatmap(rawLogs);
  const allTimePRs = buildPRs(rawLogs);
  const sessionList = buildSessionList(rawLogs, allTimePRs);

  const programExerciseNameById = new Map<string, string>(
    sessions.flatMap((session: any) =>
      ((session.program_exercises ?? []) as any[])
        .filter((exercise: any) => exercise?.id && exercise?.name)
        .map((exercise: any) => [exercise.id as string, exercise.name as string] as const),
    ),
  );

  // ── Workout alerts (inline, no HTTP) ──────────────────────────────────────
  const perfSessions: SessionPerf[] = (
    (perfSessionsResult as any)?.data ?? []
  ).map((s: any) => ({
    session_log_id: s.id,
    logged_at: s.completed_at as string,
    sets: ((s.client_set_logs ?? []) as any[]).map(
      (sl: any) =>
        ({
          exercise_id: sl.exercise_id ?? sl.exercise_name,
          exercise_name:
            sl.exercise_name ??
            (sl.exercise_id ? programExerciseNameById.get(sl.exercise_id) : null) ??
            "Exercice",
          set_number: sl.set_number ?? 1,
          actual_reps: sl.actual_reps ?? null,
          rir_actual: sl.rir_actual ?? null,
          completed: sl.completed === true,
        }) satisfies SetLogEntry,
    ),
  }));

  const overloads: OverloadEvent[] = (
    (progressionEventsResult as any)?.data ?? []
  ).map((e: any) => ({
    exercise_id: e.exercise_id,
    exercise_name: e.exercise_id,
    created_at: e.created_at,
    trigger_type: e.trigger_type,
  }));

  const analysis = analyzeExercisePerformance(perfSessions, overloads, 8);
  const workoutAlerts: GenericAlert[] = computeWorkoutAlerts(
    analysis.exercises.map((e) => ({
      exercise_name: e.exercise_name,
      completion_rate: e.completion_rate,
      avg_rir: e.avg_rir,
      rir_trend: e.rir_trend,
      overloads_last_4_weeks: e.overloads_last_4_weeks,
      stagnation: e.stagnation,
      overreaching: e.overreaching,
    })),
  ).map((a) => ({
    code: a.code,
    severity: a.severity,
    title: a.title,
    body: a.body,
  }));

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

  const allCompletedSessions = ((sessionLogsResult as any)?.data ?? []) as any[]
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

  // ── Recent sessions (inline, no HTTP) ─────────────────────────────────────
  const smartRecentSessions = ((recentSessionsResult as any)?.data ?? []).map(
    (s: any) => {
      const sets = (s.client_set_logs ?? []) as any[];
      const volumeKg = sets.reduce(
        (sum: number, st: any) =>
          sum + Number(st.actual_weight_kg ?? 0) * Number(st.actual_reps ?? 0),
        0,
      );
      const rirVals = sets
        .map((st: any) => st.rir_actual)
        .filter((v: unknown): v is number => v != null);
      const avgRir =
        rirVals.length > 0
          ? rirVals.reduce((a: number, b: number) => a + b, 0) / rirVals.length
          : null;
      return {
        id: s.id as string,
        completed_at: s.completed_at as string,
        program_session_id: s.program_session_id as string | null,
        volume_kg: Math.round(volumeKg),
        avg_rir: avgRir != null ? Math.round(avgRir * 10) / 10 : null,
      };
    },
  );

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
      todayDayOverrideKind={todayDayOverride?.kind ?? null}
      daysShort={daysShort}
      daysFull={daysFull}
      lang={lang}
      streak={streak}
      bestStreak={bestStreak}
      heatmapData={heatmapData}
      allTimePRs={allTimePRs}
      sessionList={sessionList}
      rawLogs={rawLogs}
      workoutAlerts={workoutAlerts}
      volumeCoverage={{ ...volumeCoverage, windows: volumeCoverageByWindow }}
      smartRecentSessions={smartRecentSessions}
    />
  );
}

import { Dumbbell } from "lucide-react";

function NoProgramPage({ lang }: { lang: ClientLang }) {
  return (
    <div className="min-h-screen bg-[#0d0d0d] font-barlow">
      <div className="max-w-lg mx-auto px-5 pt-24 py-16 text-center">
        <Dumbbell size={36} className="text-white/10 mx-auto mb-4" />
        <p className="text-[13px] text-white/40">
          {ct(lang, "programme.noProgram.desc")}
        </p>
      </div>
    </div>
  );
}
