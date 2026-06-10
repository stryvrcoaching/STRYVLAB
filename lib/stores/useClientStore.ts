'use client';

/**
 * useClientStore — Zustand store, source de vérité unique pour le Performance Lab
 *
 * Principe: toutes les données biométriques du client sont centralisées ici.
 * setProfile() → recalculateAll() automatiquement (chain reaction).
 * cyclePhase → macros +200 kcal si luteal.
 * caloriesOffset → override coach sans corrompre la donnée source.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  calculateHRZones, HRZonesResult,
  calculateHydration, HydrationResult, HydrationActivity, HydrationClimate,
  calculateMacros, MacroResult, MacroGoal, MacroGender,
  OneRMResult, OneRMFormula,
} from '@/lib/formulas';

// ─── Types publics ─────────────────────────────────────────────────────────────

export type CyclePhase = 'menstrual' | 'follicular' | 'ovulatory' | 'luteal' | null;

export interface ClientProfile {
  weight: number | null;       // kg
  height: number | null;       // cm
  age: number | null;
  gender: MacroGender;
  bodyFat: number | null;      // % — optional
  steps: number | null;        // daily steps
  workouts: number | null;     // weekly workouts
  activityLevel: HydrationActivity;
  climate: HydrationClimate;
  macroGoal: MacroGoal;
  cyclePhase: CyclePhase;      // CycleSync integration
  // Manual overrides (DisplayValue = BaseFormula + offset)
  caloriesOffset: number;      // kcal delta (coach override)
}

export interface CalculationResults {
  macros: MacroResult | null;
  hrZones: HRZonesResult | null;
  hydration: HydrationResult | null;
  oneRM: OneRMResult | null;
  bodyFatPercent: number | null;
}

export type SmartAlertLevel = 'info' | 'warning' | 'danger';

export interface SmartAlert {
  id: string;
  level: SmartAlertLevel;
  message: string;
}

interface ClientStore {
  profile: ClientProfile;
  results: CalculationResults;
  alerts: SmartAlert[];

  // Setters
  setProfile: (update: Partial<ClientProfile>) => void;
  resetProfile: () => void;

  // Compute all results from current profile
  recalculateAll: () => void;

  // Per-calculator helpers
  setOneRMResult: (result: OneRMResult, formula: OneRMFormula) => void;

  // Overrides
  setCaloriesOffset: (offset: number) => void;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_PROFILE: ClientProfile = {
  weight: null,
  height: null,
  age: null,
  gender: 'male',
  bodyFat: null,
  steps: null,
  workouts: null,
  activityLevel: 'moderate',
  climate: 'temperate',
  macroGoal: 'maintenance',
  cyclePhase: null,
  caloriesOffset: 0,
};

const DEFAULT_RESULTS: CalculationResults = {
  macros: null,
  hrZones: null,
  hydration: null,
  oneRM: null,
  bodyFatPercent: null,
};

// ─── Smart alerts computation (pure) ─────────────────────────────────────────

function computeAlerts(profile: ClientProfile, results: CalculationResults): SmartAlert[] {
  const alerts: SmartAlert[] = [];

  // High injury risk: female, ovulatory phase, high intensity training
  if (
    profile.gender === 'female' &&
    profile.cyclePhase === 'ovulatory' &&
    profile.workouts !== null &&
    profile.workouts >= 5
  ) {
    alerts.push({
      id: 'high_injury_risk',
      level: 'warning',
      message: 'Phase ovulatoire + entraînement intense: Laxité ligamentaire accrue. Échauffement 15-20min obligatoire.',
    });
  }

  // Luteal phase: caloric needs increase
  if (profile.gender === 'female' && profile.cyclePhase === 'luteal' && results.macros) {
    alerts.push({
      id: 'luteal_metabolism',
      level: 'info',
      message: 'Phase lutéale: Métabolisme +8% (progestérone). +200 kcal appliqués automatiquement.',
    });
  }

  // Low calories warning
  if (results.macros && results.macros.calories < 1400) {
    alerts.push({
      id: 'low_calories',
      level: 'danger',
      message: `Calories critiques (${results.macros.calories} kcal). Risque de catabolisme et dysfonction hormonale.`,
    });
  }

  // BF% + surplus warning
  const bf = profile.bodyFat ?? results.bodyFatPercent;
  const maxBFForSurplus = profile.gender === 'male' ? 18 : 28;
  if (profile.macroGoal === 'surplus' && bf !== null && bf > maxBFForSurplus) {
    alerts.push({
      id: 'surplus_high_bf',
      level: 'warning',
      message: `BF% élevé (${bf.toFixed(1)}%) avec objectif surplus. Un léger cut est conseillé d'abord.`,
    });
  }

  // High deficit warning
  if (results.macros && results.macros.adjustment < -600) {
    alerts.push({
      id: 'aggressive_deficit',
      level: 'warning',
      message: `Déficit agressif (${results.macros.adjustment} kcal). Surveiller la force et la récupération.`,
    });
  }

  return alerts;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useClientStore = create<ClientStore>()(
  persist(
    (set, get) => ({
      profile: DEFAULT_PROFILE,
      results: DEFAULT_RESULTS,
      alerts: [],

      setProfile: (update) => {
        set((state) => ({
          profile: { ...state.profile, ...update },
        }));
        get().recalculateAll();
      },

      resetProfile: () => set({ profile: DEFAULT_PROFILE, results: DEFAULT_RESULTS, alerts: [] }),

      recalculateAll: () => {
        const { profile } = get();
        const {
          weight, height, age, gender, bodyFat, steps, workouts,
          activityLevel, climate, macroGoal, cyclePhase, caloriesOffset,
        } = profile;

        const nextResults: CalculationResults = { ...get().results };

        // HR Zones — needs age
        if (age) {
          nextResults.hrZones = calculateHRZones({ age, gender });
        }

        // Hydration — needs weight
        if (weight) {
          nextResults.hydration = calculateHydration({
            weight,
            gender,
            activity: activityLevel,
            climate,
          });
        }

        // Macros — needs weight + height + age
        if (weight && height && age) {
          const baseResult = calculateMacros({
            weight,
            height,
            age,
            gender,
            goal: macroGoal,
            bodyFat: bodyFat ?? undefined,
            steps: steps ?? undefined,
            workouts: workouts ?? undefined,
          });

          // Chain reaction: luteal phase → +200 kcal (Oosthuyse 2010)
          const lutalBonus = (gender === 'female' && cyclePhase === 'luteal') ? 200 : 0;
          const totalOffset = caloriesOffset + lutalBonus;

          if (totalOffset !== 0) {
            // Distribute extra calories as carbs (luteal: satisfy carb cravings)
            const extraCarbs = Math.round(totalOffset / 4);
            nextResults.macros = {
              ...baseResult,
              calories: baseResult.calories + totalOffset,
              macros: {
                ...baseResult.macros,
                c: Math.max(0, baseResult.macros.c + extraCarbs),
              },
            };
          } else {
            nextResults.macros = baseResult;
          }

          // Body fat — from direct input or estimated
          nextResults.bodyFatPercent = bodyFat ?? nextResults.macros.estimatedBF;
        }

        const alerts = computeAlerts(profile, nextResults);
        set({ results: nextResults, alerts });
      },

      setOneRMResult: (result) =>
        set((state) => ({ results: { ...state.results, oneRM: result } })),

      setCaloriesOffset: (offset) => {
        set((state) => ({
          profile: { ...state.profile, caloriesOffset: offset },
        }));
        get().recalculateAll();
      },
    }),
    {
      name: 'stryvr-client-store',
      partialize: (state) => ({ profile: state.profile }),
    },
  ),
);
