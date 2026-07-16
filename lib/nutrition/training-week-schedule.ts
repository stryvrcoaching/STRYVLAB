import { estimateSessionDurationMin } from "@/lib/training/sessionDuration";

/** Weekday: 1 = Monday … 7 = Sunday (aligned with programme client UI). */

export const WEEKDAY_LABELS_SHORT = [
  "Lun",
  "Mar",
  "Mer",
  "Jeu",
  "Ven",
  "Sam",
  "Dim",
] as const;

export type WeekdayKind =
  | "training"
  | "rest"
  | "rest_with_activity"
  | "undefined";

export interface ProgramSessionScheduleInput {
  name: string;
  day_of_week: number | null;
  days_of_week?: number[] | null;
  exercises?:
    | {
        name?: string | null;
        sets?: number | null;
        reps?: string | null;
        rep_min?: number | null;
        rep_max?: number | null;
        rest_sec?: number | null;
        rir?: number | null;
        target_rir?: number | null;
        tempo?: string | null;
        movement_pattern?: string | null;
        is_unilateral?: boolean | null;
        is_compound?: boolean | null;
      }[]
    | null;
}

export interface ProgramScheduleInput {
  id: string;
  name: string;
  goal?: string | null;
  session_mode?: string | null;
  program_sessions?: ProgramSessionScheduleInput[] | null;
}

export interface WeekdaySessionSummary {
  name: string;
  exerciseCount: number;
  setCount: number;
  estimatedMinutes: number | null;
  avgRestSec: number | null;
  avgRir: number | null;
}

export interface WeekdayScheduleEntry {
  dow: number;
  label: string;
  kind: WeekdayKind;
  sessionNames: string[];
  sessions: WeekdaySessionSummary[];
  summary: WeekdaySessionSummary | null;
}

export interface TrainingWeekSchedule {
  programId: string | null;
  programName: string | null;
  sessionMode: "day" | "cycle" | null;
  days: WeekdayScheduleEntry[];
}

export const WEEKDAY_KIND_LABELS: Record<WeekdayKind, string> = {
  training: "Entraînement",
  rest: "Repos",
  rest_with_activity: "Repos actif",
  undefined: "Non défini",
};

export function sessionDaysOfWeek(
  session: ProgramSessionScheduleInput,
): number[] {
  const multi = session.days_of_week?.filter(
    (d) => typeof d === "number" && d >= 1 && d <= 7,
  );
  if (multi && multi.length > 0)
    return [...new Set(multi)].sort((a, b) => a - b);
  if (
    session.day_of_week != null &&
    session.day_of_week >= 1 &&
    session.day_of_week <= 7
  ) {
    return [session.day_of_week];
  }
  return [];
}

function classifySessions(
  sessions: ProgramSessionScheduleInput[],
): WeekdayKind {
  if (sessions.length === 0) return "rest";
  const withExercises = sessions.filter((s) => (s.exercises?.length ?? 0) > 0);
  if (withExercises.length > 0) return "training";
  return "rest_with_activity";
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function summarizeSession(
  session: ProgramSessionScheduleInput,
  goal: string,
): WeekdaySessionSummary {
  const exercises = session.exercises ?? [];
  const setCount = exercises.reduce(
    (sum, exercise) => sum + Math.max(0, Number(exercise.sets ?? 0)),
    0,
  );
  const restValues = exercises
    .map((exercise) => Number(exercise.rest_sec))
    .filter((value) => Number.isFinite(value) && value > 0);
  const rirValues = exercises
    .map((exercise) => Number(exercise.target_rir ?? exercise.rir))
    .filter((value) => Number.isFinite(value) && value >= 0);
  const estimatedMinutes =
    exercises.length > 0 ? estimateSessionDurationMin(exercises, goal) : null;

  return {
    name: session.name,
    exerciseCount: exercises.length,
    setCount,
    estimatedMinutes,
    avgRestSec: average(restValues),
    avgRir: average(rirValues),
  };
}

function summarizeDaySessions(
  sessions: ProgramSessionScheduleInput[],
  goal: string,
): { sessions: WeekdaySessionSummary[]; summary: WeekdaySessionSummary | null } {
  const summaries = sessions.map((session) => summarizeSession(session, goal));
  if (summaries.length === 0) return { sessions: [], summary: null };
  if (summaries.length === 1) return { sessions: summaries, summary: summaries[0] };

  const estimatedMinutes = summaries
    .map((session) => session.estimatedMinutes)
    .filter((value): value is number => typeof value === "number")
    .reduce((sum, value) => sum + value, 0);

  return {
    sessions: summaries,
    summary: {
      name: summaries.map((session) => session.name).join(" + "),
      exerciseCount: summaries.reduce((sum, session) => sum + session.exerciseCount, 0),
      setCount: summaries.reduce((sum, session) => sum + session.setCount, 0),
      estimatedMinutes: estimatedMinutes > 0 ? estimatedMinutes : null,
      avgRestSec: average(
        summaries
          .map((session) => session.avgRestSec)
          .filter((value): value is number => typeof value === "number"),
      ),
      avgRir: average(
        summaries
          .map((session) => session.avgRir)
          .filter((value): value is number => typeof value === "number"),
      ),
    },
  };
}

/** Build Mon–Sun schedule from an active programme (day mode only). */
export function buildTrainingWeekSchedule(
  program: ProgramScheduleInput | null | undefined,
): TrainingWeekSchedule {
  const emptyDays: WeekdayScheduleEntry[] = WEEKDAY_LABELS_SHORT.map(
    (label, idx) => ({
      dow: idx + 1,
      label,
      kind: "undefined" as WeekdayKind,
      sessionNames: [],
      sessions: [],
      summary: null,
    }),
  );

  if (!program) {
    return {
      programId: null,
      programName: null,
      sessionMode: null,
      days: emptyDays,
    };
  }

  const sessionMode =
    program.session_mode === "cycle"
      ? "cycle"
      : program.session_mode === "day"
        ? "day"
        : null;

  const sessions = program.program_sessions ?? [];

  if (sessionMode === "cycle") {
    return {
      programId: program.id,
      programName: program.name,
      sessionMode: "cycle",
      days: emptyDays.map((d) => ({
        ...d,
        kind: "undefined",
      })),
    };
  }

  const byDow = new Map<number, ProgramSessionScheduleInput[]>();
  for (const session of sessions) {
    for (const dow of sessionDaysOfWeek(session)) {
      const list = byDow.get(dow) ?? [];
      list.push(session);
      byDow.set(dow, list);
    }
  }

  const days = WEEKDAY_LABELS_SHORT.map((label, idx) => {
    const dow = idx + 1;
    const daySessions = byDow.get(dow) ?? [];
    const summaries = summarizeDaySessions(daySessions, program.goal ?? "hypertrophy");
    return {
      dow,
      label,
      kind: classifySessions(daySessions),
      sessionNames: daySessions.map((s) => s.name),
      sessions: summaries.sessions,
      summary: summaries.summary,
    };
  });

  return {
    programId: program.id,
    programName: program.name,
    sessionMode: sessionMode ?? "day",
    days,
  };
}

/** Suggest a nutrition protocol day name from programme weekday kind. */
export function suggestNutritionDayName(
  kind: WeekdayKind,
  protocolDayNames: string[],
): string | null {
  if (kind === "undefined" || protocolDayNames.length === 0) return null;

  const lower = protocolDayNames.map((n) => n.toLowerCase());
  const pick = (patterns: string[]) => {
    const i = lower.findIndex((n) => patterns.some((p) => n.includes(p)));
    return i >= 0 ? protocolDayNames[i] : null;
  };

  if (kind === "training") {
    return (
      pick(["entraînement", "entrainement", "training", "sport", "muscu"]) ??
      null
    );
  }

  return pick(["repos", "rest", "recovery", "récup", "recup", "off"]) ?? null;
}

/** Map Supabase nested `program_exercises` into schedule input shape. */
export function normalizeProgramForSchedule(
  program: ProgramScheduleInput & {
    program_sessions?: (ProgramSessionScheduleInput & {
      program_exercises?: ProgramSessionScheduleInput["exercises"];
    })[];
  },
): ProgramScheduleInput {
  return {
    id: program.id,
    name: program.name,
    goal: program.goal,
    session_mode: program.session_mode,
    program_sessions: (program.program_sessions ?? []).map((s) => ({
      name: s.name,
      day_of_week: s.day_of_week,
      days_of_week: s.days_of_week,
      exercises: s.exercises ?? s.program_exercises ?? [],
    })),
  };
}

export function pickActiveProgramForSchedule(
  programs:
    | (ProgramScheduleInput & {
        status?: string;
        is_client_visible?: boolean;
        created_at?: string;
      })[]
    | null
    | undefined,
): ProgramScheduleInput | null {
  if (!programs?.length) return null;
  const active = programs.filter((p) => p.status !== "archived");
  const pool = active.length > 0 ? active : programs;
  const visible = pool.filter((p) => p.is_client_visible);
  const ranked = (visible.length > 0 ? visible : pool).slice();
  ranked.sort((a, b) => {
    const ta = a.created_at ? Date.parse(a.created_at) : 0;
    const tb = b.created_at ? Date.parse(b.created_at) : 0;
    return tb - ta;
  });
  return ranked[0] ?? null;
}
