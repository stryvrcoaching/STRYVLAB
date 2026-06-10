// Scientific referential constants
// Based on REFERENTIEL.md (5 modules, 68 references)

export const REFERENTIAL_MODULES = {
  METABOLISM: 'metabolism',
  HORMONAL: 'hormonal',
  MUSCULAR: 'muscular',
  NUTRITIONAL: 'nutritional',
  RECOVERY: 'recovery',
} as const;

export type ReferentialModule = typeof REFERENTIAL_MODULES[keyof typeof REFERENTIAL_MODULES];

// Key physiological constants
export const PHYSIOLOGICAL_CONSTANTS = {
  // Metabolism
  BMR_FORMULA_MULTIPLIER: 1.2, // Light activity multiplier
  TDEE_ACTIVITY_FACTORS: {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
  },

  // Nutrition
  PROTEIN_INTAKE_G_PER_KG_LBM: 1.8,
  FAT_INTAKE_PCT_CALORIES: 0.25,
  CARB_CYCLING_RANGES: {
    high: 2.5, // g/kg
    medium: 2.0,
    low: 1.5,
    rest: 1.0,
  },

  // Training
  RPE_SCALE_MAX: 10,
  VOLUME_RECOVERY_WINDOW_HOURS: 48,
  PROGRESSION_INCREMENT_PCT: 5,

  // Recovery
  SLEEP_OPTIMAL_HOURS: 8,
  STRESS_IMPACT_FACTOR: 0.1,
} as const;

// Cycle phases for women
export const CYCLE_PHASES = {
  MENSTRUAL: 'menstrual',
  FOLLICULAR: 'follicular',
  OVULATORY: 'ovulatory',
  LUTEAL: 'luteal',
} as const;

export type CyclePhase = typeof CYCLE_PHASES[keyof typeof CYCLE_PHASES];

// Training goals
export const TRAINING_GOALS = {
  HYPERTROPHY: 'hypertrophy',
  STRENGTH: 'strength',
  ENDURANCE: 'endurance',
  FAT_LOSS: 'fat_loss',
  RECOMP: 'recomp',
  MAINTENANCE: 'maintenance',
} as const;

export type TrainingGoal = typeof TRAINING_GOALS[keyof typeof TRAINING_GOALS];

// Safety thresholds
export const SAFETY_THRESHOLDS = {
  MAX_WEEKLY_VOLUME_INCREASE_PCT: 10,
  MIN_RECOVERY_DAYS_PER_WEEK: 1,
  MAX_CONSECUTIVE_HIGH_INTENSITY_DAYS: 3,
  ALERT_FATIGUE_SCORE: 80,
} as const;