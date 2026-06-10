'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, UserCheck, X,
  ChevronDown, ChevronUp, AlertTriangle, Info,
  CheckCircle2, Zap, TrendingDown, TrendingUp, Minus,
  Copy, Check, Send, FlaskConical, Activity,
} from 'lucide-react';

import {
  calculateMacros as calcMacros,
  type MacroGoal, type MacroGender, type MacroResult,
  type SmartProtocolSuggestion,
} from '@/lib/formulas/macros';
import { useLabClientSearch, type LabClient } from '@/lib/lab/useLabClientSearch';
import { useSetTopBar } from '@/components/layout/useSetTopBar';

// ─── Types ────────────────────────────────────────────────────────────────────

type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'veryActive';

const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary:  'Sédentaire',
  light:      'Légèrement actif',
  moderate:   'Modérément actif',
  active:     'Actif',
  veryActive: 'Très actif',
};

const ACTIVITY_STEPS: Record<ActivityLevel, number> = {
  sedentary: 2000, light: 4000, moderate: 7000, active: 11000, veryActive: 15000,
};

const GOAL_LABELS: Record<MacroGoal, string> = {
  deficit:     'Déficit — Perte de gras',
  maintenance: 'Maintenance',
  surplus:     'Surplus — Prise de muscle',
};

const CLIENT_GOAL_MAP: Record<string, MacroGoal> = {
  fat_loss: 'deficit', weight_loss: 'deficit', sèche: 'deficit', cut: 'deficit',
  muscle_gain: 'surplus', hypertrophy: 'surplus', prise_de_masse: 'surplus', bulk: 'surplus',
  maintenance: 'maintenance', recomposition: 'maintenance',
};

const SPORT_PRACTICE_MAP: Record<string, ActivityLevel> = {
  sedentary: 'sedentary', light: 'light', moderate: 'moderate',
  active: 'active', athlete: 'veryActive',
};

const PRIORITY_CONFIG = {
  critical: { color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/20',    dot: 'bg-red-400'    },
  high:     { color: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/20',  dot: 'bg-amber-400'  },
  medium:   { color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20',   dot: 'bg-blue-400'   },
  low:      { color: 'text-white/40',   bg: 'bg-white/[0.03]',  border: 'border-white/[0.06]',  dot: 'bg-white/30'   },
} as const;

// ─── Helpers UI ───────────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[9px] font-bold uppercase tracking-[0.16em] text-white/35 mb-1">
      {children}
    </label>
  );
}

function Input({ value, onChange, placeholder, type = 'number', step, min, max, className = '' }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
  type?: string; step?: string; min?: string; max?: string; className?: string;
}) {
  return (
    <input
      type={type} value={value} step={step} min={min} max={max}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full h-8 rounded-lg bg-white/[0.04] border-[0.3px] border-white/[0.06] px-3 text-[12px] font-semibold text-white placeholder:text-white/20 outline-none focus:border-white/[0.12] transition-colors ${className}`}
    />
  );
}

function Select<T extends string>({ value, onChange, options }: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="w-full h-8 rounded-lg bg-white/[0.04] border-[0.3px] border-white/[0.06] px-3 text-[12px] font-semibold text-white outline-none focus:border-white/[0.12] transition-colors appearance-none cursor-pointer"
    >
      {options.map((o) => <option key={o.value} value={o.value} className="bg-[#181818]">{o.label}</option>)}
    </select>
  );
}

function SectionTitle({ children, icon: Icon }: { children: React.ReactNode; icon?: React.ElementType }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      {Icon && <Icon size={11} className="text-white/30" strokeWidth={1.75} />}
      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/30">{children}</p>
    </div>
  );
}

function DataBadge({ label, value, unit, source }: { label: string; value: string | number; unit?: string; source?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b-[0.3px] border-white/[0.04] last:border-0">
      <span className="text-[11px] text-white/40">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-semibold text-white">{value}{unit ? ` ${unit}` : ''}</span>
        {source && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#1f8a65]/10 text-[#1f8a65]/70 font-semibold uppercase tracking-wide">
            {source}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Component principal ──────────────────────────────────────────────────────

export default function MacroCalculator() {
  const router      = useRouter();

  const clientSearch = useLabClientSearch();
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // ── Inputs principaux ────────────────────────────────────────────────────────
  const [gender,        setGender]        = useState<MacroGender>('male');
  const [age,           setAge]           = useState('');
  const [weight,        setWeight]        = useState('');
  const [height,        setHeight]        = useState('');
  const [bodyFat,       setBodyFat]       = useState('');
  const [muscleMass,    setMuscleMass]    = useState('');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('moderate');
  const [workouts,      setWorkouts]      = useState('3');
  const [goal,          setGoal]          = useState<MacroGoal>('deficit');

  // ── Inputs avancés (depuis bilan) ────────────────────────────────────────────
  const [bmrMeasured,    setBmrMeasured]    = useState('');
  const [visceralFat,    setVisceralFat]    = useState('');
  const [sessionDuration, setSessionDuration] = useState('');
  const [trainingCalsWeekly, setTrainingCalsWeekly] = useState('');
  const [cardioFreq,     setCardioFreq]     = useState('');
  const [cardioDuration, setCardioDuration] = useState('');
  const [dailySteps,     setDailySteps]     = useState('');
  const [stressLevel,    setStressLevel]    = useState('');
  const [sleepH,         setSleepH]         = useState('');
  const [sleepQuality,   setSleepQuality]   = useState('');
  const [energyLevel,    setEnergyLevel]    = useState('');
  const [caffeineDaily,  setCaffeineDaily]  = useState('');
  const [alcoholWeekly,  setAlcoholWeekly]  = useState('');
  const [workHours,      setWorkHours]      = useState('');
  const [menstrualPhase, setMenstrualPhase] = useState<'follicular' | 'luteal' | 'unknown' | ''>('');

  // ── Résultats ────────────────────────────────────────────────────────────────
  const [result,     setResult]     = useState<MacroResult | null>(null);
  const [baseResult, setBaseResult] = useState<MacroResult | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // ── Ajustements manuels ──────────────────────────────────────────────────────
  const [calorieAdjust,   setCalorieAdjust]   = useState(0);    // %
  const [proteinOverride, setProteinOverride] = useState('');   // g/kg BW ratio

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeProtocol, setActiveProtocol] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // ─── TopBar ──────────────────────────────────────────────────────────────────

  const topLeft = useMemo(() => (
    <div className="flex items-center gap-3">
      <button
        onClick={() => router.push('/outils')}
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] border-[0.3px] border-white/[0.06] text-white/40 hover:bg-white/[0.08] hover:text-white/70 transition-all active:scale-[0.97]"
      >
        <ArrowLeft size={14} />
      </button>
      <div>
        <p className="text-[9px] text-white/30 uppercase tracking-[0.16em] font-semibold leading-none mb-0.5">
          Nutrition · CALC_01
        </p>
        <p className="text-[13px] font-semibold text-white leading-none">Kcal & Macros</p>
      </div>
    </div>
  ), [router]);

  const topRight = null;

  useSetTopBar(topLeft, topRight);

  // ─── Click outside dropdown ───────────────────────────────────────────────────

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowDropdown(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  // ─── Injection client ─────────────────────────────────────────────────────────

  const injectClient = useCallback((client: LabClient) => {
    if (client.weight_kg   != null) setWeight(String(client.weight_kg));
    if (client.body_fat_pct != null) setBodyFat(String(client.body_fat_pct));
    if (client.age         != null) setAge(String(client.age));
    if (client.height_cm   != null) setHeight(String(client.height_cm));
    if (client.muscle_mass_kg != null) setMuscleMass(String(client.muscle_mass_kg));
    if (client.bmr_kcal_measured != null) setBmrMeasured(String(client.bmr_kcal_measured));
    if (client.visceral_fat_level != null) setVisceralFat(String(client.visceral_fat_level));
    if (client.session_duration_min != null) setSessionDuration(String(client.session_duration_min));
    if (client.training_calories_weekly != null) setTrainingCalsWeekly(String(client.training_calories_weekly));
    if (client.cardio_frequency != null) setCardioFreq(String(client.cardio_frequency));
    if (client.cardio_duration_min != null) setCardioDuration(String(client.cardio_duration_min));
    if (client.daily_steps != null) setDailySteps(String(client.daily_steps));
    if (client.stress_level != null) setStressLevel(String(client.stress_level));
    if (client.sleep_duration_h != null) setSleepH(String(client.sleep_duration_h));
    if (client.sleep_quality != null) setSleepQuality(String(client.sleep_quality));
    if (client.energy_level != null) setEnergyLevel(String(client.energy_level));
    if (client.caffeine_daily_mg != null) setCaffeineDaily(String(client.caffeine_daily_mg));
    if (client.alcohol_weekly != null) setAlcoholWeekly(String(client.alcohol_weekly));
    if (client.work_hours_per_week != null) setWorkHours(String(client.work_hours_per_week));
    if (client.weekly_frequency != null) setWorkouts(String(client.weekly_frequency));

    // Cycle menstruel
    if (client.menstrual_cycle) {
      const lower = client.menstrual_cycle.toLowerCase();
      if (lower.includes('lut')) setMenstrualPhase('luteal');
      else if (lower.includes('fol')) setMenstrualPhase('follicular');
      else setMenstrualPhase('unknown');
    }

    // Objectif
    if (client.training_goal) {
      const mapped = CLIENT_GOAL_MAP[client.training_goal.toLowerCase()];
      if (mapped) setGoal(mapped);
    }

    // Activité
    if (client.sport_practice) {
      const mapped = SPORT_PRACTICE_MAP[client.sport_practice.toLowerCase()];
      if (mapped) setActivityLevel(mapped);
    }

    setGender(client.gender === 'female' || client.gender === 'Femme' ? 'female' : 'male');

    // Reset résultats
    setResult(null); setBaseResult(null);
    setCalorieAdjust(0); setProteinOverride('');
    setShowAdvanced(true); // montrer les données avancées injectées
  }, []);

  // ─── Calcul ───────────────────────────────────────────────────────────────────

  const buildInput = useCallback(() => {
    const w  = parseFloat(weight);
    const h  = parseFloat(height);
    const a  = parseFloat(age);
    if (!w || !h || !a) return null;
    const wo = parseInt(workouts) || 0;
    const steps = dailySteps ? parseInt(dailySteps) : ACTIVITY_STEPS[activityLevel];

    return {
      weight: w, height: h, age: a, gender, goal,
      bodyFat:     bodyFat     ? parseFloat(bodyFat)     : undefined,
      muscleMassKg: muscleMass ? parseFloat(muscleMass)  : undefined,
      bmrKcalMeasured: bmrMeasured ? parseFloat(bmrMeasured) : undefined,
      visceralFatLevel: visceralFat ? parseFloat(visceralFat) : undefined,
      steps,
      workHoursPerWeek: workHours ? parseFloat(workHours) : undefined,
      workouts: wo,
      sessionDurationMin: sessionDuration ? parseFloat(sessionDuration) : undefined,
      trainingCaloriesWeekly: trainingCalsWeekly ? parseFloat(trainingCalsWeekly) : undefined,
      cardioFrequency:  cardioFreq     ? parseFloat(cardioFreq)     : undefined,
      cardioDurationMin: cardioDuration ? parseFloat(cardioDuration) : undefined,
      stressLevel:   stressLevel   ? parseFloat(stressLevel)   : undefined,
      sleepDurationH: sleepH        ? parseFloat(sleepH)        : undefined,
      sleepQuality:  sleepQuality  ? parseFloat(sleepQuality)  : undefined,
      energyLevel:   energyLevel   ? parseFloat(energyLevel)   : undefined,
      caffeineDaily: caffeineDaily ? parseFloat(caffeineDaily) : undefined,
      alcoholWeekly: alcoholWeekly ? parseFloat(alcoholWeekly) : undefined,
      menstrualPhase: (menstrualPhase || undefined) as 'follicular' | 'luteal' | 'unknown' | undefined,
    };
  }, [
    weight, height, age, gender, goal, bodyFat, muscleMass, bmrMeasured, visceralFat,
    activityLevel, dailySteps, workHours, workouts, sessionDuration,
    trainingCalsWeekly, cardioFreq, cardioDuration, stressLevel, sleepH, sleepQuality,
    energyLevel, caffeineDaily, alcoholWeekly, menstrualPhase,
  ]);

  const calculate = useCallback(() => {
    const input = buildInput();
    if (!input) return;
    const res = calcMacros(input);
    setBaseResult(res);
    setResult(res);
    setCalorieAdjust(0); setProteinOverride('');
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  }, [buildInput]);

  // ─── Recalcul ajustements en live ────────────────────────────────────────────

  useEffect(() => {
    if (!baseResult) return;

    const bw            = parseFloat(weight) || 1;
    const adjustedCals  = Math.round(baseResult.calories + baseResult.tdee * calorieAdjust / 100);

    const proteinG = proteinOverride !== ''
      ? Math.max(0, Math.round((parseFloat(proteinOverride) || 0) * bw))
      : baseResult.macros.p;

    const remainingKcal = adjustedCals - proteinG * 4;
    let fats: number, carbs: number;

    if (proteinOverride !== '') {
      fats  = Math.max(20, Math.round(remainingKcal * 0.30 / 9));
      carbs = Math.max(0,  Math.round((remainingKcal - fats * 9) / 4));
    } else {
      const delta = adjustedCals - baseResult.calories;
      fats  = Math.max(20, baseResult.macros.f + Math.round(delta * 0.30 / 9));
      carbs = Math.max(0,  baseResult.macros.c + Math.round(delta * 0.70 / 4));
    }

    const totalKcal = proteinG * 4 + fats * 9 + carbs * 4;
    const lbm       = baseResult.leanMass;

    setResult((prev) => prev ? {
      ...prev,
      calories: adjustedCals,
      macros:   { p: proteinG, f: fats, c: carbs },
      ratios: {
        p: Math.round((proteinG / lbm) * 10) / 10,
        f: Math.round((fats    / bw)  * 10) / 10,
        c: Math.round((carbs   / bw)  * 10) / 10,
      },
      ratiosByBW: {
        p: Math.round((proteinG / bw) * 10) / 10,
        f: Math.round((fats    / bw)  * 10) / 10,
        c: Math.round((carbs   / bw)  * 10) / 10,
      },
      percents: {
        p: Math.round((proteinG * 4 / totalKcal) * 100),
        f: Math.round((fats    * 9 / totalKcal) * 100),
        c: Math.round((carbs   * 4 / totalKcal) * 100),
      },
    } : prev);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calorieAdjust, proteinOverride]);

  // ─── Copy ─────────────────────────────────────────────────────────────────────

  const handleCopy = () => {
    if (!result) return;
    const bw = parseFloat(weight) || 1;
    navigator.clipboard.writeText([
      `═══ STRYV Lab — Protocole Nutritionnel ═══`,
      `Objectif : ${GOAL_LABELS[goal]}`,
      ``,
      `TDEE     : ${result.tdee} kcal/j`,
      `Cible    : ${result.calories} kcal/j`,
      ``,
      `MACROS`,
      `• Protéines : ${result.macros.p}g  (${result.ratios.p}g/kg LBM · ${(result.macros.p / bw).toFixed(1)}g/kg PC)`,
      `• Lipides   : ${result.macros.f}g  (${result.ratios.f}g/kg)`,
      `• Glucides  : ${result.macros.c}g  (${result.ratios.c}g/kg)`,
      ``,
      `COMPOSITION`,
      `• Masse maigre : ${result.leanMass} kg`,
      `• BF% estimé   : ${result.estimatedBF}%`,
      ``,
      `TDEE BREAKDOWN`,
      `• BMR  : ${result.breakdown.bmr} kcal  [${result.dataProvenance.bmrSource}]`,
      `• NEAT : ${result.breakdown.neat} kcal`,
      `• EAT  : ${result.breakdown.eat + result.breakdown.eatCardio} kcal`,
      `• TEF  : ${result.breakdown.tef} kcal`,
      result.breakdown.alcohol > 0 ? `• Alcool : +${result.breakdown.alcohol} kcal` : '',
    ].filter(Boolean).join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ─── Apply Smart Protocol suggestion ─────────────────────────────────────────

  const applyProtocolSuggestion = (s: SmartProtocolSuggestion) => {
    if (!baseResult || !result) return;
    const bw = parseFloat(weight) || 1;

    if (s.id === 'protein_low') {
      const lbm = baseResult.leanMass;
      const optRatio = goal === 'deficit' ? 2.7 : 2.2;
      setProteinOverride((lbm * optRatio / bw).toFixed(1));
    }
    if (s.id === 'fats_critical') {
      // Augmenter lipides minimum — augmenter cals de 100 pour absorber
      setCalorieAdjust((prev) => Math.min(prev + 5, 30));
    }
    if (s.id === 'sleep_suboptimal' || s.id === 'stress_critical') {
      // Réduire déficit de 5%
      setCalorieAdjust((prev) => Math.min(prev + 5, 30));
    }
    setActiveProtocol(s.id);
    setTimeout(() => setActiveProtocol(null), 2000);
  };

  // ─── Canrun ───────────────────────────────────────────────────────────────────

  const canCalculate = parseFloat(weight) >= 40 && parseFloat(height) >= 140 && parseFloat(age) >= 15;

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-[#121212] px-6 py-6">
      <div className="max-w-[1400px] mx-auto">

        {/* ── Layout 2 colonnes (inputs | résultats) ── */}
        <div className="grid grid-cols-1 xl:grid-cols-[520px_1fr] gap-5">

          {/* ══ COLONNE GAUCHE — Inputs ═══════════════════════════════════════════ */}
          <div className="space-y-3">

            {/* ── Recherche client ── */}
            <div className="bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-xl p-4">
                <SectionTitle icon={UserCheck}>Client</SectionTitle>
                <div className="relative" ref={searchRef}>
                  <div className={`flex items-center gap-2 h-9 rounded-lg border-[0.3px] px-3 transition-colors ${
                    clientSearch.selected ? 'border-[#1f8a65]/30 bg-[#1f8a65]/[0.05]' : 'border-white/[0.06] bg-white/[0.03]'
                  }`}>
                    <UserCheck size={13} className={clientSearch.selected ? 'text-[#1f8a65]/60' : 'text-white/20'} />
                    <input
                      value={clientSearch.query}
                      onChange={(e) => { clientSearch.search(e.target.value); setShowDropdown(true); }}
                      onFocus={() => clientSearch.results.length > 0 && setShowDropdown(true)}
                      placeholder="Rechercher un client…"
                      className="flex-1 bg-transparent text-[12px] font-medium text-white placeholder:text-white/25 outline-none"
                    />
                    {clientSearch.selected ? (
                      <button onClick={() => { clientSearch.clear(); setResult(null); setBaseResult(null); }}
                        className="text-white/30 hover:text-white/60 transition-colors">
                        <X size={12} />
                      </button>
                    ) : clientSearch.loading ? (
                      <div className="w-3 h-3 border border-white/20 border-t-white/60 rounded-full animate-spin" />
                    ) : null}
                  </div>

                  {showDropdown && clientSearch.results.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-[#181818] border-[0.3px] border-white/[0.06] rounded-xl overflow-hidden z-50 shadow-xl">
                      {clientSearch.results.map((client, i) => (
                        <button
                          key={client.id}
                          onClick={() => { clientSearch.select(client); injectClient(client); setShowDropdown(false); }}
                          className={`w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.05] transition-colors text-left ${
                            i < clientSearch.results.length - 1 ? 'border-b-[0.3px] border-white/[0.04]' : ''
                          }`}
                        >
                          <div>
                            <p className="text-[12px] font-semibold text-white">{client.name}</p>
                            {client.email && <p className="text-[10px] text-white/30">{client.email}</p>}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-white/30 font-mono">
                            {client.weight_kg   != null && <span>{client.weight_kg}kg</span>}
                            {client.body_fat_pct != null && <span>{client.body_fat_pct}%</span>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Données injectées — résumé */}
                {clientSearch.selected && (
                  <div className="mt-3 pt-3 border-t-[0.3px] border-white/[0.04] grid grid-cols-3 gap-1.5">
                    {[
                      { label: 'Poids', value: weight, unit: 'kg' },
                      { label: 'BF%', value: bodyFat, unit: '%' },
                      { label: 'Taille', value: height, unit: 'cm' },
                      { label: 'Âge', value: age, unit: 'ans' },
                      { label: 'Séances', value: workouts, unit: '/sem' },
                      { label: 'Pas/j', value: dailySteps, unit: '' },
                    ].map(({ label, value, unit }) => value ? (
                      <div key={label} className="bg-white/[0.02] rounded-lg px-2 py-1.5 text-center">
                        <p className="text-[9px] text-white/30 mb-0.5">{label}</p>
                        <p className="text-[11px] font-bold text-white">{value}{unit}</p>
                      </div>
                    ) : null)}
                  </div>
                )}
            </div>

            {/* ── Biométrie & Profil ── */}
            <div className="bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-xl p-4">
              <SectionTitle icon={Activity}>Biométrie & Profil</SectionTitle>

              <div className="grid grid-cols-2 gap-3">
                {/* Sexe */}
                <div className="col-span-2">
                  <FieldLabel>Sexe</FieldLabel>
                  <div className="flex gap-1.5">
                    {([['male', 'Homme'], ['female', 'Femme']] as const).map(([v, l]) => (
                      <button key={v} onClick={() => setGender(v)}
                        className={`flex-1 h-8 rounded-lg text-[11px] font-bold border-[0.3px] transition-all ${
                          gender === v
                            ? 'bg-[#1f8a65]/10 border-[#1f8a65]/30 text-[#1f8a65]'
                            : 'bg-white/[0.03] border-white/[0.06] text-white/40 hover:text-white/70'
                        }`}>{l}</button>
                    ))}
                  </div>
                </div>

                <div>
                  <FieldLabel>Âge</FieldLabel>
                  <Input value={age} onChange={setAge} placeholder="30" min="15" max="85" />
                </div>
                <div>
                  <FieldLabel>Poids (kg)</FieldLabel>
                  <Input value={weight} onChange={setWeight} placeholder="75" min="40" max="250" />
                </div>
                <div>
                  <FieldLabel>Taille (cm)</FieldLabel>
                  <Input value={height} onChange={setHeight} placeholder="178" min="140" max="220" />
                </div>
                <div>
                  <FieldLabel>Masse grasse (%)</FieldLabel>
                  <Input value={bodyFat} onChange={setBodyFat} placeholder="15" min="3" max="60" step="0.1" />
                </div>
                <div>
                  <FieldLabel>Masse musculaire (kg)</FieldLabel>
                  <Input value={muscleMass} onChange={setMuscleMass} placeholder="Optionnel" step="0.1" />
                </div>
                <div>
                  <FieldLabel>BMR mesuré (kcal)</FieldLabel>
                  <Input value={bmrMeasured} onChange={setBmrMeasured} placeholder="Balance impédance" />
                </div>
              </div>
            </div>

            {/* ── Activité & Entraînement ── */}
            <div className="bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-xl p-4">
              <SectionTitle icon={Zap}>Activité & Entraînement</SectionTitle>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <FieldLabel>Niveau d&apos;activité quotidienne</FieldLabel>
                  <Select
                    value={activityLevel}
                    onChange={setActivityLevel}
                    options={(Object.entries(ACTIVITY_LABELS) as [ActivityLevel, string][]).map(([v, l]) => ({ value: v, label: l }))}
                  />
                </div>
                <div>
                  <FieldLabel>Séances musculation/sem</FieldLabel>
                  <Input value={workouts} onChange={setWorkouts} placeholder="3" min="0" max="7" />
                </div>
                <div>
                  <FieldLabel>Durée session (min)</FieldLabel>
                  <Input value={sessionDuration} onChange={setSessionDuration} placeholder="60" />
                </div>
                <div>
                  <FieldLabel>Séances cardio/sem</FieldLabel>
                  <Input value={cardioFreq} onChange={setCardioFreq} placeholder="0" min="0" max="7" />
                </div>
                <div>
                  <FieldLabel>Durée cardio (min)</FieldLabel>
                  <Input value={cardioDuration} onChange={setCardioDuration} placeholder="30" />
                </div>
                <div>
                  <FieldLabel>Pas quotidiens</FieldLabel>
                  <Input value={dailySteps} onChange={setDailySteps} placeholder="Auto depuis activité" />
                </div>
                <div>
                  <FieldLabel>Kcal sport/semaine (tracker)</FieldLabel>
                  <Input value={trainingCalsWeekly} onChange={setTrainingCalsWeekly} placeholder="Depuis tracker" />
                </div>
              </div>
            </div>

            {/* ── Objectif ── */}
            <div className="bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-xl p-4">
              <SectionTitle>Objectif</SectionTitle>
              <div className="space-y-1.5">
                {(Object.entries(GOAL_LABELS) as [MacroGoal, string][]).map(([v, l]) => (
                  <button key={v} onClick={() => setGoal(v)}
                    className={`w-full flex items-center justify-between px-3 h-9 rounded-lg border-[0.3px] text-left transition-all ${
                      goal === v
                        ? 'bg-[#1f8a65]/10 border-[#1f8a65]/25 text-white'
                        : 'bg-white/[0.02] border-white/[0.05] text-white/45 hover:text-white/70 hover:bg-white/[0.04]'
                    }`}>
                    <span className="text-[11px] font-semibold">{l}</span>
                    {goal === v && <CheckCircle2 size={12} className="text-[#1f8a65]" />}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Avancé (bien-être, lifestyle) ── */}
            <div className="bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-xl overflow-hidden">
              <button
                onClick={() => setShowAdvanced((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <FlaskConical size={11} className="text-white/30" />
                  <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/30">
                    Données avancées (bien-être, lifestyle)
                  </span>
                  {[stressLevel, sleepH, alcoholWeekly, caffeineDaily, visceralFat].some(Boolean) && (
                    <span className="px-1.5 py-0.5 rounded-full bg-[#1f8a65]/15 text-[#1f8a65] text-[9px] font-bold">
                      {[stressLevel, sleepH, alcoholWeekly, caffeineDaily, visceralFat].filter(Boolean).length} renseignés
                    </span>
                  )}
                </div>
                {showAdvanced ? <ChevronUp size={13} className="text-white/30" /> : <ChevronDown size={13} className="text-white/30" />}
              </button>

              {showAdvanced && (
                <div className="px-4 pb-4 border-t-[0.3px] border-white/[0.04] pt-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <FieldLabel>Stress (1–10)</FieldLabel>
                      <Input value={stressLevel} onChange={setStressLevel} placeholder="—" min="1" max="10" step="0.5" />
                    </div>
                    <div>
                      <FieldLabel>Sommeil (heures)</FieldLabel>
                      <Input value={sleepH} onChange={setSleepH} placeholder="—" min="2" max="12" step="0.5" />
                    </div>
                    <div>
                      <FieldLabel>Qualité sommeil (1–5)</FieldLabel>
                      <Input value={sleepQuality} onChange={setSleepQuality} placeholder="—" min="1" max="5" />
                    </div>
                    <div>
                      <FieldLabel>Énergie (1–10)</FieldLabel>
                      <Input value={energyLevel} onChange={setEnergyLevel} placeholder="—" min="1" max="10" />
                    </div>
                    <div>
                      <FieldLabel>Caféine (mg/j)</FieldLabel>
                      <Input value={caffeineDaily} onChange={setCaffeineDaily} placeholder="Ex: 200" />
                    </div>
                    <div>
                      <FieldLabel>Alcool (verres/sem)</FieldLabel>
                      <Input value={alcoholWeekly} onChange={setAlcoholWeekly} placeholder="0" min="0" />
                    </div>
                    <div>
                      <FieldLabel>Heures travail/sem</FieldLabel>
                      <Input value={workHours} onChange={setWorkHours} placeholder="35" />
                    </div>
                    <div>
                      <FieldLabel>Graisse viscérale (niv.)</FieldLabel>
                      <Input value={visceralFat} onChange={setVisceralFat} placeholder="Balance InBody" />
                    </div>
                    {gender === 'female' && (
                      <div>
                        <FieldLabel>Phase du cycle</FieldLabel>
                        <Select
                          value={menstrualPhase}
                          onChange={setMenstrualPhase}
                          options={[
                            { value: '', label: 'Non renseigné' },
                            { value: 'follicular', label: 'Folliculaire (J1–J14)' },
                            { value: 'luteal', label: 'Lutéale (J14–J28)' },
                            { value: 'unknown', label: 'Inconnue' },
                          ]}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── Bouton calculer ── */}
            <button
              onClick={calculate}
              disabled={!canCalculate}
              className="w-full h-11 rounded-xl bg-[#1f8a65] hover:bg-[#217356] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed text-[12px] font-bold uppercase tracking-[0.12em] text-white transition-all flex items-center justify-center gap-2"
            >
              <FlaskConical size={14} />
              Calculer les macros
            </button>

          </div>

          {/* ══ COLONNE DROITE — Résultats ════════════════════════════════════════ */}
          <div ref={resultsRef}>
            {!result ? (
              <div className="h-full min-h-[400px] flex flex-col items-center justify-center gap-3 border-[0.3px] border-dashed border-white/[0.06] rounded-xl">
                <FlaskConical size={28} className="text-white/10" />
                <p className="text-[12px] text-white/20">Renseigne les données et lance le calcul</p>
              </div>
            ) : (
              <div className="space-y-3">

                {/* ── Context flags (provenance + corrections) ── */}
                {(result.contextFlags.length > 0 || result.corrections.length > 0) && (
                  <div className="bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-xl p-4">
                    <SectionTitle icon={Info}>Sources de données</SectionTitle>
                    <div className="flex flex-wrap gap-1.5">
                      {result.contextFlags.map((f) => (
                        <div key={f.key} title={f.detail}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border-[0.3px] text-[10px] font-semibold cursor-help ${
                            f.type === 'success' ? 'border-[#1f8a65]/30 bg-[#1f8a65]/10 text-[#1f8a65]' :
                            f.type === 'danger'  ? 'border-red-500/30 bg-red-500/10 text-red-400' :
                            f.type === 'warning' ? 'border-amber-500/30 bg-amber-500/10 text-amber-400' :
                            'border-white/[0.06] bg-white/[0.03] text-white/40'
                          }`}>
                          {f.type === 'success' ? <CheckCircle2 size={9} /> :
                           f.type === 'danger'  ? <AlertTriangle size={9} /> :
                           f.type === 'warning' ? <AlertTriangle size={9} /> :
                           <Info size={9} />}
                          {f.label}
                        </div>
                      ))}
                    </div>
                    {result.corrections.length > 0 && (
                      <div className="mt-3 pt-3 border-t-[0.3px] border-white/[0.04] space-y-1">
                        {result.corrections.map((c) => (
                          <div key={c.field} className="flex items-center justify-between text-[10px]">
                            <span className="text-white/35">{c.label} : {c.value} {c.unit}</span>
                            <span className="text-amber-400/70 font-semibold">+{c.delta} kcal</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── TDEE Breakdown ── */}
                <div className="bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-4">
                    <SectionTitle icon={Activity}>Dépense énergétique</SectionTitle>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] text-white/30">Objectif {result.adjustment > 0 ? '+' : ''}{result.adjustment} kcal</span>
                    </div>
                  </div>

                  {/* Flow visuel BMR → TDEE → Cible */}
                  <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1">
                    {[
                      { label: 'BMR', value: result.breakdown.bmr, color: 'text-blue-400' },
                      { label: '+ NEAT', value: result.breakdown.neat, color: 'text-emerald-400' },
                      { label: '+ EAT', value: result.breakdown.eat + result.breakdown.eatCardio, color: 'text-violet-400' },
                      { label: '+ TEF', value: result.breakdown.tef, color: 'text-orange-400' },
                      ...(result.breakdown.alcohol > 0 ? [{ label: '+ Alcool', value: result.breakdown.alcohol, color: 'text-red-400' }] : []),
                    ].map((item, i, arr) => (
                      <React.Fragment key={item.label}>
                        <div className="flex flex-col items-center shrink-0">
                          <span className={`text-[15px] font-black tabular-nums ${item.color}`}>{item.value}</span>
                          <span className="text-[8px] text-white/30 font-semibold uppercase tracking-wide">{item.label}</span>
                        </div>
                        {i < arr.length - 1 && <span className="text-white/15 text-[11px] shrink-0 mx-0.5">=</span>}
                      </React.Fragment>
                    ))}
                    <span className="text-white/15 text-[11px] shrink-0 mx-0.5">=</span>
                    <div className="flex flex-col items-center shrink-0">
                      <span className="text-[15px] font-black tabular-nums text-white">{result.tdee}</span>
                      <span className="text-[8px] text-white/30 font-semibold uppercase tracking-wide">TDEE</span>
                    </div>
                    <span className="text-white/15 text-[11px] shrink-0 mx-0.5">→</span>
                    <div className="flex flex-col items-center shrink-0">
                      <span className="text-[18px] font-black tabular-nums text-[#1f8a65]">{result.calories}</span>
                      <span className="text-[8px] text-[#1f8a65]/60 font-semibold uppercase tracking-wide">Cible</span>
                    </div>
                  </div>

                  {/* Barres proportionnelles */}
                  <div className="space-y-1.5">
                    {[
                      { label: 'BMR', value: result.breakdown.bmr,  color: 'bg-blue-500/60',    pct: result.breakdown.bmr  / result.tdee * 100 },
                      { label: 'NEAT', value: result.breakdown.neat, color: 'bg-emerald-500/60', pct: result.breakdown.neat / result.tdee * 100 },
                      { label: 'EAT', value: result.breakdown.eat + result.breakdown.eatCardio, color: 'bg-violet-500/60', pct: (result.breakdown.eat + result.breakdown.eatCardio) / result.tdee * 100 },
                      { label: 'TEF', value: result.breakdown.tef,  color: 'bg-orange-500/60',  pct: result.breakdown.tef  / result.tdee * 100 },
                    ].map((b) => (
                      <div key={b.label} className="flex items-center gap-2">
                        <span className="text-[10px] text-white/30 w-8 shrink-0">{b.label}</span>
                        <div className="flex-1 h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                          <div className={`h-full rounded-full ${b.color}`} style={{ width: `${Math.min(100, b.pct)}%` }} />
                        </div>
                        <span className="text-[10px] font-semibold text-white/50 w-12 text-right tabular-nums">{b.value} kcal</span>
                      </div>
                    ))}
                  </div>

                  {/* Masse maigre + BF */}
                  <div className="mt-3 pt-3 border-t-[0.3px] border-white/[0.04] grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-[18px] font-black text-white tabular-nums">{result.leanMass}<span className="text-[10px] text-white/30 font-normal ml-0.5">kg</span></p>
                      <p className="text-[9px] text-white/30">Masse maigre</p>
                    </div>
                    <div>
                      <p className="text-[18px] font-black text-white tabular-nums">{result.estimatedBF}<span className="text-[10px] text-white/30 font-normal ml-0.5">%</span></p>
                      <p className="text-[9px] text-white/30">BF% estimé</p>
                    </div>
                    <div>
                      <p className="text-[18px] font-black text-white tabular-nums">{result.tdee - result.calories > 0 ? '-' : '+'}{Math.abs(result.tdee - result.calories)}<span className="text-[10px] text-white/30 font-normal ml-0.5">kcal</span></p>
                      <p className="text-[9px] text-white/30">Ajustement</p>
                    </div>
                  </div>
                </div>

                {/* ── Macros ── */}
                <div className="bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-xl p-4">
                  <SectionTitle>Macronutriments</SectionTitle>

                  {/* Répartition visuelle */}
                  <div className="flex rounded-lg overflow-hidden h-2 mb-4 gap-px">
                    <div className="bg-blue-500/70"    style={{ width: `${result.percents.p}%` }} />
                    <div className="bg-amber-500/70"   style={{ width: `${result.percents.f}%` }} />
                    <div className="bg-emerald-500/70" style={{ width: `${result.percents.c}%` }} />
                  </div>

                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {[
                      { key: 'p' as const, label: 'Protéines', color: 'text-blue-400', bar: 'bg-blue-500/60', sub: 'Synthèse & rétention' },
                      { key: 'f' as const, label: 'Lipides',   color: 'text-amber-400', bar: 'bg-amber-500/60', sub: 'Hormones & santé' },
                      { key: 'c' as const, label: 'Glucides',  color: 'text-emerald-400', bar: 'bg-emerald-500/60', sub: 'Énergie & glycogène' },
                    ].map(({ key, label, color, sub }) => (
                      <div key={key} className="bg-white/[0.02] rounded-xl p-3 border-[0.3px] border-white/[0.04]">
                        <p className="text-[9px] text-white/35 mb-1 uppercase tracking-wide">{label}</p>
                        <p className={`text-[24px] font-black tabular-nums leading-none ${color}`}>
                          {result.macros[key]}
                          <span className="text-[11px] text-white/30 font-normal ml-0.5">g</span>
                        </p>
                        <p className="text-[9px] text-white/25 mt-1">{sub}</p>
                        <div className="mt-2 pt-2 border-t-[0.3px] border-white/[0.04] space-y-0.5">
                          <p className="text-[10px] text-white/35">{result.percents[key]}% des kcal</p>
                          <p className="text-[10px] text-white/35">{result.ratiosByBW[key]} g/kg PC</p>
                          {key === 'p' && <p className="text-[10px] text-white/35">{result.ratios.p} g/kg LBM</p>}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Ajustements manuels */}
                  <div className="pt-3 border-t-[0.3px] border-white/[0.04]">
                    <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/25 mb-3">Ajustements</p>
                    <div className="space-y-3">

                      {/* Slider calorique */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] text-white/35">Ajustement calorique</span>
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => setCalorieAdjust(0)}
                              className="text-[9px] text-white/25 hover:text-white/50 transition-colors">reset</button>
                            <span className={`text-[11px] font-bold tabular-nums ${calorieAdjust > 0 ? 'text-[#1f8a65]' : calorieAdjust < 0 ? 'text-red-400' : 'text-white/40'}`}>
                              {calorieAdjust > 0 ? '+' : ''}{calorieAdjust}%
                            </span>
                          </div>
                        </div>
                        <input type="range" min="-30" max="30" step="1" value={calorieAdjust}
                          onChange={(e) => setCalorieAdjust(Number(e.target.value))}
                          className="w-full h-1 accent-[#1f8a65] cursor-pointer"
                        />
                        <div className="flex justify-between text-[8px] text-white/20 mt-0.5">
                          <span>-30%</span><span>0</span><span>+30%</span>
                        </div>
                      </div>

                      {/* Protéines override */}
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-white/35">Protéines (g/kg poids de corps)</span>
                        <div className={`flex items-center rounded-lg border-[0.3px] overflow-hidden ${
                          proteinOverride !== '' ? 'border-[#1f8a65]/30 bg-[#1f8a65]/[0.06]' : 'border-white/[0.06] bg-white/[0.03]'
                        }`}>
                          <input
                            type="number" step="0.1" min="0.5" max="4"
                            value={proteinOverride}
                            onChange={(e) => setProteinOverride(e.target.value)}
                            placeholder={
                              baseResult && weight
                                ? (baseResult.macros.p / (parseFloat(weight) || 1)).toFixed(1)
                                : '—'
                            }
                            className="w-12 h-8 bg-transparent px-2 text-[12px] font-bold text-white placeholder:text-white/20 outline-none"
                          />
                          <span className="text-[9px] text-white/25 pr-2">g/kg</span>
                          {proteinOverride !== '' && (
                            <button
                              onClick={() => setProteinOverride('')}
                              className="h-8 w-8 flex items-center justify-center text-white/30 hover:text-white/60 transition-colors"
                            >
                              <X size={11} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Recovery adaptation ── */}
                {result.recoveryAdaptation && (
                  <div className="bg-amber-500/[0.06] border-[0.3px] border-amber-500/20 rounded-xl p-4">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[11px] font-semibold text-amber-300 mb-1">
                          Adaptation récupération — déficit réduit recommandé
                        </p>
                        <p className="text-[10px] text-amber-400/70 leading-relaxed">
                          {result.recoveryAdaptation.reason} → réduire le déficit de {result.recoveryAdaptation.suggestedDeficitReduction}% conseillé.
                        </p>
                        <button
                          onClick={() => setCalorieAdjust((prev) => Math.min(prev + result.recoveryAdaptation!.suggestedDeficitReduction, 30))}
                          className="mt-2 text-[10px] font-bold text-amber-400 hover:text-amber-300 transition-colors"
                        >
                          Appliquer +{result.recoveryAdaptation.suggestedDeficitReduction}% →
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Warnings ── */}
                {result.warnings.length > 0 && (
                  <div className="space-y-1.5">
                    {result.warnings.map((w, i) => (
                      <div key={i} className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-500/[0.06] border-[0.3px] border-red-500/15">
                        <AlertTriangle size={11} className="text-red-400 shrink-0 mt-0.5" />
                        <span className="text-[11px] text-red-300/80">{w}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── Smart Protocol ── */}
                {result.smartProtocol.length > 0 && (
                  <div className="bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-xl p-4">
                    <SectionTitle icon={Zap}>Smart Protocol</SectionTitle>
                    <p className="text-[10px] text-white/30 mb-3 -mt-1 leading-relaxed">
                      Recommandations générées depuis le profil complet du client. Basées sur la littérature scientifique.
                    </p>

                    <div className="space-y-2">
                      {result.smartProtocol.map((s) => {
                        const cfg = PRIORITY_CONFIG[s.priority];
                        const isActive = activeProtocol === s.id;
                        const isApplyable = ['protein_low', 'fats_critical', 'sleep_suboptimal', 'stress_critical'].includes(s.id);

                        return (
                          <div key={s.id} className={`rounded-xl border-[0.3px] p-3 ${cfg.bg} ${cfg.border} ${isActive ? 'ring-1 ring-[#1f8a65]/30' : ''}`}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-2 flex-1 min-w-0">
                                <div className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${cfg.dot}`} />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                    <span className={`text-[11px] font-bold ${cfg.color}`}>{s.title}</span>
                                    <span className={`text-[8px] px-1.5 py-0.5 rounded-full border-[0.3px] font-bold uppercase tracking-wide ${cfg.color} ${cfg.border} opacity-70`}>
                                      {s.priority === 'critical' ? 'Critique' : s.priority === 'high' ? 'Prioritaire' : s.priority === 'medium' ? 'Recommandé' : 'Info'}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-white/40 leading-relaxed mb-1.5">{s.rationale}</p>
                                  <p className="text-[10px] text-white/60 font-medium">→ {s.action}</p>
                                  {s.source && (
                                    <p className="text-[9px] text-white/20 mt-1 italic">{s.source}</p>
                                  )}
                                </div>
                              </div>

                              {isApplyable && (
                                <button
                                  onClick={() => applyProtocolSuggestion(s)}
                                  className={`shrink-0 flex items-center gap-1 px-2.5 h-7 rounded-lg text-[10px] font-bold transition-all ${
                                    isActive
                                      ? 'bg-[#1f8a65]/20 text-[#1f8a65] border-[0.3px] border-[#1f8a65]/30'
                                      : 'bg-white/[0.05] text-white/40 hover:bg-white/[0.08] hover:text-white/70 border-[0.3px] border-white/[0.06]'
                                  }`}
                                >
                                  {isActive ? <Check size={10} /> : <Send size={10} />}
                                  {isActive ? 'Appliqué' : 'Appliquer'}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── Actions ── */}
                <div className="flex items-center gap-2">
                  <button onClick={handleCopy}
                    className="flex items-center gap-1.5 px-4 h-9 rounded-xl bg-white/[0.04] border-[0.3px] border-white/[0.06] text-[11px] font-bold text-white/50 hover:text-white/80 hover:bg-white/[0.07] transition-all">
                    {copied ? <Check size={13} className="text-[#1f8a65]" /> : <Copy size={13} />}
                    {copied ? 'Copié' : 'Copier le protocole'}
                  </button>
                  <div className="flex items-center gap-1 ml-auto text-[10px] text-white/20">
                    <span>LBM:{result.dataProvenance.lbmSource}</span>
                    <span>·</span>
                    <span>BMR:{result.dataProvenance.bmrSource}</span>
                    <span>·</span>
                    <span>EAT:{result.dataProvenance.eatSource}</span>
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
