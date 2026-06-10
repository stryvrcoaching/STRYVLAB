'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

export type LabClient = {
  id:    string;
  name:  string;
  email: string | null;
  // Profile (coach_clients)
  gender:             string | null;
  age:                number | null;
  weekly_frequency:   number | null;
  fitness_level:      string | null;
  training_goal:      string | null;
  sport_practice:     string | null;
  equipment_category: string | null;
  // Biometrics — most recent bilan
  height_cm:          number | null;
  weight_kg:          number | null;
  body_fat_pct:       number | null;
  muscle_mass_kg:     number | null;
  lean_mass_kg:       number | null;
  bmr_kcal_measured:  number | null;
  visceral_fat_level: number | null;
  body_water_pct:     number | null;
  waist_cm:           number | null;
  // Training — most recent bilan
  session_duration_min:     number | null;
  training_calories_weekly: number | null;
  perceived_intensity:      number | null;
  training_types:           string[] | null;
  // Cardio — most recent bilan
  daily_steps:         number | null;
  cardio_frequency:    number | null;
  cardio_duration_min: number | null;
  cardio_types:        string[] | null;
  // Wellness — avg last 3 bilans
  stress_level:          number | null;
  sleep_duration_h:      number | null;
  sleep_quality:         number | null;
  energy_level:          number | null;
  recovery_score:        number | null;
  post_session_recovery: number | null;
  // Lifestyle — most recent bilan
  caffeine_daily_mg:   number | null;
  alcohol_weekly:      number | null;
  work_hours_per_week: number | null;
  menstrual_cycle:     string | null;
  // General
  occupation:           string | null;
  occupation_multiplier: number | null;
};

type SearchState = {
  query:   string;
  results: LabClient[];
  loading: boolean;
  selected: LabClient | null;
};

export function useLabClientSearch() {
  const [state, setState] = useState<SearchState>({
    query: '', results: [], loading: false, selected: null,
  });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((query: string) => {
    setState((s) => ({ ...s, query }));
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim() || query.trim().length < 1) {
      setState((s) => ({ ...s, results: [], loading: false }));
      return;
    }
    setState((s) => ({ ...s, loading: true }));

    debounceRef.current = setTimeout(async () => {
      try {
        const res  = await fetch(`/api/lab/client-search?q=${encodeURIComponent(query.trim())}`);
        if (!res.ok) throw new Error('Search failed');
        const data = await res.json();
        setState((s) => ({ ...s, results: data.clients ?? [], loading: false }));
      } catch {
        setState((s) => ({ ...s, results: [], loading: false }));
      }
    }, 300);
  }, []);

  const select = useCallback((client: LabClient) => {
    setState((s) => ({ ...s, selected: client, results: [], query: client.name }));
  }, []);

  const clear = useCallback(() => {
    setState({ query: '', results: [], loading: false, selected: null });
  }, []);

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  return { ...state, search, select, clear };
}
