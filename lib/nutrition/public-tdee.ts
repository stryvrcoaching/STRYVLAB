import { calculateMacros, type MacroGoal, type MacroGender } from "@/lib/formulas/macros";

export type PublicTdeeMenstrualPhase = "follicular" | "luteal" | "unknown";

export interface PublicTdeeInput {
  gender: MacroGender;
  age: number;
  heightCm: number;
  weightKg: number;
  goal: MacroGoal;
  dailySteps?: number;
  occupationMultiplier?: number;
  workoutsPerWeek?: number;
  sessionDurationMin?: number;
  cardioSessionsPerWeek?: number;
  cardioDurationMin?: number;
  bodyFatPct?: number;
  bmrMeasuredKcal?: number;
  sleepHours?: number;
  stressLevel?: number;
  caffeineDailyMg?: number;
  alcoholWeekly?: number;
  menstrualPhase?: PublicTdeeMenstrualPhase;
}

export interface PublicTdeeMacros {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface PublicTdeeDaySplit {
  trainingDays: number;
  restDays: number;
  spreadKcal: number;
  trainingDayCalories: number;
  restDayCalories: number;
  averageCalories: number;
  weeklyCalories: number;
  trainingMacros: PublicTdeeMacros;
  restMacros: PublicTdeeMacros;
}

export interface PublicTdeePlan {
  input: PublicTdeeInput;
  result: ReturnType<typeof calculateMacros>;
  split: PublicTdeeDaySplit;
  confidence: {
    score: number;
    label: "high" | "medium" | "low";
  };
  assumptions: string[];
  guardrails: string[];
  premiumSummary: string[];
  exportText: string;
  shareQuery: string;
}

export interface PublicTdeeValidationIssue {
  field: keyof PublicTdeeInput | "unknown";
  message: string;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number) {
  return Math.round(value);
}

function buildMacros(calories: number, protein: number, fat: number): PublicTdeeMacros {
  const proteinCalories = round(protein * 4);
  const maxFatCalories = Math.max(0, calories - proteinCalories);
  const cappedFatCalories = Math.min(round(fat * 9), maxFatCalories);
  const carbs = Math.max(0, round((calories - proteinCalories - cappedFatCalories) / 4));
  return {
    calories: round(proteinCalories + cappedFatCalories + carbs * 4),
    protein_g: round(protein),
    carbs_g: carbs,
    fat_g: round(cappedFatCalories / 9),
  };
}

export function validatePublicTdeeInput(input: Partial<PublicTdeeInput>): PublicTdeeValidationIssue[] {
  const issues: PublicTdeeValidationIssue[] = [];

  if (input.gender !== "male" && input.gender !== "female") {
    issues.push({ field: "gender", message: "Le sexe est requis." });
  }

  if (input.age == null || Number.isNaN(input.age) || input.age < 15 || input.age > 85) {
    issues.push({ field: "age", message: "L'âge doit être compris entre 15 et 85 ans." });
  }

  if (input.heightCm == null || Number.isNaN(input.heightCm) || input.heightCm < 140 || input.heightCm > 220) {
    issues.push({ field: "heightCm", message: "La taille doit être comprise entre 140 et 220 cm." });
  }

  if (input.weightKg == null || Number.isNaN(input.weightKg) || input.weightKg < 40 || input.weightKg > 250) {
    issues.push({ field: "weightKg", message: "Le poids doit être compris entre 40 et 250 kg." });
  }

  if (input.goal !== "deficit" && input.goal !== "maintenance" && input.goal !== "surplus") {
    issues.push({ field: "goal", message: "L'objectif est requis." });
  }

  return issues;
}

function buildConfidenceScore(input: PublicTdeeInput, result: ReturnType<typeof calculateMacros>) {
  let score = 45;

  if (input.bodyFatPct != null) score += 10;
  if (input.bmrMeasuredKcal != null) score += 15;
  if ((input.dailySteps ?? 0) > 0) score += 8;
  if ((input.workoutsPerWeek ?? 0) > 0) score += 8;
  if ((input.sessionDurationMin ?? 0) > 0) score += 4;
  if ((input.cardioSessionsPerWeek ?? 0) > 0 && (input.cardioDurationMin ?? 0) > 0) score += 4;
  if (input.sleepHours != null) score += 3;
  if (input.stressLevel != null) score += 3;
  if (input.caffeineDailyMg != null || input.alcoholWeekly != null) score += 2;
  if (input.gender === "female" && input.menstrualPhase && input.menstrualPhase !== "unknown") score += 3;
  if ((input.occupationMultiplier ?? 1) !== 1) score += 2;
  if (result.dataProvenance.bmrSource === "measured") score += 3;

  const capped = clamp(score, 0, 100);
  return {
    score: capped,
    label: capped >= 80 ? "high" : capped >= 60 ? "medium" : "low",
  } as const;
}

function buildAssumptions(input: PublicTdeeInput, result: ReturnType<typeof calculateMacros>) {
  const assumptions: string[] = [];

  if (result.dataProvenance.bmrSource !== "measured") {
    assumptions.push("BMR estimé par formule plutôt que mesuré.");
  }
  if (result.dataProvenance.lbmSource === "boer") {
    assumptions.push("Masse maigre estimée via Boer faute de body fat ou de masse maigre mesurée.");
  }
  if ((input.cardioSessionsPerWeek ?? 0) === 0 || (input.cardioDurationMin ?? 0) === 0) {
    assumptions.push("Le cardio n'est pas détaillé séparément.");
  }
  if ((input.workoutsPerWeek ?? 0) === 0) {
    assumptions.push("Pas de différenciation training/rest si aucune séance n'est renseignée.");
  }
  if (input.gender === "female" && (!input.menstrualPhase || input.menstrualPhase === "unknown")) {
    assumptions.push("Aucun ajustement cycle menstruel appliqué.");
  }
  if (input.sleepHours == null && input.stressLevel == null) {
    assumptions.push("Aucun module récupération n'a été appliqué.");
  }

  return assumptions;
}

function buildGuardrails(input: PublicTdeeInput, result: ReturnType<typeof calculateMacros>) {
  const guardrails: string[] = [];

  guardrails.push(...result.warnings.map((warning) => warning.replace(/^⚠️\s*/, "")));

  if (result.breakdown.bmr < 1300) {
    guardrails.push("BMR très bas, prudence sur les déficits agressifs.");
  }
  if (input.goal === "surplus" && result.estimatedBF > (input.gender === "male" ? 18 : 28)) {
    guardrails.push("Surplus peu pertinent si le taux de masse grasse reste élevé.");
  }
  if (input.goal === "deficit" && result.recoveryAdaptation) {
    guardrails.push("Le déficit est modulé à la hausse si récupération trop faible.");
  }

  if (guardrails.length === 0) {
    guardrails.push("Plan conservateur construit à partir des données disponibles.");
  }

  return Array.from(new Set(guardrails)).slice(0, 6);
}

function buildSplit(input: PublicTdeeInput, result: ReturnType<typeof calculateMacros>): PublicTdeeDaySplit {
  const trainingDays = clamp(Math.round(input.workoutsPerWeek ?? 0), 0, 7);
  const restDays = 7 - trainingDays;
  const baseCalories = round(result.calories);
  const exerciseLoad = round(result.breakdown.eat + result.breakdown.eatCardio);

  const spreadKcal =
    trainingDays > 0 && restDays > 0
      ? clamp(round(Math.max(80, exerciseLoad * 0.8 + (result.breakdown.neat * 0.05))), 80, 320)
      : 0;

  const trainingOffset = restDays > 0 ? round((spreadKcal * restDays) / 7) : 0;
  const restOffset = trainingDays > 0 ? round((spreadKcal * trainingDays) / 7) : 0;

  const trainingDayCalories = baseCalories + trainingOffset;
  const restDayCalories = baseCalories - restOffset;
  const averageCalories = baseCalories;
  const weeklyCalories = baseCalories * 7;

  const trainingMacros = buildMacros(trainingDayCalories, result.macros.p, result.macros.f);
  const restMacros = buildMacros(restDayCalories, result.macros.p, result.macros.f);

  return {
    trainingDays,
    restDays,
    spreadKcal,
    trainingDayCalories,
    restDayCalories,
    averageCalories,
    weeklyCalories,
    trainingMacros,
    restMacros,
  };
}

function buildPremiumSummary(input: PublicTdeeInput, result: ReturnType<typeof calculateMacros>, confidence: PublicTdeePlan["confidence"]) {
  return [
    `BMR ${result.dataProvenance.bmrSource === "measured" ? "mesuré" : "estimé"} · confiance ${confidence.score}/100`,
    `NEAT piloté par ${((input.dailySteps ?? 0) > 0 ? "les pas" : "un niveau neutre")} et le contexte pro.`,
    `EAT basé sur ${input.workoutsPerWeek ?? 0} séance${(input.workoutsPerWeek ?? 0) > 1 ? "s" : ""} / semaine.`,
    `TEF conservé comme couche stable à partir du BMR.`,
  ];
}

function buildShareQuery(input: PublicTdeeInput) {
  const params = new URLSearchParams();
  params.set("gender", input.gender);
  params.set("age", String(input.age));
  params.set("height", String(input.heightCm));
  params.set("weight", String(input.weightKg));
  params.set("goal", input.goal);

  if (input.dailySteps != null) params.set("steps", String(input.dailySteps));
  if (input.occupationMultiplier != null) params.set("occupation", String(input.occupationMultiplier));
  if (input.workoutsPerWeek != null) params.set("workouts", String(input.workoutsPerWeek));
  if (input.sessionDurationMin != null) params.set("duration", String(input.sessionDurationMin));
  if (input.cardioSessionsPerWeek != null) params.set("cardio", String(input.cardioSessionsPerWeek));
  if (input.cardioDurationMin != null) params.set("cardioDuration", String(input.cardioDurationMin));
  if (input.bodyFatPct != null) params.set("bodyFat", String(input.bodyFatPct));
  if (input.bmrMeasuredKcal != null) params.set("bmr", String(input.bmrMeasuredKcal));
  if (input.sleepHours != null) params.set("sleep", String(input.sleepHours));
  if (input.stressLevel != null) params.set("stress", String(input.stressLevel));
  if (input.caffeineDailyMg != null) params.set("caffeine", String(input.caffeineDailyMg));
  if (input.alcoholWeekly != null) params.set("alcohol", String(input.alcoholWeekly));
  if (input.menstrualPhase && input.menstrualPhase !== "unknown") params.set("cycle", input.menstrualPhase);

  return params.toString();
}

export function computePublicTdeePlan(input: PublicTdeeInput): PublicTdeePlan {
  const issues = validatePublicTdeeInput(input);
  if (issues.length > 0) {
    const error = issues.map((issue) => issue.message).join(" ");
    throw new Error(error);
  }

  const result = calculateMacros({
    gender: input.gender,
    age: input.age,
    weight: input.weightKg,
    height: input.heightCm,
    goal: input.goal,
    bodyFat: input.bodyFatPct ?? undefined,
    bmrKcalMeasured: input.bmrMeasuredKcal ?? undefined,
    steps: input.dailySteps ?? undefined,
    occupationMultiplier: input.occupationMultiplier ?? 1,
    workouts: input.workoutsPerWeek ?? 0,
    sessionDurationMin: input.sessionDurationMin ?? undefined,
    cardioFrequency: input.cardioSessionsPerWeek ?? undefined,
    cardioDurationMin: input.cardioDurationMin ?? undefined,
    stressLevel: input.stressLevel ?? undefined,
    sleepDurationH: input.sleepHours ?? undefined,
    caffeineDaily: input.caffeineDailyMg ?? undefined,
    alcoholWeekly: input.alcoholWeekly ?? undefined,
    menstrualPhase: input.gender === "female" ? input.menstrualPhase ?? undefined : undefined,
  });

  const confidence = buildConfidenceScore(input, result);
  const split = buildSplit(input, result);
  const assumptions = buildAssumptions(input, result);
  const guardrails = buildGuardrails(input, result);
  const premiumSummary = buildPremiumSummary(input, result, confidence);
  const shareQuery = buildShareQuery(input);
  const exportText = [
    `STRYV TDEE Expert`,
    `Objectif: ${input.goal}`,
    `Calories moyennes: ${split.averageCalories} kcal`,
    `Jour training: ${split.trainingDayCalories} kcal`,
    `Jour repos: ${split.restDayCalories} kcal`,
    `Macros moyennes: P ${result.macros.p}g · G ${result.macros.c}g · L ${result.macros.f}g`,
    `BMR / NEAT / EAT / TEF: ${result.breakdown.bmr} / ${result.breakdown.neat} / ${result.breakdown.eat + result.breakdown.eatCardio} / ${round(result.breakdown.tef)}`,
  ].join("\n");

  return {
    input,
    result,
    split,
    confidence,
    assumptions,
    guardrails,
    premiumSummary,
    exportText,
    shareQuery,
  };
}
