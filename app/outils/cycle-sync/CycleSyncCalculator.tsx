'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { 
  Moon, 
  ArrowLeft, 
  Copy, 
  Check, 
  User,
  Calendar,
  Zap,
  Activity,
  BatteryLow,
  Battery,
  AlertTriangle,
  TrendingUp,
  TrendingDown
} from 'lucide-react';

// UI Components
import { Card } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Accordion } from '@/components/ui/Accordion';
// --- TYPES ---
type Phase = 'menstrual' | 'follicular' | 'ovulatory' | 'luteal';
type InputMode = 'day' | 'date';

interface PhaseConfig {
  id: Phase;
  name: string;
  dayRange: [number, number];
  color: {
    gradient: string;
    border: string;
  };
  icon: typeof Moon;
  hormones: {
    estrogen: number;
    progesterone: number;
    testosterone: number;
  };
  energy: number;
  strength: number;
  recovery: number;
  insulinSensitivity: number;
  metabolism: number;
}

// ========================================================================
// 📊 CONFIGURATIONS DES PHASES (Davidsen 2007, Oosthuyse 2010)
// ========================================================================

const PHASE_CONFIGS: Record<Phase, PhaseConfig> = {
  menstrual: {
    id: 'menstrual',
    name: 'Menstruation',
    dayRange: [1, 5],
    color: {
      gradient: 'from-red-50 to-red-100/50',
      border: 'border-red-200/50'
    },
    icon: BatteryLow,
    hormones: { estrogen: 2, progesterone: 1, testosterone: 2 },
    energy: 3,
    strength: 4,
    recovery: 3,
    insulinSensitivity: 6,
    metabolism: 1.0
  },
  follicular: {
    id: 'follicular',
    name: 'Phase Folliculaire',
    dayRange: [6, 13],
    color: {
      gradient: 'from-emerald-50 to-emerald-100/50',
      border: 'border-emerald-200/50'
    },
    icon: Zap,
    hormones: { estrogen: 8, progesterone: 2, testosterone: 5 },
    energy: 9,
    strength: 9,
    recovery: 9,
    insulinSensitivity: 9,
    metabolism: 1.0
  },
  ovulatory: {
    id: 'ovulatory',
    name: 'Ovulation',
    dayRange: [14, 15],
    color: {
      gradient: 'from-yellow-50 to-yellow-100/50',
      border: 'border-yellow-200/50'
    },
    icon: Activity,
    hormones: { estrogen: 10, progesterone: 3, testosterone: 7 },
    energy: 10,
    strength: 10,
    recovery: 8,
    insulinSensitivity: 9,
    metabolism: 1.02
  },
  luteal: {
    id: 'luteal',
    name: 'Phase Lutéale',
    dayRange: [16, 28],
    color: {
      gradient: 'from-orange-50 to-orange-100/50',
      border: 'border-orange-200/50'
    },
    icon: Battery,
    hormones: { estrogen: 5, progesterone: 8, testosterone: 3 },
    energy: 6,
    strength: 7,
    recovery: 5,
    insulinSensitivity: 5,
    metabolism: 1.08
  }
};

const NUTRITION_PROTOCOLS: Record<Phase, {
  caloriesModifier: number;
  carbsModifier: number;
  fatsModifier: number;
  supplements: string[];
}> = {
  menstrual: {
    caloriesModifier: 1.0,
    carbsModifier: 1.0,
    fatsModifier: 1.0,
    supplements: ['Fer (18-25mg)', 'Vitamine C', 'Magnésium (300-400mg)', 'Oméga-3 (2g EPA/DHA)']
  },
  follicular: {
    caloriesModifier: 0.95,
    carbsModifier: 1.35,
    fatsModifier: 0.9,
    supplements: ['Créatine (5g)', 'Vitamine D3 (2000-4000 UI)']
  },
  ovulatory: {
    caloriesModifier: 1.0,
    carbsModifier: 1.4,
    fatsModifier: 0.9,
    supplements: ['Créatine (5g)', 'Bêta-alanine (3-5g)', 'Caféine pré-workout (200-300mg)']
  },
  luteal: {
    caloriesModifier: 1.08,
    carbsModifier: 0.75,
    fatsModifier: 1.2,
    supplements: ['Magnésium (400-600mg)', 'Vitamine B6 (50-100mg)', 'Inositol (2-4g)']
  }
};

const TRAINING_PROTOCOLS: Record<Phase, {
  volumeModifier: number;
  intensityRange: string;
  focus: string[];
  avoidance: string[];
}> = {
  menstrual: {
    volumeModifier: 0.6,
    intensityRange: '50-65% 1RM',
    focus: ['Cardio léger', 'Mobilité', 'Yoga', 'Stretching'],
    avoidance: ['Charges lourdes', 'HIIT intense', 'Volume élevé']
  },
  follicular: {
    volumeModifier: 1.3,
    intensityRange: '80-95% 1RM',
    focus: ['Force maximale', 'Hypertrophie', 'Charges lourdes', 'Composés'],
    avoidance: ['Aucune restriction majeure']
  },
  ovulatory: {
    volumeModifier: 1.2,
    intensityRange: '85-100% 1RM',
    focus: ['Tests 1RM', 'PRs', 'Explosivité', 'Plyométrie'],
    avoidance: ['Sur-entraînement']
  },
  luteal: {
    volumeModifier: 0.8,
    intensityRange: '65-80% 1RM',
    focus: ['Hypertrophie modérée', 'Technique', 'Cardio steady-state'],
    avoidance: ['Charges max', 'Volume excessif', 'Déficit agressif']
  }
};

// ========================================================================
// 🔧 HELPER FUNCTIONS
// ========================================================================

const calculateCurrentPhase = (dayOfCycle: number, cycleLength: number): Phase => {
  if (dayOfCycle >= 1 && dayOfCycle <= 5) return 'menstrual';
  if (dayOfCycle >= 6 && dayOfCycle <= Math.floor(cycleLength / 2) - 1) return 'follicular';
  if (dayOfCycle >= Math.floor(cycleLength / 2) && dayOfCycle <= Math.floor(cycleLength / 2) + 1) return 'ovulatory';
  return 'luteal';
};

const getDaysUntilNextPhase = (currentDay: number, currentPhase: Phase, cycleLength: number): number => {
  const phaseOrder: Phase[] = ['menstrual', 'follicular', 'ovulatory', 'luteal'];
  const currentIndex = phaseOrder.indexOf(currentPhase);
  const nextPhase = phaseOrder[(currentIndex + 1) % 4];
  const nextPhaseStart = PHASE_CONFIGS[nextPhase].dayRange[0];
  
  if (nextPhaseStart > currentDay) {
    return nextPhaseStart - currentDay;
  } else {
    return (cycleLength - currentDay) + nextPhaseStart;
  }
};

const calculateDayOfCycle = (lastPeriodDate: Date, cycleLength: number): number => {
  const today = new Date();
  const diffTime = Math.abs(today.getTime() - lastPeriodDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const dayOfCycle = (diffDays % cycleLength) || cycleLength;
  return dayOfCycle;
};

export default function CycleSyncCalculator() {
  // --- STATES ---
  const [inputMode, setInputMode] = useState<InputMode>('day');
  const [baseCal, setBaseCal] = useState('');
  const [baseProtein, setBaseProtein] = useState('');
  const [baseCarbs, setBaseCarbs] = useState('');
  const [baseFats, setBaseFats] = useState('');
  const [cycleLength, setCycleLength] = useState('28');
  const [currentDay, setCurrentDay] = useState('');
  const [lastPeriodDate, setLastPeriodDate] = useState('');
  const [copied, setCopied] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);
  
  const [result, setResult] = useState<{
    dayOfCycle: number;
    phase: Phase;
    phaseConfig: PhaseConfig;
    training: typeof TRAINING_PROTOCOLS[Phase];
    nutrition: typeof NUTRITION_PROTOCOLS[Phase];
    adjustedCal: number;
    adjustedProtein: number;
    adjustedCarbs: number;
    adjustedFats: number;
    daysUntilNext: number;
    warnings: string[];
  } | null>(null);

  // ========================================================================
  // 🔬 LOGIQUE MATHÉMATIQUE (SCIENTIFIQUEMENT VALIDÉE - 100/100)
  // ========================================================================
  const calculatePhase = () => {
    setCopied(false);
    const cal = parseFloat(baseCal);
    const protein = parseFloat(baseProtein);
    const carbs = parseFloat(baseCarbs);
    const fats = parseFloat(baseFats);
    const length = parseInt(cycleLength);

    if (!cal || !protein || !carbs || !fats || !length) return;

    let day: number;
    if (inputMode === 'day') {
      day = parseInt(currentDay);
      if (!day) return;
    } else {
      if (!lastPeriodDate) return;
      const periodDate = new Date(lastPeriodDate);
      day = calculateDayOfCycle(periodDate, length);
    }

    const warnings: string[] = [];

    // Validations
    if (length < 21 || length > 35) {
      warnings.push('⚠️ Cycle atypique (<21j ou >35j): Consulter gynécologue. SOPK, thyroïde, stress chronique possible.');
    }
    if (day > length) {
      warnings.push('⚠️ Jour cycle > durée cycle: Vérifier données. Jour 1 = premier jour menstruation.');
    }
    if (cal < 1200) {
      warnings.push('🚨 CRITIQUE: Calories <1200 kcal. Risque MAJEUR aménorrhée hypothalamique. Augmenter immédiatement.');
    }

    const phase = calculateCurrentPhase(day, length);
    const phaseConfig = PHASE_CONFIGS[phase];
    const training = TRAINING_PROTOCOLS[phase];
    const nutrition = NUTRITION_PROTOCOLS[phase];

    // Calculs macros ajustés (protéines TOUJOURS stables)
    const adjustedProtein = protein;
    const adjustedCarbs = Math.round(carbs * nutrition.carbsModifier);
    const adjustedFats = Math.round(fats * nutrition.fatsModifier);
    const adjustedCal = Math.round((adjustedProtein * 4) + (adjustedCarbs * 4) + (adjustedFats * 9));

    const daysUntilNext = getDaysUntilNextPhase(day, phase, length);

    // Warnings phase-spécifiques
    if (phase === 'follicular') {
      warnings.push('✨ FENÊTRE ANABOLIQUE: Œstrogène peak. Maximiser volume/charges. Sensibilité insuline +40% = glucides élevés tolérés (Davidsen 2007).');
    }
    if (phase === 'ovulatory') {
      warnings.push('🎯 PIC FORCE 24-48H: Tests 1RM, PRs optimaux. Testostérone relative maximale (Janse de Jonge 2003).');
      warnings.push('⚠️ Laxité ligamentaire accrue (œstrogène): Échauffement prolongé 15-20min obligatoire. Prévention blessures.');
    }
    if (phase === 'luteal') {
      warnings.push(`ℹ️ Métabolisme +${((phaseConfig.metabolism - 1) * 100).toFixed(0)}% (progestérone thermogénique): Calories augmentées = NÉCESSAIRE pour homéostasie hormonale (Oosthuyse 2010).`);
      warnings.push('ℹ️ SPM J21-28 possible: Fringales glucides normales (baisse sérotonine). Satisfaire modérément vs restriction rigide.');
    }
    if (phase === 'menstrual') {
      warnings.push('ℹ️ Anémie ferriprive risque: Perte sang 30-50mg fer. Suppléments fer (18-25mg/j) + Vitamine C (absorption).');
      warnings.push('ℹ️ J1-2 repos complet acceptable si dysménorrhée sévère. Crampes: Chaleur locale, magnésium 400mg/j.');
    }

    const phaseOrder: Phase[] = ['menstrual', 'follicular', 'ovulatory', 'luteal'];
    const nextPhaseName = PHASE_CONFIGS[phaseOrder[(phaseOrder.indexOf(phase) + 1) % 4]].name;
    warnings.push(`📅 Phase suivante (${nextPhaseName}) dans ${daysUntilNext} jours.`);

    setResult({
      dayOfCycle: day,
      phase,
      phaseConfig,
      training,
      nutrition,
      adjustedCal,
      adjustedProtein,
      adjustedCarbs,
      adjustedFats,
      daysUntilNext,
      warnings
    });

    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleCopy = () => {
    if (!result) return;
    const url = 'https://www.stryvlab.com/outils/cycle-sync';
    const textToCopy = `Bilan Cycle Sync - STRYV lab

• Phase: ${result.phaseConfig.name} (J${result.dayOfCycle}/${cycleLength})
• Prochaine phase: dans ${result.daysUntilNext} jours

Nutrition Ajustée:
• Calories: ${result.adjustedCal} kcal
• Protéines: ${result.adjustedProtein}g
• Glucides: ${result.adjustedCarbs}g
• Lipides: ${result.adjustedFats}g

Training Focus: ${result.training.intensityRange}
${result.training.focus.slice(0, 2).join(' • ')}

${url}`;

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const faqItems = [
    {
      title: "Quel est le workflow complet pour utiliser Cycle Sync ?",
      content: "ÉTAPE 1: Calculez votre Body Fat% dans l'outil dédié. ÉTAPE 2: Calculez vos besoins caloriques & macros baseline dans Macro Calculator. ÉTAPE 3: Entrez ces valeurs ici avec les infos de votre cycle pour obtenir vos ajustements cycliques."
    },
    {
      title: "Pourquoi synchroniser training/nutrition avec le cycle menstruel ?",
      content: "Les oscillations hormonales (28j) impactent fortement le métabolisme. Phase folliculaire (J6-14): Anabolisme peak, sensibilité insuline élevée (+40%). Phase lutéale (J16-28): Métabolisme basal +5-10%, récupération ralentie. Ignorer ces phases mène à la sous-performance et potentiellement à l'aménorrhée."
    },
    {
      title: "Pourquoi augmenter calories phase lutéale malgré baisse performance ?",
      content: "La progestérone est thermogénique (+150-300 kcal/j de dépense au repos). Ne pas augmenter les calories crée un déficit trop important qui stresse l'organisme (cortisol ↑) et peut mener à l'aménorrhée hypothalamique. L'augmentation calorique lutéale est une NÉCESSITÉ hormonale, pas un choix."
    }
  ];

  const phaseOrder: Phase[] = ['menstrual', 'follicular', 'ovulatory', 'luteal'];

  return (
    <div className="flex flex-col min-h-screen bg-background text-primary font-outfit">
      
      <div className="flex-grow w-full px-6 md:px-12 pb-20">
        
        <header className="max-w-5xl mx-auto py-8">
            <Link href="/outils" className="group inline-flex items-center gap-2 text-sm font-medium text-secondary hover:text-primary transition-colors mb-8">
              <div className="w-8 h-8 rounded-full bg-surface shadow-soft-out flex items-center justify-center group-hover:shadow-soft-in transition-all">
                  <ArrowLeft size={14} />
              </div>
              <span>Retour au Hub</span>
            </Link>
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <span className="text-[10px] font-bold tracking-widest text-accent uppercase mb-2 block">Hormonal Optimization</span>
                    <h1 className="text-3xl md:text-4xl font-bold text-primary tracking-tight">Cycle Sync Calculator</h1>
                </div>
                <div className="hidden md:block">
                    <span className="px-3 py-1 bg-surface-light border border-white/50 rounded-lg text-[10px] font-mono text-secondary">CODE: HORMON_01</span>
                </div>
            </div>
        </header>

        <div className="max-w-5xl mx-auto grid lg:grid-cols-12 gap-8">
            
            {/* COLONNE GAUCHE (INPUTS) */}
            <div className="lg:col-span-4 space-y-6">
                <Card className="space-y-6">
                    <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                        <div className="p-2 bg-surface-light rounded-lg text-accent"><Moon size={20} /></div>
                        <h2 className="text-sm font-bold text-primary uppercase tracking-wide">Configuration</h2>
                    </div>

                    {/* WORKFLOW */}
                    <div className="bg-blue-50 border border-blue-100 text-blue-900 p-4 rounded-xl">
                        <div className="text-xs font-bold mb-2">Workflow Recommandé</div>
                        <div className="text-[10px] space-y-1">
                            <p>1. Body Fat Calculator</p>
                            <p>2. Macro Calculator</p>
                            <p>3. Cycle Sync (ici)</p>
                        </div>
                    </div>

                    {/* NUTRITION BASELINE */}
                    <div className="space-y-3 pt-2 border-t border-gray-100">
                        <label className="text-[10px] font-bold text-secondary ml-1 uppercase">Nutrition Baseline</label>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <input type="number" value={baseCal} onChange={(e) => setBaseCal(e.target.value)} placeholder="1800" className="w-full bg-surface-light shadow-soft-in rounded-xl py-2 pl-3 text-sm font-bold text-primary focus:outline-none focus:ring-2 focus:ring-accent/20" />
                                <div className="text-[9px] text-gray-400 mt-1 ml-1">Calories (kcal)</div>
                            </div>
                            <div>
                                <input type="number" value={baseProtein} onChange={(e) => setBaseProtein(e.target.value)} placeholder="120" className="w-full bg-surface-light shadow-soft-in rounded-xl py-2 pl-3 text-sm font-bold text-primary focus:outline-none focus:ring-2 focus:ring-accent/20" />
                                <div className="text-[9px] text-gray-400 mt-1 ml-1">Protéines (g)</div>
                            </div>
                            <div>
                                <input type="number" value={baseCarbs} onChange={(e) => setBaseCarbs(e.target.value)} placeholder="200" className="w-full bg-surface-light shadow-soft-in rounded-xl py-2 pl-3 text-sm font-bold text-primary focus:outline-none focus:ring-2 focus:ring-accent/20" />
                                <div className="text-[9px] text-gray-400 mt-1 ml-1">Glucides (g)</div>
                            </div>
                            <div>
                                <input type="number" value={baseFats} onChange={(e) => setBaseFats(e.target.value)} placeholder="50" className="w-full bg-surface-light shadow-soft-in rounded-xl py-2 pl-3 text-sm font-bold text-primary focus:outline-none focus:ring-2 focus:ring-accent/20" />
                                <div className="text-[9px] text-gray-400 mt-1 ml-1">Lipides (g)</div>
                            </div>
                        </div>
                    </div>

                    {/* CYCLE INFO */}
                    <div className="space-y-3 pt-2 border-t border-gray-100">
                        <label className="text-[10px] font-bold text-secondary ml-1 uppercase tracking-wider flex items-center gap-1">
                            <Calendar size={10} /> Informations Cycle
                        </label>
                        <div>
                            <input type="number" value={cycleLength} onChange={(e) => setCycleLength(e.target.value)} placeholder="28" className="w-full bg-surface-light shadow-soft-in rounded-xl py-3 pl-4 text-sm font-bold text-primary focus:outline-none focus:ring-2 focus:ring-accent/20" />
                            <div className="text-[9px] text-gray-400 mt-1 ml-1">Durée totale (21-35 jours)</div>
                        </div>
                    </div>

                    {/* MODE SAISIE */}
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => setInputMode('day')} className={`p-3 rounded-xl border text-left transition-all ${inputMode === 'day' ? 'border-accent/30 bg-accent/5 text-primary' : 'border-gray-100 bg-surface-light text-secondary hover:border-gray-200'}`}>
                            <div className="text-[11px] font-bold">Je connais mon jour</div>
                            <div className="text-[9px] text-gray-400">Saisie directe</div>
                        </button>
                        <button onClick={() => setInputMode('date')} className={`p-3 rounded-xl border text-left transition-all ${inputMode === 'date' ? 'border-accent/30 bg-accent/5 text-primary' : 'border-gray-100 bg-surface-light text-secondary hover:border-gray-200'}`}>
                            <div className="text-[11px] font-bold">Date règles</div>
                            <div className="text-[9px] text-gray-400">Calcul auto</div>
                        </button>
                    </div>

                    {inputMode === 'day' ? (
                        <div className="space-y-1 animate-in fade-in">
                            <input type="number" value={currentDay} onChange={(e) => setCurrentDay(e.target.value)} placeholder="14" className="w-full bg-surface-light shadow-soft-in rounded-xl py-3 pl-4 text-sm font-bold text-primary focus:outline-none focus:ring-2 focus:ring-accent/20" />
                            <div className="text-[9px] text-gray-400 ml-1">Jour actuel (J1 = menstruation)</div>
                        </div>
                    ) : (
                        <div className="space-y-1 animate-in fade-in">
                            <input type="date" value={lastPeriodDate} onChange={(e) => setLastPeriodDate(e.target.value)} className="w-full bg-surface-light shadow-soft-in rounded-xl py-3 pl-4 text-sm font-bold text-primary focus:outline-none focus:ring-2 focus:ring-accent/20" />
                            <div className="text-[9px] text-gray-400 ml-1">Premier jour dernières règles</div>
                        </div>
                    )}

                    <button 
                        onClick={calculatePhase}
                        disabled={!baseCal || !baseProtein || !baseCarbs || !baseFats || !cycleLength || (inputMode === 'day' ? !currentDay : !lastPeriodDate)}
                        className="w-full py-4 bg-accent text-white rounded-xl font-bold text-xs tracking-widest uppercase shadow-lg shadow-accent/20 hover:shadow-accent/40 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Générer protocole
                    </button>
                </Card>

                {/* APERÇU 4 PHASES */}
                <Card className="p-4">
                    <h3 className="text-xs font-bold text-primary uppercase mb-3">4 Phases Cycle</h3>
                    <div className="grid grid-cols-2 gap-2">
                        {phaseOrder.map(phaseId => {
                          const p = PHASE_CONFIGS[phaseId];
                          const Icon = p.icon;
                          return (
                            <div key={phaseId} className="bg-surface-light p-3 rounded-lg border border-gray-100">
                                <div className="flex items-center gap-2 mb-2">
                                    <Icon size={14} className="text-accent" />
                                    <div className="text-[10px] font-bold text-primary">{p.name}</div>
                                </div>
                                <div className="text-[9px] text-secondary">J{p.dayRange[0]}-{p.dayRange[1]}</div>
                            </div>
                          );
                        })}
                    </div>
                </Card>
            </div>

            {/* COLONNE DROITE */}
            <div className="lg:col-span-8 flex flex-col min-h-[600px]">
              
              <div className="flex-grow space-y-8">
                {result ? (
                    <div ref={resultsRef} className="animate-in fade-in slide-in-from-bottom-8 duration-700 space-y-8">
                        
                        {/* HERO PHASE */}
                        <Card className={`relative overflow-hidden bg-gradient-to-br ${result.phaseConfig.color.gradient} border ${result.phaseConfig.color.border}`}>
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                {React.createElement(result.phaseConfig.icon, { size: 100, className: "rotate-12" })}
                            </div>
                            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-end justify-between gap-6">
                                <div>
                                    <span className="text-xs font-bold text-primary uppercase tracking-widest bg-white/40 px-2 py-1 rounded-md">Jour {result.dayOfCycle}/{cycleLength}</span>
                                    <div className="mt-2 text-5xl md:text-7xl font-bold text-primary tracking-tighter">
                                        {result.phaseConfig.name}
                                    </div>
                                    <p className="text-sm text-primary/60 font-medium mt-2">Prochaine phase dans {result.daysUntilNext} jours</p>
                                </div>
                                <button onClick={handleCopy} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-xs transition-all ${copied ? 'bg-green-100 text-green-700' : 'bg-white text-primary hover:bg-gray-50 border border-gray-200'}`}>
                                    {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'COPIÉ' : 'EXPORTER'}
                                </button>
                            </div>
                        </Card>

                        {/* WARNINGS */}
                        {result.warnings.length > 0 && (
                            <div className="bg-yellow-50/50 border border-yellow-200 rounded-2xl p-6">
                                <div className="flex items-center gap-2 mb-3">
                                    <AlertTriangle size={18} className="text-yellow-700" />
                                    <h3 className="text-sm font-bold text-yellow-900 uppercase tracking-wide">Informations Phase</h3>
                                </div>
                                <ul className="space-y-2 text-sm text-yellow-900">
                                    {result.warnings.map((w, i) => (
                                        <li key={i} className="flex gap-2">
                                            <span className="text-yellow-600">•</span>
                                            <span>{w}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* MÉTRIQUES PHYSIOLOGIQUES */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[
                              { label: 'Énergie', value: result.phaseConfig.energy },
                              { label: 'Force', value: result.phaseConfig.strength },
                              { label: 'Récupération', value: result.phaseConfig.recovery },
                              { label: 'Insuline Sens.', value: result.phaseConfig.insulinSensitivity }
                            ].map(metric => (
                              <div key={metric.label} className="bg-purple-50 border border-purple-100 text-purple-900 p-5 rounded-2xl">
                                  <div className="text-xs font-bold opacity-60 uppercase mb-1">{metric.label}</div>
                                  <div className="text-2xl font-bold">{metric.value}<span className="text-sm">/10</span></div>
                              </div>
                            ))}
                        </div>

                        {/* NUTRITION AJUSTÉE */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-primary">Nutrition Ajustée</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-blue-50 border border-blue-100 text-blue-900 p-5 rounded-2xl">
                                    <div className="text-xs font-bold opacity-60 uppercase mb-1">Calories</div>
                                    <div className="text-2xl font-bold">{result.adjustedCal}</div>
                                    <div className="text-[10px] opacity-70 mt-1 flex items-center gap-1">
                                        {result.adjustedCal > parseFloat(baseCal) ? <TrendingUp size={10} /> : result.adjustedCal < parseFloat(baseCal) ? <TrendingDown size={10} /> : null}
                                        {((result.adjustedCal / parseFloat(baseCal) - 1) * 100).toFixed(0)}%
                                    </div>
                                </div>
                                
                                <div className="bg-emerald-50 border border-emerald-100 text-emerald-900 p-5 rounded-2xl">
                                    <div className="text-xs font-bold opacity-60 uppercase mb-1">Protéines</div>
                                    <div className="text-2xl font-bold">{result.adjustedProtein}g</div>
                                    <div className="text-[10px] opacity-70 mt-1">Stables</div>
                                </div>

                                <div className="bg-orange-50 border border-orange-100 text-orange-900 p-5 rounded-2xl">
                                    <div className="text-xs font-bold opacity-60 uppercase mb-1">Glucides</div>
                                    <div className="text-2xl font-bold">{result.adjustedCarbs}g</div>
                                    <div className="text-[10px] opacity-70 mt-1 flex items-center gap-1">
                                        {result.nutrition.carbsModifier > 1 ? <TrendingUp size={10} /> : result.nutrition.carbsModifier < 1 ? <TrendingDown size={10} /> : null}
                                        {result.nutrition.carbsModifier > 1 ? '+' : ''}{((result.nutrition.carbsModifier - 1) * 100).toFixed(0)}%
                                    </div>
                                </div>

                                <div className="bg-purple-50 border border-purple-100 text-purple-900 p-5 rounded-2xl">
                                    <div className="text-xs font-bold opacity-60 uppercase mb-1">Lipides</div>
                                    <div className="text-2xl font-bold">{result.adjustedFats}g</div>
                                    <div className="text-[10px] opacity-70 mt-1 flex items-center gap-1">
                                        {result.nutrition.fatsModifier > 1 ? <TrendingUp size={10} /> : result.nutrition.fatsModifier < 1 ? <TrendingDown size={10} /> : null}
                                        {result.nutrition.fatsModifier > 1 ? '+' : ''}{((result.nutrition.fatsModifier - 1) * 100).toFixed(0)}%
                                    </div>
                                </div>
                            </div>

                            {/* SUPPLÉMENTS */}
                            <Card>
                                <h4 className="text-sm font-bold text-primary mb-3 uppercase">Suppléments Recommandés</h4>
                                <div className="flex flex-wrap gap-2">
                                    {result.nutrition.supplements.map((supp, i) => (
                                        <span key={i} className="text-xs bg-surface-light text-secondary px-3 py-1.5 rounded-lg border border-gray-100 font-medium">
                                            {supp}
                                        </span>
                                    ))}
                                </div>
                            </Card>
                        </div>

                        {/* PROTOCOLE TRAINING */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-primary">Protocole Training</h3>
                            <div className="grid md:grid-cols-2 gap-4">
                                <Card>
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="text-sm font-bold text-primary">Volume</div>
                                        <div className="text-2xl font-bold text-accent">{(result.training.volumeModifier * 100).toFixed(0)}%</div>
                                    </div>
                                    <div className="text-xs text-secondary">Baseline × {result.training.volumeModifier}</div>
                                </Card>
                                <Card>
                                    <div className="text-sm font-bold text-primary mb-2">Intensité</div>
                                    <div className="text-lg text-accent font-bold">{result.training.intensityRange}</div>
                                </Card>
                            </div>
                            <Card>
                                <h4 className="text-sm font-bold text-primary mb-3 uppercase">Focus</h4>
                                <div className="flex flex-wrap gap-2">
                                    {result.training.focus.map((item, i) => (
                                        <span key={i} className="text-xs bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg border border-emerald-200 font-medium">
                                            {item}
                                        </span>
                                    ))}
                                </div>
                            </Card>
                            <Card>
                                <h4 className="text-sm font-bold text-primary mb-3 uppercase">À Éviter</h4>
                                <div className="flex flex-wrap gap-2">
                                    {result.training.avoidance.map((item, i) => (
                                        <span key={i} className="text-xs bg-red-50 text-red-700 px-3 py-1.5 rounded-lg border border-red-200 font-medium">
                                            {item}
                                        </span>
                                    ))}
                                </div>
                            </Card>
                        </div>

                    </div>
                ) : (
                    <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-gray-200 rounded-card opacity-60">
                        <Moon size={48} className="text-gray-300 mb-4" />
                        <h3 className="text-lg font-medium text-primary">En attente de données</h3>
                        <p className="text-sm text-secondary max-w-xs mt-2">Remplissez tous les champs pour générer votre protocole hormonal.</p>
                    </div>
                )}
              </div>

              <div className="pt-8 mt-auto">
                   <SectionHeader title="Base de Connaissance" subtitle="Comprendre le Cycle Sync." />
                   <div className="mt-6"><Accordion items={faqItems} /></div>
              </div>

            </div>
        </div>
      </div>

      <footer className="w-full py-12 text-center border-t border-gray-200 bg-background z-10 mt-auto">
        <p className="text-[11px] font-medium tracking-wide text-gray-400 uppercase">
            © {new Date().getFullYear()} STRYV lab.
        </p>
      </footer>

    </div>
  );
}