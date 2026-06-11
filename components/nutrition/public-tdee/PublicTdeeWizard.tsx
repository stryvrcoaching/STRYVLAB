'use client';

import Link from 'next/link';
import { useMemo, useRef, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Copy,
  Download,
  Sparkles,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Flame,
  ShieldCheck,
  BrainCircuit,
  CheckCircle2,
} from 'lucide-react';
import { useSetTopBar } from '@/components/layout/useSetTopBar';
import {
  computePublicTdeePlan,
  validatePublicTdeeInput,
  type PublicTdeeInput,
  type PublicTdeePlan,
  type PublicTdeeMenstrualPhase,
} from '@/lib/nutrition/public-tdee';

type Step = 1 | 2 | 3 | 4;

const STEP_META: Record<Step, { label: string; title: string; desc: string }> = {
  1: {
    label: '01 · Profil',
    title: 'Bases indispensables',
    desc: 'Les champs essentiels pour établir le socle du calcul.',
  },
  2: {
    label: '02 · Activité',
    title: 'Niveau d’activité et entraînement',
    desc: 'Les leviers qui changent réellement le TDEE au quotidien.',
  },
  3: {
    label: '03 · Expert',
    title: 'Affinage expert',
    desc: 'Les signaux qui améliorent la précision sans bloquer le calcul.',
  },
  4: {
    label: '04 · Résultat',
    title: 'Plan complet et déroulement premium',
    desc: 'Calories, macros, logique des jours et export.',
  },
};

const GOAL_OPTIONS: Array<{ value: PublicTdeeInput['goal']; label: string; hint: string }> = [
  { value: 'deficit', label: 'Déficit', hint: 'Perdre du gras sans improviser la dose.' },
  { value: 'maintenance', label: 'Maintenance', hint: 'Stabiliser et consolider la structure.' },
  { value: 'surplus', label: 'Surplus', hint: 'Construire proprement sans déraper.' },
];

const GENDER_OPTIONS: Array<{ value: PublicTdeeInput['gender']; label: string }> = [
  { value: 'male', label: 'Homme' },
  { value: 'female', label: 'Femme' },
];

const ACTIVITY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Ne pas préciser' },
  { value: '0.95', label: 'Très sédentaire' },
  { value: '1.00', label: 'Sédentaire' },
  { value: '1.05', label: 'Légèrement actif' },
  { value: '1.10', label: 'Modérément actif' },
  { value: '1.18', label: 'Actif' },
] as const;

const PHASE_OPTIONS: Array<{ value: PublicTdeeMenstrualPhase; label: string }> = [
  { value: 'unknown', label: 'Non renseignée' },
  { value: 'follicular', label: 'Folliculaire' },
  { value: 'luteal', label: 'Lutéale' },
];

function parseNumber(value: string) {
  if (value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toStringValue(value: number | null | undefined) {
  return value == null ? '' : String(value);
}

function useCopyState() {
  const [copied, setCopied] = useState(false);

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return { copied, copy };
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-[9px] font-bold uppercase tracking-[0.16em] text-white/35">{children}</label>;
}

function TextField({
  value,
  onChange,
  placeholder,
  type = 'text',
  min,
  max,
  step,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  min?: string;
  max?: string;
  step?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      type={type}
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      className="h-9 w-full rounded-lg border-[0.3px] border-white/[0.06] bg-white/[0.04] px-3 text-[12px] font-semibold text-white outline-none transition-colors placeholder:text-white/20 focus:border-white/[0.12]"
    />
  );
}

function SelectField<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="h-9 w-full cursor-pointer appearance-none rounded-lg border-[0.3px] border-white/[0.06] bg-white/[0.04] px-3 text-[12px] font-semibold text-white outline-none transition-colors focus:border-white/[0.12]"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value} className="bg-[#181818]">
          {option.label}
        </option>
      ))}
    </select>
  );
}

function MetricCard({
  label,
  value,
  suffix,
  tone = 'white',
}: {
  label: string;
  value: string | number;
  suffix?: string;
  tone?: 'white' | 'green' | 'amber';
}) {
  const toneCls =
    tone === 'green' ? 'text-[#1f8a65]' : tone === 'amber' ? 'text-amber-400' : 'text-white';

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3">
      <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">{label}</p>
      <div className="mt-2 flex items-end gap-1">
        <span className={`text-[22px] font-semibold leading-none ${toneCls}`}>{value}</span>
        {suffix && <span className="pb-0.5 text-[10px] text-white/35">{suffix}</span>}
      </div>
    </div>
  );
}

function Disclosure({
  title,
  children,
  defaultOpen = false,
  icon: Icon,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  icon?: React.ElementType;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-[11px] font-semibold text-white/70">
          {Icon && <Icon size={13} className="text-white/35" />}
          {title}
        </span>
        {open ? (
          <ChevronUp size={13} className="text-white/30" />
        ) : (
          <ChevronDown size={13} className="text-white/30" />
        )}
      </button>
      {open && <div className="border-t border-white/[0.05] px-4 py-3">{children}</div>}
    </div>
  );
}

function parsePlanFromSearch(searchParams: ReturnType<typeof useSearchParams>) {
  const gender = searchParams.get('gender');
  const goal = searchParams.get('goal');
  const age = parseNumber(searchParams.get('age') ?? '');
  const height = parseNumber(searchParams.get('height') ?? '');
  const weight = parseNumber(searchParams.get('weight') ?? '');

  if (gender !== 'male' && gender !== 'female') return null;
  if (goal !== 'deficit' && goal !== 'maintenance' && goal !== 'surplus') return null;
  if (age == null || height == null || weight == null) return null;

  const occupation = parseNumber(searchParams.get('occupation') ?? '');
  const phase = searchParams.get('cycle');

  return {
    gender,
    goal,
    age,
    height,
    weight,
    steps: parseNumber(searchParams.get('steps') ?? ''),
    occupation,
    workouts: parseNumber(searchParams.get('workouts') ?? ''),
    duration: parseNumber(searchParams.get('duration') ?? ''),
    cardio: parseNumber(searchParams.get('cardio') ?? ''),
    cardioDuration: parseNumber(searchParams.get('cardioDuration') ?? ''),
    bodyFat: parseNumber(searchParams.get('bodyFat') ?? ''),
    bmr: parseNumber(searchParams.get('bmr') ?? ''),
    sleep: parseNumber(searchParams.get('sleep') ?? ''),
    stress: parseNumber(searchParams.get('stress') ?? ''),
    caffeine: parseNumber(searchParams.get('caffeine') ?? ''),
    alcohol: parseNumber(searchParams.get('alcohol') ?? ''),
    phase: phase === 'follicular' || phase === 'luteal' ? phase : 'unknown',
  };
}

export default function PublicTdeeWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hydratedFromQuery = useRef(false);

  const [step, setStep] = useState<Step>(1);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [plan, setPlan] = useState<PublicTdeePlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { copied, copy } = useCopyState();

  const [gender, setGender] = useState<PublicTdeeInput['gender']>('male');
  const [goal, setGoal] = useState<PublicTdeeInput['goal']>('deficit');
  const [age, setAge] = useState('30');
  const [heightCm, setHeightCm] = useState('180');
  const [weightKg, setWeightKg] = useState('80');
  const [dailySteps, setDailySteps] = useState('8000');
  const [occupationMultiplier, setOccupationMultiplier] = useState('1.00');
  const [workoutsPerWeek, setWorkoutsPerWeek] = useState('4');
  const [sessionDurationMin, setSessionDurationMin] = useState('60');
  const [cardioSessionsPerWeek, setCardioSessionsPerWeek] = useState('');
  const [cardioDurationMin, setCardioDurationMin] = useState('');
  const [bodyFatPct, setBodyFatPct] = useState('');
  const [bmrMeasuredKcal, setBmrMeasuredKcal] = useState('');
  const [sleepHours, setSleepHours] = useState('');
  const [stressLevel, setStressLevel] = useState('');
  const [caffeineDailyMg, setCaffeineDailyMg] = useState('');
  const [alcoholWeekly, setAlcoholWeekly] = useState('');
  const [menstrualPhase, setMenstrualPhase] = useState<PublicTdeeMenstrualPhase>('unknown');

  useEffect(() => {
    if (hydratedFromQuery.current) return;
    const seeded = parsePlanFromSearch(searchParams);
    hydratedFromQuery.current = true;
    if (!seeded) return;

    setGender(seeded.gender as PublicTdeeInput['gender']);
    setGoal(seeded.goal as PublicTdeeInput['goal']);
    setAge(String(seeded.age));
    setHeightCm(String(seeded.height));
    setWeightKg(String(seeded.weight));
    setDailySteps(toStringValue(seeded.steps));
    setOccupationMultiplier(toStringValue(seeded.occupation));
    setWorkoutsPerWeek(toStringValue(seeded.workouts));
    setSessionDurationMin(toStringValue(seeded.duration));
    setCardioSessionsPerWeek(toStringValue(seeded.cardio));
    setCardioDurationMin(toStringValue(seeded.cardioDuration));
    setBodyFatPct(toStringValue(seeded.bodyFat));
    setBmrMeasuredKcal(toStringValue(seeded.bmr));
    setSleepHours(toStringValue(seeded.sleep));
    setStressLevel(toStringValue(seeded.stress));
    setCaffeineDailyMg(toStringValue(seeded.caffeine));
    setAlcoholWeekly(toStringValue(seeded.alcohol));
    setMenstrualPhase(seeded.phase as PublicTdeeMenstrualPhase);

    try {
      const computed = computePublicTdeePlan({
        gender: seeded.gender as PublicTdeeInput['gender'],
        goal: seeded.goal as PublicTdeeInput['goal'],
        age: seeded.age,
        heightCm: seeded.height,
        weightKg: seeded.weight,
        dailySteps: seeded.steps ?? undefined,
        occupationMultiplier: seeded.occupation ?? undefined,
        workoutsPerWeek: seeded.workouts ?? undefined,
        sessionDurationMin: seeded.duration ?? undefined,
        cardioSessionsPerWeek: seeded.cardio ?? undefined,
        cardioDurationMin: seeded.cardioDuration ?? undefined,
        bodyFatPct: seeded.bodyFat ?? undefined,
        bmrMeasuredKcal: seeded.bmr ?? undefined,
        sleepHours: seeded.sleep ?? undefined,
        stressLevel: seeded.stress ?? undefined,
        caffeineDailyMg: seeded.caffeine ?? undefined,
        alcoholWeekly: seeded.alcohol ?? undefined,
        menstrualPhase: seeded.phase,
      });
      setPlan(computed);
      setStep(4);
    } catch {
      setStep(3);
    }
  }, [searchParams]);

  const topLeft = useMemo(
    () => (
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push('/outils')}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.04] text-white/40 transition-all hover:bg-white/[0.08] hover:text-white/75"
        >
          <ArrowLeft size={14} />
        </button>
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/30">Nutrition · CALC_02</p>
          <p className="text-[13px] font-semibold text-white">TDEE Expert</p>
        </div>
      </div>
    ),
    [router],
  );

  useSetTopBar(topLeft, null);

  const sharePath = useMemo(() => {
    if (!plan) return '';
    return `/outils/tdee?${plan.shareQuery}`;
  }, [plan]);

  function buildInput(): PublicTdeeInput {
    return {
      gender,
      goal,
      age: Number(age),
      heightCm: Number(heightCm),
      weightKg: Number(weightKg),
      dailySteps: parseNumber(dailySteps) ?? undefined,
      occupationMultiplier: parseNumber(occupationMultiplier) ?? undefined,
      workoutsPerWeek: parseNumber(workoutsPerWeek) ?? undefined,
      sessionDurationMin: parseNumber(sessionDurationMin) ?? undefined,
      cardioSessionsPerWeek: parseNumber(cardioSessionsPerWeek) ?? undefined,
      cardioDurationMin: parseNumber(cardioDurationMin) ?? undefined,
      bodyFatPct: parseNumber(bodyFatPct) ?? undefined,
      bmrMeasuredKcal: parseNumber(bmrMeasuredKcal) ?? undefined,
      sleepHours: parseNumber(sleepHours) ?? undefined,
      stressLevel: parseNumber(stressLevel) ?? undefined,
      caffeineDailyMg: parseNumber(caffeineDailyMg) ?? undefined,
      alcoholWeekly: parseNumber(alcoholWeekly) ?? undefined,
      menstrualPhase,
    };
  }

  function handleCompute() {
    const input = buildInput();
    const issues = validatePublicTdeeInput(input);
    if (issues.length > 0) {
      setError(issues[0]?.message ?? 'Champs invalides.');
      setPlan(null);
      return false;
    }

    try {
      const computed = computePublicTdeePlan(input);
      setPlan(computed);
      setError(null);
      setStep(4);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de calculer le plan.');
      setPlan(null);
      return false;
    }
  }

  function handleNext() {
    if (step === 3) {
      handleCompute();
      return;
    }
    const issues = validatePublicTdeeInput(buildInput());
    if (issues.length > 0) {
      setError(issues[0]?.message ?? 'Champs invalides.');
      return;
    }
    setError(null);
    setStep((current) => Math.min(4, (current + 1) as Step));
  }

  function handleBack() {
    if (step === 4 && plan) {
      setStep(3);
      return;
    }
    setStep((current) => Math.max(1, (current - 1) as Step));
  }

  async function copySummary() {
    if (!plan) return;
    await copy(plan.exportText);
  }

  async function copyShareLink() {
    if (!plan) return;
    await copy(`${window.location.origin}${sharePath}`);
  }

  async function downloadJson() {
    if (!plan) return;
    const blob = new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'stryv-tdee-plan.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  const currentInput = buildInput();
  const validationPreview = validatePublicTdeeInput(currentInput);

  return (
    <main className="min-h-screen bg-[#121212] text-white">
      <div className="mx-auto max-w-6xl px-6 pb-24 pt-8 md:px-8">
        <section className="mb-6 rounded-[28px] border border-white/[0.06] bg-[#181818] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.18)] md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="max-w-3xl space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#1f8a65]/20 bg-[#1f8a65]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#1f8a65]">
                <Sparkles size={12} />
                Outil public expert
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Calcule ton TDEE réel, puis programme tes jours</h1>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/55">
                  Un wizard hybride minimaliste avec BMR, NEAT, EAT, TEF, différenciation training/rest et sortie premium dépliable.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
                <span className="rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1">2 min</span>
                <span className="rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1">Mobile first</span>
                <span className="rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1">Open source ready</span>
              </div>
            </div>

            <div className="grid w-full max-w-sm gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3 md:grid-cols-3">
              <MetricCard label="Étape" value={step} suffix="/4" tone="green" />
              <MetricCard label="Focus" value="Plan" suffix="complet" tone="amber" />
              <MetricCard label="Sortie" value="Premium" suffix="dépliable" />
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-white/[0.06] bg-[#181818] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.16)] md:p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">{STEP_META[step].label}</p>
              <h2 className="mt-2 text-[18px] font-semibold text-white">{STEP_META[step].title}</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-white/52">{STEP_META[step].desc}</p>
            </div>
            <div className="hidden items-center gap-2 md:flex">
              {[1, 2, 3, 4].map((value) => (
                <div key={value} className={`h-2 w-12 rounded-full ${value <= step ? 'bg-[#1f8a65]' : 'bg-white/[0.06]'}`} />
              ))}
            </div>
          </div>

          {step !== 4 && (
            <div className="mb-5 grid gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] md:grid-cols-4">
              {([1, 2, 3, 4] as Step[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStep(value)}
                  className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                    value === step
                      ? 'border-[#1f8a65]/25 bg-[#1f8a65]/10 text-white'
                      : 'border-white/[0.06] bg-white/[0.03] text-white/40 hover:bg-white/[0.05] hover:text-white/70'
                  }`}
                >
                  {STEP_META[value].label}
                </button>
              ))}
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <FieldLabel>Sexe</FieldLabel>
                <SelectField value={gender} onChange={setGender} options={GENDER_OPTIONS} />
              </div>
              <div>
                <FieldLabel>Objectif</FieldLabel>
                <SelectField value={goal} onChange={setGoal} options={GOAL_OPTIONS} />
              </div>
              <div>
                <FieldLabel>Âge</FieldLabel>
                <TextField value={age} onChange={setAge} type="number" min="15" max="85" placeholder="30" />
              </div>
              <div>
                <FieldLabel>Taille</FieldLabel>
                <TextField value={heightCm} onChange={setHeightCm} type="number" min="140" max="220" placeholder="180" />
              </div>
              <div>
                <FieldLabel>Poids</FieldLabel>
                <TextField value={weightKg} onChange={setWeightKg} type="number" min="40" max="250" placeholder="80" />
              </div>
              <div>
                <FieldLabel>Masse grasse estimée</FieldLabel>
                <TextField value={bodyFatPct} onChange={setBodyFatPct} type="number" min="3" max="45" placeholder="Optionnel" />
              </div>

              <div className="md:col-span-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 size={16} className="mt-0.5 text-[#1f8a65]" />
                  <div>
                    <p className="text-[12px] font-semibold text-white">Le calcul reste possible sans masse grasse.</p>
                    <p className="mt-1 text-[12px] leading-relaxed text-white/45">
                      Si tu ne la renseignes pas, le moteur s’appuie sur une estimation conservatrice pour garder un plan exploitable.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <FieldLabel>Pas par jour</FieldLabel>
                <TextField value={dailySteps} onChange={setDailySteps} type="number" min="0" max="40000" placeholder="8000" />
              </div>
              <div>
                <FieldLabel>Type de travail</FieldLabel>
                <SelectField value={occupationMultiplier} onChange={setOccupationMultiplier} options={ACTIVITY_OPTIONS} />
              </div>
              <div>
                <FieldLabel>Séances / semaine</FieldLabel>
                <TextField value={workoutsPerWeek} onChange={setWorkoutsPerWeek} type="number" min="0" max="14" placeholder="4" />
              </div>
              <div>
                <FieldLabel>Durée moyenne</FieldLabel>
                <TextField value={sessionDurationMin} onChange={setSessionDurationMin} type="number" min="0" max="240" placeholder="60" />
              </div>

              <div className="md:col-span-2">
                <button
                  type="button"
                  onClick={() => setAdvancedOpen((value) => !value)}
                  className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-white/45 transition-colors hover:text-white/75"
                >
                  {advancedOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  Affiner l’activité
                </button>

                {advancedOpen && (
                  <div className="grid gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 md:grid-cols-2">
                    <div>
                      <FieldLabel>Cardio / semaine</FieldLabel>
                      <TextField value={cardioSessionsPerWeek} onChange={setCardioSessionsPerWeek} type="number" min="0" max="14" placeholder="Optionnel" />
                    </div>
                    <div>
                      <FieldLabel>Durée cardio</FieldLabel>
                      <TextField value={cardioDurationMin} onChange={setCardioDurationMin} type="number" min="0" max="240" placeholder="Optionnel" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <FieldLabel>BMR mesuré</FieldLabel>
                <TextField value={bmrMeasuredKcal} onChange={setBmrMeasuredKcal} type="number" min="1000" max="4000" placeholder="Optionnel" />
              </div>
              <div>
                <FieldLabel>Phase menstruelle</FieldLabel>
                <SelectField value={menstrualPhase} onChange={setMenstrualPhase} options={PHASE_OPTIONS} />
              </div>
              <div>
                <FieldLabel>Sommeil moyen</FieldLabel>
                <TextField value={sleepHours} onChange={setSleepHours} type="number" min="0" max="16" placeholder="Optionnel" />
              </div>
              <div>
                <FieldLabel>Stress ressenti</FieldLabel>
                <TextField value={stressLevel} onChange={setStressLevel} type="number" min="1" max="10" placeholder="1 à 10" />
              </div>
              <div>
                <FieldLabel>Caféine quotidienne</FieldLabel>
                <TextField value={caffeineDailyMg} onChange={setCaffeineDailyMg} type="number" min="0" max="1200" placeholder="mg / jour" />
              </div>
              <div>
                <FieldLabel>Alcool hebdo</FieldLabel>
                <TextField value={alcoholWeekly} onChange={setAlcoholWeekly} type="number" min="0" max="30" placeholder="verres / semaine" />
              </div>

              <div className="md:col-span-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="flex items-start gap-3">
                  <BrainCircuit size={16} className="mt-0.5 text-[#1f8a65]" />
                  <div>
                    <p className="text-[12px] font-semibold text-white">Les champs experts améliorent la précision, ils ne bloquent pas le plan.</p>
                    <p className="mt-1 text-[12px] leading-relaxed text-white/45">
                      Le moteur applique les signaux utiles seulement s’ils existent. Sinon il reste conservateur et explicable.
                    </p>
                  </div>
                </div>
              </div>

              <div className="md:col-span-2 flex items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-[11px] text-white/50">
                <ShieldCheck size={14} className="text-[#1f8a65]" />
                Validation minimale actuelle: {validationPreview.length === 0 ? 'OK' : validationPreview[0]?.message}
              </div>
            </div>
          )}

          {step === 4 && plan && (
            <div className="space-y-5">
              <div className="grid gap-3 md:grid-cols-3">
                <MetricCard label="Calories training" value={plan.split.trainingDayCalories} suffix="kcal" tone="green" />
                <MetricCard label="Calories repos" value={plan.split.restDayCalories} suffix="kcal" tone="amber" />
                <MetricCard label="Moyenne hebdo" value={plan.split.averageCalories} suffix="kcal" />
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <MetricCard label="BMR" value={plan.result.breakdown.bmr} suffix="kcal" />
                <MetricCard label="NEAT" value={plan.result.breakdown.neat} suffix="kcal" />
                <MetricCard label="EAT" value={plan.result.breakdown.eat + plan.result.breakdown.eatCardio} suffix="kcal" />
                <MetricCard label="TEF" value={Math.round(plan.result.breakdown.tef)} suffix="kcal" />
              </div>

              <section className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-[24px] border border-white/[0.06] bg-white/[0.03] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">Plan complet</p>
                      <h3 className="mt-2 text-[24px] font-semibold text-white">{plan.split.averageCalories} kcal</h3>
                      <p className="mt-2 text-[13px] leading-relaxed text-white/50">
                        {plan.input.goal === 'deficit'
                          ? 'Programme orienté déficit avec jours training plus hauts et repos plus bas.'
                          : plan.input.goal === 'surplus'
                            ? 'Programme orienté surplus avec lissage hebdomadaire.'
                            : 'Programme de maintenance avec répartition contrôlée des jours.'}
                      </p>
                    </div>
                    <div className="rounded-full border border-[#1f8a65]/20 bg-[#1f8a65]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#1f8a65]">
                      {plan.confidence.label}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl bg-white/[0.02] p-3">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Protéines</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{plan.result.macros.p}g</p>
                    </div>
                    <div className="rounded-2xl bg-white/[0.02] p-3">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Glucides</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{plan.result.macros.c}g</p>
                    </div>
                    <div className="rounded-2xl bg-white/[0.02] p-3">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Lipides</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{plan.result.macros.f}g</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 rounded-[24px] border border-white/[0.06] bg-white/[0.03] p-5">
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">
                    <Flame size={13} className="text-[#1f8a65]" />
                    Répartition hebdo
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <MetricCard label="Jours training" value={plan.split.trainingDays} suffix="/7" />
                    <MetricCard label="Jours repos" value={plan.split.restDays} suffix="/7" />
                  </div>
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <p className="text-[11px] font-semibold text-white/75">Macros training</p>
                    <p className="mt-1 text-[12px] text-white/45">
                      {plan.split.trainingMacros.protein_g}g P · {plan.split.trainingMacros.carbs_g}g G · {plan.split.trainingMacros.fat_g}g L
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <p className="text-[11px] font-semibold text-white/75">Macros repos</p>
                    <p className="mt-1 text-[12px] text-white/45">
                      {plan.split.restMacros.protein_g}g P · {plan.split.restMacros.carbs_g}g G · {plan.split.restMacros.fat_g}g L
                    </p>
                  </div>
                </div>
              </section>

              <div className="grid gap-3 lg:grid-cols-2">
                <Disclosure title="Déroulement premium" defaultOpen icon={BarChart3}>
                  <div className="space-y-2 text-[12px] leading-relaxed text-white/55">
                    {plan.premiumSummary.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>
                </Disclosure>

                <Disclosure title="Garde-fous et hypothèses" defaultOpen icon={ShieldCheck}>
                  <div className="space-y-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">Hypothèses</p>
                      <ul className="mt-2 space-y-2 text-[12px] leading-relaxed text-white/55">
                        {plan.assumptions.map((item) => (
                          <li key={item} className="flex gap-2">
                            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-white/30" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">Garde-fous</p>
                      <ul className="mt-2 space-y-2 text-[12px] leading-relaxed text-white/55">
                        {plan.guardrails.map((item) => (
                          <li key={item} className="flex gap-2">
                            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1f8a65]" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </Disclosure>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <button
                  type="button"
                  onClick={copySummary}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.04] px-4 py-3 text-[12px] font-semibold text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white"
                >
                  <Copy size={14} />
                  Copier le résumé
                </button>
                  <button
                  type="button"
                  onClick={copyShareLink}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.04] px-4 py-3 text-[12px] font-semibold text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white"
                >
                  <Download size={14} />
                  Copier le lien
                </button>
                <button
                  type="button"
                  onClick={downloadJson}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.04] px-4 py-3 text-[12px] font-semibold text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white"
                >
                  <Download size={14} />
                  Export JSON
                </button>
              </div>

              <div className="rounded-[24px] border border-[#1f8a65]/20 bg-[#1f8a65]/10 p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#1f8a65]">Passerelle finale</p>
                    <h3 className="mt-2 text-lg font-semibold text-white">Recevoir un cadrage plus poussé avec STRYV</h3>
                    <p className="mt-1 text-[13px] leading-relaxed text-white/55">
                      Tu as déjà le plan. Si tu veux le niveau au-dessus, passe à l’admission stratégique.
                    </p>
                  </div>
                  <Link
                    href="/omni/admission"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1f8a65] px-4 py-3 text-[12px] font-semibold text-white transition-colors hover:bg-[#197155]"
                  >
                    Aller plus loin avec STRYV
                    <ArrowRight size={14} />
                  </Link>
                </div>
              </div>

              {copied && (
                <div className="rounded-2xl border border-[#1f8a65]/20 bg-[#1f8a65]/10 px-4 py-3 text-sm text-[#1f8a65]">
                  Copié dans le presse-papiers.
                </div>
              )}
            </div>
          )}

          <div className="mt-6 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-[12px] font-semibold text-white/60 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              <ArrowLeft size={14} />
              Retour
            </button>

            {step !== 4 ? (
              <button
                type="button"
                onClick={handleNext}
                className="inline-flex items-center gap-2 rounded-xl bg-[#1f8a65] px-4 py-3 text-[12px] font-semibold text-white transition-colors hover:bg-[#197155]"
              >
                {step === 3 ? 'Calculer mon plan' : 'Continuer'}
                <ArrowRight size={14} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStep(3)}
                className="inline-flex items-center gap-2 rounded-xl bg-white/[0.04] px-4 py-3 text-[12px] font-semibold text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white"
              >
                Modifier les données
              </button>
            )}
          </div>
        </section>

        {step !== 4 && (
          <div className="mt-5 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 text-[12px] text-white/45">
            Le calcul reste exploitable avec un profil partiel. Les champs expert augmentent la précision mais ne bloquent pas la sortie.
          </div>
        )}
      </div>
    </main>
  );
}
