"use client";

import { useState, useRef, useEffect, useCallback, useMemo, type ReactNode } from "react";
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
} from '@dnd-kit/core'
import { useRouter } from "next/navigation";
import Image from "next/image";
import ExercisePicker from "./ExercisePicker";
import { useProgramIntelligence, useLabOverrides, type IntelligenceProfile } from "@/lib/programs/intelligence";
import { getCatalogEntryByName, getMusclesFromCatalog } from "@/lib/programs/intelligence/catalog-utils";
import ProgramIntelligencePanel from "./ProgramIntelligencePanel";
import IntelligenceAlertBadge from "./IntelligenceAlertBadge";
import ExerciseAlternativesDrawer from "./ExerciseAlternativesDrawer";
import ExerciseClientAlternatives from "./ExerciseClientAlternatives";
import NavigatorPane from "./studio/NavigatorPane";
import EditorPane from "./studio/EditorPane";
import IntelligencePanelShell from "./studio/IntelligencePanelShell";
import SaveAsTemplateModal from "./SaveAsTemplateModal";
import type { SetPrescription } from "@/lib/programs/setPrescriptions";

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

const SUPERSET_COLORS = ['#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6', '#06b6d4', '#f97316']

const MUSCLE_GROUPS: { slug: string; label: string }[] = [
  { slug: 'chest',      label: 'Pectoraux' },
  { slug: 'shoulders',  label: 'Épaules' },
  { slug: 'biceps',     label: 'Biceps' },
  { slug: 'triceps',    label: 'Triceps' },
  { slug: 'abs',        label: 'Abdos' },
  { slug: 'back_upper', label: 'Dos (haut)' },
  { slug: 'back_lower', label: 'Lombaires' },
  { slug: 'traps',      label: 'Trapèzes' },
  { slug: 'quads',      label: 'Quadriceps' },
  { slug: 'hamstrings', label: 'Ischios' },
  { slug: 'glutes',     label: 'Fessiers' },
  { slug: 'calves',     label: 'Mollets' },
]

function makeExId(si: number, ei: number) { return `ex-${si}-${ei}` }
function parseExId(id: string): { si: number; ei: number } {
  const parts = id.split('-')
  return { si: Number(parts[1]), ei: Number(parts[2]) }
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
  group_id?: string;
  dbId?: string;
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
  session_mode: 'day' | 'cycle';
}

function emptyExercise(): Exercise {
  return {
    name: "",
    sets: 3,
    reps: "8-12",
    rest_sec: 90,
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
    tempo: null,
    set_prescriptions: [],
    group_id: undefined,
    dbId: undefined,
    plane: null, mechanic: null, unilateral: false,
    primaryMuscle: null, primaryActivation: null,
    secondaryMusclesDetail: [], secondaryActivations: [],
    stabilizers: [], jointStressSpine: null, jointStressKnee: null,
    jointStressShoulder: null, globalInstability: null,
    coordinationDemand: null, constraintProfile: null,
  };
}
function emptySession(): Session {
  return {
    name: "",
    day_of_week: null,
    days_of_week: [],
    notes: "",
    exercises: [emptyExercise()],
    open: true,
  };
}

function derivePrimaryMusclesFromStoredExercise(exercise: any): string[] {
  const catalog = getCatalogEntryByName(exercise.name)
  const precisePrimary = exercise.primary_muscle ?? catalog?.primaryMuscle ?? null
  if (precisePrimary) return [precisePrimary]
  if ((exercise.primary_muscles ?? []).length > 0) return exercise.primary_muscles
  return getMusclesFromCatalog(exercise.name)
}

interface Props {
  noFullscreen?: boolean; // page parent gère son propre layout h-screen
  initial?: any;
  templateId?: string;
  programId?: string;   // mode programme client (vs template)
  clientId?: string;
  onSaved?: (program: any) => void;
  onCancel?: () => void;
  onTopBarActions?: (node: ReactNode) => void;
  /** If provided, Builder manages the TopBar itself (left=this node, right=save actions) */
  topBarLeft?: ReactNode;
}

export default function ProgramTemplateBuilder({ initial, templateId, programId, clientId, onSaved, onCancel, onTopBarActions, topBarLeft, noFullscreen }: Props) {
  const router = useRouter();
  const isProgram = !!programId;
  const isEdit = !!templateId || isProgram;

  useSetFullscreenPage(!noFullscreen)

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
          session_mode: (initial.session_mode ?? 'day') as 'day' | 'cycle',
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
          session_mode: 'day',
        },
  );

  const [sessions, setSessions] = useState<Session[]>(() => {
    // Support both template (coach_program_template_sessions) and program (program_sessions) shapes
    const rawSessions = initial?.coach_program_template_sessions
      ?? initial?.program_sessions
      ?? null

    if (!rawSessions) return [emptySession()]
    return rawSessions
      .sort((a: any, b: any) => a.position - b.position)
      .map((s: any) => ({
        name: s.name,
        day_of_week: s.day_of_week,
        days_of_week: (s as any).days_of_week ?? (s.day_of_week ? [s.day_of_week] : []),
        notes: s.notes ?? "",
        open: false,
        exercises: (s.coach_program_template_exercises ?? s.program_exercises ?? [])
          .sort((a: any, b: any) => a.position - b.position)
          .map((e: any) => ({
            ...(() => {
              const catalog = getCatalogEntryByName(e.name)
              return {
                movement_pattern: e.movement_pattern ?? catalog?.movementPattern ?? null,
                equipment_required: e.equipment_required ?? catalog?.equipment ?? [],
                primary_muscles: derivePrimaryMusclesFromStoredExercise(e),
                secondary_muscles: e.secondary_muscles ?? catalog?.secondaryMuscles ?? [],
                is_compound: e.is_compound ?? catalog?.isCompound ?? undefined,
                image_url: e.image_url ?? catalog?.gifUrl ?? null,
                plane: e.plane ?? catalog?.plane ?? null,
                mechanic: e.mechanic ?? catalog?.mechanic ?? null,
                unilateral: e.unilateral ?? catalog?.unilateral ?? false,
                primaryMuscle: e.primary_muscle ?? catalog?.primaryMuscle ?? null,
                constraintProfile: e.constraint_profile ?? catalog?.constraintProfile ?? null,
              }
            })(),
            name: e.name,
            sets: e.sets,
            reps: e.reps,
            rest_sec: e.rest_sec,
            rir: e.rir,
            weight_increment_kg: e.weight_increment_kg ?? null,
            notes: e.notes ?? "",
            is_unilateral: e.is_unilateral ?? false,
            tempo: e.tempo ?? null,
            set_prescriptions: e.set_prescriptions ?? [],
            group_id: e.group_id ?? undefined,
            dbId: e.id ?? undefined,
            primaryActivation: e.primary_activation != null ? Number(e.primary_activation) : null,
            secondaryMusclesDetail: e.secondary_muscles_detail ?? [],
            secondaryActivations: (e.secondary_activations ?? []).map(Number),
            stabilizers: e.stabilizers ?? [],
            jointStressSpine: e.joint_stress_spine ?? null,
            jointStressKnee: e.joint_stress_knee ?? null,
            jointStressShoulder: e.joint_stress_shoulder ?? null,
            globalInstability: e.global_instability ?? null,
            coordinationDemand: e.coordination_demand ?? null,
          })),
      }))
  });

  const orderedSessions = useMemo(() =>
    meta.session_mode === 'day'
      ? [...sessions].sort((a, b) => (a.days_of_week[0] ?? a.day_of_week ?? 99) - (b.days_of_week[0] ?? b.day_of_week ?? 99))
      : sessions,
    [sessions, meta.session_mode]
  )

  function rawSessionIndex(orderedSi: number): number {
    const target = orderedSessions[orderedSi]
    if (!target) return 0  // defensive fallback — should never happen in practice
    return sessions.indexOf(target)
  }

  function moveSession(fromSi: number, toSi: number) {
    if (meta.session_mode !== 'cycle') return
    if (fromSi === toSi) return
    setSessions(prev => {
      const next = [...prev]
      const [moved] = next.splice(fromSi, 1)
      next.splice(toSi, 0, moved)
      return next
    })
    // Scroll to moved session's first exercise
    setTimeout(() => {
      const el = exerciseRefs.current[`${toSi}-0`]
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  function moveExercise(
    fromSi: number, fromEi: number,
    toSi: number, toEi: number,
  ) {
    if (fromSi === toSi && fromEi === toEi) return
    setSessions(prev => {
      const next = prev.map(s => ({ ...s, exercises: [...s.exercises] }))
      const [moved] = next[fromSi].exercises.splice(fromEi, 1)
      next[toSi].exercises.splice(toEi, 0, moved)
      return next
    })
    // Scroll to destination after state update
    setTimeout(() => {
      const key = `${toSi}-${toEi}`
      const el = exerciseRefs.current[key]
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        setHighlightKey(key)
        setTimeout(() => setHighlightKey(null), 1200)
      }
    }, 50)
  }

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [activeInsightsTab, setActiveInsightsTab] = useState<'smartfit' | 'performance'>('smartfit');
  const [intelligenceProfile, setIntelligenceProfile] = useState<IntelligenceProfile | undefined>(undefined);
  const [morphoAdjustments, setMorphoAdjustments] = useState<Record<string, number> | undefined>(undefined);
  const [morphoDate, setMorphoDate] = useState<string | undefined>(undefined);
  const [highlightKey, setHighlightKey] = useState<string | null>(null);
  const exerciseRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const { overrides: labOverrides, setOverride: onOverrideChange, resetOverrides: onOverrideReset } = useLabOverrides()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  useEffect(() => {
    if (!clientId) return
    Promise.all([
      fetch(`/api/clients/${clientId}/intelligence-profile`).then(r => r.ok ? r.json() : null),
      fetch(`/api/clients/${clientId}/morpho/latest`).then(r => r.ok ? r.json() : null),
    ]).then(([profile, morpho]) => {
      if (profile) setIntelligenceProfile(profile)
      if (morpho?.data?.stimulus_adjustments) {
        setMorphoAdjustments(morpho.data.stimulus_adjustments)
      }
      if (morpho?.data?.analysis_date) {
        setMorphoDate(new Date(morpho.data.analysis_date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' }))
      }
    }).catch(() => {})
  }, [clientId]);
  const [pickerTarget, setPickerTarget] = useState<{
    si: number;
    ei: number;
  } | null>(null);
  const [alternativesTarget, setAlternativesTarget] = useState<{ si: number; ei: number } | null>(null);
  // Picker used to add a client alternative — callback receives the picked name
  const [altPickerCallback, setAltPickerCallback] = useState<((name: string) => Promise<void>) | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const intelligenceMeta = useMemo(() => ({
    goal: meta.goal,
    level: meta.level,
    weeks: meta.weeks,
    frequency: meta.frequency,
    equipment_archetype: meta.equipment_archetype,
  }), [meta.goal, meta.level, meta.weeks, meta.frequency, meta.equipment_archetype]);

  const intelligenceSessions = useMemo(() => orderedSessions.map(s => ({
    name: s.name,
    day_of_week: s.days_of_week[0] ?? s.day_of_week,
    days_of_week: s.days_of_week,
    exercises: s.exercises.map(e => ({
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
      unilateral: e.unilateral ?? false,
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
  })), [orderedSessions]);
  const { result: intelligenceResult, alertsFor } = useProgramIntelligence(intelligenceSessions, intelligenceMeta, intelligenceProfile, morphoAdjustments ?? undefined, labOverrides);

  function handleAlertClick(sessionIndex: number, exerciseIndex: number) {
    const key = `${sessionIndex}-${exerciseIndex}`
    const el = exerciseRefs.current[key]
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setHighlightKey(key)
      setTimeout(() => setHighlightKey(null), 2000)
    }
  }

  function handlePerformanceExerciseSelect(exerciseName: string) {
    const normalized = exerciseName.trim().toLowerCase()
    if (!normalized) return

    for (let orderedSi = 0; orderedSi < orderedSessions.length; orderedSi += 1) {
      const exerciseIndex = orderedSessions[orderedSi].exercises.findIndex(
        (exercise) => exercise.name.trim().toLowerCase() === normalized,
      )

      if (exerciseIndex >= 0) {
        handleAlertClick(rawSessionIndex(orderedSi), exerciseIndex)
        return
      }
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeId = String(active.id)
    const overId = String(over.id)

    if (activeId.startsWith('nav-session-') && overId.startsWith('nav-session-')) {
      const fromSi = Number(activeId.replace('nav-session-', ''))
      const toSi = Number(overId.replace('nav-session-', ''))
      if (meta.session_mode === 'cycle') {
        moveSession(fromSi, toSi)
      }
      return
    }

    if (activeId.startsWith('ex-') && overId.startsWith('ex-')) {
      const from = parseExId(activeId)
      const to = parseExId(overId)
      moveExercise(rawSessionIndex(from.si), from.ei, rawSessionIndex(to.si), to.ei)
      return
    }

    if (activeId.startsWith('ex-') && overId.startsWith('session-')) {
      const from = parseExId(activeId)
      const toSi = Number(overId.replace('session-', ''))
      const toEi = orderedSessions[toSi].exercises.length
      moveExercise(rawSessionIndex(from.si), from.ei, rawSessionIndex(toSi), toEi)
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
        idx === si ? { ...s, exercises: [...s.exercises, emptyExercise()] } : s,
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
        sessions: sessions.map((s) => ({
          name: s.name,
          day_of_week: s.days_of_week[0] ?? s.day_of_week ?? null,
          days_of_week: s.days_of_week,
          notes: s.notes,
          exercises: s.exercises.map((e) => ({
            name: e.name,
            sets: e.sets,
            reps: e.reps,
            rest_sec: e.rest_sec,
            rir: e.rir,
            weight_increment_kg: e.weight_increment_kg ?? null,
            notes: e.notes,
            image_url: e.image_url,
            movement_pattern: e.movement_pattern,
            equipment_required: e.equipment_required,
            primary_muscles: e.primary_muscles,
            secondary_muscles: e.secondary_muscles,
            is_compound: e.is_compound,
            is_unilateral: e.is_unilateral ?? false,
            tempo: e.tempo ?? null,
            set_prescriptions: e.set_prescriptions ?? [],
            group_id: e.group_id,
            dbId: e.dbId,
            plane: e.plane ?? null,
            mechanic: e.mechanic ?? null,
            unilateral: e.unilateral ?? false,
            primary_muscle: e.primaryMuscle ?? null,
            primary_activation: e.primaryActivation ?? null,
            secondary_muscles_detail: e.secondaryMusclesDetail ?? [],
            secondary_activations: e.secondaryActivations ?? [],
            stabilizers: e.stabilizers ?? [],
            joint_stress_spine: e.jointStressSpine ?? null,
            joint_stress_knee: e.jointStressKnee ?? null,
            joint_stress_shoulder: e.jointStressShoulder ?? null,
            global_instability: e.globalInstability ?? null,
            coordination_demand: e.coordinationDemand ?? null,
            constraint_profile: e.constraintProfile ?? null,
          })),
        })),
      };

      let url: string
      let method: string
      if (isProgram) {
        url = `/api/programs/${programId}`
        method = "PATCH"
      } else if (isEdit) {
        url = `/api/program-templates/${templateId}`
        method = "PATCH"
      } else {
        url = "/api/program-templates"
        method = "POST"
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
        onSaved(d.program)
      } else if (!isProgram) {
        router.push("/coach/programs/templates");
      }
    } catch {
      setError("Erreur réseau");
    } finally {
      setSaving(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta, sessions, isProgram, programId, templateId, isEdit, onSaved, router])

  const morphoConnected = !!morphoAdjustments && Object.keys(morphoAdjustments).length > 0

  const topBarActionsNode = useMemo(() => (
    <div className="flex items-center gap-2">
      {isProgram && (
        <button
          onClick={() => setShowSaveAsTemplate(true)}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-white/[0.04] text-white/60 text-[12px] font-bold uppercase tracking-[0.1em] hover:bg-white/[0.08] hover:text-white/80 transition-all active:scale-[0.98]"
        >
          <BookmarkPlus size={12} />
          Template
        </button>
      )}
      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-1.5 h-8 px-4 rounded-lg bg-[#1f8a65] text-white text-[12px] font-bold uppercase tracking-[0.1em] hover:bg-[#217356] disabled:opacity-50 transition-all active:scale-[0.98]"
      >
        {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
        {saving ? 'Enregistrement…' : 'Enregistrer'}
      </button>
    </div>
  ), [isProgram, saving, handleSave])

  // When topBarLeft is provided, Builder owns the TopBar directly.
  // When onTopBarActions is provided, push actions up to the parent instead.
  useSetTopBar(topBarLeft ?? null, topBarLeft ? topBarActionsNode : undefined)

  useEffect(() => {
    if (!onTopBarActions || topBarLeft) return
    onTopBarActions(topBarActionsNode)
  }, [onTopBarActions, topBarActionsNode, topBarLeft])

  // Compute stable color mapping: group_id → color
  const supersetGroupColors = useMemo(() => {
    const map: Record<string, string> = {}
    let colorIdx = 0
    sessions.forEach(s => {
      s.exercises.forEach(e => {
        if (e.group_id && !map[e.group_id]) {
          map[e.group_id] = SUPERSET_COLORS[colorIdx % SUPERSET_COLORS.length]
          colorIdx++
        }
      })
    })
    return map
  }, [sessions])

  function toggleSuperset(si: number, ei: number) {
    setSessions(prev => {
      const session = prev[si]
      const ex = session.exercises[ei]

      if (ex.group_id) {
        const groupId = ex.group_id
        const groupMembers = session.exercises.filter(e => e.group_id === groupId)
        const nextEx = session.exercises[ei + 1]
        const nextInSameGroup = nextEx?.group_id === groupId

        if (!nextInSameGroup && nextEx) {
          // Exercice suivant pas dans le groupe → étendre le groupe vers le suivant
          return prev.map((s, i) => {
            if (i !== si) return s
            return {
              ...s,
              exercises: s.exercises.map((e, idx) => {
                if (idx === ei + 1) return { ...e, group_id: groupId }
                return e
              }),
            }
          })
        } else {
          // Suivant déjà dans le groupe (ou pas de suivant) → retirer ex du groupe
          return prev.map((s, i) => {
            if (i !== si) return s
            const updated = s.exercises.map(e => {
              if (e.group_id !== groupId) return e
              if (groupMembers.length <= 2 || e === ex) return { ...e, group_id: undefined }
              return e
            })
            return { ...s, exercises: updated }
          })
        }
      } else {
        // Pas dans un groupe → créer groupe avec suivant (ou rejoindre groupe du suivant)
        const nextEx = session.exercises[ei + 1]
        if (!nextEx) return prev
        const targetGroupId = nextEx.group_id ?? `sg-${Date.now()}`
        return prev.map((s, i) => {
          if (i !== si) return s
          return {
            ...s,
            exercises: s.exercises.map((e, idx) => {
              if (idx === ei) return { ...e, group_id: targetGroupId }
              if (idx === ei + 1) return { ...e, group_id: targetGroupId }
              return e
            }),
          }
        })
      }
    })
  }

  const navSessions = useMemo(() =>
    orderedSessions.map(s => ({
      name: s.name,
      exercises: s.exercises.map(e => ({ name: e.name })),
    })),
    [orderedSessions]
  )

  // ─── Resizable split layout ────────────────────────────────────────────────
  const [showSaveAsTemplate, setShowSaveAsTemplate] = useState(false);
  const [navWidth, setNavWidth] = useState(16)       // % of total width
  const [intelWidth, setIntelWidth] = useState(30)   // % of total width
  const containerRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef<'left' | 'right' | null>(null)
  const startXRef = useRef(0)
  const startNavRef = useRef(16)
  const startIntelRef = useRef(30)

  const onMouseDownLeft = useCallback((e: React.MouseEvent) => {
    draggingRef.current = 'left'
    startXRef.current = e.clientX
    startNavRef.current = navWidth
    e.preventDefault()
  }, [navWidth])

  const onMouseDownRight = useCallback((e: React.MouseEvent) => {
    draggingRef.current = 'right'
    startXRef.current = e.clientX
    startIntelRef.current = intelWidth
    e.preventDefault()
  }, [intelWidth])

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!draggingRef.current || !containerRef.current) return
      const totalW = containerRef.current.offsetWidth
      const dx = e.clientX - startXRef.current
      const dPct = (dx / totalW) * 100
      if (draggingRef.current === 'left') {
        const next = Math.min(Math.max(startNavRef.current + dPct, 12), 28)
        setNavWidth(next)
      } else {
        const next = Math.min(Math.max(startIntelRef.current - dPct, 22), 42)
        setIntelWidth(next)
      }
    }
    function onMouseUp() { draggingRef.current = null }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
    <div className="h-full flex flex-col bg-[#121212] overflow-hidden">
      {/* Dual-pane layout */}
      <div ref={containerRef} className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        {/* Navigator */}
        <div style={{ flexGrow: navWidth, flexShrink: 1, flexBasis: 0, minWidth: 160, overflow: 'hidden', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <NavigatorPane
            sessions={navSessions}
            activeSessionIndex={null}
            activeExerciseKey={highlightKey}
            sessionMode={meta.session_mode}
            onSelectSession={si => {
              const el = exerciseRefs.current[`${rawSessionIndex(si)}-0`]
              el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}
            onSelectExercise={(si, ei) => handleAlertClick(rawSessionIndex(si), ei)}
            onAddSession={() => setSessions(prev => [...prev, emptySession()])}
            onMoveSession={(fromSi, toSi) => moveSession(fromSi, toSi)}
          />
        </div>

        {/* Resize handle left */}
        <div
          onMouseDown={onMouseDownLeft}
          className="w-1 flex-none bg-white/[0.06] hover:bg-[#1f8a65]/50 cursor-col-resize transition-colors active:bg-[#1f8a65]"
        />

        {/* Editor — takes remaining space */}
        <div style={{ flexGrow: 100 - navWidth - intelWidth, flexShrink: 1, flexBasis: 0, minWidth: 0, overflow: 'hidden', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <EditorPane
            meta={meta}
            sessions={orderedSessions}
            error={error}
            uploadingKey={uploadingKey}
            highlightKey={highlightKey}
            intelligenceResult={intelligenceResult}
            morphoConnected={morphoConnected}
            templateId={templateId}
            alertsFor={alertsFor}
            sessionMode={meta.session_mode}
            onMetaChange={patch => setMeta(m => ({ ...m, ...patch }))}
            onSessionModeChange={mode => setMeta(m => ({ ...m, session_mode: mode }))}
            onUpdateSession={(si, patch) => updateSession(rawSessionIndex(si), patch)}
            onUpdateExercise={(si, ei, patch) => updateExercise(rawSessionIndex(si), ei, patch)}
            onRemoveExercise={(si, ei) => removeExercise(rawSessionIndex(si), ei)}
            onAddExercise={si => addExercise(rawSessionIndex(si))}
            onRemoveSession={si => removeSession(rawSessionIndex(si))}
            onAddSession={() => setSessions(prev => [...prev, emptySession()])}
            onImageUpload={(si, ei, file) => handleImageUpload(rawSessionIndex(si), ei, file)}
            onPickExercise={(si, ei) => setPickerTarget({ si: rawSessionIndex(si), ei })}
            onPickExerciseForAlternative={(si, ei, addFn) => {
              setAltPickerCallback(() => addFn)
              setPickerTarget({ si: rawSessionIndex(si), ei })
            }}
            onOpenAlternatives={(si, ei) => setAlternativesTarget({ si: rawSessionIndex(si), ei })}
            onToggleSuperset={(si, ei) => toggleSuperset(rawSessionIndex(si), ei)}
            onMoveSession={(fromSi, toSi) => moveSession(rawSessionIndex(fromSi), rawSessionIndex(toSi))}
            onMoveExercise={(fromSi, fromEi, toSi, toEi) =>
              moveExercise(rawSessionIndex(fromSi), fromEi, rawSessionIndex(toSi), toEi)
            }
            makeExDragId={makeExId}
            sessionDropId={(si) => `session-${si}`}
            supersetGroupColors={supersetGroupColors}
            programId={programId}
            exerciseRefSetter={exerciseRefSetter}
            clientId={clientId}
          />
        </div>

        {/* Resize handle right */}
        <div
          onMouseDown={onMouseDownRight}
          className="w-1 flex-none bg-white/[0.06] hover:bg-[#1f8a65]/50 cursor-col-resize transition-colors active:bg-[#1f8a65]"
        />

        {/* Intelligence Panel */}
        <div style={{ flexGrow: intelWidth, flexShrink: 1, flexBasis: 0, minWidth: 260, overflow: 'hidden', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <IntelligencePanelShell
            result={intelligenceResult}
            meta={meta}
            onAlertClick={handleAlertClick}
            morphoConnected={morphoConnected}
            morphoDate={morphoDate}
            sraHeatmap={intelligenceResult?.sraHeatmap}
            labOverrides={labOverrides}
            presentPatterns={Array.from(new Set(sessions.flatMap(s => s.exercises.map(e => e.movement_pattern).filter(Boolean) as string[])))}
            onOverrideChange={onOverrideChange}
            onOverrideReset={onOverrideReset}
            clientId={clientId}
            anchorExerciseNames={Array.from(new Set(sessions.flatMap(s => s.exercises.map(e => e.name).filter(Boolean))))}
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
              altPickerCallback(exercise.name)
              setAltPickerCallback(null)
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
              })
            }
            setPickerTarget(null)
          }}
          onClose={() => {
            setPickerTarget(null)
            setAltPickerCallback(null)
          }}
        />
      )}

      {alternativesTarget && (
        <ExerciseAlternativesDrawer
          exercise={intelligenceSessions[alternativesTarget.si]?.exercises[alternativesTarget.ei]}
          sessionExercises={intelligenceSessions[alternativesTarget.si]?.exercises ?? []}
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
    </div>
    </DndContext>
  );
}
