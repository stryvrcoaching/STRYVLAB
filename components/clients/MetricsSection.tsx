"use client";

import {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  X,
  Loader2,
  AlertCircle,
  BarChart2,
  Table2,
  PenLine,
  SlidersHorizontal,
  Filter,
  Calendar,
  Layers,
  GripHorizontal,
  Activity,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { BioNormsPanel } from "@/components/health/BioNormsPanel";
import {
  Area,
  AreaChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  LineChart,
  Line,
  BarChart,
  Bar,
  useXAxisScale,
  useOffset,
  usePlotArea,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Slider } from "@/components/ui/slider";
import CsvImportButton from "./CsvImportButton";
import { Skeleton } from "@/components/ui/skeleton";

// ─── Chart color palette (semantic mapping to STRYVR design tokens) ────────────
// Only gray tones for charts - green only on hover/active states

// ─── Chart config for shadcn charts ───────────────────────────────────────────
function createChartConfig(selectedMetrics: string[]): ChartConfig {
  const config: ChartConfig = {};
  selectedMetrics.forEach((key) => {
    const field = FIELD_MAP[key];
    if (field) {
      const color = getMetricColor(key);
      config[key] = { label: field.label, color };
      config[`__pct_${key}`] = { label: `${field.label} (%)`, color };
    }
  });
  return config;
}

// ─── Field definitions ────────────────────────────────────────────────────────

interface FieldDef {
  key: string;
  label: string;
  unit: string;
  category: "composition" | "measurements" | "wellness";
  step: number;
}

const FIELDS: FieldDef[] = [
  {
    key: "weight_kg",
    label: "Poids",
    unit: "kg",
    category: "composition",
    step: 0.1,
  },
  {
    key: "body_fat_pct",
    label: "Masse grasse %",
    unit: "%",
    category: "composition",
    step: 0.1,
  },
  {
    key: "fat_mass_kg",
    label: "Masse grasse",
    unit: "kg",
    category: "composition",
    step: 0.1,
  },
  {
    key: "lean_mass_kg",
    label: "Masse maigre",
    unit: "kg",
    category: "composition",
    step: 0.1,
  },
  {
    key: "muscle_mass_kg",
    label: "Masse musculaire",
    unit: "kg",
    category: "composition",
    step: 0.1,
  },
  {
    key: "muscle_mass_pct",
    label: "Masse musculaire %",
    unit: "%",
    category: "composition",
    step: 0.1,
  },
  {
    key: "skeletal_muscle_pct",
    label: "Musc. squelettique %",
    unit: "%",
    category: "composition",
    step: 0.1,
  },
  {
    key: "body_water_pct",
    label: "Hydrique %",
    unit: "%",
    category: "composition",
    step: 0.1,
  },
  {
    key: "bone_mass_kg",
    label: "Masse osseuse",
    unit: "kg",
    category: "composition",
    step: 0.01,
  },
  {
    key: "visceral_fat_level",
    label: "Graisse viscérale",
    unit: "",
    category: "composition",
    step: 1,
  },
  {
    key: "waist_cm",
    label: "Tour de taille",
    unit: "cm",
    category: "measurements",
    step: 0.5,
  },
  {
    key: "hips_cm",
    label: "Hanches",
    unit: "cm",
    category: "measurements",
    step: 0.5,
  },
  {
    key: "chest_cm",
    label: "Poitrine",
    unit: "cm",
    category: "measurements",
    step: 0.5,
  },
  {
    key: "arm_cm",
    label: "Bras",
    unit: "cm",
    category: "measurements",
    step: 0.5,
  },
  {
    key: "thigh_cm",
    label: "Cuisse",
    unit: "cm",
    category: "measurements",
    step: 0.5,
  },
  {
    key: "calf_cm",
    label: "Mollet",
    unit: "cm",
    category: "measurements",
    step: 0.5,
  },
  {
    key: "neck_cm",
    label: "Cou",
    unit: "cm",
    category: "measurements",
    step: 0.5,
  },
  {
    key: "waist_hip_ratio",
    label: "Ratio taille/hanches",
    unit: "",
    category: "measurements",
    step: 0.01,
  },
  {
    key: "sleep_duration_h",
    label: "Sommeil",
    unit: "h",
    category: "wellness",
    step: 0.25,
  },
  {
    key: "energy_level",
    label: "Énergie",
    unit: "/10",
    category: "wellness",
    step: 1,
  },
  {
    key: "stress_level",
    label: "Stress",
    unit: "/10",
    category: "wellness",
    step: 1,
  },
];

const FIELD_MAP = Object.fromEntries(FIELDS.map((f) => [f.key, f]));
const KPI_FIELDS = ["weight_kg", "body_fat_pct", "muscle_mass_kg", "muscle_mass_pct"];
const NEG_GOOD_FIELDS = [
  "body_fat_pct",
  "fat_mass_kg",
  "visceral_fat_level",
  "bmi",
  "stress_level",
];

// ─── Couleurs sémantiques par métrique ───────────────────────────────────────
// Source de vérité unique — utilisée dans overlay ET chips.
// Règle : aucun doublon de couleur. Familles sémantiques cohérentes.
//
// Famille graisse    : orange/rouge  — signal négatif
// Famille muscle     : vert          — 3 teintes distinctes selon précision
// Famille structure  : teal/bleu     — masse maigre, eau, os
// Famille mensurations : spectre froid distinct de la composition
// Famille bien-être  : indigo/jaune/rouge clair
const METRIC_COLORS: Record<string, string> = {
  // ── Poids ──────────────────────────────────────────────────────────────────
  weight_kg:           "#9ca3af", // gris neutre — poids total (référence)

  // ── Graisse (famille orange→rouge) ────────────────────────────────────────
  body_fat_pct:        "#f97316", // orange vif — % masse grasse
  fat_mass_kg:         "#fb923c", // orange moyen — masse grasse kg
  visceral_fat_level:  "#ef4444", // rouge — graisse viscérale (risque élevé)

  // ── Muscle (famille vert, 3 teintes distinctes) ────────────────────────────
  muscle_mass_kg:      "#1f8a65", // vert STRYV foncé — masse musculaire kg (valeur absolue)
  muscle_mass_pct:     "#34d399", // vert émeraude — % musculaire total
  skeletal_muscle_pct: "#86efac", // vert clair pastel — % squelettique (sous-ensemble)

  // ── Structure corporelle (famille teal/bleu) ──────────────────────────────
  lean_mass_kg:        "#2dd4bf", // teal — masse maigre (distinct du vert muscle)
  body_water_pct:      "#38bdf8", // bleu ciel — hydratation cellulaire
  bone_mass_kg:        "#a78bfa", // violet — masse osseuse

  // ── Mensurations tronc (famille amber/rose) ────────────────────────────────
  waist_cm:            "#fbbf24", // amber — tour de taille (risque central)
  hips_cm:             "#f472b6", // rose — hanches
  waist_hip_ratio:     "#fb7185", // rose-rouge — ratio taille/hanches

  // ── Mensurations membres (spectre froid distinct) ─────────────────────────
  chest_cm:            "#c084fc", // violet clair — poitrine
  arm_cm:              "#60a5fa", // bleu moyen — bras
  thigh_cm:            "#7dd3fc", // bleu clair — cuisse
  calf_cm:             "#67e8f9", // cyan — mollet
  neck_cm:             "#a3e635", // lime — cou (Navy)

  // ── Bien-être ─────────────────────────────────────────────────────────────
  sleep_duration_h:    "#818cf8", // indigo — sommeil
  energy_level:        "#facc15", // jaune — énergie subjective
  stress_level:        "#f87171", // rouge clair — stress perçu
};

function getMetricColor(key: string): string {
  return METRIC_COLORS[key] ?? "#9ca3af";
}

// Groupes de métriques pour la vue superposée
// Seules les métriques comparables ensemble (même échelle narrative) sont groupées.
const OVERLAY_GROUPS = [
  {
    key: "recomposition",
    label: "Recomposition",
    desc: "Poids, masse grasse et masse musculaire en kg — trajectoires de recomposition",
    interpretation:
      "Vue centrale du coach. Toutes les courbes sont normalisées à 0 % au point de départ — chaque série montre sa variation relative, indépendamment de son unité. Le signal clé : fat_mass ↓ + muscle_mass ↑ simultanément, même si le poids total stagne. C'est la signature d'une recomposition réussie. lean_mass (= poids − graisse) est un indicateur de rétention globale : il monte si le client gagne du muscle ou de l'eau, et descend si le déficit est trop agressif. Seuil de détection plateau : ±0.5 % sur 4 bilans consécutifs (Schoenfeld 2010). Minimum 3 points pour interpréter une tendance.",
    metrics: [
      "weight_kg",
      "fat_mass_kg",
      "lean_mass_kg",
      "muscle_mass_kg",
    ],
  },
  {
    key: "body_ratios",
    label: "Ratios corporels",
    desc: "% masse grasse, % musculaire total, % squelettique, % hydratation",
    interpretation:
      "Ces ratios sont mécaniquement interdépendants : une baisse du % masse grasse fait monter le % musculaire même sans vrai gain. Croiser toujours avec 'Recomposition' (valeurs absolues) pour distinguer un vrai gain d'un effet de dilution. muscle_mass_pct et skeletal_muscle_pct évoluent souvent de concert — un écart croissant entre les deux peut signaler une adaptation du tissu conjonctif ou une variation de la méthode de mesure. body_water_pct : une chute soudaine indique déshydratation, pas perte de graisse.",
    metrics: ["body_fat_pct", "muscle_mass_pct", "skeletal_muscle_pct", "body_water_pct"],
  },
  {
    key: "metabolic_risk",
    label: "Risque métabolique",
    desc: "Graisse viscérale, ratio taille/hanches — indicateurs cardio-métaboliques",
    interpretation:
      "Indicateurs de risque indépendants du poids total — un client normopondéral peut avoir un profil à risque élevé. Graisse viscérale (score Tanita) : seuil clinique à 12 (ACE). Ratio taille/hanches : risque élevé > 0.85 femme / 0.90 homme (OMS 2011). Ces deux métriques répondent en 4–8 semaines à un déficit calorique modéré, souvent avant que le poids ne bouge.",
    metrics: ["visceral_fat_level", "waist_cm", "waist_hip_ratio"],
  },
  {
    key: "measurements_upper",
    label: "Mensurations — membres",
    desc: "Bras, cuisse, mollet, poitrine — développement musculaire segmentaire",
    interpretation:
      "Signal d'hypertrophie localisée. Bras + cuisse en hausse avec tour de taille stable = prise de masse propre. Ces mesures bougent lentement (4–8 semaines minimum) — ne pas interpréter sur moins de 3 points. Particulièrement utile pour valider la progression quand la balance est ambiguë (rétention d'eau, variation de glycogène).",
    metrics: ["arm_cm", "thigh_cm", "calf_cm", "chest_cm"],
  },
  {
    key: "measurements_central",
    label: "Mensurations — tronc",
    desc: "Taille, hanches, cou — morphologie centrale et ratio",
    interpretation:
      "Tour de taille = premier indicateur de perte de graisse abdominale, souvent avant le poids. Hanches : marqueur de distribution gynoïde. Tour de cou : utilisé dans la formule Navy pour estimer la masse grasse (Hodgdon & Beckett 1984) — une réduction du cou peut signaler une perte de graisse faciale/cervicale. Ratio taille/hanches évolue même sans variation de poids.",
    metrics: ["waist_cm", "hips_cm", "neck_cm"],
  },
  {
    key: "wellness",
    label: "Récupération & bien-être",
    desc: "Sommeil, énergie subjective, stress perçu",
    interpretation:
      "Le bien-être conditionne directement les adaptations. Un stress chronique élevé (cortisol) bloque la lipolyse et favorise le catabolisme musculaire. Sommeil < 7h est associé à une réduction de 55% de la perte de masse grasse sous déficit calorique (Spiegel et al. 2010). Corréler ces courbes avec les phases d'entraînement pour identifier les périodes à risque de surentraînement.",
    metrics: ["sleep_duration_h", "energy_level", "stress_level"],
  },
];

/// Toutes les métriques overlay — chargées en série, visibilité contrôlée par visibleSeries
const DEFAULT_OVERLAY_METRICS = Array.from(
  new Set(OVERLAY_GROUPS.flatMap((g) => g.metrics)),
);

// ─── Types ────────────────────────────────────────────────────────────────────

interface MetricRow {
  submissionId: string;
  date: string;
  values: Record<string, number>;
}

interface MetricSeries {
  [fieldKey: string]: { date: string; value: number }[];
}

// ─── Training phases & annotations ───────────────────────────────────────────

type PhaseType = "bulk" | "cut" | "maintenance" | "peak" | "deload" | "custom";
type AnnotationType =
  | "program_change"
  | "injury"
  | "travel"
  | "nutrition"
  | "note"
  | "lab_protocol";

interface TrainingPhase {
  id: string;
  label: string;
  phase_type: PhaseType;
  date_start: string;
  date_end: string | null;
  notes?: string | null;
}

interface MetricAnnotation {
  id: string;
  event_date: string;
  label: string;
  body?: string | null;
  event_type: AnnotationType;
}

const PHASE_COLORS: Record<
  PhaseType,
  { bg: string; text: string; label: string }
> = {
  bulk: {
    bg: "rgba(99,102,241,0.12)",
    text: "#818cf8",
    label: "Prise de masse",
  },
  cut: { bg: "rgba(249,115,22,0.12)", text: "#fb923c", label: "Sèche" },
  maintenance: {
    bg: "rgba(255,255,255,0.04)",
    text: "#9ca3af",
    label: "Maintien",
  },
  peak: {
    bg: "rgba(250,204,21,0.10)",
    text: "#facc15",
    label: "Pic de performance",
  },
  deload: { bg: "rgba(34,211,238,0.08)", text: "#67e8f9", label: "Décharge" },
  custom: {
    bg: "rgba(31,138,101,0.10)",
    text: "#1f8a65",
    label: "Personnalisé",
  },
};

const ANNOTATION_ICONS: Record<AnnotationType, string> = {
  program_change: "⚡",
  injury: "🩹",
  travel: "✈️",
  nutrition: "🥗",
  note: "📌",
  lab_protocol: "🧪",
};

const ANNOTATION_LABELS: Record<AnnotationType, string> = {
  program_change: "Programme",
  injury: "Blessure",
  travel: "Voyage",
  nutrition: "Nutrition",
  note: "Note",
  lab_protocol: "Protocole Lab",
};

// ─── Scientific plateau thresholds ───────────────────────────────────────────
// Sources: Schoenfeld 2010, Helms et al. 2014, Trexler et al. 2014, NSCA

const PLATEAU_THRESHOLDS: Partial<
  Record<string, { pct: number; minPoints: number }>
> = {
  lean_mass_kg: { pct: 0.5, minPoints: 4 },
  muscle_mass_kg: { pct: 0.5, minPoints: 4 },
  muscle_mass_pct: { pct: 1.0, minPoints: 4 },
  skeletal_muscle_pct: { pct: 1.0, minPoints: 4 },
  fat_mass_kg: { pct: 1.5, minPoints: 3 },
  body_fat_pct: { pct: 2.0, minPoints: 3 },
  weight_kg: { pct: 0.5, minPoints: 3 },
  waist_cm: { pct: 1.0, minPoints: 3 },
  sleep_duration_h: { pct: 5.0, minPoints: 4 },
  energy_level: { pct: 10.0, minPoints: 4 },
};
const DEFAULT_PLATEAU_THRESHOLD = { pct: 2.0, minPoints: 3 };

function detectPlateaus(
  data: { date: string; value: number }[],
  metricKey: string,
): { startIdx: number; endIdx: number; startDate: string; endDate: string }[] {
  const threshold = PLATEAU_THRESHOLDS[metricKey] ?? DEFAULT_PLATEAU_THRESHOLD;
  const plateaus: {
    startIdx: number;
    endIdx: number;
    startDate: string;
    endDate: string;
  }[] = [];
  if (data.length < threshold.minPoints) return plateaus;
  let plateauStart = 0;
  for (let i = 1; i < data.length; i++) {
    const baseVal = data[plateauStart].value;
    if (baseVal === 0) {
      plateauStart = i;
      continue;
    }
    const variation =
      Math.abs((data[i].value - baseVal) / Math.abs(baseVal)) * 100;
    if (variation < threshold.pct) {
      if (i - plateauStart + 1 >= threshold.minPoints) {
        if (
          plateaus.length > 0 &&
          plateaus[plateaus.length - 1].endIdx === i - 1
        ) {
          plateaus[plateaus.length - 1].endIdx = i;
          plateaus[plateaus.length - 1].endDate = data[i].date;
        } else if (i - plateauStart + 1 === threshold.minPoints) {
          plateaus.push({
            startIdx: plateauStart,
            endIdx: i,
            startDate: data[plateauStart].date,
            endDate: data[i].date,
          });
        } else if (plateaus.length > 0) {
          plateaus[plateaus.length - 1].endIdx = i;
          plateaus[plateaus.length - 1].endDate = data[i].date;
        }
      }
    } else {
      plateauStart = i;
    }
  }
  return plateaus;
}

// ─── Norm reference zones (evidence-based) ───────────────────────────────────
// Sources: ACSM Guidelines, WHO, ACE Body Fat Standards

type NormZone = { label: string; min: number; max: number; color: string };

const NORM_ZONES: Partial<
  Record<
    string,
    { male?: NormZone[]; female?: NormZone[]; neutral?: NormZone[] }
  >
> = {
  body_fat_pct: {
    male: [
      { label: "Essentiel", min: 2, max: 5, color: "rgba(99,102,241,0.12)" },
      { label: "Athlète", min: 5, max: 13, color: "rgba(31,138,101,0.12)" },
      { label: "Forme", min: 13, max: 17, color: "rgba(34,197,94,0.10)" },
      { label: "Acceptable", min: 17, max: 24, color: "rgba(250,204,21,0.08)" },
      { label: "Obèse", min: 24, max: 45, color: "rgba(239,68,68,0.10)" },
    ],
    female: [
      { label: "Essentiel", min: 10, max: 13, color: "rgba(99,102,241,0.12)" },
      { label: "Athlète", min: 13, max: 20, color: "rgba(31,138,101,0.12)" },
      { label: "Forme", min: 20, max: 24, color: "rgba(34,197,94,0.10)" },
      { label: "Acceptable", min: 24, max: 31, color: "rgba(250,204,21,0.08)" },
      { label: "Obèse", min: 31, max: 55, color: "rgba(239,68,68,0.10)" },
    ],
  },
  visceral_fat_level: {
    neutral: [
      { label: "Sain", min: 1, max: 9, color: "rgba(31,138,101,0.12)" },
      { label: "Excessif", min: 9, max: 14, color: "rgba(250,204,21,0.10)" },
      { label: "Dangereux", min: 14, max: 30, color: "rgba(239,68,68,0.12)" },
    ],
  },
  sleep_duration_h: {
    neutral: [
      { label: "Insuffisant", min: 0, max: 6, color: "rgba(239,68,68,0.10)" },
      { label: "Optimal", min: 6, max: 9, color: "rgba(31,138,101,0.12)" },
      { label: "Excessif", min: 9, max: 12, color: "rgba(250,204,21,0.08)" },
    ],
  },
  energy_level: {
    neutral: [
      { label: "Faible", min: 0, max: 4, color: "rgba(239,68,68,0.10)" },
      { label: "Modéré", min: 4, max: 7, color: "rgba(250,204,21,0.08)" },
      { label: "Optimal", min: 7, max: 10, color: "rgba(31,138,101,0.12)" },
    ],
  },
  stress_level: {
    neutral: [
      { label: "Faible", min: 0, max: 3, color: "rgba(31,138,101,0.12)" },
      { label: "Modéré", min: 3, max: 7, color: "rgba(250,204,21,0.08)" },
      { label: "Élevé", min: 7, max: 10, color: "rgba(239,68,68,0.10)" },
    ],
  },
};

type ViewMode = "table" | "charts" | "overlay" | "norms";
type ChartCategory = "composition" | "measurements" | "wellness";
type DateRangePreset = "1m" | "3m" | "6m" | "1y" | "all" | "custom";

interface FilterState {
  dateFrom: string; // ISO date string or ''
  dateTo: string; // ISO date string or ''
  preset: DateRangePreset;
  selectedMetrics: string[]; // keys of FIELDS to show in charts
}

const DEFAULT_FILTER: FilterState = {
  dateFrom: "",
  dateTo: "",
  preset: "all",
  selectedMetrics: DEFAULT_OVERLAY_METRICS,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: string) {
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateInput(d: string) {
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "";
  return dt.toISOString().split("T")[0];
}

function getDelta(series: { date: string; value: number }[]) {
  if (series.length < 2) return null;
  return series[series.length - 1].value - series[0].value;
}

function fmtVal(v: number, unit: string) {
  const s = Number.isInteger(v) ? String(v) : v.toFixed(v < 10 ? 2 : 1);
  return unit ? `${s} ${unit}` : s;
}

function presetToRange(preset: DateRangePreset): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString().split("T")[0];
  if (preset === "all" || preset === "custom") return { from: "", to: "" };
  const months = { "1m": 1, "3m": 3, "6m": 6, "1y": 12 }[preset];
  const from = new Date(now);
  from.setMonth(from.getMonth() - months);
  return { from: from.toISOString().split("T")[0], to };
}

function filterSeries(
  data: { date: string; value: number }[],
  dateFrom: string,
  dateTo: string,
): { date: string; value: number }[] {
  return data.filter((d) => {
    if (dateFrom && d.date < dateFrom) return false;
    if (dateTo && d.date > dateTo) return false;
    return true;
  });
}

function filterRows(
  rows: MetricRow[],
  dateFrom: string,
  dateTo: string,
): MetricRow[] {
  return rows.filter((r) => {
    const d = r.date.split("T")[0];
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    return true;
  });
}

// ─── DeltaBadge ──────────────────────────────────────────────────────────────

function DeltaBadge({
  delta,
  unit,
  negGood,
}: {
  delta: number;
  unit: string;
  negGood: boolean;
}) {
  const isGood = delta === 0 ? null : negGood ? delta < 0 : delta > 0;
  const label =
    delta === 0
      ? "Stable"
      : `${delta > 0 ? "+" : ""}${delta.toFixed(1)}${unit ? ` ${unit}` : ""}`;
  const Icon = delta === 0 ? Minus : delta > 0 ? TrendingUp : TrendingDown;

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#1f8a65] text-white text-[10px] font-bold leading-none">
      <Icon size={9} />
      {label}
      {isGood !== null && (
        <span
          className={`ml-0.5 ${isGood ? "text-white/70" : "text-white/50"}`}
        >
          {isGood ? "↑" : "↓"}
        </span>
      )}
    </span>
  );
}

// ─── Custom tooltip dark ──────────────────────────────────────────────────────

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    name?: string;
    color?: string;
    dataKey?: string;
  }>;
  label?: string;
  unit?: string;
  fieldLabel?: string;
  accentColor?: string;
  multiSeries?: boolean;
}

function CustomTooltip({
  active,
  payload,
  label,
  unit,
  fieldLabel,
  accentColor,
  multiSeries,
}: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const dateStr = label
    ? new Date(label).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "";

  if (multiSeries) {
    return (
      <div
        className="bg-[#0f0f0f] rounded-xl px-3 py-2.5 flex flex-col gap-1.5"
        style={{ minWidth: 140 }}
      >
        <p className="text-[9px] text-white/40 font-medium pb-1.5">{dateStr}</p>
        <div className="mb-1 h-px bg-white/[0.07]" />
        {payload.map((p, i) => {
          const fieldKey = typeof p.dataKey === "string" ? p.dataKey : "";
          const field = FIELD_MAP[fieldKey];
          const v = p.value;
          return (
            <div key={i} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5">
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: p.color }}
                />
                <span className="text-[9px] text-white/50">
                  {field?.label ?? fieldKey}
                </span>
              </div>
              <span
                className="text-xs font-bold tabular-nums"
                style={{ color: p.color }}
              >
                {Number.isInteger(v) ? v : v.toFixed(1)}
                {field?.unit ? (
                  <span className="text-white/40 font-normal ml-0.5 text-[9px]">
                    {field.unit}
                  </span>
                ) : null}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  const val = payload[0].value;
  return (
    <div
      className="bg-[#0f0f0f] rounded-xl px-3 py-2.5 flex flex-col gap-1"
      style={{ minWidth: 120 }}
    >
      <p className="text-[9px] text-white/40 font-medium">{dateStr}</p>
      <div className="flex items-baseline gap-1.5">
        <span
          className="text-xl font-bold tabular-nums"
          style={{ color: accentColor ?? "#1f8a65" }}
        >
          {Number.isInteger(val) ? val : val.toFixed(1)}
        </span>
        {unit && (
          <span className="text-xs text-white/50 font-medium">{unit}</span>
        )}
      </div>
      {fieldLabel && <p className="text-[9px] text-white/30">{fieldLabel}</p>}
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  fieldKey,
  series,
  index,
}: {
  fieldKey: string;
  series: MetricSeries;
  index: number;
}) {
  const field = FIELD_MAP[fieldKey];
  const data = series[fieldKey] ?? [];
  const last = data[data.length - 1];
  const delta = getDelta(data);
  const isDark = index % 2 === 1;
  const isNegGood = NEG_GOOD_FIELDS.includes(fieldKey);

  const lineColor = isDark ? "var(--chart-2)" : "var(--chart-1)";
  const gradId = `kpiGrad_${fieldKey}`;

  const min = data.length > 0 ? Math.min(...data.map((d) => d.value)) : 0;
  const max = data.length > 0 ? Math.max(...data.map((d) => d.value)) : 1;
  const pad = (max - min) * 0.2 || 1;
  const domain: [number, number] = [min - pad, max + pad];

  const deltaGood =
    delta === null
      ? null
      : delta === 0
        ? null
        : isNegGood
          ? delta < 0
          : delta > 0;

  // Chart config for shadcn
  const chartConfig: ChartConfig = {
    value: {
      label: field?.label ?? "",
      color: isDark ? "var(--chart-2)" : "var(--chart-1)",
    },
  };

  return (
    <div className="rounded-2xl overflow-hidden flex flex-col min-w-0 bg-[#181818]">
      {/* Text zone */}
      <div className="px-6 pt-6 pb-3 flex flex-col gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] truncate text-white/40">
          {field?.label}
        </p>

        {last ? (
          <div className="flex items-end justify-between gap-3">
            <div className="flex items-baseline gap-2 leading-none">
              <span
                className="font-bold tabular-nums leading-none text-white"
                style={{ fontSize: 44, letterSpacing: "-0.03em" }}
              >
                {last.value % 1 === 0 ? last.value : last.value.toFixed(1)}
              </span>
              {field?.unit && (
                <span className="text-base font-semibold pb-1 text-white/40">
                  {field.unit}
                </span>
              )}
            </div>
            {/* Delta pill */}
            {delta !== null && (
              <div
                className={`flex flex-col items-center shrink-0 px-3 py-2 rounded-xl ${
                  delta === 0
                    ? "bg-white/[0.06]"
                    : deltaGood
                      ? "bg-[#1f8a65]"
                      : "bg-red-500/15"
                }`}
              >
                <span
                  className={`text-[11px] font-bold tabular-nums leading-tight flex items-center gap-0.5 ${
                    delta === 0
                      ? "text-white/40"
                      : deltaGood
                        ? "text-white"
                        : "text-red-300"
                  }`}
                >
                  {delta === 0 ? "─" : delta > 0 ? "↗" : "↘"}
                  <span>{Math.abs(delta).toFixed(1)}</span>
                </span>
                {field?.unit && (
                  <span
                    className={`text-[9px] font-medium mt-0.5 ${
                      delta === 0
                        ? "text-white/40"
                        : deltaGood
                          ? "text-white/60"
                          : "text-red-400"
                    }`}
                  >
                    {field.unit}
                  </span>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="font-bold text-white/30" style={{ fontSize: 44 }}>
            —
          </p>
        )}
      </div>

      {/* Mini chart flush to bottom */}
      <div className="mt-auto">
        {data.length >= 2 ? (
          <>
            <svg width={0} height={0} style={{ position: "absolute" }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--color-value)"
                    stopOpacity={0.18}
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--color-value)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
            </svg>
            <ChartContainer
              config={chartConfig}
              className="min-h-[80px] w-full"
            >
              <LineChart
                data={data}
                margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
              >
                <YAxis domain={domain} hide />
                <ChartTooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const value = payload[0].value as number;
                    const dateStr = label
                      ? new Date(label).toLocaleDateString("fr-FR", {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                        })
                      : "";
                    const unit = field?.unit ?? "";
                    return (
                      <div
                        className="bg-[#0f0f0f] rounded-xl px-3 py-2.5 flex flex-col gap-1"
                        style={{ minWidth: 120 }}
                      >
                        <p className="text-[9px] text-white/40 font-medium">
                          {dateStr}
                        </p>
                        <div className="flex items-baseline gap-1.5">
                          <span
                            className="text-xl font-bold tabular-nums"
                            style={{
                              color: isDark
                                ? "var(--chart-2)"
                                : "var(--chart-1)",
                            }}
                          >
                            {Number.isInteger(value) ? value : value.toFixed(1)}
                          </span>
                          {unit && (
                            <span className="text-xs text-white/50 font-medium">
                              {unit}
                            </span>
                          )}
                        </div>
                        <p className="text-[9px] text-white/30">
                          {field?.label}
                        </p>
                      </div>
                    );
                  }}
                  cursor={{
                    stroke: "var(--color-value)",
                    strokeWidth: 1,
                    strokeOpacity: 0.4,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="var(--color-value)"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ChartContainer>
          </>
        ) : (
          <div className="mx-5 mb-4 h-px bg-white/[0.07]" />
        )}
      </div>
    </div>
  );
}

// ─── Sparkline (table) ────────────────────────────────────────────────────────

function Sparkline({ data }: { data: { date: string; value: number }[] }) {
  if (data.length < 2) return null;
  const min = Math.min(...data.map((d) => d.value));
  const max = Math.max(...data.map((d) => d.value));
  const domain: [number, number] = [min * 0.99, max * 1.01];
  return (
    <ResponsiveContainer width={72} height={48}>
      <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
        <defs>
          <linearGradient id="gradSparklineInline" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.12} />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <YAxis domain={domain} hide />
        <Area
          type="monotone"
          dataKey="value"
          stroke="var(--chart-1)"
          strokeWidth={1.5}
          fill="url(#gradSparklineInline)"
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── Full metric chart (single series) ───────────────────────────────────────

function FullChart({
  fieldKey,
  data,
  chartKind = "line",
}: {
  fieldKey: string;
  data: { date: string; value: number }[];
  chartKind?: "bar" | "line";
}) {
  const field = FIELD_MAP[fieldKey];
  if (!field || data.length === 0) return null;

  const useBar = chartKind === "bar";
  const ChartComponent = useBar ? BarChart : AreaChart;

  const delta = getDelta(data);
  const isNegGood = NEG_GOOD_FIELDS.includes(fieldKey);
  const deltaGood =
    delta === null
      ? null
      : delta === 0
        ? null
        : isNegGood
          ? delta < 0
          : delta > 0;

  const lineColor = "var(--chart-1)";
  const gradId = `fullChart_${fieldKey}`;

  const last = data[data.length - 1];
  const baseline = data[0]?.value;
  const min = Math.min(...data.map((d) => d.value));
  const max = Math.max(...data.map((d) => d.value));
  const padding = (max - min) * 0.25 || Math.abs(last.value) * 0.05 || 1;
  const domain: [number, number] = [Math.max(0, min - padding), max + padding];
  const tickCount = Math.min(data.length, 6);

  // Chart config for shadcn
  const chartConfig: ChartConfig = {
    value: {
      label: field.label,
      color: "var(--chart-1)",
    },
  };

  return (
    <div className="bg-[#181818] rounded-2xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-6 pt-6 pb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.12em] mb-2">
            {field.label}
          </p>
          <div className="flex items-baseline gap-2">
            <span
              className="font-bold text-white tabular-nums leading-none"
              style={{ fontSize: 42, letterSpacing: "-0.03em" }}
            >
              {Number.isInteger(last.value)
                ? last.value
                : last.value.toFixed(1)}
            </span>
            {field.unit && (
              <span className="text-lg font-semibold text-white/40">
                {field.unit}
              </span>
            )}
          </div>
          {/* Baseline comparison inline */}
          {baseline !== undefined && data.length > 1 && (
            <p className="text-[11px] text-white/35 mt-2">
              Départ :{" "}
              <span className="font-semibold text-white/45">
                {Number.isInteger(baseline) ? baseline : baseline.toFixed(1)}{" "}
                {field.unit}
              </span>
            </p>
          )}
        </div>

        {/* Delta block */}
        {delta !== null && (
          <div
            className={`flex flex-col items-center px-4 py-3 rounded-xl shrink-0 ${
              delta === 0
                ? "bg-white/[0.05]"
                : deltaGood
                  ? "bg-[#1f8a65]"
                  : "bg-red-500/15"
            }`}
          >
            {delta === 0 ? (
              <Minus size={15} className="text-white/40 mb-1" />
            ) : delta > 0 ? (
              <TrendingUp
                size={15}
                className={deltaGood ? "text-white mb-1" : "text-red-400 mb-1"}
              />
            ) : (
              <TrendingDown
                size={15}
                className={deltaGood ? "text-white mb-1" : "text-red-400 mb-1"}
              />
            )}
            <span
              className={`text-base font-bold tabular-nums leading-none ${
                delta === 0
                  ? "text-white/40"
                  : deltaGood
                    ? "text-white"
                    : "text-red-300"
              }`}
            >
              {delta > 0 ? "+" : ""}
              {Math.abs(delta) < 0.1 ? delta.toFixed(2) : delta.toFixed(1)}
            </span>
            {field.unit && (
              <span
                className={`text-[10px] font-medium mt-1 ${
                  delta === 0
                    ? "text-white/40"
                    : deltaGood
                      ? "text-white/60"
                      : "text-red-400"
                }`}
              >
                {field.unit}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Chart area */}
      <div className="bg-[#0a0a0a] pt-2 pb-1 mx-0">
        <svg width={0} height={0} style={{ position: "absolute" }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.16} />
              <stop
                offset="70%"
                stopColor="var(--chart-1)"
                stopOpacity={0.04}
              />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
        </svg>
        <ChartContainer config={chartConfig} className="min-h-[220px] w-full">
          <ChartComponent
            data={data}
            margin={{ top: 16, right: 16, bottom: 4, left: 8 }}
          >
            <CartesianGrid
              vertical={false}
              stroke="rgba(255,255,255,0.08)"
              strokeDasharray="0"
            />
            <XAxis
              dataKey="date"
              tick={{
                fontSize: 10,
                fill: "rgba(255,255,255,0.40)",
                fontWeight: 600,
              }}
              axisLine={false}
              tickLine={false}
              tickCount={tickCount}
              tickFormatter={(d) =>
                new Date(d).toLocaleDateString("fr-FR", {
                  day: "2-digit",
                  month: "2-digit",
                })
              }
            />
            <YAxis
              tick={{
                fontSize: 10,
                fill: "rgba(255,255,255,0.35)",
                fontWeight: 500,
              }}
              axisLine={false}
              tickLine={false}
              width={48}
              domain={domain}
              tickFormatter={(v) =>
                Number.isInteger(v) ? String(v) : v.toFixed(1)
              }
            />
            <ChartTooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const value = payload[0].value as number;
                const dateStr = label
                  ? new Date(label).toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })
                  : "";
                const unit = field?.unit ?? "";
                return (
                  <div
                    className="bg-[#0f0f0f] rounded-xl px-3 py-2.5 flex flex-col gap-1"
                    style={{ minWidth: 120 }}
                  >
                    <p className="text-[9px] text-white/40 font-medium">
                      {dateStr}
                    </p>
                    <div className="flex items-baseline gap-1.5">
                      <span
                        className="text-xl font-bold tabular-nums"
                        style={{ color: "#1f8a65" }}
                      >
                        {Number.isInteger(value) ? value : value.toFixed(1)}
                      </span>
                      {unit && (
                        <span className="text-xs text-white/50 font-medium">
                          {unit}
                        </span>
                      )}
                    </div>
                    <p className="text-[9px] text-white/30">{field?.label}</p>
                  </div>
                );
              }}
              cursor={{
                stroke: "rgba(255,255,255,0.20)",
                strokeWidth: 1,
                strokeDasharray: "4 3",
                strokeOpacity: 0.35,
              }}
            />
            {baseline !== undefined && data.length > 1 && (
              <ReferenceLine
                y={baseline}
                stroke="rgba(255,255,255,0.10)"
                strokeDasharray="5 3"
                strokeWidth={1.5}
              />
            )}
            {useBar ? (
              <Bar
                dataKey="value"
                fill="var(--color-value)"
                radius={[2, 2, 0, 0]}
                isAnimationActive
                animationDuration={700}
                animationEasing="ease-out"
              />
            ) : (
              <Area
                type="monotone"
                dataKey="value"
                stroke="var(--color-value)"
                strokeWidth={2.5}
                fill={`url(#${gradId})`}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                dot={(props: any) => {
                  const isLast = props.index === data.length - 1;
                  if (!isLast && data.length > 8)
                    return <g key={props.index} />;
                  return (
                    <circle
                      key={props.index}
                      cx={props.cx}
                      cy={props.cy}
                      r={isLast ? 5 : 3}
                      fill="#181818"
                      stroke="var(--color-value)"
                      strokeWidth={2}
                    />
                  );
                }}
                activeDot={{
                  r: 6,
                  fill: "#1f8a65",
                  stroke: "#181818",
                  strokeWidth: 2,
                }}
                isAnimationActive
                animationDuration={700}
                animationEasing="ease-out"
              />
            )}
          </ChartComponent>
        </ChartContainer>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[9px] font-medium text-white/40">
          {new Date(data[0].date).toLocaleDateString("fr-FR", {
            day: "2-digit",
            month: "short",
            year: "2-digit",
          })}
        </p>
        <p className="text-[9px] font-medium text-white/40">
          {data.length} point{data.length > 1 ? "s" : ""}
        </p>
        <p className="text-[9px] font-medium text-white/40">
          {new Date(data[data.length - 1].date).toLocaleDateString("fr-FR", {
            day: "2-digit",
            month: "short",
            year: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}

// ─── Multi-series overlay chart ───────────────────────────────────────────────
// The core problem with overlaying metrics (weight kg, fat %, BMI) is that
// their absolute scales are incompatible — everything flattens on a shared Y axis.
// Solution: normalize all series to % change from their own baseline (first point = 0%).
// Each series becomes a trajectory, not an absolute value — comparable regardless of unit.

// Tooltip for normalized % change view
interface MultiTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; dataKey?: string; color?: string }>;
  label?: string;
}

function MultiTooltip({ active, payload, label }: MultiTooltipProps) {
  if (!active || !payload?.length) return null;
  const dateStr = label
    ? new Date(label).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "";

  return (
    <div
      className="bg-[#0f0f0f] rounded-xl px-3 py-2.5 flex flex-col gap-1.5"
      style={{
        minWidth: 160,
      }}
    >
      <p className="text-[9px] text-white/40 font-medium pb-1.5">{dateStr}</p>
      <div className="mb-1 h-px bg-white/[0.07]" />
      {payload.map((p, i) => {
        const fieldKey =
          typeof p.dataKey === "string" ? p.dataKey.replace("__pct_", "") : "";
        const f = FIELD_MAP[fieldKey];
        if (!f) return null;
        const color = p.color ?? "#1f8a65";

        const pctVal = p.value;
        const isGood =
          pctVal === 0
            ? null
            : NEG_GOOD_FIELDS.includes(fieldKey)
              ? pctVal < 0
              : pctVal > 0;
        return (
          <div key={i} className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-1.5 min-w-0">
              <div
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: color }}
              />
              <span className="text-[9px] text-white/50 truncate">
                {f.label}
              </span>
            </div>
            <div className="text-right shrink-0">
              <span
                className={`text-xs font-bold tabular-nums ${
                  pctVal === 0
                    ? "text-white/50"
                    : isGood
                      ? "text-[#1f8a65]"
                      : "text-red-400"
                }`}
              >
                {pctVal > 0 ? "+" : ""}
                {pctVal.toFixed(1)}%
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Annotations overlay layer — uses Recharts v3 hooks to get correct pixel coords ──
function AnnotationsLayer({
  annotations,
  phases,
  onHover,
  onLeave,
  onClick,
}: {
  annotations: MetricAnnotation[];
  phases: TrainingPhase[];
  onHover: (ann: MetricAnnotation, x: number, y: number) => void;
  onLeave: () => void;
  onClick?: (id: string) => void;
}) {
  const xScale = useXAxisScale();
  const offset = useOffset();
  const plotArea = usePlotArea();
  if (!xScale || !offset || !plotArea) return null;
  const chartTop = offset.top ?? 8;
  const chartHeight = plotArea.height ?? 300;

  return (
    <g>
      {/* Phase lines */}
      {phases.map((phase) => {
        const px = xScale(phase.date_start as never);
        if (typeof px !== "number" || isNaN(px)) return null;
        const c = PHASE_COLORS[phase.phase_type];
        return (
          <g key={phase.id}>
            <line
              x1={px} y1={chartTop}
              x2={px} y2={chartTop + chartHeight}
              stroke={c.text}
              strokeOpacity={phase.date_end ? 0.5 : 0.35}
              strokeWidth={1.5}
              strokeDasharray="4 2"
            />
            <text
              x={px + 4}
              y={chartTop + 12}
              fontSize={9}
              fill={c.text}
              style={{ pointerEvents: "none", userSelect: "none" }}
            >
              {phase.label}
            </text>
          </g>
        );
      })}
      {/* Annotation icons */}
      {annotations.map((ann, annIdx) => {
        const px = xScale(ann.event_date as never);
        if (typeof px !== "number" || isNaN(px)) return null;
        const stackIndex = annotations.slice(0, annIdx).filter((a) => a.event_date === ann.event_date).length;
        const emoji = ANNOTATION_ICONS[ann.event_type] ?? "📌";
        const yOffset = stackIndex * 26;
        const cy = chartTop + 14 + yOffset;
        return (
          <g
            key={ann.id}
            onMouseEnter={(e) => {
              const rect = (e.currentTarget as SVGGElement).getBoundingClientRect();
              onHover(ann, rect.left + rect.width / 2, rect.top);
            }}
            onMouseLeave={onLeave}
            onClick={(e) => { e.stopPropagation(); onClick?.(ann.id); }}
            style={{ cursor: "pointer" }}
          >
            <line
              x1={px} y1={chartTop}
              x2={px} y2={chartTop + chartHeight}
              stroke="rgba(255,255,255,0.20)"
              strokeWidth={1}
              strokeDasharray="2 3"
            />
            <circle cx={px} cy={cy} r={16} fill="transparent" />
            <circle cx={px} cy={cy} r={11} fill="rgba(18,18,18,0.92)" stroke="rgba(255,255,255,0.18)" strokeWidth={0.5} />
            <foreignObject
              x={px - 11}
              y={cy - 11}
              width={22}
              height={22}
              style={{ pointerEvents: "none", userSelect: "none", overflow: "visible" }}
            >
              <div
                style={{
                  width: 22,
                  height: 22,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  lineHeight: 1,
                }}
              >
                {emoji}
              </div>
            </foreignObject>
          </g>
        );
      })}
    </g>
  );
}

// ─── Annotation label for ReferenceLine — captures hover events ──────────────
function AnnotationLabelContent({
  viewBox,
  ann,
  onHover,
  onLeave,
  onClick,
  stackIndex = 0,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  viewBox?: any;
  ann: MetricAnnotation;
  onHover: (ann: MetricAnnotation, x: number, y: number) => void;
  onLeave: () => void;
  onClick?: (id: string) => void;
  stackIndex?: number;
}) {
  if (!viewBox) return null;
  // In Recharts v3, viewBox for a vertical ReferenceLine is the chart area:
  // { x: leftOffset, y: topOffset, width: chartWidth, height: chartHeight }
  // The line's pixel x-coordinate is viewBox.x (for leftmost) but actually
  // Recharts passes the line's computed x in viewBox.x for vertical lines.
  const lineX = typeof viewBox.x === "number" ? viewBox.x : 0;
  const chartTop = typeof viewBox.y === "number" ? viewBox.y : 8;
  if (isNaN(lineX)) return null;
  const emoji = ANNOTATION_ICONS[ann.event_type] ?? "📌";
  // Stack icons vertically when multiple annotations share the same date
  const yOffset = stackIndex * 26;
  const cx = lineX;
  const cy = chartTop + 14 + yOffset;
  return (
    <g
      onMouseEnter={(e) => {
        const rect = (e.currentTarget as SVGGElement).getBoundingClientRect();
        onHover(ann, rect.left + rect.width / 2, rect.top);
      }}
      onMouseLeave={onLeave}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(ann.id);
      }}
      style={{ cursor: "pointer" }}
    >
      <circle cx={cx} cy={cy} r={16} fill="transparent" />
      <circle cx={cx} cy={cy} r={11} fill="rgba(20,20,20,0.90)" stroke="rgba(255,255,255,0.18)" strokeWidth={0.5} />
      <text
        x={cx}
        y={cy + 5}
        textAnchor="middle"
        fontSize={12}
        style={{ userSelect: "none", pointerEvents: "none" }}
      >
        {emoji}
      </text>
    </g>
  );
}

function MultiSeriesChart({
  selectedMetrics,
  series,
  rows,
  clientId,
  clientGender,
  phases,
  annotations,
  onPhasesChange,
  onAnnotationsChange,
  onAnnotationClick,
  timeRangeDays,
  setTimeRangeDays,
}: {
  selectedMetrics: string[];
  series: MetricSeries;
  rows: MetricRow[];
  clientId: string;
  clientGender?: string | null;
  phases: TrainingPhase[];
  annotations: MetricAnnotation[];
  onPhasesChange: (phases: TrainingPhase[]) => void;
  onAnnotationsChange: (annotations: MetricAnnotation[]) => void;
  onAnnotationClick?: (id: string) => void;
  timeRangeDays: TimeRangeDays;
  setTimeRangeDays: React.Dispatch<React.SetStateAction<TimeRangeDays>>;
}) {
  // ── Feature 1: Cross-group mixing — all metrics with data are available ──
  const allMetricsWithData = FIELDS.filter(
    (f) => (series[f.key]?.length ?? 0) > 0,
  ).map((f) => f.key);
  const [visibleSeries, setVisibleSeries] = useState<Set<string>>(
    () =>
      new Set(
        OVERLAY_GROUPS[0].metrics.filter((m) => (series[m]?.length ?? 0) > 0),
      ),
  );

  const [chartHeight, setChartHeight] = useState(300);
  const chartHeightRef = useRef(300);
  const chartDivRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // ── Fermer plein écran avec Escape ──
  useEffect(() => {
    if (!isFullscreen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isFullscreen]);

  // ── Interpretation panel toggle (default collapsed) ──
  const [showInterpretation, setShowInterpretation] = useState(false);

  // ── Context menu state ──
  // Step "choose" is skipped — annotation form is the default entry
  type ContextStep = "choose" | "phase" | "annotation";
  interface ContextMenu {
    x: number;
    y: number;
    dateStart: string;
    dateEnd: string | null;
    isRange: boolean;
    editingId?: string; // if set, we're editing an existing item
    editingType?: "phase" | "annotation"; // which type is being edited
  }
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [contextStep, setContextStep] = useState<ContextStep>("annotation");
  const [ctxPhaseForm, setCtxPhaseForm] = useState<{
    label: string;
    phase_type: PhaseType;
    date_start: string;
    date_end: string;
    notes: string;
  }>({
    label: "",
    phase_type: "bulk",
    date_start: "",
    date_end: "",
    notes: "",
  });
  // Unified annotation form — all types now have body
  const [ctxAnnForm, setCtxAnnForm] = useState<{
    label: string;
    event_type: AnnotationType;
    event_date: string;
    body: string;
  }>({ label: "", event_type: "note", event_date: "", body: "" });

  // ── Legend focus (isolate a single curve) ──
  const [focusedMetric, setFocusedMetric] = useState<string | null>(null);

  // ── Annotation hover tooltip ──
  const [hoveredAnnotation, setHoveredAnnotation] = useState<{
    ann: MetricAnnotation;
    screenX: number;
    screenY: number;
  } | null>(null);

  // ── Drag-range state for phase selection ──
  const [dragState, setDragState] = useState<{
    startDate: string;
    currentDate: string;
  } | null>(null);

  // ── Flag: annotation icon was just clicked — ignore next chart mouseUp ──
  const annotationClickedRef = useRef(false);

  // ── Saving state ──
  const [savingPhase, setSavingPhase] = useState(false);
  const [savingAnnotation, setSavingAnnotation] = useState(false);
  const [annotationError, setAnnotationError] = useState<string | null>(null);

  // ── Feature 4: Delta on filtered window ──
  // series is already filtered by the parent (filteredSeries) so baseline = first point of filtered window

  const baselineValues = useMemo(() => {
    const b: Record<string, number> = {};
    selectedMetrics.forEach((k) => {
      const s = series[k] ?? [];
      if (s.length > 0) b[k] = s[0].value;
    });
    return b;
  }, [selectedMetrics, series]);

  const dates = useMemo(() => {
    const dateSet = new Set<string>();
    selectedMetrics.forEach((k) => {
      (series[k] ?? []).forEach((d) => dateSet.add(d.date));
    });
    return Array.from(dateSet).sort();
  }, [selectedMetrics, series]);

  const lastDataDate = dates.length > 0 ? dates[dates.length - 1] : undefined;

  const merged = useMemo(() => {
    // Inject all annotation/phase dates so xScale can position them,
    // but XAxis domain will be clamped to lastDataDate to prevent extra ticks
    const annotationDates = [
      ...annotations.map((a) => a.event_date),
      ...phases.map((p) => p.date_start),
    ].filter((d) => !dates.includes(d));
    const allDates = [...dates, ...annotationDates].sort();

    return allDates.map((date) => {
      const row: Record<string, number | string> = { date };
      selectedMetrics.forEach((k) => {
        const point = (series[k] ?? []).find((d) => d.date === date);
        if (point) {
          const baseline = baselineValues[k];
          if (baseline !== undefined && baseline !== 0) {
            row[`__pct_${k}`] =
              ((point.value - baseline) / Math.abs(baseline)) * 100;
          }
          // baseline === 0: leave key absent (null) — avoids division by zero and phantom zero points
        }
        // no point: leave key absent so connectNulls bridges over phantom dates
      });
      return row;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dates.join(","), selectedMetrics.join(","), baselineValues, annotations, phases]);

  const deltas = useMemo(() => {
    const d: Record<string, number | null> = {};
    // Cover all metrics with data, not just selectedMetrics — visibleSeries can include any
    allMetricsWithData.forEach((k) => {
      const s = series[k] ?? [];
      if (s.length < 2) {
        d[k] = null;
        return;
      }
      const baseline = s[0].value;
      const last = s[s.length - 1].value;
      d[k] =
        baseline !== 0 ? ((last - baseline) / Math.abs(baseline)) * 100 : null;
    });
    return d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allMetricsWithData.join(","), series]);

  // ── Feature 3: Plateau detection per visible metric ──
  const plateausByMetric = useMemo(() => {
    const result: Record<string, ReturnType<typeof detectPlateaus>> = {};
    selectedMetrics.forEach((k) => {
      if (visibleSeries.has(k)) {
        result[k] = detectPlateaus(series[k] ?? [], k);
      }
    });
    return result;
  }, [selectedMetrics, series, visibleSeries]);

  const metricsWithPlateau = Object.entries(plateausByMetric)
    .filter(([, p]) => p.length > 0)
    .map(([k]) => k);

  // ── Feature 6: Single-metric absolute mode for norm zones ──
  const singleVisibleMetric =
    visibleSeries.size === 1 ? Array.from(visibleSeries)[0] : null;
  const normZoneEntry = singleVisibleMetric
    ? NORM_ZONES[singleVisibleMetric]
    : null;
  const gender = clientGender?.toLowerCase();
  const activeNormZones: NormZone[] | undefined = normZoneEntry
    ? (normZoneEntry.neutral ??
      (gender === "female" || gender === "femme"
        ? normZoneEntry.female
        : normZoneEntry.male))
    : undefined;
  const useAbsoluteAxis = !!(singleVisibleMetric && activeNormZones);

  const absoluteData = useMemo(() => {
    if (!singleVisibleMetric) return [];
    const dataPoints = (series[singleVisibleMetric] ?? []).map((d) => ({
      date: d.date,
      value: d.value,
    }));
    const existingDates = new Set(dataPoints.map((d) => d.date));
    // Inject all annotation/phase dates so xScale can position them
    const extraDates = [
      ...annotations.map((a) => a.event_date),
      ...phases.map((p) => p.date_start),
    ].filter((d) => !existingDates.has(d));
    const combined = [
      ...dataPoints,
      ...extraDates.map((date) => ({ date, value: undefined as unknown as number })),
    ].sort((a, b) => a.date.localeCompare(b.date));

    return combined;
  }, [singleVisibleMetric, series, annotations, phases]);

  const absMin =
    absoluteData.length > 0 ? Math.min(...absoluteData.map((d) => d.value)) : 0;
  const absMax =
    absoluteData.length > 0
      ? Math.max(...absoluteData.map((d) => d.value))
      : 100;
  const absPad = Math.max((absMax - absMin) * 0.15, 1);
  const absDomain: [number, number] = [
    Math.floor(absMin - absPad),
    Math.ceil(absMax + absPad),
  ];

  // Pct mode Y domain
  const dataKeys = selectedMetrics.map((k) => `__pct_${k}`);
  const visibleDataKeys = dataKeys.filter((k) =>
    visibleSeries.has(k.replace("__pct_", "")),
  );
  const allPctVals = merged.flatMap((row) =>
    visibleDataKeys
      .map((k) => row[k] as number)
      .filter((v) => typeof v === "number"),
  );
  const pctMin = allPctVals.length > 0 ? Math.min(...allPctVals) : -5;
  const pctMax = allPctVals.length > 0 ? Math.max(...allPctVals) : 5;
  const pctPad = Math.max((pctMax - pctMin) * 0.15, 1);
  const pctDomain: [number, number] = [
    Math.floor(pctMin - pctPad),
    Math.ceil(pctMax + pctPad),
  ];

  // Active group detection
  const activeGroupKey =
    OVERLAY_GROUPS.find((g) => {
      const withData = g.metrics.filter((m) => (series[m]?.length ?? 0) > 0);
      if (withData.length === 0) return false;
      return (
        withData.every((m) => visibleSeries.has(m)) &&
        visibleSeries.size === withData.length
      );
    })?.key ?? null;
  const activeGroup =
    OVERLAY_GROUPS.find((g) => g.key === activeGroupKey) ?? null;

  const chartConfig = createChartConfig(selectedMetrics);

  // ── Context menu helpers ──
  function openContextMenu(
    e: React.MouseEvent,
    dateStart: string,
    dateEnd: string | null,
  ) {
    const isRange = !!(dateEnd && dateEnd !== dateStart);
    setContextMenu({ x: e.clientX, y: e.clientY, dateStart, dateEnd, isRange });
    // Skip "choose" — go straight to annotation form (most common action)
    setContextStep("annotation");
    setCtxPhaseForm({
      label: "",
      phase_type: "bulk",
      date_start: dateStart,
      date_end: dateEnd ?? "",
      notes: "",
    });
    setCtxAnnForm({ label: "", event_type: "note", event_date: dateStart, body: "" });
  }

  function closeContextMenu() {
    setContextMenu(null);
    setContextStep("annotation");
    setDragState(null);
    setAnnotationError(null);
  }

  function openEditPhase(phase: TrainingPhase, e: React.MouseEvent) {
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      dateStart: phase.date_start,
      dateEnd: phase.date_end ?? null,
      isRange: !!phase.date_end,
      editingId: phase.id,
      editingType: "phase",
    });
    setContextStep("phase");
    setCtxPhaseForm({
      label: phase.label,
      phase_type: phase.phase_type,
      date_start: phase.date_start,
      date_end: phase.date_end ?? "",
      notes: phase.notes ?? "",
    });
  }

  function openEditAnnotation(ann: MetricAnnotation, e: React.MouseEvent) {
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      dateStart: ann.event_date,
      dateEnd: null,
      isRange: false,
      editingId: ann.id,
      editingType: "annotation",
    });
    setContextStep("annotation");
    setCtxAnnForm({
      label: ann.label,
      event_type: ann.event_type,
      event_date: ann.event_date,
      body: ann.body ?? "",
    });
  }

  // ── Phase handlers ──
  async function handleSavePhase(form: typeof ctxPhaseForm) {
    if (!form.label || !form.date_start) return;
    setSavingPhase(true);
    const editingId = contextMenu?.editingId;
    try {
      if (editingId) {
        const res = await fetch(
          `/api/clients/${clientId}/phases/${editingId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              label: form.label,
              phase_type: form.phase_type,
              date_start: form.date_start,
              date_end: form.date_end || null,
              notes: form.notes || null,
            }),
          },
        );
        if (res.ok) {
          const updated = await res.json();
          onPhasesChange(phases.map((p) => (p.id === editingId ? updated : p)));
          closeContextMenu();
        }
      } else {
        const res = await fetch(`/api/clients/${clientId}/phases`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: form.label,
            phase_type: form.phase_type,
            date_start: form.date_start,
            date_end: form.date_end || null,
            notes: form.notes || null,
          }),
        });
        if (res.ok) {
          const newPhase = await res.json();
          onPhasesChange([...phases, newPhase]);
          closeContextMenu();
        }
      }
    } finally {
      setSavingPhase(false);
    }
  }

  async function handleDeletePhase(id: string) {
    await fetch(`/api/clients/${clientId}/phases/${id}`, { method: "DELETE" });
    onPhasesChange(phases.filter((p) => p.id !== id));
  }

  // ── Annotation handlers — unified (all types support body) ──
  async function handleSaveAnnotation(form: typeof ctxAnnForm) {
    if (!form.label || !form.event_date) return;
    setSavingAnnotation(true);
    setAnnotationError(null);
    const editingId = contextMenu?.editingId;
    const payload = {
      label: form.label,
      body: form.body || null,
      event_type: form.event_type,
      event_date: form.event_date,
    };
    try {
      if (editingId) {
        const res = await fetch(
          `/api/clients/${clientId}/annotations/${editingId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
        );
        if (res.ok) {
          const updated = await res.json();
          onAnnotationsChange(
            annotations
              .map((a) => (a.id === editingId ? updated : a))
              .sort((a, b) => a.event_date.localeCompare(b.event_date)),
          );
          closeContextMenu();
        } else {
          const err = await res.json().catch(() => ({}));
          const msg = typeof err?.error === "string" ? err.error : "Erreur lors de la modification.";
          setAnnotationError(msg);
        }
      } else {
        const res = await fetch(`/api/clients/${clientId}/annotations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const newAnnotation = await res.json();
          onAnnotationsChange(
            [...annotations, newAnnotation].sort((a, b) =>
              a.event_date.localeCompare(b.event_date),
            ),
          );
          closeContextMenu();
        } else {
          const err = await res.json().catch(() => ({}));
          setAnnotationError(err?.error ?? "Erreur lors de l'enregistrement.");
        }
      }
    } finally {
      setSavingAnnotation(false);
    }
  }

  async function handleDeleteAnnotation(id: string) {
    await fetch(`/api/clients/${clientId}/annotations/${id}`, {
      method: "DELETE",
    });
    onAnnotationsChange(annotations.filter((a) => a.id !== id));
  }

  // ── Chart click/drag date extraction ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function getDateFromChartEvent(payload: any): string | null {
    if (!payload) return null;
    const activePayload = payload.activePayload ?? payload.activeLabel;
    if (typeof activePayload === "string") return activePayload;
    const label = payload.activeLabel;
    if (typeof label === "string") return label;
    return null;
  }

  const innerContent = (
    <div className="flex flex-col gap-4">
      {/* ── Bloc 1 : Contrôles — groupes + sélection métriques ── */}
      <div className="bg-[#181818] border-subtle rounded-2xl px-5 py-4">
        {/* Description */}
        <div className="mb-4 pb-4 border-b border-white/[0.05]">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[9px] font-bold text-white/30 uppercase tracking-[0.18em]">
              Vue superposée
            </p>
            <button
              onClick={() => setIsFullscreen(true)}
              className="flex items-center justify-center w-6 h-6 rounded-lg bg-white/[0.04] text-white/30 hover:bg-white/[0.08] hover:text-white/60 transition-all"
              title="Plein écran (F)"
            >
              <Maximize2 size={11} />
            </button>
          </div>
          <p className="text-[12px] text-white/55 leading-relaxed">
            {useAbsoluteAxis ? (
              <>
                Axe absolu activé — une seule métrique visible. Les zones de
                référence scientifiques sont affichées.{" "}
                <span className="text-white/80 font-semibold">
                  Sélectionner plusieurs métriques
                </span>{" "}
                pour revenir en mode Δ%.
              </>
            ) : (
              <>
                Compare l&apos;évolution relative de plusieurs métriques. Chaque
                courbe part de{" "}
                <span className="text-white/80 font-semibold">0 %</span> au
                premier point de la période filtrée. Δ calculé sur la{" "}
                <span className="text-[#1f8a65]">
                  fenêtre active uniquement
                </span>
                .
              </>
            )}
          </p>
        </div>

        {/* ── Feature 3: Plateau alerts — compact collapsible ── */}
        {metricsWithPlateau.length > 0 && (
          <details className="mb-4 group rounded-xl bg-amber-500/[0.07] overflow-hidden">
            <summary className="flex items-center gap-2 px-4 py-2.5 cursor-pointer list-none select-none">
              <span className="text-amber-400 text-[12px]">⚡</span>
              <p className="text-[11px] font-bold text-amber-400 flex-1">
                Plateau détecté ·{" "}
                <span className="font-normal text-amber-400/70">
                  {metricsWithPlateau
                    .map((k) => FIELD_MAP[k]?.label ?? k)
                    .join(", ")}
                </span>
              </p>
              <ChevronDown
                size={12}
                className="text-amber-400/60 transition-transform group-open:rotate-180"
              />
            </summary>
            <div className="px-4 pb-3 pt-1">
              <p className="text-[11px] text-white/45 leading-relaxed">
                Variation insuffisante selon les seuils evidence-based
                (Schoenfeld 2010, Helms 2014). Un ajustement du protocole
                d&apos;entraînement ou nutritionnel est recommandé.
              </p>
            </div>
          </details>
        )}

        {/* ── Groupes ── */}
        <div className="mb-4">
          <p className="text-[9px] font-bold text-white/30 uppercase tracking-[0.18em] mb-2">
            Groupes
          </p>
          <div className="flex flex-wrap gap-2 mb-3">
            {OVERLAY_GROUPS.map((group) => {
              const withData = group.metrics.filter(
                (m) => (series[m]?.length ?? 0) > 0,
              );
              const isActive = activeGroupKey === group.key;
              const hasData = withData.length > 0;
              return (
                <button
                  key={group.key}
                  disabled={!hasData}
                  onClick={() => {
                    setVisibleSeries(new Set(withData));
                    setShowInterpretation(false);
                  }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                    isActive
                      ? "bg-[#1f8a65]/20 text-white border-[0.3px] border-[#1f8a65]/40"
                      : hasData
                        ? "bg-white/[0.04] text-white/55 hover:bg-white/[0.08] hover:text-white border-[0.3px] border-white/[0.06]"
                        : "bg-white/[0.02] text-white/15 cursor-not-allowed border-[0.3px] border-white/[0.04]"
                  }`}
                >
                  {/* Micro-palette : 3 premiers points colorés du groupe */}
                  <span className="flex items-center gap-0.5 shrink-0">
                    {group.metrics.slice(0, 3).map((m) => (
                      <span
                        key={m}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{
                          backgroundColor: getMetricColor(m),
                          opacity: isActive ? 1 : hasData ? 0.5 : 0.2,
                        }}
                      />
                    ))}
                  </span>
                  {group.label}
                </button>
              );
            })}
          </div>
          {activeGroup && (
            <div className="rounded-xl bg-white/[0.03] px-4 py-3">
              <button
                onClick={() => setShowInterpretation((v) => !v)}
                className="flex items-center justify-between w-full"
              >
                <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.12em]">
                  Comment interpréter
                </p>
                {showInterpretation ? (
                  <ChevronUp size={13} className="text-white/30" />
                ) : (
                  <ChevronDown size={13} className="text-white/30" />
                )}
              </button>
              {showInterpretation && (
                <p className="text-[12px] text-white/55 leading-relaxed mt-2">
                  {activeGroup.interpretation}
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── Feature 1: All metrics — cross-group mixing ── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[9px] font-bold text-white/30 uppercase tracking-[0.18em]">
              Métriques
            </p>
            <div className="flex items-center gap-1 bg-[#181818] border-subtle rounded-xl p-1">
              <button
                type="button"
                aria-pressed={
                  visibleSeries.size === allMetricsWithData.length &&
                  allMetricsWithData.length > 0
                }
                onClick={() => setVisibleSeries(new Set(allMetricsWithData))}
                className={`flex items-center justify-center px-3 py-1.5 rounded-lg transition-all text-[11px] font-semibold ${
                  visibleSeries.size === allMetricsWithData.length &&
                  allMetricsWithData.length > 0
                    ? "bg-[#1f8a65] text-white"
                    : "text-white/60 hover:bg-white/[0.08] hover:text-white"
                }`}
              >
                Tout
              </button>
              <button
                type="button"
                aria-pressed={visibleSeries.size === 0}
                onClick={() => setVisibleSeries(new Set())}
                className={`flex items-center justify-center px-3 py-1.5 rounded-lg transition-all text-[11px] font-semibold ${
                  visibleSeries.size === 0
                    ? "bg-[#1f8a65] text-white"
                    : "text-white/60 hover:bg-white/[0.08] hover:text-white"
                }`}
              >
                Aucun
              </button>
            </div>
          </div>
          {(["composition", "measurements", "wellness"] as const).map((cat) => {
            const catFields = FIELDS.filter(
              (f) => f.category === cat && allMetricsWithData.includes(f.key),
            );
            if (catFields.length === 0) return null;
            const catLabels: Record<string, string> = {
              composition: "Composition",
              measurements: "Mensurations",
              wellness: "Bien-être",
            };
            return (
              <div key={cat} className="mb-2">
                <p className="text-[9px] font-bold text-white/25 uppercase tracking-[0.18em] mb-1.5">
                  {catLabels[cat]}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {catFields.map((f) => {
                    const color = getMetricColor(f.key);
                    const isVisible = visibleSeries.has(f.key);
                    const hasPlateau =
                      (plateausByMetric[f.key]?.length ?? 0) > 0;
                    return (
                      <button
                        key={f.key}
                        onClick={() => {
                          const newSet = new Set(visibleSeries);
                          if (isVisible) newSet.delete(f.key);
                          else newSet.add(f.key);
                          setVisibleSeries(newSet);
                        }}
                        className="relative flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all"
                        style={
                          isVisible
                            ? { backgroundColor: `${color}22`, color }
                            : {
                                backgroundColor: "rgba(255,255,255,0.04)",
                                color: "rgba(255,255,255,0.35)",
                              }
                        }
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0 transition-opacity"
                          style={{
                            backgroundColor: color,
                            opacity: isVisible ? 1 : 0.35,
                          }}
                        />
                        {f.label}
                        {hasPlateau && isVisible && (
                          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <TimeRangeSlider
        timeRangeDays={timeRangeDays}
        setTimeRangeDays={setTimeRangeDays}
      />

      {/* ── Bloc 2 : Graphique ── */}
      <div className="bg-[#181818] border-subtle rounded-2xl overflow-hidden flex flex-col">
        {/* ── Header barre actions ── */}
        <div className="flex items-center justify-between px-4 h-11 border-b border-white/[0.06] shrink-0">
          <p className="text-[10px] text-white/30 leading-none">
            Cliquez sur le graphique pour ancrer une note à une date précise
          </p>
          <button
            onClick={(e) => {
              e.stopPropagation();
              const today = new Date().toISOString().split("T")[0];
              openContextMenu(e, today, null);
            }}
            className="flex items-center gap-2 px-3 h-7 rounded-lg bg-white/[0.05] border-[0.3px] border-white/[0.08] hover:bg-white/[0.09] hover:border-white/[0.16] active:scale-[0.97] transition-all"
          >
            <PenLine size={12} className="text-[#1f8a65]" />
            <span className="text-[10px] font-bold text-white/70 uppercase tracking-[0.10em]">
              Ajouter une note
            </span>
          </button>
        </div>

        {/* ── Zone graphique ── */}
        <div
          ref={chartDivRef}
          className="relative"
          style={{ height: chartHeight }}
        >
        {/* ── Chart empty state ── */}
        {visibleSeries.size > 0 && merged.length === 0 && !useAbsoluteAxis && (
          <div className="mx-5 mt-5 mb-5 rounded-xl bg-white/[0.03] px-5 py-6 text-center">
            <p className="text-[12px] font-semibold text-white/40 mb-1">
              Aucune donnée pour ce groupe
            </p>
            <p className="text-[11px] text-white/25">
              Ces métriques n&apos;ont pas encore été saisies. Importez un CSV
              ou ajoutez une mesure.
            </p>
          </div>
        )}

        <div className="absolute inset-0 px-1 pt-1 pb-8">

          <ChartContainer
            config={chartConfig}
            className="w-full [&_svg]:overflow-visible"
            style={{ height: "100%" }}
          >
            {useAbsoluteAxis ? (
              <LineChart
                data={absoluteData}
                margin={{ top: 8, right: 32, bottom: 4, left: 4 }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onMouseDown={(payload: any, e: any) => {
                  const date = getDateFromChartEvent(payload);
                  if (date)
                    setDragState({ startDate: date, currentDate: date });
                  void e;
                }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onMouseMove={(payload: any) => {
                  if (!dragState) return;
                  const date = getDateFromChartEvent(payload);
                  if (date && date !== dragState.currentDate)
                    setDragState((d) =>
                      d ? { ...d, currentDate: date } : null,
                    );
                }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onMouseUp={(payload: any, e: any) => {
                  if (annotationClickedRef.current) {
                    annotationClickedRef.current = false;
                    setDragState(null);
                    return;
                  }
                  if (!dragState) return;
                  const date =
                    getDateFromChartEvent(payload) ?? dragState.startDate;
                  const [d1, d2] = [dragState.startDate, date].sort();
                  setDragState(null);
                  openContextMenu(
                    e as React.MouseEvent,
                    d1,
                    d1 === d2 ? null : d2,
                  );
                }}
                style={{ cursor: "crosshair" }}
              >
                <CartesianGrid
                  vertical={false}
                  stroke="rgba(255,255,255,0.06)"
                />
                {activeNormZones?.map((z) => (
                  <ReferenceLine
                    key={`nmin-${z.label}`}
                    y={z.min}
                    stroke={z.color.replace(/[\d.]+\)$/, "0.35)")}
                    strokeDasharray="3 3"
                    strokeWidth={1}
                  />
                ))}
                {activeNormZones?.map((z) => (
                  <ReferenceLine
                    key={`nmax-${z.label}`}
                    y={z.max}
                    stroke={z.color.replace(/[\d.]+\)$/, "0.35)")}
                    strokeDasharray="3 3"
                    strokeWidth={1}
                  />
                ))}
                {dragState && dragState.currentDate !== dragState.startDate && (
                  <ReferenceLine
                    x={dragState.currentDate}
                    stroke="rgba(255,255,255,0.40)"
                    strokeWidth={1}
                    strokeDasharray="4 3"
                  />
                )}
                <XAxis
                  dataKey="date"
                  tick={{
                    fontSize: 10,
                    fill: "rgba(255,255,255,0.30)",
                    fontWeight: 600,
                  }}
                  axisLine={false}
                  tickLine={false}
                  tickCount={6}
                  domain={lastDataDate ? [absoluteData[0]?.date, lastDataDate] : undefined}
                  tickFormatter={(d) =>
                    new Date(d).toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })
                  }
                />
                <YAxis
                  tick={{
                    fontSize: 10,
                    fill: "rgba(255,255,255,0.30)",
                    fontWeight: 600,
                  }}
                  axisLine={false}
                  tickLine={false}
                  width={42}
                  domain={absDomain}
                  tickFormatter={(v) =>
                    `${v}${FIELD_MAP[singleVisibleMetric!]?.unit ? " " + FIELD_MAP[singleVisibleMetric!]!.unit : ""}`
                  }
                />
                <ChartTooltip
                  content={
                    <CustomTooltip
                      unit={FIELD_MAP[singleVisibleMetric!]?.unit}
                      fieldLabel={FIELD_MAP[singleVisibleMetric!]?.label}
                      accentColor={getMetricColor(singleVisibleMetric!)}
                    />
                  }
                  cursor={{
                    stroke: "rgba(255,255,255,0.15)",
                    strokeWidth: 1,
                    strokeDasharray: "4 3",
                  }}
                />
                <AnnotationsLayer
                  annotations={annotations}
                  phases={phases}
                  onHover={(a, sx, sy) => setHoveredAnnotation({ ann: a, screenX: sx, screenY: sy })}
                  onLeave={() => setHoveredAnnotation(null)}
                  onClick={(id) => { annotationClickedRef.current = true; onAnnotationClick?.(id); }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={getMetricColor(singleVisibleMetric!)}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                  activeDot={{ r: 4, style: { cursor: "pointer" } }}
                  isAnimationActive
                  animationDuration={500}
                />
              </LineChart>
            ) : (
              <LineChart
                data={merged}
                margin={{ top: 8, right: 32, bottom: 4, left: 4 }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onMouseDown={(payload: any, e: any) => {
                  const date = getDateFromChartEvent(payload);
                  if (date)
                    setDragState({ startDate: date, currentDate: date });
                  void e;
                }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onMouseMove={(payload: any) => {
                  if (!dragState) return;
                  const date = getDateFromChartEvent(payload);
                  if (date && date !== dragState.currentDate)
                    setDragState((d) =>
                      d ? { ...d, currentDate: date } : null,
                    );
                }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onMouseUp={(payload: any, e: any) => {
                  if (annotationClickedRef.current) {
                    annotationClickedRef.current = false;
                    setDragState(null);
                    return;
                  }
                  if (!dragState) return;
                  const date =
                    getDateFromChartEvent(payload) ?? dragState.startDate;
                  const [d1, d2] = [dragState.startDate, date].sort();
                  setDragState(null);
                  openContextMenu(
                    e as React.MouseEvent,
                    d1,
                    d1 === d2 ? null : d2,
                  );
                }}
                style={{ cursor: "crosshair" }}
              >
                <CartesianGrid
                  vertical={false}
                  stroke="rgba(255,255,255,0.06)"
                />
                <ReferenceLine
                  y={0}
                  stroke="rgba(255,255,255,0.20)"
                  strokeWidth={1}
                />
                {dragState && dragState.currentDate !== dragState.startDate && (
                  <ReferenceLine
                    x={dragState.currentDate}
                    stroke="rgba(255,255,255,0.40)"
                    strokeWidth={1}
                    strokeDasharray="4 3"
                  />
                )}
                <XAxis
                  dataKey="date"
                  tick={{
                    fontSize: 10,
                    fill: "rgba(255,255,255,0.30)",
                    fontWeight: 600,
                  }}
                  axisLine={false}
                  tickLine={false}
                  tickCount={6}
                  domain={lastDataDate ? [dates[0], lastDataDate] : undefined}
                  tickFormatter={(d) =>
                    new Date(d).toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })
                  }
                />
                <YAxis
                  tick={{
                    fontSize: 10,
                    fill: "rgba(255,255,255,0.30)",
                    fontWeight: 600,
                  }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                  domain={pctDomain}
                  tickFormatter={(v) => `${v > 0 ? "+" : ""}${v.toFixed(0)}%`}
                />
                <ChartTooltip
                  content={<MultiTooltip />}
                  cursor={{
                    stroke: "rgba(255,255,255,0.15)",
                    strokeWidth: 1,
                    strokeDasharray: "4 3",
                  }}
                />
                <AnnotationsLayer
                  annotations={annotations}
                  phases={phases}
                  onHover={(a, sx, sy) => setHoveredAnnotation({ ann: a, screenX: sx, screenY: sy })}
                  onLeave={() => setHoveredAnnotation(null)}
                  onClick={(id) => { annotationClickedRef.current = true; onAnnotationClick?.(id); }}
                />
                {selectedMetrics.map((k) => {
                  if (!visibleSeries.has(k)) return null;
                  const color = getMetricColor(k);
                  const metricPlateaus = plateausByMetric[k] ?? [];
                  const plateauDateSet = new Set(
                    metricPlateaus.flatMap((p) => {
                      const start = dates.indexOf(p.startDate);
                      const end = dates.indexOf(p.endDate);
                      return dates.slice(Math.max(0, start), end + 1);
                    }),
                  );
                  const isFocused =
                    focusedMetric === null || focusedMetric === k;
                  return (
                    <Line
                      key={k}
                      type="monotone"
                      dataKey={`__pct_${k}`}
                      stroke={color}
                      strokeWidth={
                        isFocused ? (focusedMetric === k ? 3 : 2) : 2
                      }
                      strokeOpacity={isFocused ? 1 : 0.12}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      dot={(dotProps: any) => {
                        const date = dates[dotProps.index];
                        if (!plateauDateSet.has(date))
                          return <g key={dotProps.index} />;
                        return (
                          <circle
                            key={dotProps.index}
                            cx={dotProps.cx}
                            cy={dotProps.cy}
                            r={2.5}
                            fill="rgba(251,191,36,0.9)"
                            stroke="none"
                          />
                        );
                      }}
                      connectNulls
                      activeDot={{ r: 4, style: { cursor: "pointer" } }}
                      isAnimationActive
                      animationDuration={500}
                    />
                  );
                })}
              </LineChart>
            )}
          </ChartContainer>
        </div>
        {/* absolute inset chart */}

        {/* Footer dates — ancré en bas du bloc */}
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-2 pt-1 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[9px] text-white/20 font-medium">
            {(
              useAbsoluteAxis
                ? absoluteData[0]?.date
                : (merged[0]?.date as string)
            )
              ? new Date(
                  useAbsoluteAxis
                    ? absoluteData[0]?.date
                    : (merged[0]?.date as string),
                ).toLocaleDateString("fr-FR", {
                  day: "2-digit",
                  month: "short",
                  year: "2-digit",
                })
              : ""}
          </p>
          <div className="flex-1 h-px bg-white/[0.08]" />
          <p className="text-[9px] text-white/20 font-medium">
            {(
              useAbsoluteAxis
                ? absoluteData[absoluteData.length - 1]?.date
                : (merged[merged.length - 1]?.date as string)
            )
              ? new Date(
                  useAbsoluteAxis
                    ? absoluteData[absoluteData.length - 1]?.date
                    : (merged[merged.length - 1]?.date as string),
                ).toLocaleDateString("fr-FR", {
                  day: "2-digit",
                  month: "short",
                  year: "2-digit",
                })
              : ""}
          </p>
        </div>

        {/* ── Drag handle — ligne épaisse collée au bord bas du bloc ── */}
        <div
          onMouseDown={(e) => {
            e.preventDefault();
            const startY = e.clientY;
            const startH = chartHeightRef.current;
            const el = chartDivRef.current;

            const onMove = (ev: MouseEvent) => {
              const next = Math.max(160, Math.min(700, startH + ev.clientY - startY));
              chartHeightRef.current = next;
              if (el) el.style.height = `${next}px`;
            };
            const onUp = () => {
              setChartHeight(chartHeightRef.current);
              window.removeEventListener("mousemove", onMove);
              window.removeEventListener("mouseup", onUp);
            };
            window.addEventListener("mousemove", onMove);
            window.addEventListener("mouseup", onUp);
          }}
          className="absolute bottom-0 left-0 right-0 h-[10px] cursor-row-resize group flex items-end"
        >
          <div className="w-full h-[3px] bg-white/[0.08] group-hover:bg-[#1f8a65]/60 group-active:bg-[#1f8a65] transition-colors duration-150" />
        </div>
        </div>{/* end zone graphique */}
      </div>
      {/* end Bloc 2: Graphique */}


      {/* ── Bloc 3 : Légende Δ% + zones normatives ── */}
      {(visibleSeries.size > 0 || (useAbsoluteAxis && activeNormZones)) && (
        <div className="bg-[#181818] border-subtle rounded-2xl px-5 py-4">
          {/* Feature 4: Delta legend on filtered window */}
          {visibleSeries.size > 0 && (
            <div
              className={`flex flex-wrap gap-2 ${useAbsoluteAxis && activeNormZones ? "mb-4 pb-4 border-b border-white/[0.05]" : ""}`}
            >
              {Array.from(visibleSeries).map((k) => {
                const f = FIELD_MAP[k];
                const delta = deltas[k];
                const color = getMetricColor(k);
                const isNegGood = NEG_GOOD_FIELDS.includes(k);
                if (!f) return null;
                return (
                  <button
                    key={k}
                    onClick={() =>
                      setFocusedMetric(focusedMetric === k ? null : k)
                    }
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                      focusedMetric === k
                        ? "bg-white/[0.08] ring-1 ring-white/[0.12]"
                        : focusedMetric !== null
                          ? "bg-white/[0.015] opacity-40"
                          : "bg-white/[0.03] hover:bg-white/[0.06]"
                    }`}
                    title={
                      focusedMetric === k
                        ? "Cliquez pour afficher toutes les courbes"
                        : "Cliquez pour isoler cette courbe"
                    }
                  >
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: color }}
                    />
                    <span className="text-[10px] text-white/55 font-medium">
                      {f.label}
                    </span>
                    {delta != null &&
                      (() => {
                        const isGood = isNegGood ? delta < 0 : delta > 0;
                        const colorClass =
                          delta === 0
                            ? "text-white/30"
                            : isGood
                              ? "text-[#1f8a65]"
                              : "text-red-400";
                        const Arrow =
                          delta > 0
                            ? TrendingUp
                            : delta < 0
                              ? TrendingDown
                              : Minus;
                        return (
                          <span
                            className={`flex items-center gap-0.5 text-[10px] font-bold tabular-nums ${colorClass}`}
                          >
                            <Arrow size={10} strokeWidth={2.5} />
                            {delta > 0 ? "+" : ""}
                            {delta.toFixed(1)}%
                          </span>
                        );
                      })()}
                    {(plateausByMetric[k]?.length ?? 0) > 0 && (
                      <span className="flex items-center gap-0.5 text-[9px] font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded-md">
                        ⚡ PLATEAU
                      </span>
                    )}
                  </button>
                );
              })}
              {focusedMetric !== null && (
                <button
                  onClick={() => setFocusedMetric(null)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold text-white/35 hover:text-white/60 bg-white/[0.02] hover:bg-white/[0.05] transition-all"
                >
                  <X size={9} />
                  Tout afficher
                </button>
              )}
            </div>
          )}

          {/* Feature 6: Norm zones legend (single-metric absolute mode) */}
          {useAbsoluteAxis && activeNormZones && (
            <div>
              <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.12em] mb-2">
                Zones de référence — {FIELD_MAP[singleVisibleMetric!]?.label}
              </p>
              <div className="flex flex-wrap gap-2 mb-1">
                {activeNormZones.map((z) => (
                  <div key={z.label} className="flex items-center gap-1.5">
                    <div
                      className="w-2.5 h-2.5 rounded-sm"
                      style={{
                        background: z.color.replace(/[\d.]+\)$/, "0.7)"),
                      }}
                    />
                    <span className="text-[10px] text-white/50">
                      {z.label}{" "}
                      <span className="text-white/25">
                        {z.min}–{z.max} {FIELD_MAP[singleVisibleMetric!]?.unit}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[9px] text-white/25">
                Sources : ACSM, WHO, ACE Body Fat Standards
              </p>
            </div>
          )}
        </div>
      )}

      {contextMenu && (
        <>
          {/* backdrop */}
          <div className="fixed inset-0 z-40" onClick={closeContextMenu} />
          <div
            className="fixed z-50 w-[290px] rounded-xl bg-[#181818] border border-white/[0.08] shadow-2xl p-3 flex flex-col gap-2"
            style={{
              top: Math.min(contextMenu.y, window.innerHeight - 400),
              left: Math.min(Math.max(8, contextMenu.x - 145), window.innerWidth - 298),
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-0.5">
              <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.12em]">
                {contextMenu.editingId
                  ? contextMenu.editingType === "phase"
                    ? "Modifier la phase"
                    : "Modifier l'annotation"
                  : contextMenu.isRange
                    ? `${formatDate(contextMenu.dateStart)} → ${contextMenu.dateEnd ? formatDate(contextMenu.dateEnd) : "…"}`
                    : formatDate(contextMenu.dateStart)}
              </p>
              <button
                onClick={closeContextMenu}
                className="text-white/20 hover:text-white/60 transition-colors"
              >
                <X size={12} />
              </button>
            </div>

            {/* Toggle: annotation ↔ phase (only when creating, not editing) */}
            {!contextMenu.editingId && (
              <div className="flex items-center gap-1 bg-white/[0.04] rounded-lg p-0.5 mb-1">
                <button
                  onClick={() => setContextStep("annotation")}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[10px] font-semibold transition-all ${
                    contextStep === "annotation"
                      ? "bg-[#1f8a65] text-white"
                      : "text-white/40 hover:text-white/70"
                  }`}
                >
                  <span>📌</span> Note / Événement
                </button>
                <button
                  onClick={() => setContextStep("phase")}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[10px] font-semibold transition-all ${
                    contextStep === "phase"
                      ? "bg-white/[0.10] text-white"
                      : "text-white/40 hover:text-white/70"
                  }`}
                >
                  <span>🏋️</span> Phase
                </button>
              </div>
            )}

            {/* ── Annotation form (unified — all types) ── */}
            {contextStep === "annotation" && (
              <div className="flex flex-col gap-2">
                {/* Type chips */}
                <div>
                  <label className="text-[9px] font-bold uppercase tracking-wide text-white/35 block mb-1.5">
                    Type
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {(Object.keys(ANNOTATION_ICONS) as AnnotationType[]).map((t) => (
                      <button
                        key={t}
                        onClick={() => setCtxAnnForm((p) => ({ ...p, event_type: t }))}
                        className={`flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-semibold transition-all ${
                          ctxAnnForm.event_type === t
                            ? "bg-[#1f8a65] text-white"
                            : "bg-white/[0.05] text-white/40 hover:bg-white/[0.09] hover:text-white/70"
                        }`}
                      >
                        <span>{ANNOTATION_ICONS[t]}</span>
                        <span>{ANNOTATION_LABELS[t]}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="text-[9px] font-bold uppercase tracking-wide text-white/35 block mb-1">
                    Titre
                  </label>
                  <input
                    autoFocus
                    value={ctxAnnForm.label}
                    onChange={(e) => setCtxAnnForm((p) => ({ ...p, label: e.target.value }))}
                    placeholder={
                      ctxAnnForm.event_type === "program_change" ? "ex: Nouveau programme push/pull"
                      : ctxAnnForm.event_type === "injury" ? "ex: Douleur épaule droite"
                      : ctxAnnForm.event_type === "nutrition" ? "ex: Ajout créatine"
                      : ctxAnnForm.event_type === "travel" ? "ex: Vacances Espagne"
                      : "ex: Observation importante"
                    }
                    className="w-full px-2.5 py-1.5 bg-[#0a0a0a] rounded-lg text-[11px] text-white outline-none placeholder:text-white/20"
                  />
                </div>

                {/* Body — always visible, all types */}
                <div>
                  <label className="text-[9px] font-bold uppercase tracking-wide text-white/35 block mb-1">
                    Détail <span className="text-white/20 font-normal normal-case">(optionnel)</span>
                  </label>
                  <textarea
                    value={ctxAnnForm.body}
                    onChange={(e) => setCtxAnnForm((p) => ({ ...p, body: e.target.value }))}
                    placeholder="Contexte, protocole, observations…"
                    rows={2}
                    className="w-full px-2.5 py-1.5 bg-[#0a0a0a] rounded-lg text-[11px] text-white outline-none placeholder:text-white/20 resize-none leading-relaxed"
                  />
                </div>

                {/* Date */}
                <div>
                  <label className="text-[9px] font-bold uppercase tracking-wide text-white/35 block mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={ctxAnnForm.event_date}
                    onChange={(e) => setCtxAnnForm((p) => ({ ...p, event_date: e.target.value }))}
                    className="w-full px-2.5 py-1.5 bg-[#0a0a0a] rounded-lg text-[11px] text-white outline-none [color-scheme:dark]"
                  />
                </div>

                {annotationError && (
                  <p className="text-[10px] text-red-400 leading-snug pt-1">
                    {annotationError}
                  </p>
                )}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    onClick={closeContextMenu}
                    className="text-[10px] text-white/35 hover:text-white/60 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={() => handleSaveAnnotation(ctxAnnForm)}
                    disabled={savingAnnotation || !ctxAnnForm.label || !ctxAnnForm.event_date}
                    className="px-3 py-1.5 rounded-lg bg-[#1f8a65] text-white text-[10px] font-bold disabled:opacity-50 hover:bg-[#217356] transition-colors"
                  >
                    {savingAnnotation ? "…" : contextMenu?.editingId ? "Modifier" : "Enregistrer"}
                  </button>
                </div>
              </div>
            )}

            {/* ── Phase form ── */}
            {contextStep === "phase" && (
              <div className="flex flex-col gap-2">
                <div>
                  <label className="text-[9px] font-bold uppercase tracking-wide text-white/35 block mb-1">
                    Nom
                  </label>
                  <input
                    autoFocus
                    value={ctxPhaseForm.label}
                    onChange={(e) => setCtxPhaseForm((p) => ({ ...p, label: e.target.value }))}
                    placeholder="ex: Prise de masse hiver"
                    className="w-full px-2.5 py-1.5 bg-[#0a0a0a] rounded-lg text-[11px] text-white outline-none placeholder:text-white/20"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold uppercase tracking-wide text-white/35 block mb-1">
                    Type
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {(Object.keys(PHASE_COLORS) as PhaseType[]).map((pt) => (
                      <button
                        key={pt}
                        onClick={() => setCtxPhaseForm((p) => ({ ...p, phase_type: pt }))}
                        className="px-2 py-1 rounded-md text-[9px] font-bold transition-all"
                        style={
                          ctxPhaseForm.phase_type === pt
                            ? { backgroundColor: PHASE_COLORS[pt].bg, color: PHASE_COLORS[pt].text }
                            : { backgroundColor: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.35)" }
                        }
                      >
                        {PHASE_COLORS[pt].label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] font-bold uppercase tracking-wide text-white/35 block mb-1">
                      Début
                    </label>
                    <input
                      type="date"
                      value={ctxPhaseForm.date_start}
                      onChange={(e) => setCtxPhaseForm((p) => ({ ...p, date_start: e.target.value }))}
                      className="w-full px-2 py-1.5 bg-[#0a0a0a] rounded-lg text-[10px] text-white outline-none [color-scheme:dark]"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold uppercase tracking-wide text-white/35 block mb-1">
                      Fin
                    </label>
                    <input
                      type="date"
                      value={ctxPhaseForm.date_end}
                      onChange={(e) => setCtxPhaseForm((p) => ({ ...p, date_end: e.target.value }))}
                      className="w-full px-2 py-1.5 bg-[#0a0a0a] rounded-lg text-[10px] text-white outline-none [color-scheme:dark]"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    onClick={closeContextMenu}
                    className="text-[10px] text-white/35 hover:text-white/60 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={() => handleSavePhase(ctxPhaseForm)}
                    disabled={savingPhase || !ctxPhaseForm.label || !ctxPhaseForm.date_start}
                    className="px-3 py-1.5 rounded-lg bg-[#1f8a65] text-white text-[10px] font-bold disabled:opacity-50 hover:bg-[#217356] transition-colors"
                  >
                    {savingPhase ? "…" : contextMenu?.editingId ? "Modifier" : "Enregistrer"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Annotation hover tooltip ── */}
      {hoveredAnnotation &&
        (() => {
          const nearTop = hoveredAnnotation.screenY < 120;
          const nearRight = hoveredAnnotation.screenX > window.innerWidth - 280;
          const nearLeft = hoveredAnnotation.screenX < 140;
          const xShift = nearRight ? "-100%" : nearLeft ? "0%" : "-50%";
          const yShift = nearTop ? "0%" : "-100%";
          const caretLeft = nearRight ? "calc(100% - 20px)" : nearLeft ? "16px" : "50%";
          return (
            <div
              className="fixed z-[60] pointer-events-none"
              style={{
                top: nearTop
                  ? hoveredAnnotation.screenY + 28
                  : hoveredAnnotation.screenY - 12,
                left: hoveredAnnotation.screenX,
                transform: `translate(${xShift}, ${yShift})`,
              }}
            >
              <div className="relative bg-[#0f0f0f] border border-white/[0.10] rounded-xl px-3 py-2.5 w-[220px] shadow-2xl">
                {nearTop ? (
                  <div className="absolute -top-[5px] w-2.5 h-2.5 bg-[#0f0f0f] border-l border-t border-white/[0.10] rotate-45" style={{ left: caretLeft, transform: "translateX(-50%) rotate(45deg)" }} />
                ) : (
                  <div className="absolute -bottom-[5px] w-2.5 h-2.5 bg-[#0f0f0f] border-r border-b border-white/[0.10] rotate-45" style={{ left: caretLeft, transform: "translateX(-50%) rotate(45deg)" }} />
                )}
                <p className="text-[11px] font-semibold text-white leading-snug">
                  {ANNOTATION_ICONS[hoveredAnnotation.ann.event_type]}{" "}
                  {hoveredAnnotation.ann.label}
                </p>
                <p className="text-[9px] text-white/45 mt-1">
                  {ANNOTATION_LABELS[hoveredAnnotation.ann.event_type]} ·{" "}
                  {formatDate(hoveredAnnotation.ann.event_date)}
                </p>
                <p className="text-[8px] text-white/25 mt-1">
                  Cliquez pour localiser dans la liste
                </p>
              </div>
            </div>
          );
        })()}
    </div>
  );

  return (
    <>
      {innerContent}

      {/* ── Modal plein écran ── */}
      {isFullscreen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setIsFullscreen(false); }}
        >
          <div className="relative w-full max-w-[95vw] h-[92vh] bg-[#181818] rounded-2xl border-[0.3px] border-white/[0.06] flex flex-col overflow-hidden">
            {/* Header modal */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.05] shrink-0">
              <p className="text-[11px] font-bold text-white/40 uppercase tracking-[0.14em]">
                Vue superposée — plein écran
              </p>
              <button
                onClick={() => setIsFullscreen(false)}
                className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/[0.04] text-white/40 hover:bg-white/[0.08] hover:text-white/70 transition-all"
                title="Fermer (Escape)"
              >
                <Minimize2 size={13} />
              </button>
            </div>
            {/* Contenu scrollable */}
            <div className="flex-1 overflow-y-auto p-5">
              {innerContent}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Filter panel ─────────────────────────────────────────────────────────────

interface FilterPanelProps {
  filter: FilterState;
  onChange: (f: FilterState) => void;
  fieldsWithData: FieldDef[];
  viewMode: ViewMode;
  onClose: () => void;
}

function FilterPanel({
  filter,
  onChange,
  fieldsWithData,
  viewMode,
  onClose,
}: FilterPanelProps) {
  const [local, setLocal] = useState<FilterState>(filter);

  function apply() {
    onChange(local);
    onClose();
  }

  function reset() {
    setLocal(DEFAULT_FILTER);
    onChange(DEFAULT_FILTER);
    onClose();
  }

  function setPreset(preset: DateRangePreset) {
    if (preset === "custom") {
      setLocal((p) => ({ ...p, preset }));
      return;
    }
    const { from, to } = presetToRange(preset);
    setLocal((p) => ({ ...p, preset, dateFrom: from, dateTo: to }));
  }

  function toggleMetric(key: string) {
    setLocal((p) => {
      const has = p.selectedMetrics.includes(key);
      if (has && p.selectedMetrics.length === 1) return p; // keep at least 1
      return {
        ...p,
        selectedMetrics: has
          ? p.selectedMetrics.filter((k) => k !== key)
          : [...p.selectedMetrics, key],
      };
    });
  }

  const PRESETS: { key: DateRangePreset; label: string }[] = [
    { key: "1m", label: "1 mois" },
    { key: "3m", label: "3 mois" },
    { key: "6m", label: "6 mois" },
    { key: "1y", label: "1 an" },
    { key: "all", label: "Tout" },
    { key: "custom", label: "Perso." },
  ];

  return (
    <div className="bg-[#181818] rounded-2xl p-5 flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={14} className="text-white/60" />
          <p className="text-sm font-bold text-white">Filtres</p>
        </div>
        <button
          onClick={onClose}
          className="text-[rgba(255,255,255,0.40)] hover:text-white p-1 rounded-lg hover:bg-[#0a0a0a] transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Period presets */}
      <div>
        <p className="text-[10px] font-semibold text-[rgba(255,255,255,0.40)] uppercase tracking-wide mb-2">
          Période
        </p>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPreset(p.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                local.preset === p.key
                  ? "bg-[#1f8a65] text-white"
                  : "bg-[#0a0a0a] text-white/60 hover:text-white"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom date range */}
        {local.preset === "custom" && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-[rgba(255,255,255,0.40)] block mb-1">
                Du
              </label>
              <input
                type="date"
                value={local.dateFrom}
                onChange={(e) =>
                  setLocal((p) => ({ ...p, dateFrom: e.target.value }))
                }
                className="w-full px-2.5 py-1.5 bg-[#0a0a0a] rounded-lg text-xs text-white outline-none transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] text-[rgba(255,255,255,0.40)] block mb-1">
                Au
              </label>
              <input
                type="date"
                value={local.dateTo}
                onChange={(e) =>
                  setLocal((p) => ({ ...p, dateTo: e.target.value }))
                }
                className="w-full px-2.5 py-1.5 bg-[#0a0a0a] rounded-lg text-xs text-white outline-none transition-colors"
              />
            </div>
          </div>
        )}
      </div>

      {/* Metric selector (only relevant for charts/overlay view) */}
      {viewMode === "charts" && (
        <div>
          <p className="text-[10px] font-semibold text-[rgba(255,255,255,0.40)] uppercase tracking-wide mb-2">
            Métriques affichées
          </p>
          <div className="flex flex-col gap-1">
            {(["composition", "measurements", "wellness"] as const).map(
              (cat) => {
                const catFields = fieldsWithData.filter(
                  (f) => f.category === cat,
                );
                if (catFields.length === 0) return null;
                const catLabels: Record<string, string> = {
                  composition: "Composition",
                  measurements: "Mensurations",
                  wellness: "Bien-être",
                };
                return (
                  <div key={cat} className="mb-2">
                    <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest mb-1.5">
                      {catLabels[cat]}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {catFields.map((f) => {
                        const active = local.selectedMetrics.includes(f.key);
                        return (
                          <button
                            key={f.key}
                            onClick={() => toggleMetric(f.key)}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all ${
                              active
                                ? "bg-[#1f8a65] text-white"
                                : "bg-[#0a0a0a] text-white/60 hover:text-white"
                            }`}
                          >
                            {f.label}
                            {f.unit && (
                              <span
                                className={`${active ? "text-[#1f8a65]/60" : "text-white/40"} text-[9px]`}
                              >
                                {f.unit}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              },
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="h-px bg-white/[0.07]" />
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={reset}
          className="text-xs text-[rgba(255,255,255,0.40)] hover:text-white font-medium transition-colors"
        >
          Réinitialiser
        </button>
        <button
          onClick={apply}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1f8a65] text-white text-xs font-bold hover:opacity-90 transition-opacity"
        >
          <CheckCircle2 size={12} />
          Appliquer
        </button>
      </div>
    </div>
  );
}

// ─── Field input row ──────────────────────────────────────────────────────────

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-[10px] text-[rgba(255,255,255,0.40)] block mb-0.5">
        {field.label}
        {field.unit ? ` (${field.unit})` : ""}
      </label>
      <input
        type="number"
        step={field.step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="—"
        className="w-full px-2.5 py-1.5 bg-[#0a0a0a] rounded-lg text-xs font-mono text-white outline-none transition-colors placeholder:text-white/40"
      />
    </div>
  );
}

// ─── Modal shell ──────────────────────────────────────────────────────────────

function ModalShell({
  title,
  subtitle,
  onClose,
  footer,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-[#181818] rounded-2xl w-full max-w-lg my-8">
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <p className="text-sm font-bold text-white">{title}</p>
            {subtitle && (
              <p className="text-xs text-white/40 mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/[0.06]"
          >
            <X size={15} />
          </button>
        </div>
        <div className="h-px bg-white/[0.07] mx-5" />
        {children}
        <div className="h-px bg-white/[0.07] mx-5" />
        <div className="flex items-center justify-between px-5 py-3">
          {footer}
        </div>
      </div>
    </div>
  );
}

const CATEGORIES = [
  {
    key: "composition" as const,
    label: "Composition corporelle",
    fields: FIELDS.filter((f) => f.category === "composition"),
  },
  {
    key: "measurements" as const,
    label: "Mensurations",
    fields: FIELDS.filter((f) => f.category === "measurements"),
  },
  {
    key: "wellness" as const,
    label: "Bien-être",
    fields: FIELDS.filter((f) => f.category === "wellness"),
  },
];

// ─── Edit row modal ───────────────────────────────────────────────────────────

function EditRowModal({
  row,
  clientId,
  onClose,
  onSaved,
}: {
  row: MetricRow;
  clientId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [date, setDate] = useState(formatDateInput(row.date));
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(
      Object.entries(row.values).map(([k, v]) => [k, String(v)]),
    ),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const numericValues: Record<string, number | null> = {};
    for (const f of FIELDS) {
      const raw = values[f.key];
      if (raw === "" || raw === undefined) {
        if (row.values[f.key] !== undefined) numericValues[f.key] = null;
      } else {
        const n = parseFloat(raw.replace(",", "."));
        if (!isNaN(n)) numericValues[f.key] = n;
      }
    }
    const res = await fetch(
      `/api/clients/${clientId}/metrics/${row.submissionId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, values: numericValues }),
      },
    );
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Erreur lors de la sauvegarde");
      setSaving(false);
      return;
    }
    onSaved();
  }

  return (
    <ModalShell
      title="Modifier la mesure"
      subtitle="Laissez vide pour supprimer une valeur"
      onClose={onClose}
      footer={
        <>
          <button
            onClick={onClose}
            className="text-xs text-[rgba(255,255,255,0.40)] hover:text-white font-medium transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1f8a65] text-white text-xs font-bold hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saving ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                Sauvegarde…
              </>
            ) : (
              <>
                <CheckCircle2 size={12} />
                Sauvegarder
              </>
            )}
          </button>
        </>
      }
    >
      <div className="px-5 py-4">
        <label className="text-[11px] font-semibold text-[rgba(255,255,255,0.40)] uppercase tracking-wide block mb-1.5">
          Date
        </label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full px-3 py-2 bg-[#0a0a0a] rounded-lg text-sm text-white outline-none focus:bg-[#181818] transition-colors"
        />
      </div>
      <div className="px-5 py-4 flex flex-col gap-5 max-h-[50vh] overflow-y-auto">
        {CATEGORIES.map((cat) => (
          <div key={cat.key}>
            <p className="text-[11px] font-semibold text-[rgba(255,255,255,0.40)] uppercase tracking-wide mb-2">
              {cat.label}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {cat.fields.map((f) => (
                <FieldInput
                  key={f.key}
                  field={f}
                  value={values[f.key] ?? ""}
                  onChange={(v) => setValues((p) => ({ ...p, [f.key]: v }))}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      {error && (
        <div className="px-5 pb-2 flex items-center gap-1.5 text-xs text-red-500">
          <AlertCircle size={13} />
          {error}
        </div>
      )}
    </ModalShell>
  );
}

// ─── Manual entry form ────────────────────────────────────────────────────────

function ManualEntryForm({
  clientId,
  onSaved,
  onClose,
}: {
  clientId: string;
  onSaved: () => void;
  onClose: () => void;
}) {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const filledCount = Object.values(values).filter(
    (v) => v.trim() !== "",
  ).length;

  async function handleSave() {
    setSaving(true);
    setError(null);
    const numericValues: Record<string, number> = {};
    for (const [k, v] of Object.entries(values)) {
      if (v.trim() === "") continue;
      const n = parseFloat(v.replace(",", "."));
      if (!isNaN(n)) numericValues[k] = n;
    }
    if (Object.keys(numericValues).length === 0) {
      setError("Saisissez au moins une valeur");
      setSaving(false);
      return;
    }
    const res = await fetch(`/api/clients/${clientId}/metrics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, values: numericValues }),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Erreur");
      setSaving(false);
      return;
    }
    onSaved();
  }

  return (
    <ModalShell
      title="Saisie manuelle"
      subtitle="Ajoutez une mesure pour une date donnée"
      onClose={onClose}
      footer={
        <>
          <button
            onClick={onClose}
            className="text-xs text-[rgba(255,255,255,0.40)] hover:text-white font-medium transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving || filledCount === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1f8a65] text-white text-xs font-bold hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saving ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                Sauvegarde…
              </>
            ) : (
              <>
                <CheckCircle2 size={12} />
                Enregistrer{filledCount > 0 ? ` (${filledCount})` : ""}
              </>
            )}
          </button>
        </>
      }
    >
      <div className="px-5 py-4">
        <label className="text-[11px] font-semibold text-[rgba(255,255,255,0.40)] uppercase tracking-wide block mb-1.5">
          Date
        </label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full px-3 py-2 bg-[#0a0a0a] rounded-lg text-sm text-white outline-none focus:bg-[#181818] transition-colors"
        />
      </div>
      <div className="px-5 py-4 flex flex-col gap-5 max-h-[50vh] overflow-y-auto">
        {CATEGORIES.map((cat) => (
          <div key={cat.key}>
            <p className="text-[11px] font-semibold text-[rgba(255,255,255,0.40)] uppercase tracking-wide mb-2">
              {cat.label}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {cat.fields.map((f) => (
                <FieldInput
                  key={f.key}
                  field={f}
                  value={values[f.key] ?? ""}
                  onChange={(v) => setValues((p) => ({ ...p, [f.key]: v }))}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      {error && (
        <div className="px-5 pb-2 flex items-center gap-1.5 text-xs text-red-500">
          <AlertCircle size={13} />
          {error}
        </div>
      )}
    </ModalShell>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  clientId: string;
  clientGender?: string | null;
  clientDateOfBirth?: string | null;
}

const TABLE_COLS = FIELDS.filter((f) =>
  [
    "weight_kg",
    "body_fat_pct",
    "muscle_mass_kg",
    "waist_cm",
    "energy_level",
  ].includes(f.key),
);

// ─── Time range utilities ───────────────────────────────────────────────────

type TimeRangeDays = [number, number];

function formatTimeRange(days: number): string {
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return "1 jour";
  if (days <= 7) return `${days} jours`;
  if (days < 35) {
    const weeks = Math.ceil(days / 7);
    return weeks === 1 ? "1 semaine" : `${weeks} semaines`;
  }
  if (days < 365) {
    const months = Math.round(days / 30);
    return months === 1 ? "1 mois" : `${months} mois`;
  }
  if (days === 365) return "1 an";
  if (days === 730) return "2 ans";
  const years = days / 365;
  return `${years.toFixed(1).replace(/\.0$/, "")} ans`;
}

function formatTimeRangeLabel(range: TimeRangeDays): string {
  if (range[0] === range[1]) {
    return formatTimeRange(range[0]);
  }
  return `${formatTimeRange(range[0])} — ${formatTimeRange(range[1])}`;
}

function getTimeRangeDate(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split("T")[0];
}

function getTimeRangeBounds(range: TimeRangeDays) {
  return {
    from: getTimeRangeDate(range[1]),
    to: getTimeRangeDate(range[0]),
  };
}

function formatThumbDate(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// Convert days-ago offset → YYYY-MM-DD for <input type="date">
function daysToISODate(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split("T")[0];
}

// Convert YYYY-MM-DD → days-ago offset (clamped 0–730)
function isoDateToDays(iso: string): number {
  // Parse as local date to avoid UTC midnight → off-by-one on local timezones
  const [year, month, day] = iso.split("-").map(Number);
  const target = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - target.getTime()) / 86400000);
  return Math.max(0, Math.min(730, diff));
}

// Returns a human-readable duration label for the selected range (e.g. "3 mois", "1 an 2 mois")
function formatRangeDuration(daysStart: number, daysEnd: number): string {
  const diff = Math.abs(daysEnd - daysStart);
  if (diff < 7) return `${diff} jour${diff > 1 ? "s" : ""}`;
  if (diff < 14) return "1 semaine";
  if (diff < 30) return `${Math.round(diff / 7)} semaines`;
  const months = Math.round(diff / 30.44);
  if (months < 12) return `${months} mois`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (rem === 0) return `${years} an${years > 1 ? "s" : ""}`;
  return `${years} an${years > 1 ? "s" : ""} ${rem} mois`;
}

// Returns a CSS translateX value that prevents the label from overflowing the track edges
function thumbLabelTranslate(pct: number): string {
  if (pct < 8) return "translateX(0%)";
  if (pct > 92) return "translateX(-100%)";
  return "translateX(-50%)";
}

function TimeRangeSlider({
  timeRangeDays,
  setTimeRangeDays,
}: {
  timeRangeDays: TimeRangeDays;
  setTimeRangeDays: Dispatch<SetStateAction<TimeRangeDays>>;
}) {
  const MAX = 730;
  const rangeLabel = formatRangeDuration(timeRangeDays[0], timeRangeDays[1]);

  return (
    <div className="bg-[#181818] border-subtle rounded-2xl px-5 py-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[9px] font-bold text-white/30 uppercase tracking-[0.18em]">
          Période d&apos;analyse
        </p>
        <span className="text-[11px] font-semibold text-white/50 shrink-0 tabular-nums">
          {rangeLabel}
        </span>
      </div>
      {/* Date inputs row */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 flex flex-col gap-1">
          <label className="text-[9px] font-bold text-white/30 uppercase tracking-[0.14em]">
            Du
          </label>
          <input
            type="date"
            value={daysToISODate(timeRangeDays[1])}
            max={daysToISODate(0)}
            onChange={(e) => {
              if (!e.target.value) return;
              const days = isoDateToDays(e.target.value);
              // timeRangeDays[1] = "Du" (furthest in past = largest days-ago value)
              // Clamp so "Du" never goes more recent than "Au" (timeRangeDays[0])
              setTimeRangeDays([timeRangeDays[0], Math.max(days, timeRangeDays[0])]);
            }}
            className="h-8 w-full rounded-lg bg-[#0a0a0a] px-2.5 text-[11px] font-semibold text-white/75 outline-none border-[0.3px] border-white/[0.08] focus:border-white/[0.18] transition-colors [color-scheme:dark] tabular-nums"
          />
        </div>
        <div className="flex-1 flex flex-col gap-1">
          <label className="text-[9px] font-bold text-white/30 uppercase tracking-[0.14em]">
            Au
          </label>
          <input
            type="date"
            value={daysToISODate(timeRangeDays[0])}
            max={daysToISODate(0)}
            onChange={(e) => {
              if (!e.target.value) return;
              const days = isoDateToDays(e.target.value);
              // timeRangeDays[0] = "Au" (most recent = smallest days-ago value)
              // Clamp so "Au" never goes further in past than "Du" (timeRangeDays[1])
              setTimeRangeDays([Math.min(days, timeRangeDays[1]), timeRangeDays[1]]);
            }}
            className="h-8 w-full rounded-lg bg-[#0a0a0a] px-2.5 text-[11px] font-semibold text-white/75 outline-none border-[0.3px] border-white/[0.08] focus:border-white/[0.18] transition-colors [color-scheme:dark] tabular-nums"
          />
        </div>
      </div>
      {/* Slider */}
      <div className="flex items-center gap-3">
        <Calendar size={13} className="text-white/30 shrink-0" />
        <Slider
          value={timeRangeDays}
          onValueChange={(value) => {
            const next = Array.isArray(value)
              ? [value[0], value[1]]
              : timeRangeDays;
            setTimeRangeDays(next as TimeRangeDays);
          }}
          min={0}
          max={MAX}
          step={1}
          className="w-full"
        />
      </div>
    </div>
  );
}

// ─── Note detail modal — post-it style reader + editor ────────────────────────
const ANNOTATION_TYPE_OPTIONS: {
  value: AnnotationType;
  label: string;
  icon: string;
}[] = [
  { value: "program_change", label: "Programme", icon: "⚡" },
  { value: "injury", label: "Blessure", icon: "🩹" },
  { value: "travel", label: "Voyage", icon: "✈️" },
  { value: "nutrition", label: "Nutrition", icon: "🥗" },
  { value: "note", label: "Note", icon: "📌" },
];

function NoteModal({
  ann,
  clientId,
  onClose,
  onSaved,
  onDeleted,
}: {
  ann: MetricAnnotation;
  clientId: string;
  onClose: () => void;
  onSaved: (updated: MetricAnnotation) => void;
  onDeleted: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [eventType, setEventType] = useState<AnnotationType>(ann.event_type);
  const [eventDate, setEventDate] = useState(ann.event_date);
  const [label, setLabel] = useState(ann.label);
  const [body, setBody] = useState(ann.body ?? "");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function cancelEdit() {
    setEditing(false);
    setEventType(ann.event_type);
    setEventDate(ann.event_date);
    setLabel(ann.label);
    setBody(ann.body ?? "");
  }

  async function save() {
    if (!label || !eventDate) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/annotations/${ann.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, body: body || null, event_type: eventType, event_date: eventDate }),
      });
      if (res.ok) {
        const updated = await res.json();
        onSaved(updated);
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteAnn() {
    await fetch(`/api/clients/${clientId}/annotations/${ann.id}`, { method: "DELETE" });
    onDeleted(ann.id);
  }

  const currentIcon = ANNOTATION_ICONS[eventType];
  const currentLabel = ANNOTATION_LABELS[eventType];

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#181818] border border-white/[0.08] rounded-2xl w-full max-w-md flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {editing ? (
          /* ── Edit mode ── */
          <>
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/[0.06]">
              <p className="text-[11px] font-bold text-white/50 uppercase tracking-[0.12em]">Modifier l&apos;annotation</p>
              <button
                onClick={onClose}
                className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/30 hover:text-white/70 hover:bg-white/[0.08] transition-all"
              >
                <X size={13} />
              </button>
            </div>

            <div className="px-5 py-4 flex flex-col gap-3">
              {/* Type */}
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-[0.16em] text-white/35 mb-1.5">Type</label>
                <div className="flex gap-1.5 flex-wrap">
                  {ANNOTATION_TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setEventType(opt.value)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                        eventType === opt.value
                          ? "bg-[#1f8a65] text-white"
                          : "bg-white/[0.04] text-white/45 hover:bg-white/[0.07] hover:text-white/70"
                      }`}
                    >
                      <span>{opt.icon}</span>{opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Titre */}
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-[0.16em] text-white/35 mb-1.5">Titre</label>
                <input
                  autoFocus
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="ex: Ajout créatine"
                  className="w-full bg-[#0a0a0a] rounded-lg px-3 py-2 text-[12px] text-white outline-none placeholder:text-white/20"
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-[0.16em] text-white/35 mb-1.5">Date</label>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full bg-[#0a0a0a] rounded-lg px-3 py-2 text-[12px] text-white outline-none [color-scheme:dark]"
                />
              </div>

              {/* Détail */}
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-[0.16em] text-white/35 mb-1.5">
                  Détail <span className="text-white/20 font-normal normal-case">(optionnel)</span>
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Contexte, observations, protocole…"
                  rows={4}
                  className="w-full bg-[#0a0a0a] rounded-lg px-3 py-2 text-[12px] text-white/80 outline-none placeholder:text-white/20 resize-none leading-relaxed"
                />
              </div>
            </div>

            <div className="flex items-center justify-between px-5 pb-5 pt-3 border-t border-white/[0.06]">
              <button
                onClick={cancelEdit}
                className="text-[11px] font-medium text-white/40 hover:text-white/70 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={save}
                disabled={saving || !label || !eventDate}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#1f8a65] text-white text-[11px] font-bold hover:bg-[#217356] disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                Enregistrer
              </button>
            </div>
          </>
        ) : (
          /* ── Read mode ── */
          <>
            {/* Header — emoji large + type badge + date */}
            <div className="flex items-start gap-4 px-5 pt-5 pb-4 border-b border-white/[0.06]">
              <div className="w-10 h-10 rounded-xl bg-white/[0.06] flex items-center justify-center text-[20px] shrink-0">
                {currentIcon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-white leading-snug mb-1">
                  {label}
                </p>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-white/[0.06] text-[9px] font-bold uppercase tracking-[0.12em] text-white/45">
                    {currentLabel}
                  </span>
                  <span className="text-[10px] text-white/30 tabular-nums">
                    {formatDate(ann.event_date)}
                  </span>
                </div>
              </div>
              <button
                onClick={onClose}
                className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/30 hover:text-white/70 hover:bg-white/[0.08] transition-all shrink-0 mt-0.5"
              >
                <X size={13} />
              </button>
            </div>

            {/* Body — read zone */}
            <div className="px-5 py-4 min-h-[72px]">
              {body ? (
                <p className="text-[12px] text-white/65 leading-relaxed whitespace-pre-wrap">
                  {body}
                </p>
              ) : (
                <button
                  onClick={() => setEditing(true)}
                  className="text-[11px] text-white/25 italic hover:text-white/45 transition-colors text-left"
                >
                  Aucun détail — cliquer pour ajouter une note…
                </button>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-5 pb-5 pt-3 border-t border-white/[0.06]">
              {!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white/25 hover:text-red-400 hover:bg-red-400/5 transition-all"
                >
                  <Trash2 size={11} />
                  Supprimer
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-red-400 font-medium">Confirmer ?</span>
                  <button
                    onClick={deleteAnn}
                    className="px-2.5 py-1.5 rounded-lg bg-red-400/10 border border-red-400/25 text-[11px] font-bold text-red-400 hover:bg-red-400/20 transition-colors"
                  >
                    Supprimer
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="px-2.5 py-1.5 rounded-lg text-[11px] text-white/30 hover:text-white/60 transition-colors"
                  >
                    Annuler
                  </button>
                </div>
              )}

              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-white/60 text-[11px] font-semibold hover:bg-white/[0.09] hover:text-white hover:border-white/[0.14] transition-all"
              >
                <Edit2 size={11} />
                Modifier
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── PhaseEditModal ───────────────────────────────────────────────────────────
interface PhaseEditModalProps {
  phase: TrainingPhase;
  onClose: () => void;
  onSave: (form: {
    label: string;
    phase_type: PhaseType;
    date_start: string;
    date_end: string;
    notes: string;
  }) => Promise<void>;
  saving: boolean;
}

function PhaseEditModal({ phase, onClose, onSave, saving }: PhaseEditModalProps) {
  const [label, setLabel] = useState(phase.label);
  const [phaseType, setPhaseType] = useState<PhaseType>(phase.phase_type);
  const [dateStart, setDateStart] = useState(phase.date_start.slice(0, 10));
  const [dateEnd, setDateEnd] = useState(phase.date_end ? phase.date_end.slice(0, 10) : "");
  const [notes, setNotes] = useState(phase.notes ?? "");

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-sm bg-[#181818] rounded-2xl p-5 border border-white/[0.06] flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-semibold text-white">Modifier la phase</p>
          <button onClick={onClose} className="text-white/40 hover:text-white/70 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Phase type chips */}
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(PHASE_COLORS) as PhaseType[]).map((pt) => (
            <button
              key={pt}
              onClick={() => setPhaseType(pt)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all"
              style={
                phaseType === pt
                  ? { backgroundColor: PHASE_COLORS[pt].bg, color: PHASE_COLORS[pt].text, outline: `1px solid ${PHASE_COLORS[pt].text}40` }
                  : { backgroundColor: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)" }
              }
            >
              {PHASE_COLORS[pt].label}
            </button>
          ))}
        </div>

        {/* Label */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-widest text-white/40">Libellé</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ex: Bulk hiver 2026"
            className="w-full bg-[#0a0a0a] rounded-xl px-3 h-9 text-[12px] text-white placeholder:text-white/20 outline-none"
          />
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-white/40">Début</label>
            <input
              type="date"
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
              className="w-full bg-[#0a0a0a] rounded-xl px-3 h-9 text-[12px] text-white outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-white/40">Fin (opt.)</label>
            <input
              type="date"
              value={dateEnd}
              onChange={(e) => setDateEnd(e.target.value)}
              className="w-full bg-[#0a0a0a] rounded-xl px-3 h-9 text-[12px] text-white outline-none"
            />
          </div>
        </div>

        {/* Notes */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-widest text-white/40">Notes (opt.)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Objectifs, contexte..."
            className="w-full bg-[#0a0a0a] rounded-xl px-3 py-2.5 text-[12px] text-white placeholder:text-white/20 outline-none resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 h-9 rounded-xl bg-white/[0.04] text-[12px] text-white/55 hover:text-white/80 transition-colors font-medium"
          >
            Annuler
          </button>
          <button
            onClick={() => onSave({ label, phase_type: phaseType, date_start: dateStart, date_end: dateEnd, notes })}
            disabled={saving || !dateStart}
            className="flex-1 h-9 rounded-xl bg-[#1f8a65] text-[12px] text-white font-bold hover:bg-[#217356] disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MetricsSection({ clientId, clientGender, clientDateOfBirth }: Props) {
  const [rows, setRows] = useState<MetricRow[]>([]);
  const [series, setSeries] = useState<MetricSeries>({});
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [chartCategory, setChartCategory] =
    useState<ChartCategory>("composition");

  // Chart kind per category — persisted in localStorage
  const [chartKindByCategory, setChartKindByCategory] = useState<
    Record<ChartCategory, "bar" | "line">
  >(() => {
    if (typeof window === "undefined") {
      return { composition: "bar", measurements: "line", wellness: "line" };
    }
    try {
      const stored = localStorage.getItem("stryvr_chartKind");
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          composition: parsed.composition ?? "bar",
          measurements: parsed.measurements ?? "line",
          wellness: parsed.wellness ?? "line",
        };
      }
    } catch {}
    return { composition: "bar", measurements: "line", wellness: "line" };
  });

  function toggleChartKind(cat: ChartCategory) {
    setChartKindByCategory((prev) => {
      const next = {
        ...prev,
        [cat]: prev[cat] === "bar" ? "line" : "bar",
      };
      try {
        localStorage.setItem("stryvr_chartKind", JSON.stringify(next));
      } catch {}
      return next;
    });
  }
  const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER);
  const [showFilters, setShowFilters] = useState(false);
  const [editingRow, setEditingRow] = useState<MetricRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MetricRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [timeRangeDays, setTimeRangeDays] = useState<TimeRangeDays>([0, 730]);
  const [phases, setPhases] = useState<TrainingPhase[]>([]);
  const [annotations, setAnnotations] = useState<MetricAnnotation[]>([]);
  const [mounted, setMounted] = useState(false);
  const [highlightedAnnotationId, setHighlightedAnnotationId] = useState<
    string | null
  >(null);
  const annotationRefs = useMemo(() => new Map<string, HTMLDivElement>(), []);
  const [noteModal, setNoteModal] = useState<MetricAnnotation | null>(null);
  const [phaseDeleteConfirm, setPhaseDeleteConfirm] = useState<string | null>(null);
  const [phaseEditModal, setPhaseEditModal] = useState<TrainingPhase | null>(null);
  const [phaseEditSaving, setPhaseEditSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/metrics`);
      const d = await res.json();
      setRows(d.rows ?? []);
      setSeries(d.series ?? {});
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    load();
    setMounted(true);
  }, [load]);

  useEffect(() => {
    Promise.all([
      fetch(`/api/clients/${clientId}/phases`).then((r) => r.json()),
      fetch(`/api/clients/${clientId}/annotations`).then((r) => r.json()),
    ])
      .then(([phasesData, annotationsData]) => {
        if (Array.isArray(phasesData)) setPhases(phasesData);
        if (Array.isArray(annotationsData)) setAnnotations(annotationsData);
      })
      .catch(() => {});
  }, [clientId]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await fetch(
      `/api/clients/${clientId}/metrics/${deleteTarget.submissionId}`,
      { method: "DELETE" },
    );
    setDeleting(false);
    setDeleteTarget(null);
    if (res.ok) {
      showToast("Mesure supprimée");
      load();
    } else showToast("Erreur lors de la suppression");
  }

  function toggleRow(id: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  // Derived: effective date range from filter AND time range
  const timeRangeBounds = getTimeRangeBounds(timeRangeDays);
  const effectiveDateFrom =
    filter.preset !== "custom"
      ? presetToRange(filter.preset).from
      : filter.dateFrom;
  const effectiveDateTo =
    filter.preset !== "custom"
      ? presetToRange(filter.preset).to
      : filter.dateTo;

  const finalDateFrom = [effectiveDateFrom, timeRangeBounds.from]
    .filter(Boolean)
    .sort()
    .reverse()[0] as string;
  const finalDateTo = [effectiveDateTo, timeRangeBounds.to]
    .filter(Boolean)
    .sort()[0] as string;

  const filteredRows = useMemo(
    () =>
      filterRows(rows, finalDateFrom, finalDateTo).filter((row) =>
        FIELDS.some((f) => row.values[f.key] !== undefined),
      ),
    [rows, finalDateFrom, finalDateTo],
  );

  const filteredSeries = useMemo(() => {
    const result: MetricSeries = {};
    for (const [k, data] of Object.entries(series)) {
      result[k] = filterSeries(data, finalDateFrom, finalDateTo);
    }
    return result;
  }, [series, finalDateFrom, finalDateTo]);

  const filteredAnnotations = useMemo(
    () => annotations.filter((a) => {
      if (finalDateFrom && a.event_date < finalDateFrom) return false;
      if (finalDateTo && a.event_date > finalDateTo) return false;
      return true;
    }),
    [annotations, finalDateFrom, finalDateTo],
  );

  const filteredPhases = useMemo(
    () => phases.filter((p) => {
      if (finalDateTo && p.date_start > finalDateTo) return false;
      if (finalDateFrom && p.date_end && p.date_end < finalDateFrom) return false;
      return true;
    }),
    [phases, finalDateFrom, finalDateTo],
  );

  const hasData = rows.some((row) =>
    FIELDS.some((f) => row.values[f.key] !== undefined),
  );

  // For norms: needs weight_kg AND height_cm across all submissions (not necessarily same row)
  const normsSubmissionId = useMemo(() => {
    let hasWeight = false;
    let hasHeight = false;
    let latestWithWeight: string | null = null;
    for (const row of rows) {
      if (row.values['weight_kg'] != null) { hasWeight = true; latestWithWeight = row.submissionId; }
      if (row.values['height_cm'] != null) hasHeight = true;
    }
    return (hasWeight && hasHeight) ? latestWithWeight : null;
  }, [rows]);

  const fieldsWithData = FIELDS.filter((f) => (series[f.key]?.length ?? 0) > 0);
  const chartsInCategory = fieldsWithData.filter(
    (f) => f.category === chartCategory,
  );

  // For overlay view: show metrics that have data in the FULL series (not filtered window)
  // so that the slider can be moved freely without making the chart disappear.
  // The chart itself receives filteredSeries and will show the filtered window.
  const overlayMetrics = filter.selectedMetrics.filter(
    (k) => (series[k]?.length ?? 0) > 0,
  );

  // Active filter count (for badge)
  const activeFilterCount = [
    filter.preset !== "all" ? 1 : 0,
    viewMode !== "table" && filter.selectedMetrics.length !== KPI_FIELDS.length
      ? 1
      : 0,
  ].reduce((a, b) => a + b, 0);

  // Shared slider block rendered in both charts and overlay views
  const SliderBlock = (
    <div className="bg-[#181818] border-subtle rounded-2xl px-5 py-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[9px] font-bold text-white/30 uppercase tracking-[0.18em]">
          Période d&apos;analyse
        </p>
        <span className="text-[11px] font-semibold text-white/50 shrink-0 tabular-nums">
          {formatRangeDuration(timeRangeDays[0], timeRangeDays[1])}
        </span>
      </div>
      {/* Date inputs row */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 flex flex-col gap-1">
          <label className="text-[9px] font-bold text-white/30 uppercase tracking-[0.14em]">
            Du
          </label>
          <input
            type="date"
            value={daysToISODate(timeRangeDays[1])}
            max={daysToISODate(0)}
            onChange={(e) => {
              if (!e.target.value) return;
              const days = isoDateToDays(e.target.value);
              setTimeRangeDays([timeRangeDays[0], Math.max(days, timeRangeDays[0])]);
            }}
            className="h-8 w-full rounded-lg bg-[#0a0a0a] px-2.5 text-[11px] font-semibold text-white/75 outline-none border-[0.3px] border-white/[0.08] focus:border-white/[0.18] transition-colors [color-scheme:dark] tabular-nums"
          />
        </div>
        <div className="flex-1 flex flex-col gap-1">
          <label className="text-[9px] font-bold text-white/30 uppercase tracking-[0.14em]">
            Au
          </label>
          <input
            type="date"
            value={daysToISODate(timeRangeDays[0])}
            max={daysToISODate(0)}
            onChange={(e) => {
              if (!e.target.value) return;
              const days = isoDateToDays(e.target.value);
              setTimeRangeDays([Math.min(days, timeRangeDays[1]), timeRangeDays[1]]);
            }}
            className="h-8 w-full rounded-lg bg-[#0a0a0a] px-2.5 text-[11px] font-semibold text-white/75 outline-none border-[0.3px] border-white/[0.08] focus:border-white/[0.18] transition-colors [color-scheme:dark] tabular-nums"
          />
        </div>
      </div>
      {/* Slider */}
      <div className="flex items-center gap-3">
        <Calendar size={13} className="text-white/30 shrink-0" />
        <Slider
          value={timeRangeDays}
          onValueChange={(value) => {
            const next = Array.isArray(value)
              ? [value[0], value[1]]
              : timeRangeDays;
            setTimeRangeDays(next as TimeRangeDays);
          }}
          min={0}
          max={730}
          step={1}
          className="w-full"
        />
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {/* ── Bloc 1 : Contrôles (vue + actions) ── */}
      <div
        className={`flex flex-col sm:flex-row flex-wrap items-start sm:items-center justify-between gap-4 transition-all duration-700 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
      >
        {/* Left: View mode toggle */}
        <div className="flex w-full sm:w-auto flex-wrap items-center gap-0.5 bg-white/[0.05] rounded-full p-1 min-w-0">
          {[
            { key: "table" as ViewMode, label: "Tableau", Icon: Table2 },
            { key: "charts" as ViewMode, label: "Graphiques", Icon: BarChart2 },
            { key: "overlay" as ViewMode, label: "Superposé", Icon: Layers },
            { key: "norms" as ViewMode, label: "Normes", Icon: Activity },
          ].map(({ key, label, Icon }) => {
            const canOverlay = filter.selectedMetrics.length > 1;
            const isOverlay = key === "overlay";
            const isNorms = key === "norms";
            const disabled =
              (isOverlay && !canOverlay) ||
              (isNorms && !normsSubmissionId);
            const disabledTitle = isOverlay
              ? "Sélectionnez au moins 2 métriques pour activer ce mode"
              : isNorms
                ? "Aucune mesure avec poids et taille — requis pour les normes"
                : undefined;
            return (
              <button
                key={key}
                onClick={() => !disabled && setViewMode(key)}
                disabled={disabled}
                title={disabled ? disabledTitle : undefined}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  viewMode === key
                    ? "bg-[#1f8a65] text-white"
                    : disabled
                      ? "text-white/20 cursor-not-allowed"
                      : "text-white/60 hover:text-white"
                }`}
              >
                <Icon size={12} />
                <span className="hidden sm:inline">{label}</span>
              </button>
            );
          })}
        </div>

        {/* Right: Actions */}
        <div className="flex flex-wrap items-center justify-end gap-2 w-full sm:w-auto min-w-0">
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              showFilters
                ? "bg-[#1f8a65] text-white"
                : "bg-white/[0.05] text-white/60 hover:text-white hover:bg-white/[0.08]"
            }`}
          >
            <Filter size={12} />
            <span className="hidden sm:inline">Filtrer</span>
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#1f8a65] text-white text-[9px] font-bold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setShowManualEntry(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] text-xs font-semibold text-white/60 hover:text-white hover:bg-white/[0.08] transition-all"
          >
            <PenLine size={12} />
            <span className="hidden sm:inline">Saisie</span>
          </button>

          <CsvImportButton
            clientId={clientId}
            compact
            onImported={() => {
              showToast("Import CSV réussi");
              load();
            }}
          />
        </div>
      </div>

      {/* ── Bloc 2 : Panneau de filtres (inline) ── */}
      {showFilters && (
        <FilterPanel
          filter={filter}
          onChange={setFilter}
          fieldsWithData={fieldsWithData}
          viewMode={viewMode}
          onClose={() => setShowFilters(false)}
        />
      )}

      {/* ── Filtre actif pill ── */}
      {!showFilters && filter.preset !== "all" && (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1f8a65] text-white text-[10px] font-semibold">
            <Calendar size={10} />
            {filter.preset === "custom"
              ? `${filter.dateFrom ? formatDate(filter.dateFrom) : "…"} → ${filter.dateTo ? formatDate(filter.dateTo) : "…"}`
              : (
                  {
                    "1m": "1 mois",
                    "3m": "3 mois",
                    "6m": "6 mois",
                    "1y": "1 an",
                  } as Record<string, string>
                )[filter.preset]}
            <button
              onClick={() =>
                setFilter((p) => ({
                  ...p,
                  preset: "all",
                  dateFrom: "",
                  dateTo: "",
                }))
              }
              className="ml-1 opacity-60 hover:opacity-100"
            >
              <X size={9} />
            </button>
          </div>
          <p className="text-[10px] text-white/40">
            {filteredRows.length} mesure{filteredRows.length !== 1 ? "s" : ""}{" "}
            dans cette période
          </p>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="flex flex-col gap-4">
          {viewMode === "table" ? (
            <div className="bg-[#181818] border-subtle rounded-2xl overflow-hidden">
              <div className="grid grid-cols-[minmax(96px,1fr)_1.8fr] gap-3 border-b border-white/[0.06] px-4 py-3">
                <Skeleton className="h-3 w-24" />
                <div className="flex flex-wrap justify-end gap-3">
                  {Array.from({
                    length: Math.min(TABLE_COLS.length + 2, 6),
                  }).map((_, index) => (
                    <Skeleton key={index} className="h-3 w-14" />
                  ))}
                </div>
              </div>
              <div className="divide-y divide-white/[0.05]">
                {[1, 2, 3, 4].map((row) => (
                  <div
                    key={row}
                    className="grid grid-cols-[minmax(96px,1fr)_1.8fr] gap-3 px-4 py-3"
                  >
                    <Skeleton className="h-3 w-20" />
                    <div className="flex flex-wrap justify-end gap-3">
                      {Array.from({
                        length: Math.min(TABLE_COLS.length + 2, 6),
                      }).map((_, index) => (
                        <Skeleton key={index} className="h-3 w-14" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-4 py-3">
                <Skeleton className="h-3 w-40" />
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="bg-[#181818] border-subtle rounded-2xl p-5 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-2.5 w-20" />
                      <Skeleton className="w-7 h-7 rounded-lg" />
                    </div>
                    <Skeleton className="h-9 w-14" />
                  </div>
                ))}
              </div>
              <div className="bg-[#181818] border-subtle rounded-2xl p-5 space-y-3">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-48 w-full rounded-xl" />
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && !hasData && (
        <div className="bg-[#181818] border-subtle rounded-2xl p-10 flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-full bg-white/[0.06] flex items-center justify-center">
            <BarChart2 size={20} className="text-[#1f8a65]" />
          </div>
          <div>
            <p className="font-bold text-white">Aucune donnée</p>
            <p className="text-xs text-white/40 max-w-xs mt-1">
              Importez un fichier CSV depuis votre balance connectée, ou
              saisissez les mesures manuellement.
            </p>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={() => setShowManualEntry(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/[0.06] text-[#1f8a65] text-xs font-bold hover:bg-white/[0.09] transition-colors"
            >
              <PenLine size={13} />
              Saisie manuelle
            </button>
            <CsvImportButton
              clientId={clientId}
              compact
              onImported={() => {
                showToast("Import CSV réussi");
                load();
              }}
            />
          </div>
        </div>
      )}

      {/* ── Bloc 3 : TABLE VIEW ── */}
      {!loading && hasData && viewMode === "table" && (
        <div
          className={`bg-[#181818] border-subtle rounded-2xl overflow-hidden transition-all duration-700 delay-100 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="px-3 py-3 text-left w-8" />
                  <th className="px-3 py-3 text-left font-semibold text-[rgba(255,255,255,0.40)] uppercase tracking-wide text-[10px] whitespace-nowrap">
                    Date
                  </th>
                  {TABLE_COLS.map((f) => (
                    <th
                      key={f.key}
                      className="px-3 py-3 text-right font-semibold text-[rgba(255,255,255,0.40)] uppercase tracking-wide text-[10px] whitespace-nowrap"
                    >
                      {f.label}
                      {f.unit ? (
                        <span className="font-normal opacity-60 ml-0.5">
                          ({f.unit})
                        </span>
                      ) : null}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-right font-semibold text-[rgba(255,255,255,0.40)] uppercase tracking-wide text-[10px] whitespace-nowrap">
                    Tendance
                  </th>
                  <th className="px-3 py-3 w-16" />
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, idx) => {
                  const isExpanded = expandedRows.has(row.submissionId);
                  const allFieldsInRow = FIELDS.filter(
                    (f) => row.values[f.key] !== undefined,
                  );
                  const hiddenFields = allFieldsInRow.filter(
                    (f) => !TABLE_COLS.some((c) => c.key === f.key),
                  );
                  return (
                    <>
                      <tr
                        key={row.submissionId}
                        className="border-b border-white/[0.05] transition-colors hover:bg-white/[0.02]"
                      >
                        <td className="px-3 py-2.5">
                          {hiddenFields.length > 0 && (
                            <button
                              onClick={() => toggleRow(row.submissionId)}
                              className="text-white/40 hover:text-white/60 transition-colors"
                            >
                              {isExpanded ? (
                                <ChevronUp size={13} />
                              ) : (
                                <ChevronDown size={13} />
                              )}
                            </button>
                          )}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-white/60 whitespace-nowrap text-[11px]">
                          {formatDate(row.date)}
                        </td>
                        {TABLE_COLS.map((f) => (
                          <td
                            key={f.key}
                            className="px-3 py-2.5 text-right font-mono tabular-nums"
                          >
                            {row.values[f.key] !== undefined ? (
                              <span className="font-bold text-white">
                                {row.values[f.key]}
                              </span>
                            ) : (
                              <span className="text-white/40">—</span>
                            )}
                          </td>
                        ))}
                        <td className="px-3 py-2.5">
                          <div className="flex justify-end">
                            <Sparkline
                              data={(filteredSeries["weight_kg"] ?? []).slice(
                                0,
                                idx + 1,
                              )}
                            />
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setEditingRow(row)}
                              className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-[#0a0a0a] transition-colors"
                              title="Modifier"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(row)}
                              className="p-1.5 rounded-lg text-white/40 hover:text-red-500 hover:bg-red-500/15 transition-colors"
                              title="Supprimer"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && hiddenFields.length > 0 && (
                        <tr
                          key={`${row.submissionId}-exp`}
                          className="bg-white/[0.02] border-b border-white/[0.05]"
                        >
                          <td
                            colSpan={TABLE_COLS.length + 4}
                            className="px-6 py-3"
                          >
                            <div className="flex flex-wrap gap-4">
                              {hiddenFields.map((f) => (
                                <div
                                  key={f.key}
                                  className="flex items-center gap-1.5"
                                >
                                  <span className="text-[10px] text-[rgba(255,255,255,0.40)]">
                                    {f.label} :
                                  </span>
                                  <span className="font-mono text-xs font-bold text-white">
                                    {row.values[f.key]}
                                    {f.unit ? ` ${f.unit}` : ""}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="h-px bg-white/[0.06] mx-4" />
          <div className="px-4 py-2.5 flex items-center justify-between">
            <p className="text-[10px] text-[rgba(255,255,255,0.40)]">
              {filteredRows.length} mesure{filteredRows.length > 1 ? "s" : ""}
              {filter.preset !== "all" ? " (filtrées)" : " au total"}
            </p>
            <p className="text-[10px] text-white/40">
              ↕ Cliquez sur la flèche pour voir toutes les valeurs
            </p>
          </div>
        </div>
      )}

      {/* ── Bloc 4 : CHARTS VIEW ── */}
      {!loading && hasData && viewMode === "charts" && (
        <>
          {/* Sub-tabs: category + chart kind toggle */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-0.5 bg-white/[0.05] rounded-full p-1">
              {[
                { key: "composition" as ChartCategory, label: "Composition" },
                { key: "measurements" as ChartCategory, label: "Mensurations" },
                { key: "wellness" as ChartCategory, label: "Bien-être" },
              ].map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => setChartCategory(cat.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    chartCategory === cat.key
                      ? "bg-[#181818] text-white"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  {cat.label}
                  {fieldsWithData.filter((f) => f.category === cat.key).length >
                    0 && (
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded-full ${chartCategory === cat.key ? "bg-white/20 text-white/80" : "bg-white/[0.06] text-white/40"}`}
                    >
                      {
                        fieldsWithData.filter((f) => f.category === cat.key)
                          .length
                      }
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Bar / Line toggle */}
            <div
              className="flex items-center gap-0.5 bg-white/[0.05] rounded-lg p-0.5"
              title={chartKindByCategory[chartCategory] === "bar" ? "Passer en linéaire" : "Passer en barres"}
            >
              <button
                onClick={() => chartKindByCategory[chartCategory] !== "bar" && toggleChartKind(chartCategory)}
                className={`flex items-center justify-center w-7 h-7 rounded-md transition-all ${
                  chartKindByCategory[chartCategory] === "bar"
                    ? "bg-[#181818] text-white"
                    : "text-white/35 hover:text-white/60"
                }`}
              >
                <BarChart2 size={13} />
              </button>
              <button
                onClick={() => chartKindByCategory[chartCategory] !== "line" && toggleChartKind(chartCategory)}
                className={`flex items-center justify-center w-7 h-7 rounded-md transition-all ${
                  chartKindByCategory[chartCategory] === "line"
                    ? "bg-[#181818] text-white"
                    : "text-white/35 hover:text-white/60"
                }`}
              >
                <Activity size={13} />
              </button>
            </div>
          </div>

          {/* Slider bloc — avant les graphiques */}
          {SliderBlock}

          {/* Charts grid */}
          {chartsInCategory.length === 0 ? (
            <div className="bg-[#181818] border-subtle rounded-2xl p-8 text-center text-white/40 text-sm">
              Aucune donnée pour cette catégorie
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {chartsInCategory.map((f) => (
                <FullChart
                  key={f.key}
                  fieldKey={f.key}
                  data={filteredSeries[f.key] ?? []}
                  chartKind={chartKindByCategory[chartCategory]}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Bloc 5 : OVERLAY VIEW ── */}
      {!loading && hasData && viewMode === "overlay" && (
        <>
          {/* Graphique superposé */}
          <MultiSeriesChart
            selectedMetrics={overlayMetrics}
            series={filteredSeries}
            rows={filteredRows}
            clientId={clientId}
            clientGender={clientGender}
            phases={filteredPhases}
            annotations={filteredAnnotations}
            onPhasesChange={setPhases}
            onAnnotationsChange={setAnnotations}
            onAnnotationClick={(id) => {
              const ann = annotations.find((a) => a.id === id);
              if (ann) setNoteModal(ann);
            }}
            timeRangeDays={timeRangeDays}
            setTimeRangeDays={setTimeRangeDays}
          />

          {/* Bloc Phases & Événements — vue liste groupée par mois */}
          {(phases.length > 0 || annotations.length > 0) &&
            (() => {
              // Build unified timeline items sorted by date descending
              type TimelineItem =
                | { kind: "phase"; date: string; phase: TrainingPhase }
                | { kind: "ann"; date: string; ann: MetricAnnotation };

              const items: TimelineItem[] = [
                ...phases.map((p) => ({
                  kind: "phase" as const,
                  date: p.date_start,
                  phase: p,
                })),
                ...annotations.map((a) => ({
                  kind: "ann" as const,
                  date: a.event_date,
                  ann: a,
                })),
              ].sort((a, b) => b.date.localeCompare(a.date));

              // Group by "MMMM YYYY" (fr-FR)
              const groups: { label: string; items: TimelineItem[] }[] = [];
              for (const item of items) {
                const d = new Date(item.date + "T00:00:00");
                const label = d.toLocaleDateString("fr-FR", {
                  month: "long",
                  year: "numeric",
                });
                const last = groups[groups.length - 1];
                if (last && last.label === label) last.items.push(item);
                else groups.push({ label, items: [item] });
              }

              return (
                <div className="bg-[#181818] border-subtle rounded-2xl px-5 py-4">
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/[0.05]">
                    <p className="text-[9px] font-bold text-white/30 uppercase tracking-[0.18em]">
                      Phases & Événements
                    </p>
                    <span className="text-[9px] text-white/20 tabular-nums">
                      {phases.length + annotations.length} entrée
                      {phases.length + annotations.length > 1 ? "s" : ""}
                    </span>
                  </div>

                  <div className="flex flex-col gap-5">
                    {groups.map((group) => (
                      <div key={group.label}>
                        <p className="text-[9px] font-bold text-white/20 tracking-[0.14em] mb-2 capitalize">
                          {group.label}
                        </p>
                        <div className="flex flex-col gap-1">
                          {group.items.map((item, i) => {
                            if (item.kind === "phase") {
                              const ph = item.phase;
                              const c = PHASE_COLORS[ph.phase_type];
                              const dayStart = new Date(
                                ph.date_start + "T00:00:00",
                              ).toLocaleDateString("fr-FR", {
                                day: "2-digit",
                                month: "2-digit",
                              });
                              const dayEnd = ph.date_end
                                ? new Date(
                                    ph.date_end + "T00:00:00",
                                  ).toLocaleDateString("fr-FR", {
                                    day: "2-digit",
                                    month: "2-digit",
                                  })
                                : null;
                              return (
                                <div
                                  key={`phase-${ph.id}-${i}`}
                                  className="group flex items-center gap-2.5 px-3 py-2 rounded-lg"
                                  style={{ backgroundColor: c.bg }}
                                >
                                  {/* Color dot */}
                                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c.text }} />
                                  {/* Date */}
                                  <span className="text-[9px] tabular-nums w-[34px] shrink-0" style={{ color: c.text, opacity: 0.7 }}>
                                    {dayStart}
                                  </span>
                                  {/* Label */}
                                  <span className="text-[11px] font-semibold flex-1 min-w-0 truncate" style={{ color: c.text }}>
                                    {ph.label}
                                  </span>
                                  {/* Type + end date */}
                                  <span className="text-[9px] shrink-0" style={{ color: c.text, opacity: 0.55 }}>
                                    {PHASE_COLORS[ph.phase_type].label}{dayEnd ? ` → ${dayEnd}` : ""}
                                  </span>
                                  {/* Actions */}
                                  {phaseDeleteConfirm === ph.id ? (
                                    <div className="flex items-center gap-1 ml-1 shrink-0">
                                      <button
                                        onClick={async () => {
                                          await fetch(`/api/clients/${clientId}/phases/${ph.id}`, { method: "DELETE" });
                                          setPhases((prev) => prev.filter((p) => p.id !== ph.id));
                                          setPhaseDeleteConfirm(null);
                                        }}
                                        className="text-[9px] font-bold text-red-400 hover:text-red-300 transition-colors px-1"
                                      >
                                        Oui
                                      </button>
                                      <button
                                        onClick={() => setPhaseDeleteConfirm(null)}
                                        className="text-[9px] text-white/30 hover:text-white/60 transition-colors px-1"
                                      >
                                        Non
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-0.5 ml-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setPhaseEditModal(ph); }}
                                        className="p-1 rounded text-white/20 hover:text-white/60 transition-colors"
                                        title="Modifier"
                                      >
                                        <Edit2 size={9} />
                                      </button>
                                      <button
                                        onClick={() => setPhaseDeleteConfirm(ph.id)}
                                        className="p-1 rounded text-white/20 hover:text-red-400 transition-colors"
                                        title="Supprimer"
                                      >
                                        <Trash2 size={9} />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            }

                            // annotation
                            const ann = item.ann;
                            const day = new Date(
                              ann.event_date + "T00:00:00",
                            ).toLocaleDateString("fr-FR", {
                              day: "2-digit",
                              month: "2-digit",
                            });
                            return (
                              <button
                                key={`ann-${ann.id}-${i}`}
                                onClick={() => setNoteModal(ann)}
                                className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] transition-all text-left group w-full"
                              >
                                {/* Emoji */}
                                <span className="text-[13px] shrink-0 w-[18px] text-center">
                                  {ANNOTATION_ICONS[ann.event_type]}
                                </span>
                                {/* Date */}
                                <span className="text-[9px] text-white/30 tabular-nums w-[34px] shrink-0">
                                  {day}
                                </span>
                                {/* Label */}
                                <span className="text-[11px] font-medium text-white/75 group-hover:text-white/90 transition-colors flex-1 min-w-0 truncate">
                                  {ann.label}
                                </span>
                                {/* Type badge */}
                                <span className="text-[8px] text-white/20 shrink-0 font-semibold uppercase tracking-[0.10em]">
                                  {ANNOTATION_LABELS[ann.event_type]}
                                </span>
                                {/* Body dot — has detail */}
                                {ann.body && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-white/20 shrink-0" title="Contient un détail" />
                                )}
                                {/* Arrow */}
                                <ChevronDown
                                  size={10}
                                  className="text-white/15 group-hover:text-white/35 transition-colors shrink-0 -rotate-90"
                                />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
        </>
      )}

      {/* ── Bloc 6 : NORMS VIEW ── */}
      {viewMode === "norms" && normsSubmissionId && (
        <BioNormsPanel
          clientId={clientId}
          clientProfile={{ sex: clientGender, date_of_birth: clientDateOfBirth }}
        />
      )}

      {/* ── Modals ── */}
      {editingRow && (
        <EditRowModal
          row={editingRow}
          clientId={clientId}
          onClose={() => setEditingRow(null)}
          onSaved={() => {
            setEditingRow(null);
            showToast("Mesure modifiée");
            load();
          }}
        />
      )}
      {showManualEntry && (
        <ManualEntryForm
          clientId={clientId}
          onClose={() => setShowManualEntry(false)}
          onSaved={() => {
            setShowManualEntry(false);
            showToast("Mesure enregistrée");
            load();
          }}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#181818] rounded-2xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-white mb-2">
              Supprimer cette mesure ?
            </h3>
            <p className="text-sm text-white/60 mb-5">
              La mesure du{" "}
              <span className="font-semibold text-white">
                {formatDate(deleteTarget.date)}
              </span>{" "}
              sera définitivement supprimée.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 rounded-xl bg-white/[0.05] text-sm text-white/60 hover:text-white transition-colors font-medium"
              >
                Annuler
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-lg bg-red-500/15 text-red-300 text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {deleting ? "Suppression…" : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {noteModal && (
        <NoteModal
          ann={noteModal}
          clientId={clientId}
          onClose={() => setNoteModal(null)}
          onSaved={(updated) => {
            setAnnotations((prev) =>
              prev.map((a) => (a.id === updated.id ? updated : a)),
            );
            setNoteModal(updated);
          }}
          onDeleted={(id) => {
            setAnnotations((prev) => prev.filter((a) => a.id !== id));
            setNoteModal(null);
          }}
        />
      )}

      {/* ── Phase edit modal (from list) ── */}
      {phaseEditModal && (() => {
        const ph = phaseEditModal;
        const localRef = { current: { label: ph.label, phase_type: ph.phase_type, date_start: ph.date_start, date_end: ph.date_end ?? "", notes: ph.notes ?? "" } };
        return (
          <PhaseEditModal
            phase={ph}
            onClose={() => setPhaseEditModal(null)}
            onSave={async (form) => {
              setPhaseEditSaving(true);
              try {
                const res = await fetch(`/api/clients/${clientId}/phases/${ph.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ label: form.label, phase_type: form.phase_type, date_start: form.date_start, date_end: form.date_end || null, notes: form.notes || null }),
                });
                if (res.ok) {
                  const updated = await res.json();
                  setPhases((prev) => prev.map((p) => (p.id === ph.id ? updated : p)));
                  setPhaseEditModal(null);
                  showToast("Phase modifiée");
                }
              } finally {
                setPhaseEditSaving(false);
              }
            }}
            saving={phaseEditSaving}
          />
        );
        void localRef;
      })()}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#181818] text-white text-xs font-bold px-4 py-2.5 rounded-full flex items-center gap-2">
          <CheckCircle2 size={13} className="text-[#1f8a65]" />
          {toast}
        </div>
      )}
    </div>
  );
}
