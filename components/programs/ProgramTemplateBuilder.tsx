"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { useSetTopBar } from "@/components/layout/useSetTopBar";
import { useSetFullscreenPage } from "@/components/layout/CoachShell";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Save,
  Loader2,
  Tag,
  ImagePlus,
  X,
  Library,
  Dumbbell,
  ArrowLeftRight,
  Upload,
  BookmarkPlus,
} from "lucide-react";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import { useRouter } from "next/navigation";
import Image from "next/image";
import ExercisePicker from "./ExercisePicker";
import {
  useProgramIntelligence,
  useLabOverrides,
  type IntelligenceProfile,
} from "@/lib/programs/intelligence";
import {
  getCatalogEntryByName,
  getMusclesFromCatalog,
} from "@/lib/programs/intelligence/catalog-utils";
import ProgramIntelligencePanel from "./ProgramIntelligencePanel";
import IntelligenceAlertBadge from "./IntelligenceAlertBadge";
import ExerciseAlternativesDrawer from "./ExerciseAlternativesDrawer";
import ExerciseClientAlternatives from "./ExerciseClientAlternatives";
import NavigatorPane from "./studio/NavigatorPane";
import EditorPane from "./studio/EditorPane";
import IntelligencePanelShell from "./studio/IntelligencePanelShell";
import WeekNavigator, {
  type CompletionBehavior,
} from "./studio/WeekNavigator";
import MesocycleGeneratorModal from "./MesocycleGeneratorModal";
import type { ProgramWeekRecord } from "@/lib/programs/programWeeks";
import { publishClientImpact } from "@/lib/coach/client-impact-events";
import SaveAsTemplateModal from "./SaveAsTemplateModal";
import SavePatternModal from "./SavePatternModal";
import PatternPicker from "./PatternPicker";
import {
  applyDefaultFieldToSetPrescriptions,
  type SetPrescription,
  type SupersetRestMode,
} from "@/lib/programs/setPrescriptions";
import ContextDocsMenu from "@/components/docs/ContextDocsMenu";
import { getDocsForAudienceAndContext } from "@/lib/docs/registry";
import HeaderIconButton from "@/components/layout/HeaderIconButton";
import { getDefaultTempo, normalizeTempoPreset } from "@/lib/training/tempo";
import { getDefaultReps } from "@/lib/training/setRecommendation";
import { getDefaultRestSec } from "@/lib/training/restPolicy";

const GOALS = [
  { value: "hypertrophy", label: "Hypertrophie" },
  { value: "strength", label: "Force" },
  { value: "endurance", label: "Endurance" },
  { value: "fat_loss", label: "Perte de gras" },
  { value: "recomp", label: "Recomposition" },
  { value: "maintenance", label: "Maintenance" },
  { value: "athletic", label: "Athletic" },
];

const LEVELS = [
  { value: "beginner", label: "Débutant" },
  { value: "intermediate", label: "Intermédiaire" },
  { value: "advanced", label: "Avancé" },
  { value: "elite", label: "Élite" },
];

const MUSCLE_OPTIONS = [
  "Full Body",
  "Jambes",
  "Fessiers",
  "Ischio-jambiers",
  "Quadriceps",
  "Pectoraux",
  "Dos",
  "Épaules",
  "Biceps",
  "Triceps",
  "Abdos",
  "Mollets",
  "Lombaires",
  "Posture",
  "Cardio",
];

const EQUIPMENT_ARCHETYPES = [
  { value: "", label: "— Non spécifié —" },
  { value: "bodyweight", label: "Poids du corps" },
  { value: "home_dumbbells", label: "Domicile — Haltères" },
  { value: "home_full", label: "Domicile — Complet" },
  { value: "home_rack", label: "Rack à domicile" },
  { value: "functional_box", label: "Box / Fonctionnel" },
  { value: "commercial_gym", label: "Salle de sport" },
];

const MOVEMENT_PATTERNS = [
  { value: "", label: "— Pattern —" },
  { value: "horizontal_push", label: "Poussée horizontale" },
  { value: "vertical_push", label: "Poussée verticale" },
  { value: "horizontal_pull", label: "Tirage horizontal" },
  { value: "vertical_pull", label: "Tirage vertical" },
  { value: "squat_pattern", label: "Pattern squat" },
  { value: "hip_hinge", label: "Charnière hanche" },
  { value: "knee_flexion", label: "Flexion genou" },
  { value: "knee_extension", label: "Extension genou" },
  { value: "calf_raise", label: "Extension mollets" },
  { value: "elbow_flexion", label: "Flexion coude (Biceps)" },
  { value: "elbow_extension", label: "Extension coude (Triceps)" },
  { value: "lateral_raise", label: "Élévation latérale" },
  { value: "hip_abduction", label: "Abduction hanche" },
  { value: "hip_adduction", label: "Adduction hanche" },
  { value: "shoulder_rotation", label: "Rotation épaule" },
  { value: "carry", label: "Porté (Carry)" },
  { value: "scapular_elevation", label: "Élévation scapulaire (Shrug)" },
  { value: "scapular_retraction", label: "Rétraction scapulaire" },
  { value: "scapular_protraction", label: "Protraction scapulaire" },
  { value: "core_anti_flex", label: "Gainage anti-flexion" },
  { value: "core_flex", label: "Flexion core" },
  { value: "core_rotation", label: "Rotation core" },
  { value: "cardio", label: "Cardio" },
];

const EQUIPMENT_ITEMS = [
  { value: "bodyweight", label: "Poids du corps" },
  { value: "band", label: "Élastique" },
  { value: "dumbbell", label: "Haltère" },
  { value: "barbell", label: "Barre" },
  { value: "kettlebell", label: "Kettlebell" },
  { value: "machine", label: "Machine" },
  { value: "cable", label: "Poulie" },
  { value: "smith", label: "Smith machine" },
  { value: "trx", label: "TRX" },
  { value: "ez_bar", label: "Barre EZ" },
  { value: "trap_bar", label: "Trap bar" },
  { value: "landmine", label: "Landmine" },
  { value: "medicine_ball", label: "Med ball" },
  { value: "swiss_ball", label: "Swiss ball" },
  { value: "rings", label: "Anneaux" },
  { value: "sled", label: "Sled" },
];
const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const SUPERSET_COLORS = [
  "#f59e0b",
  "#3b82f6",
  "#ec4899",
  "#8b5cf6",
  "#06b6d4",
  "#f97316",
];

const MUSCLE_GROUPS: { slug: string; label: string }[] = [
  { slug: "chest", label: "Pectoraux" },
  { slug: "shoulders", label: "Épaules" },
  { slug: "biceps", label: "Biceps" },
  { slug: "triceps", label: "Triceps" },
  { slug: "abs", label: "Abdos" },
  { slug: "back_upper", label: "Dos (haut)" },
  { slug: "back_lower", label: "Lombaires" },
  { slug: "traps", label: "Trapèzes" },
  { slug: "quads", label: "Quadriceps" },
  { slug: "hamstrings", label: "Ischios" },
  { slug: "glutes", label: "Fessiers" },
  { slug: "calves", label: "Mollets" },
  { slug: "cardio", label: "Cardio" },
];

function makeExId(si: number, ei: number) {
  return `ex-${si}-${ei}`;
}
function parseExId(id: string): { si: number; ei: number } {
  const parts = id.split("-");
  return { si: Number(parts[1]), ei: Number(parts[2]) };
}

interface Exercise {
  name: string;
  sets: number;
  reps: string;
  rest_sec: number | null;
  rir: number | null;
  weight_increment_kg: number | null;
  notes: string;
  image_url: string | null;
  movement_pattern: string | null;
  equipment_required: string[];
  primary_muscles: string[];
  secondary_muscles: string[];
  is_compound: boolean | undefined;
  is_unilateral: boolean;
  tempo: string | null;
  set_prescriptions?: SetPrescription[];
  superset_rest_mode?: SupersetRestMode | null;
  group_id?: string;
  dbId?: string;
  target_rir?: number | null;
  target_hr_zone?: string | null;
  execution_type?: 'reps_rir' | 'time_rpe' | 'distance_rpe';
  // Biomech fields (auto-populated from catalog on picker selection)
  plane?: string | null;
  mechanic?: string | null;
  unilateral?: boolean;
  primaryMuscle?: string | null;
  primaryActivation?: number | null;
  secondaryMusclesDetail?: string[];
  secondaryActivations?: number[];
  stabilizers?: string[];
  jointStressSpine?: number | null;
  jointStressKnee?: number | null;
  jointStressShoulder?: number | null;
  globalInstability?: number | null;
  coordinationDemand?: number | null;
  constraintProfile?: string | null;
}
interface Session {
  dbId?: string;
  name: string;
  day_of_week: number | null;
  days_of_week: number[];
  notes: string;
  exercises: Exercise[];
  open: boolean;
}
interface TemplateMeta {
  name: string;
  description: string;
  goal: string;
  level: string;
  frequency: number;
  weeks: number;
  muscle_tags: string[];
  notes: string;
  equipment_archetype: string;
  session_mode: "day" | "cycle";
  volume_focus: Record<string, "priority" | "progression" | "maintenance" | "off">;
}

function emptyExercise(goal = "hypertrophy"): Exercise {
  return {
    name: "",
    sets: 3,
    reps: getDefaultReps(goal),
    rest_sec: getDefaultRestSec(goal),
    rir: 2,
    weight_increment_kg: null,
    notes: "",
    image_url: null,
    movement_pattern: null,
    equipment_required: [],
    primary_muscles: [],
    secondary_muscles: [],
    is_compound: undefined,
    is_unilateral: false,
    target_rir: null,
    target_hr_zone: null,
    execution_type: 'reps_rir',
    // Persist the objective-based default so it is retained after a reload.
    tempo: getDefaultTempo(null, goal),
    set_prescriptions: [],
    superset_rest_mode: 'after_round',
    group_id: undefined,
    dbId: undefined,
    plane: null,
    mechanic: null,
    unilateral: false,
    primaryMuscle: null,
    primaryActivation: null,
    secondaryMusclesDetail: [],
    secondaryActivations: [],
    stabilizers: [],
    jointStressSpine: null,
    jointStressKnee: null,
    jointStressShoulder: null,
    globalInstability: null,
    coordinationDemand: null,
    constraintProfile: null,
  };
}
function emptySession(goal = "hypertrophy"): Session {
  return {
    dbId: undefined,
    name: "",
    day_of_week: null,
    days_of_week: [],
    notes: "",
    exercises: [emptyExercise(goal)],
    open: true,
  };
}

function derivePrimaryMusclesFromStoredExercise(exercise: any): string[] {
  const catalog = getCatalogEntryByName(exercise.name);
  const precisePrimary =
    exercise.primary_muscle ?? catalog?.primaryMuscle ?? null;
  if (precisePrimary) return [precisePrimary];
  if ((exercise.primary_muscles ?? []).length > 0)
    return exercise.primary_muscles;
  return getMusclesFromCatalog(exercise.name);
}

function mapStoredSessions(rawSessions: any[] | null | undefined, goal: string): Session[] {
  if (!rawSessions) return [emptySession(goal)];

  return rawSessions
    .slice()
    .sort((a: any, b: any) => a.position - b.position)
    .map((session: any) => ({
      dbId: session.id ?? undefined,
      name: session.name,
      day_of_week: session.day_of_week,
      days_of_week:
        session.days_of_week ?? (session.day_of_week ? [session.day_of_week] : []),
      notes: session.notes ?? "",
      open: false,
      exercises: (
        session.coach_program_template_exercises ??
        session.program_exercises ??
        []
      )
        .slice()
        .sort((a: any, b: any) => a.position - b.position)
        .map((exercise: any) => {
          const catalog = getCatalogEntryByName(exercise.name);
          return {
            name: exercise.name,
            sets: exercise.sets,
            reps: exercise.reps ?? getDefaultReps(goal),
            rest_sec: exercise.rest_sec ?? getDefaultRestSec(goal),
            rir: exercise.rir,
            weight_increment_kg: exercise.weight_increment_kg ?? null,
            notes: exercise.notes ?? "",
            image_url: exercise.image_url ?? catalog?.gifUrl ?? null,
            movement_pattern:
              exercise.movement_pattern ?? catalog?.movementPattern ?? null,
            equipment_required:
              exercise.equipment_required ?? catalog?.equipment ?? [],
            primary_muscles: derivePrimaryMusclesFromStoredExercise(exercise),
            secondary_muscles:
              exercise.secondary_muscles ?? catalog?.secondaryMuscles ?? [],
            is_compound:
              exercise.is_compound ?? catalog?.isCompound ?? undefined,
            is_unilateral: exercise.is_unilateral ?? false,
            target_rir: exercise.target_rir ?? exercise.rir ?? null,
            target_hr_zone: exercise.target_hr_zone ?? null,
            tempo:
              exercise.tempo ??
              getDefaultTempo(
                exercise.movement_pattern ?? catalog?.movementPattern ?? null,
                goal,
              ),
            set_prescriptions: exercise.set_prescriptions ?? [],
            superset_rest_mode: exercise.superset_rest_mode ?? "after_round",
            group_id: exercise.group_id ?? undefined,
            dbId: exercise.id ?? undefined,
            execution_type: exercise.execution_type ?? "reps_rir",
            plane: exercise.plane ?? catalog?.plane ?? null,
            mechanic: exercise.mechanic ?? catalog?.mechanic ?? null,
            unilateral: exercise.unilateral ?? catalog?.unilateral ?? false,
            primaryMuscle:
              exercise.primary_muscle ?? catalog?.primaryMuscle ?? null,
            primaryActivation:
              exercise.primary_activation != null
                ? Number(exercise.primary_activation)
                : null,
            secondaryMusclesDetail: exercise.secondary_muscles_detail ?? [],
            secondaryActivations: (exercise.secondary_activations ?? []).map(Number),
            stabilizers: exercise.stabilizers ?? [],
            jointStressSpine: exercise.joint_stress_spine ?? null,
            jointStressKnee: exercise.joint_stress_knee ?? null,
            jointStressShoulder: exercise.joint_stress_shoulder ?? null,
            globalInstability: exercise.global_instability ?? null,
            coordinationDemand: exercise.coordination_demand ?? null,
            constraintProfile:
              exercise.constraint_profile ?? catalog?.constraintProfile ?? null,
          } as Exercise;
        }),
    }));
}

function buildStoredSessionsPayload(sessions: Session[], goal: string) {
  return sessions.map((session) => ({
    dbId: session.dbId,
    name: session.name,
    day_of_week: session.days_of_week[0] ?? session.day_of_week ?? null,
    days_of_week: session.days_of_week,
    notes: session.notes,
    exercises: session.exercises.map((exercise) => ({
      name: exercise.name,
      sets: exercise.sets,
      reps: exercise.reps,
      rest_sec: exercise.rest_sec ?? getDefaultRestSec(goal),
      rir:
        exercise.execution_type === "reps_rir"
          ? exercise.rir
          : (exercise.target_rir ?? exercise.rir),
      weight_increment_kg: exercise.weight_increment_kg ?? null,
      target_rir: exercise.target_rir ?? null,
      target_hr_zone: exercise.target_hr_zone ?? null,
      notes: exercise.notes,
      image_url: exercise.image_url,
      movement_pattern: exercise.movement_pattern,
      equipment_required: exercise.equipment_required,
      primary_muscles: exercise.primary_muscles,
      secondary_muscles: exercise.secondary_muscles,
      is_compound: exercise.is_compound,
      is_unilateral: exercise.is_unilateral ?? false,
      tempo: normalizeTempoPreset(exercise.tempo, exercise.movement_pattern, goal),
      set_prescriptions: (exercise.set_prescriptions ?? []).map((set) => ({
        ...set,
        tempo:
          set.tempo == null
            ? null
            : normalizeTempoPreset(set.tempo, exercise.movement_pattern, goal),
      })),
      superset_rest_mode: exercise.superset_rest_mode ?? "after_round",
      group_id: exercise.group_id ?? null,
      dbId: exercise.dbId,
      execution_type: exercise.execution_type ?? "reps_rir",
      plane: exercise.plane ?? null,
      mechanic: exercise.mechanic ?? null,
      unilateral: exercise.unilateral ?? false,
      primary_muscle: exercise.primaryMuscle ?? null,
      primary_activation: exercise.primaryActivation ?? null,
      secondary_muscles_detail: exercise.secondaryMusclesDetail ?? [],
      secondary_activations: exercise.secondaryActivations ?? [],
      stabilizers: exercise.stabilizers ?? [],
      joint_stress_spine: exercise.jointStressSpine ?? null,
      joint_stress_knee: exercise.jointStressKnee ?? null,
      joint_stress_shoulder: exercise.jointStressShoulder ?? null,
      global_instability: exercise.globalInstability ?? null,
      coordination_demand: exercise.coordinationDemand ?? null,
      constraint_profile: exercise.constraintProfile ?? null,
    })),
  }));
}

interface Props {
  noFullscreen?: boolean; // page parent gère son propre layout h-screen
  initial?: any;
  templateId?: string;
  programId?: string; // mode programme client (vs template)
  clientId?: string;
  onSaved?: (program: any) => void;
  onCancel?: () => void;
  onTopBarActions?: (node: ReactNode) => void;
  /** If provided, Builder manages the TopBar itself (left=this node, right=save actions) */
  topBarLeft?: ReactNode;
}

export default function ProgramTemplateBuilder({
  initial,
  templateId,
  programId,
  clientId,
  onSaved,
  onCancel,
  onTopBarActions,
  topBarLeft,
  noFullscreen,
}: Props) {
  const router = useRouter();
  const isProgram = !!programId;
  const isEdit = !!templateId || isProgram;

  useSetFullscreenPage(!noFullscreen);

  const [meta, setMeta] = useState<TemplateMeta>(() =>
    initial
      ? {
          name: initial.name ?? "",
          description: initial.description ?? "",
          goal: initial.goal ?? "hypertrophy",
          level: initial.level ?? "intermediate",
          frequency: initial.frequency ?? 3,
          weeks: initial.weeks ?? 8,
          muscle_tags: initial.muscle_tags ?? [],
          notes: initial.notes ?? "",
          equipment_archetype: initial.equipment_archetype ?? "",
          session_mode: (initial.session_mode ?? "day") as "day" | "cycle",
          volume_focus: initial.volume_focus ?? {},
        }
      : {
          name: "",
          description: "",
          goal: "hypertrophy",
          level: "intermediate",
          frequency: 3,
          weeks: 8,
          muscle_tags: [],
          notes: "",
          equipment_archetype: "",
          session_mode: "day",
          volume_focus: {},
        },
  );

  const [sessions, setSessions] = useState<Session[]>(() =>
    mapStoredSessions(
      initial?.coach_program_template_sessions ?? initial?.program_sessions ?? null,
      initial?.goal ?? "hypertrophy",
    ),
  );

  useEffect(() => {
    if (!clientId) return;
    const cardioSessions = sessions.filter((session) =>
      session.exercises.some((exercise) => exercise.execution_type && exercise.execution_type !== "reps_rir"),
    );
    const strengthSessions = sessions.filter((session) =>
      session.exercises.some((exercise) => !exercise.execution_type || exercise.execution_type === "reps_rir"),
    );
    const parseNumbers = (value: string) => (String(value).match(/\d+(?:[.,]\d+)?/g) ?? []).map((item) => Number(item.replace(",", ".")));
    const averageReps = (value: string) => {
      const numbers = parseNumbers(value);
      if (numbers.length === 0) return 0;
      return numbers.length > 1 ? (numbers[0] + numbers[1]) / 2 : numbers[0];
    };
    const cardioMinutes = cardioSessions.reduce((total, session) => total + session.exercises.reduce((sessionTotal, exercise) => {
      if (exercise.execution_type !== "time_rpe") return sessionTotal;
      return sessionTotal + averageReps(exercise.reps);
    }, 0), 0);
    const strengthExercises = sessions.flatMap((session) => session.exercises).filter((exercise) => !exercise.execution_type || exercise.execution_type === "reps_rir");
    const setsWeekly = strengthExercises.reduce((sum, exercise) => sum + Math.max(0, Number(exercise.sets ?? 0)), 0);
    const repsWeekly = strengthExercises.reduce((sum, exercise) => sum + Math.max(0, Number(exercise.sets ?? 0) * averageReps(exercise.reps)), 0);
    const restMinutesWeekly = strengthExercises.reduce((sum, exercise) => sum + Math.max(0, Number(exercise.sets ?? 0) - 1) * Math.max(0, Number(exercise.rest_sec ?? 0)) / 60, 0);
    const strengthWorkMinutes = repsWeekly * 3 / 60;
    const totalPlannedMinutes = cardioMinutes + strengthWorkMinutes + restMinutesWeekly;
    const trainingRirValues = strengthExercises.map((exercise) => Number(exercise.target_rir ?? exercise.rir)).filter((value) => Number.isFinite(value) && value >= 0 && value <= 5);
    const cardioTypes = Array.from(new Set(
      cardioSessions.flatMap((session) => session.exercises)
        .filter((exercise) => exercise.execution_type && exercise.execution_type !== "reps_rir")
        .map((exercise) => String(exercise.target_hr_zone ?? "").trim())
        .filter(Boolean),
    ));
    const cardioRpeValues = cardioSessions.flatMap((session) => session.exercises)
      .filter((exercise) => exercise.execution_type && exercise.execution_type !== "reps_rir")
      .map((exercise) => Number(exercise.target_rir ?? exercise.rir))
      .filter((value) => Number.isFinite(value) && value >= 1 && value <= 10);
    publishClientImpact({
      clientId,
      kind: "workout-draft",
      workout: {
        weeklyFrequency: sessions.length,
        strengthFrequency: strengthSessions.length,
        cardioFrequency: cardioSessions.length,
        cardioDurationMin: cardioSessions.length > 0 ? cardioMinutes / cardioSessions.length : 0,
        cardioTypes,
        cardioRpe: cardioRpeValues.length > 0
          ? cardioRpeValues.reduce((sum, value) => sum + value, 0) / cardioRpeValues.length
          : null,
        sessionDurationMin: sessions.length > 0 ? totalPlannedMinutes / sessions.length : null,
        trainingTypes: strengthExercises.length > 0 ? ["Musculation / Powerlifting"] : [],
        trainingRir: trainingRirValues.length > 0
          ? trainingRirValues.reduce((sum, value) => sum + value, 0) / trainingRirValues.length
          : null,
        setsWeekly,
        repsWeekly,
        restMinutesWeekly,
      },
    });
  }, [clientId, sessions]);

  useEffect(() => () => {
    if (clientId) publishClientImpact({ clientId, kind: "clear-workout-draft" });
  }, [clientId]);

  const orderedSessions = useMemo(
    () =>
      meta.session_mode === "day"
        ? [...sessions].sort(
            (a, b) =>
              (a.days_of_week[0] ?? a.day_of_week ?? 99) -
              (b.days_of_week[0] ?? b.day_of_week ?? 99),
          )
        : sessions,
    [sessions, meta.session_mode],
  );

  function rawSessionIndex(orderedSi: number): number {
    const target = orderedSessions[orderedSi];
    if (!target) return 0; // defensive fallback — should never happen in practice
    return sessions.indexOf(target);
  }

  function moveSession(fromSi: number, toSi: number) {
    if (meta.session_mode !== "cycle") return;
    if (fromSi === toSi) return;
    setSessions((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromSi, 1);
      next.splice(toSi, 0, moved);
      return next;
    });
    // Scroll to moved session's first exercise
    setTimeout(() => {
      const el = exerciseRefs.current[`${toSi}-0`];
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  function moveExercise(
    fromSi: number,
    fromEi: number,
    toSi: number,
    toEi: number,
  ) {
    if (fromSi === toSi && fromEi === toEi) return;
    setSessions((prev) => {
      const next = prev.map((s) => ({ ...s, exercises: [...s.exercises] }));
      const [moved] = next[fromSi].exercises.splice(fromEi, 1);
      next[toSi].exercises.splice(toEi, 0, moved);
      return next;
    });
    // Scroll to destination after state update
    setTimeout(() => {
      const key = `${toSi}-${toEi}`;
      const el = exerciseRefs.current[key];
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
        setHighlightKey(key);
        setTimeout(() => setHighlightKey(null), 1200);
      }
    }, 50);
  }

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [programWeeks, setProgramWeeks] = useState<ProgramWeekRecord[]>([]);
  const [activeWeekId, setActiveWeekId] = useState<string | null>(null);
  const [completionBehavior, setCompletionBehavior] =
    useState<CompletionBehavior>("repeat");
  const [weeksLoading, setWeeksLoading] = useState(false);
  const [weekAction, setWeekAction] = useState<
    "switch" | "add" | "duplicate" | "delete" | "completion" | "mesocycle" | null
  >(null);
  const [showMesocycleGenerator, setShowMesocycleGenerator] = useState(false);
  const activeWeekIdRef = useRef<string | null>(null);
  const goalRef = useRef(meta.goal);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [activeInsightsTab, setActiveInsightsTab] = useState<
    "smartfit" | "performance"
  >("smartfit");
  const [intelligenceProfile, setIntelligenceProfile] = useState<
    IntelligenceProfile | undefined
  >(undefined);
  const [morphoAdjustments, setMorphoAdjustments] = useState<
    Record<string, number> | undefined
  >(undefined);
  const [morphoDate, setMorphoDate] = useState<string | undefined>(undefined);
  const [highlightKey, setHighlightKey] = useState<string | null>(null);
  const exerciseRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const {
    overrides: labOverrides,
    setOverride: onOverrideChange,
    resetOverrides: onOverrideReset,
  } = useLabOverrides();

  useEffect(() => {
    goalRef.current = meta.goal;
  }, [meta.goal]);

  const loadWeekContent = useCallback(
    async (weekId: string) => {
      if (!programId) return;
      setWeeksLoading(true);
      try {
        const response = await fetch(
          `/api/programs/${programId}/weeks/${weekId}/content`,
        );
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error ?? "Impossible de charger cette semaine");
        }
        activeWeekIdRef.current = weekId;
        setActiveWeekId(weekId);
        setSessions(mapStoredSessions(data.sessions ?? [], goalRef.current));
        setSelectedExercises([]);
      } finally {
        setWeeksLoading(false);
      }
    },
    [programId],
  );

  const synchronizeProgramWeeks = useCallback(
    async (sessionMode: TemplateMeta["session_mode"]) => {
      if (!programId) return;
      setWeeksLoading(true);
      try {
        let response = await fetch(`/api/programs/${programId}/weeks`);
        let data = await response.json();

        if (!response.ok) {
          if (sessionMode === "cycle") {
            throw new Error(
              data.error ?? "Le mode cycle n’est pas encore disponible",
            );
          }
          return;
        }

        const configuredCompletionBehavior =
          (data.completion_behavior as CompletionBehavior | undefined) ?? "repeat";

        if (data.cycle_available === false) {
          setProgramWeeks([]);
          activeWeekIdRef.current = null;
          setActiveWeekId(null);
          if (sessionMode === "cycle") {
            setMeta((current) => ({ ...current, session_mode: "day" }));
            setError(
              "Le mode cycle doit d’abord être activé sur la base de données.",
            );
          }
          return;
        }

        if ((data.weeks ?? []).length === 0 && sessionMode === "cycle") {
          response = await fetch(`/api/programs/${programId}/weeks`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "initialize" }),
          });
          data = await response.json();
          if (!response.ok) {
            throw new Error(data.error ?? "Impossible d’activer le cycle");
          }
        }

        const weeks = (data.weeks ?? []) as ProgramWeekRecord[];
        setProgramWeeks(weeks);
        setCompletionBehavior(configuredCompletionBehavior);

        if (weeks.length > 0) {
          const currentWeek =
            weeks.find((week) => week.id === activeWeekIdRef.current) ?? weeks[0];
          await loadWeekContent(currentWeek.id);
        }
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Impossible de préparer le cycle",
        );
      } finally {
        setWeeksLoading(false);
      }
    },
    [loadWeekContent, programId],
  );

  useEffect(() => {
    if (!isProgram || !programId) return;
    void synchronizeProgramWeeks(meta.session_mode);
  }, [isProgram, meta.session_mode, programId, synchronizeProgramWeeks]);

  const persistActiveWeek = useCallback(async () => {
    const weekId = activeWeekIdRef.current;
    if (!programId || !weekId) {
      throw new Error("La semaine active n’est pas encore prête");
    }

    const response = await fetch(
      `/api/programs/${programId}/weeks/${weekId}/content`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessions: buildStoredSessionsPayload(sessions, meta.goal),
        }),
      },
    );
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error ?? "Impossible d’enregistrer cette semaine");
    }

    setSessions(mapStoredSessions(data.sessions ?? [], meta.goal));
  }, [meta.goal, programId, sessions]);

  const handleWeekSelect = useCallback(
    async (weekId: string) => {
      if (weekId === activeWeekIdRef.current) return;
      setError("");
      setWeekAction("switch");
      try {
        await persistActiveWeek();
        await loadWeekContent(weekId);
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Impossible de changer de semaine",
        );
      } finally {
        setWeekAction(null);
      }
    },
    [loadWeekContent, persistActiveWeek],
  );

  const handleCreateWeek = useCallback(
    async (action: "add_empty" | "duplicate") => {
      if (!programId || !activeWeekIdRef.current) return;
      const visualAction = action === "add_empty" ? "add" : "duplicate";
      setError("");
      setWeekAction(visualAction);
      try {
        await persistActiveWeek();
        const response = await fetch(`/api/programs/${programId}/weeks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            source_week_id:
              action === "duplicate" ? activeWeekIdRef.current : undefined,
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error ?? "Impossible d’ajouter une semaine");
        }
        setProgramWeeks(data.weeks ?? []);
        if (data.week?.id) await loadWeekContent(data.week.id);
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Impossible d’ajouter une semaine",
        );
      } finally {
        setWeekAction(null);
      }
    },
    [loadWeekContent, persistActiveWeek, programId],
  );

  const handleDeleteWeek = useCallback(async () => {
    const weekId = activeWeekIdRef.current;
    if (!programId || !weekId || programWeeks.length <= 1) return;

    const activeWeek = programWeeks.find((week) => week.id === weekId);
    const sessionCount = sessions.length;
    const confirmed = window.confirm(
      `Supprimer ${activeWeek?.label ?? "cette semaine"} ?\n\n` +
        `${sessionCount} séance${sessionCount > 1 ? "s" : ""} et tous les exercices associés seront supprimés. Cette action est définitive.`,
    );
    if (!confirmed) return;

    setError("");
    setWeekAction("delete");
    try {
      const response = await fetch(`/api/programs/${programId}/weeks`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week_id: weekId }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Impossible de supprimer cette semaine");
      }

      const remainingWeeks = (data.weeks ?? []) as ProgramWeekRecord[];
      setProgramWeeks(remainingWeeks);
      setMeta((current) => ({ ...current, session_mode: "cycle" }));
      activeWeekIdRef.current = null;
      setActiveWeekId(null);
      if (data.active_week_id) await loadWeekContent(data.active_week_id);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Impossible de supprimer cette semaine",
      );
    } finally {
      setWeekAction(null);
    }
  }, [loadWeekContent, programId, programWeeks, sessions.length]);

  const handleCompletionBehaviorChange = useCallback(
    async (behavior: CompletionBehavior) => {
      if (!programId) return;
      const previous = completionBehavior;
      setCompletionBehavior(behavior);
      setWeekAction("completion");
      try {
        const response = await fetch(`/api/programs/${programId}/weeks`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ completion_behavior: behavior }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error ?? "Impossible de modifier la fin du cycle");
        }
      } catch (cause) {
        setCompletionBehavior(previous);
        setError(
          cause instanceof Error
            ? cause.message
            : "Impossible de modifier la fin du cycle",
        );
      } finally {
        setWeekAction(null);
      }
    },
    [completionBehavior, programId],
  );

  const handleOpenMesocycleGenerator = useCallback(async () => {
    if (!programId || !activeWeekIdRef.current) return;
    setError("");
    setWeekAction("mesocycle");
    try {
      await persistActiveWeek();
      setShowMesocycleGenerator(true);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Impossible de préparer le générateur de mésocycle",
      );
    } finally {
      setWeekAction(null);
    }
  }, [persistActiveWeek, programId]);

  const handleMesocycleApplied = useCallback(
    async (result: {
      weeks: ProgramWeekRecord[];
      completion_behavior: CompletionBehavior;
    }) => {
      const generatedWeeks = result.weeks ?? [];
      setProgramWeeks(generatedWeeks);
      setCompletionBehavior(result.completion_behavior);
      setMeta((current) => ({
        ...current,
        weeks: generatedWeeks.length,
        session_mode: "cycle",
      }));
      activeWeekIdRef.current = null;
      setActiveWeekId(null);
      setShowMesocycleGenerator(false);
      if (generatedWeeks[0]?.id) await loadWeekContent(generatedWeeks[0].id);
    },
    [loadWeekContent],
  );

  const [selectedExercises, setSelectedExercises] = useState<
    { si: number; ei: number }[]
  >([]);
  const [showSavePattern, setShowSavePattern] = useState(false);
  const [pickerPatternTarget, setPickerPatternTarget] = useState<number | null>(
    null,
  );

  const addPattern = useCallback((si: number, patternExercises: any[]) => {
    setSessions((prev) =>
      prev.map((s, idx) => {
        if (idx !== si) return s;
        const blueprint = emptyExercise(meta.goal);
        const newExercises = patternExercises.map((exRaw) => {
          // deep clone to avoid shared references and normalize fields
          const ex = JSON.parse(JSON.stringify(exRaw ?? {}));
          const name = (ex.name ?? "").toString().trim();
          const catalog = name ? getCatalogEntryByName(name) : null;
          return {
            ...blueprint,
            ...ex,
            dbId: undefined,
            name:
              name || (ex.dbId ? `Exercice (${ex.dbId})` : "Exercice inconnu"),
            image_url: ex.image_url ?? catalog?.gifUrl ?? blueprint.image_url,
            rest_sec: ex.rest_sec ?? blueprint.rest_sec,
            reps: ex.reps ?? blueprint.reps,
            tempo: ex.tempo ?? getDefaultTempo(ex.movement_pattern ?? catalog?.movementPattern ?? null, meta.goal),
          };
        });
        return {
          ...s,
          exercises: [...s.exercises, ...newExercises],
        };
      }),
    );
  }, [meta.goal]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  useEffect(() => {
    if (!clientId) return;
    Promise.all([
      fetch(`/api/clients/${clientId}/intelligence-profile`).then((r) =>
        r.ok ? r.json() : null,
      ),
      fetch(`/api/clients/${clientId}/morpho/latest`).then((r) =>
        r.ok ? r.json() : null,
      ),
    ])
      .then(([profile, morpho]) => {
        if (profile) setIntelligenceProfile(profile);
        if (morpho?.data?.stimulus_adjustments) {
          setMorphoAdjustments(morpho.data.stimulus_adjustments);
        }
        if (morpho?.data?.analysis_date) {
          setMorphoDate(
            new Date(morpho.data.analysis_date).toLocaleDateString("fr-FR", {
              day: "2-digit",
              month: "2-digit",
              year: "2-digit",
            }),
          );
        }
      })
      .catch(() => {});
  }, [clientId]);
  const [pickerTarget, setPickerTarget] = useState<{
    si: number;
    ei: number;
  } | null>(null);
  const [alternativesTarget, setAlternativesTarget] = useState<{
    si: number;
    ei: number;
  } | null>(null);
  // Picker used to add a client alternative — callback receives the picked name
  const [altPickerCallback, setAltPickerCallback] = useState<
    ((name: string) => Promise<void>) | null
  >(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const intelligenceMeta = useMemo(
    () => ({
      goal: meta.goal,
      level: meta.level,
      weeks: meta.weeks,
      frequency: meta.frequency,
      equipment_archetype: meta.equipment_archetype,
      sessionMode: meta.session_mode,
      volumeFocus: meta.volume_focus,
    }),
    [
      meta.goal,
      meta.level,
      meta.weeks,
      meta.frequency,
      meta.equipment_archetype,
      meta.session_mode,
      meta.volume_focus,
    ],
  );

  const intelligenceSessions = useMemo(
    () =>
      orderedSessions.map((s) => ({
        name: s.name,
        day_of_week: s.days_of_week[0] ?? s.day_of_week,
        days_of_week: s.days_of_week,
        exercises: s.exercises.map((e) => ({
          name: e.name,
          sets: e.sets,
          reps: e.reps,
          rest_sec: e.rest_sec,
          rir: e.rir,
          notes: e.notes,
          movement_pattern: e.movement_pattern,
          equipment_required: e.equipment_required,
          primary_muscles: e.primary_muscles,
          secondary_muscles: e.secondary_muscles,
          is_compound: e.is_compound,
          is_unilateral: e.is_unilateral ?? false,
          plane: e.plane ?? null,
          mechanic: e.mechanic ?? null,
          set_prescriptions: e.set_prescriptions ?? [],
          superset_rest_mode: e.superset_rest_mode ?? 'after_round',
          unilateral: e.unilateral ?? false,
          execution_type: e.execution_type ?? 'reps_rir',
          primaryMuscle: e.primaryMuscle ?? null,
          primaryActivation: e.primaryActivation ?? null,
          secondaryMusclesDetail: e.secondaryMusclesDetail ?? [],
          secondaryActivations: e.secondaryActivations ?? [],
          stabilizers: e.stabilizers ?? [],
          jointStressSpine: e.jointStressSpine ?? null,
          jointStressKnee: e.jointStressKnee ?? null,
          jointStressShoulder: e.jointStressShoulder ?? null,
          globalInstability: e.globalInstability ?? null,
          coordinationDemand: e.coordinationDemand ?? null,
          constraintProfile: e.constraintProfile ?? null,
        })),
      })),
    [orderedSessions],
  );
  const { result: intelligenceResult, alertsFor } = useProgramIntelligence(
    intelligenceSessions,
    intelligenceMeta,
    intelligenceProfile,
    morphoAdjustments ?? undefined,
    labOverrides,
  );

  function handleAlertClick(sessionIndex: number, exerciseIndex: number) {
    const key = `${sessionIndex}-${exerciseIndex}`;
    const el = exerciseRefs.current[key];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightKey(key);
      setTimeout(() => setHighlightKey(null), 2000);
    }
  }

  function handlePerformanceExerciseSelect(exerciseName: string) {
    const normalized = exerciseName.trim().toLowerCase();
    if (!normalized) return;

    for (
      let orderedSi = 0;
      orderedSi < orderedSessions.length;
      orderedSi += 1
    ) {
      const exerciseIndex = orderedSessions[orderedSi].exercises.findIndex(
        (exercise) => exercise.name.trim().toLowerCase() === normalized,
      );

      if (exerciseIndex >= 0) {
        handleAlertClick(rawSessionIndex(orderedSi), exerciseIndex);
        return;
      }
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    if (
      activeId.startsWith("nav-session-") &&
      overId.startsWith("nav-session-")
    ) {
      const fromSi = Number(activeId.replace("nav-session-", ""));
      const toSi = Number(overId.replace("nav-session-", ""));
      if (meta.session_mode === "cycle") {
        moveSession(fromSi, toSi);
      }
      return;
    }

    if (activeId.startsWith("ex-") && overId.startsWith("ex-")) {
      const from = parseExId(activeId);
      const to = parseExId(overId);
      moveExercise(
        rawSessionIndex(from.si),
        from.ei,
        rawSessionIndex(to.si),
        to.ei,
      );
      return;
    }

    if (activeId.startsWith("ex-") && overId.startsWith("session-")) {
      const from = parseExId(activeId);
      const toSi = Number(overId.replace("session-", ""));
      const toEi = orderedSessions[toSi].exercises.length;
      moveExercise(
        rawSessionIndex(from.si),
        from.ei,
        rawSessionIndex(toSi),
        toEi,
      );
    }
  }

  async function handleImageUpload(si: number, ei: number, file: File) {
    const key = `${si}-${ei}`;
    setUploadingKey(key);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/program-templates/exercises/upload-image", {
        method: "POST",
        body: fd,
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error ?? "Erreur upload");
        return;
      }
      updateExercise(si, ei, { image_url: d.url });
    } catch {
      setError("Erreur réseau lors de l'upload");
    } finally {
      setUploadingKey(null);
    }
  }

  function toggleMuscleTag(tag: string) {
    setMeta((m) => ({
      ...m,
      muscle_tags: m.muscle_tags.includes(tag)
        ? m.muscle_tags.filter((t) => t !== tag)
        : [...m.muscle_tags, tag],
    }));
  }

  useEffect(() => {
    setMeta((m) => ({ ...m, frequency: sessions.length }));
  }, [sessions.length]);

  function updateSession(i: number, patch: Partial<Session>) {
    setSessions((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
    );
  }

  function removeSession(si: number) {
    setSessions((prev) => prev.filter((_, i) => i !== si));
  }

  function exerciseRefSetter(key: string) {
    return (el: HTMLDivElement | null) => {
      exerciseRefs.current[key] = el;
    };
  }

  function addExercise(si: number) {
    setSessions((prev) =>
      prev.map((s, idx) =>
        idx === si ? { ...s, exercises: [...s.exercises, emptyExercise(meta.goal)] } : s,
      ),
    );
  }

  function removeExercise(si: number, ei: number) {
    setSessions((prev) =>
      prev.map((s, idx) =>
        idx === si
          ? { ...s, exercises: s.exercises.filter((_, i) => i !== ei) }
          : s,
      ),
    );
  }

  function updateExercise(si: number, ei: number, patch: Partial<Exercise>) {
    setSessions((prev) =>
      prev.map((s, idx) =>
        idx === si
          ? {
              ...s,
              exercises: s.exercises.map((e, i) =>
                i === ei ? { ...e, ...patch } : e,
              ),
            }
          : s,
      ),
    );
  }

  function handleMetaChange(patch: Partial<TemplateMeta>) {
    const nextGoal = patch.goal
    if (!nextGoal || nextGoal === meta.goal) {
      setMeta((current) => ({ ...current, ...patch }))
      return
    }

    const previousGoal = meta.goal
    const previousReps = getDefaultReps(previousGoal)
    const nextReps = getDefaultReps(nextGoal)
    const previousRest = getDefaultRestSec(previousGoal)
    const nextRest = getDefaultRestSec(nextGoal)

    setMeta((current) => ({ ...current, ...patch }))
    setSessions((currentSessions) =>
      currentSessions.map((session) => ({
        ...session,
        exercises: session.exercises.map((exercise) => {
          const previousTempo = getDefaultTempo(exercise.movement_pattern, previousGoal)
          const nextTempo = getDefaultTempo(exercise.movement_pattern, nextGoal)
          const shouldUpdateReps = !exercise.reps || exercise.reps === previousReps
          const shouldUpdateTempo = !exercise.tempo || exercise.tempo === previousTempo
          const shouldUpdateRest = exercise.rest_sec == null || exercise.rest_sec === previousRest
          const prescriptions = exercise.set_prescriptions ?? []

          return {
            ...exercise,
            reps: shouldUpdateReps ? nextReps : exercise.reps,
            tempo: shouldUpdateTempo ? nextTempo : exercise.tempo,
            rest_sec: shouldUpdateRest ? nextRest : exercise.rest_sec,
            set_prescriptions: applyDefaultFieldToSetPrescriptions(
              applyDefaultFieldToSetPrescriptions(
                applyDefaultFieldToSetPrescriptions(
                  prescriptions,
                  'rest_sec',
                  exercise.rest_sec,
                  shouldUpdateRest ? nextRest : exercise.rest_sec,
                ),
                'reps', exercise.reps, shouldUpdateReps ? nextReps : exercise.reps,
              ),
              'tempo',
              exercise.tempo,
              shouldUpdateTempo ? nextTempo : exercise.tempo,
            ),
          }
        }),
      })),
    )
  }

  const handleSave = useCallback(async () => {
    setError("");
    if (!meta.name.trim()) {
      setError("Le nom du template est requis.");
      return;
    }
    if (sessions.some((s) => !s.name.trim())) {
      setError("Chaque séance doit avoir un nom.");
      return;
    }
    if (sessions.some((s) => s.exercises.some((e) => !e.name.trim()))) {
      setError("Chaque exercice doit avoir un nom.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...meta,
        sessions: buildStoredSessionsPayload(sessions, meta.goal),
      };

      if (isProgram && programWeeks.length > 0) {
        await persistActiveWeek();
        const response = await fetch(`/api/programs/${programId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(meta),
        });
        const data = await response.json();
        if (!response.ok) {
          setError(data.error ?? "Erreur");
          return;
        }
        onSaved?.(data.program);
        return;
      }

      if (isProgram && meta.session_mode === "cycle") {
        setError("Le cycle est encore en cours d’initialisation.");
        return;
      }

      let url: string;
      let method: string;
      if (isProgram) {
        url = `/api/programs/${programId}`;
        method = "PATCH";
      } else if (isEdit) {
        url = `/api/program-templates/${templateId}`;
        method = "PATCH";
      } else {
        url = "/api/program-templates";
        method = "POST";
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error ?? "Erreur");
        return;
      }

      if (isProgram && onSaved) {
        onSaved(d.program);
      } else if (!isProgram) {
        router.push("/coach/programs/templates");
      }
    } catch {
      setError("Erreur réseau");
    } finally {
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    meta,
    sessions,
    isProgram,
    programId,
    templateId,
    isEdit,
    onSaved,
    persistActiveWeek,
    programWeeks.length,
    router,
  ]);

  const morphoConnected =
    !!morphoAdjustments && Object.keys(morphoAdjustments).length > 0;
  const workoutStudioDocs = useMemo(
    () => getDocsForAudienceAndContext("coach", "workout-studio"),
    [],
  );

  const topBarActionsNode = useMemo(
    () => (
      <div className="flex items-center gap-2">
        <ContextDocsMenu docs={workoutStudioDocs} compact />
        {isProgram && (
          <HeaderIconButton
            onClick={() => setShowSaveAsTemplate(true)}
            icon={<BookmarkPlus size={12} />}
            label="Enregistrer comme template"
          />
        )}
        <HeaderIconButton
          onClick={handleSave}
          disabled={saving || weeksLoading || weekAction !== null}
          icon={
            saving ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Save size={12} />
            )
          }
          label={saving ? "Enregistrement en cours" : "Enregistrer"}
          variant="accent"
        />
      </div>
    ),
    [
      isProgram,
      saving,
      weeksLoading,
      weekAction,
      handleSave,
      workoutStudioDocs,
    ],
  );

  // When topBarLeft is provided, Builder owns the TopBar directly.
  // When onTopBarActions is provided, push actions up to the parent instead.
  useSetTopBar(topBarLeft ?? null, topBarLeft ? topBarActionsNode : undefined);

  useEffect(() => {
    if (!onTopBarActions || topBarLeft) return;
    onTopBarActions(topBarActionsNode);
  }, [onTopBarActions, topBarActionsNode, topBarLeft]);

  // Compute stable color mapping: group_id → color
  const supersetGroupColors = useMemo(() => {
    const map: Record<string, string> = {};
    let colorIdx = 0;
    sessions.forEach((s) => {
      s.exercises.forEach((e) => {
        if (e.group_id && !map[e.group_id]) {
          map[e.group_id] = SUPERSET_COLORS[colorIdx % SUPERSET_COLORS.length];
          colorIdx++;
        }
      });
    });
    return map;
  }, [sessions]);

  function toggleSuperset(si: number, ei: number) {
    setSessions((prev) => {
      const session = prev[si];
      const ex = session.exercises[ei];

      if (ex.group_id) {
        const groupId = ex.group_id;
        const groupMembers = session.exercises.filter(
          (e) => e.group_id === groupId,
        );
        const nextEx = session.exercises[ei + 1];
        const nextInSameGroup = nextEx?.group_id === groupId;

        if (!nextInSameGroup && nextEx) {
          // Exercice suivant pas dans le groupe → étendre le groupe vers le suivant
          return prev.map((s, i) => {
            if (i !== si) return s;
            return {
              ...s,
              exercises: s.exercises.map((e, idx) => {
                if (idx === ei + 1) return { ...e, group_id: groupId };
                return e;
              }),
            };
          });
        } else {
          // Suivant déjà dans le groupe (ou pas de suivant) → retirer ex du groupe
          return prev.map((s, i) => {
            if (i !== si) return s;
            const updated = s.exercises.map((e) => {
              if (e.group_id !== groupId) return e;
              if (groupMembers.length <= 2 || e === ex)
                return { ...e, group_id: undefined };
              return e;
            });
            return { ...s, exercises: updated };
          });
        }
      } else {
        // Pas dans un groupe → créer groupe avec suivant (ou rejoindre groupe du suivant)
        const nextEx = session.exercises[ei + 1];
        if (!nextEx) return prev;
        const targetGroupId = nextEx.group_id ?? `sg-${Date.now()}`;
        return prev.map((s, i) => {
          if (i !== si) return s;
          return {
            ...s,
            exercises: s.exercises.map((e, idx) => {
              if (idx === ei) return { ...e, group_id: targetGroupId };
              if (idx === ei + 1) return { ...e, group_id: targetGroupId };
              return e;
            }),
          };
        });
      }
    });
  }

  const navSessions = useMemo(
    () =>
      orderedSessions.map((s) => ({
        name: s.name,
        exercises: s.exercises.map((e) => ({ name: e.name })),
      })),
    [orderedSessions],
  );

  // ─── Resizable split layout ────────────────────────────────────────────────
  const [showSaveAsTemplate, setShowSaveAsTemplate] = useState(false);
  const [navWidth, setNavWidth] = useState(16); // % of total width
  const [intelWidth, setIntelWidth] = useState(30); // % of total width
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<"left" | "right" | null>(null);
  const startXRef = useRef(0);
  const startNavRef = useRef(16);
  const startIntelRef = useRef(30);

  const onMouseDownLeft = useCallback(
    (e: React.MouseEvent) => {
      draggingRef.current = "left";
      startXRef.current = e.clientX;
      startNavRef.current = navWidth;
      e.preventDefault();
    },
    [navWidth],
  );

  const onMouseDownRight = useCallback(
    (e: React.MouseEvent) => {
      draggingRef.current = "right";
      startXRef.current = e.clientX;
      startIntelRef.current = intelWidth;
      e.preventDefault();
    },
    [intelWidth],
  );

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!draggingRef.current || !containerRef.current) return;
      const totalW = containerRef.current.offsetWidth;
      const dx = e.clientX - startXRef.current;
      const dPct = (dx / totalW) * 100;
      if (draggingRef.current === "left") {
        const next = Math.min(Math.max(startNavRef.current + dPct, 12), 28);
        setNavWidth(next);
      } else {
        const next = Math.min(Math.max(startIntelRef.current - dPct, 22), 42);
        setIntelWidth(next);
      }
    }
    function onMouseUp() {
      draggingRef.current = null;
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="h-full flex flex-col bg-[#121212] overflow-hidden">
        {isProgram &&
          (meta.session_mode === "cycle" || programWeeks.length > 0) && (
            <WeekNavigator
              weeks={programWeeks}
              activeWeekId={activeWeekId}
              completionBehavior={completionBehavior}
              loading={weeksLoading}
              action={weekAction}
              onSelectWeek={handleWeekSelect}
              onAddEmptyWeek={() => void handleCreateWeek("add_empty")}
              onDuplicateWeek={() => void handleCreateWeek("duplicate")}
              onDeleteWeek={() => void handleDeleteWeek()}
              onGenerateMesocycle={() => void handleOpenMesocycleGenerator()}
              onCompletionBehaviorChange={(behavior) =>
                void handleCompletionBehaviorChange(behavior)
              }
            />
          )}

        {showMesocycleGenerator && programId && (
          <MesocycleGeneratorModal
            programId={programId}
            weeks={programWeeks}
            activeWeekId={activeWeekId}
            completionBehavior={completionBehavior}
            onClose={() => setShowMesocycleGenerator(false)}
            onApplied={(result) => void handleMesocycleApplied(result)}
          />
        )}

        {/* Dual-pane layout */}
        <div
          ref={containerRef}
          className="flex flex-1 overflow-hidden"
          style={{ minHeight: 0 }}
        >
          {/* Navigator */}
          <div
            style={{
              flexGrow: navWidth,
              flexShrink: 1,
              flexBasis: 0,
              minWidth: 160,
              overflow: "hidden",
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <NavigatorPane
              sessions={navSessions}
              activeSessionIndex={null}
              activeExerciseKey={highlightKey}
              sessionMode={meta.session_mode}
              onSelectSession={(si) => {
                const el = exerciseRefs.current[`${rawSessionIndex(si)}-0`];
                el?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              onSelectExercise={(si, ei) =>
                handleAlertClick(rawSessionIndex(si), ei)
              }
              onAddSession={() =>
                setSessions((prev) => [...prev, emptySession(meta.goal)])
              }
              onMoveSession={(fromSi, toSi) => moveSession(fromSi, toSi)}
            />
          </div>

          {/* Resize handle left */}
          <div
            onMouseDown={onMouseDownLeft}
            className="w-1 flex-none bg-white/[0.06] hover:bg-[#1f8a65]/50 cursor-col-resize transition-colors active:bg-[#1f8a65]"
          />

          {/* Editor — takes remaining space */}
          <div
            style={{
              flexGrow: 100 - navWidth - intelWidth,
              flexShrink: 1,
              flexBasis: 0,
              minWidth: 0,
              overflow: "hidden",
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <EditorPane
              meta={meta}
              sessions={orderedSessions}
              clientId={clientId}
              error={error}
              uploadingKey={uploadingKey}
              highlightKey={highlightKey}
              intelligenceResult={intelligenceResult}
              morphoConnected={morphoConnected}
              templateId={templateId}
              alertsFor={alertsFor}
              sessionMode={meta.session_mode}
              onMetaChange={handleMetaChange}
              onSessionModeChange={(mode) =>
                setMeta((m) => ({ ...m, session_mode: mode }))
              }
              onUpdateSession={(si, patch) =>
                updateSession(rawSessionIndex(si), patch)
              }
              onUpdateExercise={(si, ei, patch) =>
                updateExercise(rawSessionIndex(si), ei, patch)
              }
              onRemoveExercise={(si, ei) =>
                removeExercise(rawSessionIndex(si), ei)
              }
              onAddExercise={(si) => addExercise(rawSessionIndex(si))}
              onRemoveSession={(si) => removeSession(rawSessionIndex(si))}
              onAddSession={() =>
                setSessions((prev) => [...prev, emptySession(meta.goal)])
              }
              onImageUpload={(si, ei, file) =>
                handleImageUpload(rawSessionIndex(si), ei, file)
              }
              onPickExercise={(si, ei) =>
                setPickerTarget({ si: rawSessionIndex(si), ei })
              }
              onPickExerciseForAlternative={(si, ei, addFn) => {
                setAltPickerCallback(() => addFn);
                setPickerTarget({ si: rawSessionIndex(si), ei });
              }}
              onOpenAlternatives={(si, ei) =>
                setAlternativesTarget({ si: rawSessionIndex(si), ei })
              }
              onToggleSuperset={(si, ei) =>
                toggleSuperset(rawSessionIndex(si), ei)
              }
              onMoveSession={(fromSi, toSi) =>
                moveSession(rawSessionIndex(fromSi), rawSessionIndex(toSi))
              }
              onMoveExercise={(fromSi, fromEi, toSi, toEi) =>
                moveExercise(
                  rawSessionIndex(fromSi),
                  fromEi,
                  rawSessionIndex(toSi),
                  toEi,
                )
              }
              makeExDragId={makeExId}
              sessionDropId={(si) => `session-${si}`}
              supersetGroupColors={supersetGroupColors}
              programId={programId}
              exerciseRefSetter={exerciseRefSetter}
              selectedExercises={selectedExercises}
              onToggleSelectExercise={(si, ei) => {
                setSelectedExercises((prev) => {
                  const exists = prev.some((s) => s.si === si && s.ei === ei);
                  if (exists) {
                    return prev.filter((s) => !(s.si === si && s.ei === ei));
                  } else {
                    return [...prev, { si, ei }];
                  }
                });
              }}
              onAddPatternClick={(si) =>
                setPickerPatternTarget(rawSessionIndex(si))
              }
            />
          </div>

          {/* Resize handle right */}
          <div
            onMouseDown={onMouseDownRight}
            className="w-1 flex-none bg-white/[0.06] hover:bg-[#1f8a65]/50 cursor-col-resize transition-colors active:bg-[#1f8a65]"
          />

          {/* Intelligence Panel */}
          <div
            style={{
              flexGrow: intelWidth,
              flexShrink: 1,
              flexBasis: 0,
              minWidth: 260,
              overflow: "hidden",
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <IntelligencePanelShell
              result={intelligenceResult}
              meta={meta}
              onAlertClick={handleAlertClick}
              morphoConnected={morphoConnected}
              morphoDate={morphoDate}
              sraHeatmap={intelligenceResult?.sraHeatmap}
              labOverrides={labOverrides}
              presentPatterns={Array.from(
                new Set(
                  sessions.flatMap(
                    (s) =>
                      s.exercises
                        .map((e) => e.movement_pattern)
                        .filter(Boolean) as string[],
                  ),
                ),
              )}
              onOverrideChange={onOverrideChange}
              onOverrideReset={onOverrideReset}
              onVolumeFocusChange={(group, focus) =>
                setMeta((current) => ({
                  ...current,
                  volume_focus: { ...current.volume_focus, [group]: focus },
                }))
              }
              clientId={clientId}
              anchorExerciseNames={Array.from(
                new Set(
                  sessions.flatMap((s) =>
                    s.exercises.map((e) => e.name).filter(Boolean),
                  ),
                ),
              )}
              activeTab={activeInsightsTab}
              onTabChange={setActiveInsightsTab}
              onExerciseSelect={handlePerformanceExerciseSelect}
            />
          </div>
        </div>

        {/* Overlays */}
        {pickerTarget && (
          <ExercisePicker
            onSelect={(exercise) => {
              if (altPickerCallback) {
                // Mode: adding a client alternative
                altPickerCallback(exercise.name);
                setAltPickerCallback(null);
              } else {
                // Mode: replacing/setting main exercise
                updateExercise(pickerTarget.si, pickerTarget.ei, {
                  name: exercise.name,
                  image_url: exercise.gifUrl,
                  movement_pattern: exercise.movementPattern,
                  equipment_required: exercise.equipment,
                  is_compound: exercise.isCompound,
                  primary_muscles: exercise.primaryMuscles,
                  secondary_muscles: exercise.secondaryMuscles,
                  plane: exercise.plane ?? null,
                  mechanic: exercise.mechanic ?? null,
                  unilateral: exercise.unilateral ?? false,
                  primaryMuscle: exercise.primaryMuscle ?? null,
                  primaryActivation: exercise.primaryActivation ?? null,
                  secondaryMusclesDetail: exercise.secondaryMusclesDetail ?? [],
                  secondaryActivations: exercise.secondaryActivations ?? [],
                  stabilizers: exercise.stabilizers ?? [],
                  jointStressSpine: exercise.jointStressSpine ?? null,
                  jointStressKnee: exercise.jointStressKnee ?? null,
                  jointStressShoulder: exercise.jointStressShoulder ?? null,
                  globalInstability: exercise.globalInstability ?? null,
                  coordinationDemand: exercise.coordinationDemand ?? null,
                  constraintProfile: exercise.constraintProfile ?? null,
                  tempo: getDefaultTempo(exercise.movementPattern ?? null, meta.goal),
                });
              }
              setPickerTarget(null);
            }}
            onClose={() => {
              setPickerTarget(null);
              setAltPickerCallback(null);
            }}
          />
        )}

        {alternativesTarget && (
          <ExerciseAlternativesDrawer
            exercise={
              intelligenceSessions[alternativesTarget.si]?.exercises[
                alternativesTarget.ei
              ]
            }
            sessionExercises={
              intelligenceSessions[alternativesTarget.si]?.exercises ?? []
            }
            meta={intelligenceMeta}
            onReplace={(patch) => {
              updateExercise(alternativesTarget.si, alternativesTarget.ei, {
                ...patch,
              });
              setAlternativesTarget(null);
            }}
            onClose={() => setAlternativesTarget(null)}
          />
        )}

        {showSaveAsTemplate && programId && (
          <SaveAsTemplateModal
            programId={programId}
            programName={meta.name}
            onClose={() => setShowSaveAsTemplate(false)}
          />
        )}

        {showSavePattern && (
          <SavePatternModal
            exercises={selectedExercises.map(
              (s) => sessions[rawSessionIndex(s.si)].exercises[s.ei],
            )}
            onSaved={() => {
              setShowSavePattern(false);
              setSelectedExercises([]);
            }}
            onClose={() => setShowSavePattern(false)}
          />
        )}

        {pickerPatternTarget !== null && (
          <PatternPicker
            onSelect={(pattern) => {
              addPattern(pickerPatternTarget, pattern.exercises);
              setPickerPatternTarget(null);
            }}
            onClose={() => setPickerPatternTarget(null)}
          />
        )}

        {/* Floating Action Bar for Exercises Selection */}
        {selectedExercises.length > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#181818] border border-white/10 shadow-2xl rounded-full px-4 py-2 flex items-center gap-4 z-[110]">
            <span className="text-xs font-semibold text-white">
              {selectedExercises.length} exercice(s) sélectionné(s)
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSelectedExercises([])}
                className="px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-white/50 hover:text-white transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => setShowSavePattern(true)}
                className="px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#1f8a65] text-white hover:opacity-90 transition-opacity"
              >
                Sauvegarder comme pattern
              </button>
            </div>
          </div>
        )}
      </div>
    </DndContext>
  );
}
