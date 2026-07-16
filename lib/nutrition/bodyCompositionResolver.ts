import {
  calculateBMI,
  navyBodyFatPct,
  round1,
  type Sex,
} from "@/lib/health/healthMath";
import {
  calculateLBMFromBF,
  calculateMuscleMassFromBF,
} from "@/lib/nutrition/calculators";
import type { NutritionClientData } from "@/lib/nutrition/types";

export type CompositionResolverKey = "bmr" | "weight" | "height" | "bf" | "steps" | "lean_mass" | "muscle_mass";

export type CompositionSourceKind = "selected" | "fallback" | "manual" | "estimated";

export type CompositionEstimateMethodId =
  | "existing-body-fat"
  | "existing-lean-mass"
  | "us-navy"
  | "relative-fat-mass"
  | "deurenberg";

export type CompositionEstimateMethod = {
  id: CompositionEstimateMethodId;
  label: string;
  description: string;
  primaryValueLabel: string;
  primaryValue: number;
  bodyFatPct: number | null;
  leanMassKg: number | null;
  muscleMassKg: number | null;
  fieldsResolved: CompositionResolverKey[];
  caution: string;
};

type CompositionContext = {
  weightKg: number | null;
  heightCm: number | null;
  age: number | null;
  sex: Sex | null;
  waistCm: number | null;
  neckCm: number | null;
  hipsCm: number | null;
  bodyFatPct: number | null;
  leanMassKg: number | null;
};

function mapSex(gender: string | null | undefined): Sex | null {
  if (gender === "female" || gender === "F") return "female";
  if (gender === "male" || gender === "M") return "male";
  return null;
}

function clampBodyFat(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  if (value < 3 || value > 65) return null;
  return round1(value);
}

function buildContext(clientData: NutritionClientData | null): CompositionContext {
  return {
    weightKg: clientData?.weight_kg ?? null,
    heightCm: clientData?.height_cm ?? null,
    age: clientData?.age ?? null,
    sex: mapSex(clientData?.gender),
    waistCm: clientData?.waist_cm ?? null,
    neckCm: clientData?.neck_cm ?? null,
    hipsCm: clientData?.hips_cm ?? null,
    bodyFatPct: clientData?.body_fat_pct ?? null,
    leanMassKg: clientData?.lean_mass_kg ?? null,
  };
}

function fieldsResolvedForMethod(
  missingKey: CompositionResolverKey,
  values: { bodyFatPct: number | null; leanMassKg: number | null; muscleMassKg: number | null },
): CompositionResolverKey[] {
  const resolved: CompositionResolverKey[] = [];
  if ((missingKey === "bf" || missingKey === "lean_mass" || missingKey === "muscle_mass") && values.bodyFatPct != null) {
    resolved.push("bf");
  }
  if ((missingKey === "lean_mass" || missingKey === "muscle_mass") && values.leanMassKg != null) {
    resolved.push("lean_mass");
  }
  if (missingKey === "muscle_mass" && values.muscleMassKg != null) {
    resolved.push("muscle_mass");
  }
  return Array.from(new Set(resolved));
}

function buildDerivedMethod(
  missingKey: CompositionResolverKey,
  id: CompositionEstimateMethodId,
  label: string,
  description: string,
  bodyFatPct: number | null,
  leanMassKg: number | null,
  muscleMassKg: number | null,
  caution: string,
): CompositionEstimateMethod | null {
  const primaryValue =
    missingKey === "bf"
      ? bodyFatPct
      : missingKey === "lean_mass"
        ? leanMassKg
        : muscleMassKg;

  if (primaryValue == null) return null;

  return {
    id,
    label,
    description,
    primaryValueLabel:
      missingKey === "bf"
        ? "% masse grasse"
        : missingKey === "lean_mass"
          ? "Masse maigre"
          : "Masse musculaire",
    primaryValue,
    bodyFatPct,
    leanMassKg,
    muscleMassKg,
    fieldsResolved: fieldsResolvedForMethod(missingKey, {
      bodyFatPct,
      leanMassKg,
      muscleMassKg,
    }),
    caution,
  };
}

export function getBodyCompositionEstimateMethods(
  missingKey: CompositionResolverKey | null,
  clientData: NutritionClientData | null,
): CompositionEstimateMethod[] {
  if (!missingKey || !clientData) return [];
  if (!["bf", "lean_mass", "muscle_mass"].includes(missingKey)) return [];

  const ctx = buildContext(clientData);
  const methods: CompositionEstimateMethod[] = [];

  if (ctx.weightKg && ctx.bodyFatPct != null) {
    const leanMassKg = calculateLBMFromBF(ctx.weightKg, ctx.bodyFatPct);
    const muscleMassKg = calculateMuscleMassFromBF(ctx.weightKg, ctx.bodyFatPct);
    const existingBodyFatMethod = buildDerivedMethod(
      missingKey,
      "existing-body-fat",
      "Dériver depuis la masse grasse disponible",
      "Utilise le % de masse grasse déjà présent pour recalculer les compartiments corporels.",
      round1(ctx.bodyFatPct),
      leanMassKg,
      muscleMassKg,
      "Rapide et cohérent si le % masse grasse actuel est suffisamment fiable.",
    );
    if (existingBodyFatMethod) methods.push(existingBodyFatMethod);
  }

  if (ctx.weightKg && ctx.leanMassKg != null && missingKey === "muscle_mass") {
    const muscleMassKg = round1(ctx.leanMassKg * 0.85);
    const existingLeanMethod = buildDerivedMethod(
      missingKey,
      "existing-lean-mass",
      "Dériver depuis la masse maigre disponible",
      "Heuristique simple pour estimer la masse musculaire à partir de la masse maigre.",
      ctx.bodyFatPct != null ? round1(ctx.bodyFatPct) : null,
      round1(ctx.leanMassKg),
      muscleMassKg,
      "La masse musculaire estimée reste plus fragile qu'une mesure impédancemétrique.",
    );
    if (existingLeanMethod) methods.push(existingLeanMethod);
  }

  if (ctx.weightKg && ctx.heightCm && ctx.sex && ctx.waistCm && ctx.neckCm) {
    const rawNavy = navyBodyFatPct(
      ctx.sex,
      ctx.waistCm,
      ctx.neckCm,
      ctx.heightCm,
      ctx.sex === "female" ? ctx.hipsCm ?? undefined : undefined,
    );
    const bodyFatPct = clampBodyFat(rawNavy);
    if (bodyFatPct != null) {
      const leanMassKg = calculateLBMFromBF(ctx.weightKg, bodyFatPct);
      const muscleMassKg = calculateMuscleMassFromBF(ctx.weightKg, bodyFatPct);
      const navyMethod = buildDerivedMethod(
        missingKey,
        "us-navy",
        "US Navy",
        "Estimation anthropométrique à partir de la taille, du cou et du tour de taille.",
        bodyFatPct,
        leanMassKg,
        muscleMassKg,
        "Précision indicative ±3 à 5%. Pertinent si les mensurations sont propres.",
      );
      if (navyMethod) methods.push(navyMethod);
    }
  }

  if (ctx.weightKg && ctx.heightCm && ctx.sex && ctx.waistCm) {
    const rawRfm =
      ctx.sex === "female"
        ? 76 - 20 * (ctx.heightCm / ctx.waistCm)
        : 64 - 20 * (ctx.heightCm / ctx.waistCm);
    const bodyFatPct = clampBodyFat(rawRfm);
    if (bodyFatPct != null) {
      const leanMassKg = calculateLBMFromBF(ctx.weightKg, bodyFatPct);
      const muscleMassKg = calculateMuscleMassFromBF(ctx.weightKg, bodyFatPct);
      const rfmMethod = buildDerivedMethod(
        missingKey,
        "relative-fat-mass",
        "Relative Fat Mass",
        "Méthode légère basée sur le ratio taille / tour de taille.",
        bodyFatPct,
        leanMassKg,
        muscleMassKg,
        "Plus robuste qu'un simple IMC, mais moins spécifique qu'une mesure de composition directe.",
      );
      if (rfmMethod) methods.push(rfmMethod);
    }
  }

  if (ctx.weightKg && ctx.heightCm && ctx.age && ctx.sex) {
    const bmi = calculateBMI(ctx.weightKg, ctx.heightCm);
    const sexFactor = ctx.sex === "male" ? 1 : 0;
    const rawDeurenberg = 1.2 * bmi + 0.23 * ctx.age - 10.8 * sexFactor - 5.4;
    const bodyFatPct = clampBodyFat(rawDeurenberg);
    if (bodyFatPct != null) {
      const leanMassKg = calculateLBMFromBF(ctx.weightKg, bodyFatPct);
      const muscleMassKg = calculateMuscleMassFromBF(ctx.weightKg, bodyFatPct);
      const deurenbergMethod = buildDerivedMethod(
        missingKey,
        "deurenberg",
        "Deurenberg",
        "Estimation populationnelle à partir de l'IMC, de l'âge et du sexe.",
        bodyFatPct,
        leanMassKg,
        muscleMassKg,
        "Méthode pratique quand les mensurations sont absentes, mais moins individualisée.",
      );
      if (deurenbergMethod) methods.push(deurenbergMethod);
    }
  }

  return methods.filter((method, index, array) => array.findIndex((item) => item.id === method.id) === index);
}

export function getBodyCompositionMissingInputs(
  missingKey: CompositionResolverKey | null,
  clientData: NutritionClientData | null,
): string[] {
  if (!missingKey || !clientData) return [];
  if (!["bf", "lean_mass", "muscle_mass"].includes(missingKey)) return [];

  const ctx = buildContext(clientData);
  const missing = new Set<string>();

  if (!ctx.weightKg) missing.add("poids");
  if (!ctx.heightCm) missing.add("taille");
  if (!ctx.age) missing.add("âge");
  if (!ctx.sex) missing.add("sexe");
  if (!ctx.waistCm) missing.add("tour de taille");
  if (!ctx.neckCm) missing.add("tour de cou");
  if (ctx.sex === "female" && !ctx.hipsCm) missing.add("tour de hanches");

  return Array.from(missing);
}
