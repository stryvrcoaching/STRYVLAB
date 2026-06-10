'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { 
  RefreshCw, 
  ArrowLeft, 
  Copy, 
  Check, 
  Activity,
  Scale,
  Zap,
  Calendar,
  Utensils,
  ChevronDown,
  Dumbbell,
  Target,
  AlertTriangle
} from 'lucide-react';

// UI Components
import { Card } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Accordion } from '@/components/ui/Accordion';
// Formulas & Store
import {
  calculateCarbCycling,
  type CarbCyclingResult,
  type CarbCycleProtocol,
  type CarbCycleGoal,
  type CarbCycleSex,
  type CarbCycleOccupation,
  type CarbCycleIntensity,
  type CarbCyclePhase,
  type CarbCycleInsulin,
} from '@/lib/formulas';
import { useClientStore } from '@/lib/stores/useClientStore';

// --- Local type aliases for UI selects ---
type Protocol = CarbCycleProtocol;
type Goal = CarbCycleGoal;
type Sex = CarbCycleSex;
type ActivityLevel = CarbCycleOccupation;
type Intensity = CarbCycleIntensity;
type Phase = CarbCyclePhase;
type Insulin = CarbCycleInsulin;

export default function CarbCyclingCalculator() {
  const setProfile = useClientStore((s) => s.setProfile);

  // --- STATES ---
  const [gender, setGender] = useState<Sex>('male');
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');

  // Body Composition
  const [bodyFat, setBodyFat] = useState('');
  const [waist, setWaist] = useState('');
  const [neck, setNeck] = useState('');
  const [hips, setHips] = useState('');

  // Activity & Training
  const [occupation, setOccupation] = useState<ActivityLevel>('sedentaire');
  const [sessionsPerWeek, setSessionsPerWeek] = useState('');
  const [sessionDuration, setSessionDuration] = useState('');
  const [intensity, setIntensity] = useState<Intensity>('moderee');

  // Strategy
  const [goal, setGoal] = useState<Goal>('moderate');
  const [phase, setPhase] = useState<Phase>('hypertrophie');
  const [protocol, setProtocol] = useState<Protocol>('3/1');
  const [insulin, setInsulin] = useState<Insulin>('normale');

  const [copied, setCopied] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  const [result, setResult] = useState<CarbCyclingResult | null>(null);

  // ========================================================================
  // 🔬 CALCULATION — delegates to lib/formulas/carbCycling.ts (pure function)
  // ========================================================================
  const calculateCycle = () => {
    setCopied(false);
    const w = parseFloat(weight);
    const h = parseFloat(height);
    const a = parseFloat(age);
    if (!w || !h || !a) return;

    const sessions = parseFloat(sessionsPerWeek) || 0;
    const duration = parseFloat(sessionDuration) || 0;

    const res = calculateCarbCycling({
      gender, age: a, weight: w, height: h,
      bodyFat: bodyFat ? parseFloat(bodyFat) : undefined,
      waist: waist ? parseFloat(waist) : undefined,
      neck: neck ? parseFloat(neck) : undefined,
      hips: hips ? parseFloat(hips) : undefined,
      occupation, sessionsPerWeek: sessions, sessionDuration: duration,
      intensity, goal, phase, protocol, insulin,
    });

    setResult(res);
    setProfile({ weight: w, height: h, age: a, gender, bodyFat: bodyFat ? parseFloat(bodyFat) : null, workouts: sessions });

    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const getGoalLabel = (g: Goal) => {
    const labels: Record<Goal, string> = { 
      aggressive: 'Fat loss agressif', 
      moderate: 'Fat loss modéré', 
      recomp: 'Recomposition', 
      performance: 'Performance', 
      bulk: 'Prise de masse' 
    };
    return labels[g];
  };

  const handleCopy = () => {
    if (!result) return;
    const url = 'https://www.stryvlab.com/outils/carb-cycling';
    const textToCopy = `Bilan Carb Cycling : ${getGoalLabel(goal)} (${protocol}) - Moyenne ${result.weeklyAvg}kcal/jour - ${url}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const faqItems = [
    { title: "Qu'est-ce que le carb cycling ?", content: "Une stratégie nutritionnelle validée scientifiquement qui alterne entre jours à glucides élevés (jours d'entraînement) et jours bas (repos) pour optimiser la perte de graisse tout en préservant la masse musculaire et la performance." },
    { title: "Comment choisir mon protocole ?", content: "3/1 (3 bas, 1 haut) est le standard le plus équilibré. Si vous avez >20% BF à perdre, optez pour 4/1 ou 5/2. Si vous êtes déjà <12% BF (homme) ou <22% (femme), le 2/1 peut maximiser la performance." },
    { title: "Quand placer les jours hauts ?", content: "CRITIQUE: Synchronisez impérativement vos jours hauts en glucides avec vos séances les plus intenses et/ou les groupes musculaires les plus volumineux (Jambes, Dos) pour maximiser la resynthèse du glycogène musculaire. Ne gaspillez pas un jour haut sur une séance bras ou un jour de repos." }
  ];

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
                    <span className="text-[10px] font-bold tracking-widest text-accent uppercase mb-2 block">Nutrition Precision</span>
                    <h1 className="text-3xl md:text-4xl font-bold text-primary tracking-tight">Carb Cycling Calculator</h1>
                </div>
                <div className="hidden md:block">
                    <span className="px-3 py-1 bg-surface-light border border-white/50 rounded-lg text-[10px] font-mono text-secondary">CODE: NUTR_01</span>
                </div>
            </div>
        </header>

        <div className="max-w-5xl mx-auto grid lg:grid-cols-12 gap-8">
            
            {/* --- COLONNE GAUCHE (INPUTS) --- */}
            <div className="lg:col-span-4 space-y-6">
                <Card className="space-y-6">
                    <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                        <div className="p-2 bg-surface-light rounded-lg text-accent"><Scale size={20} /></div>
                        <h2 className="text-sm font-bold text-primary uppercase tracking-wide">Configuration</h2>
                    </div>

                    {/* 1. SEXE */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-secondary ml-1 uppercase tracking-wider">Sexe</label>
                        <div className="grid grid-cols-2 p-1 bg-surface-light/50 border border-gray-100 rounded-xl">
                            {(['male', 'female'] as Sex[]).map(s => (
                                <button 
                                    key={s} 
                                    onClick={() => setGender(s)}
                                    className={`py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-all ${gender === s ? 'bg-white text-accent shadow-sm ring-1 ring-black/5' : 'text-secondary hover:text-primary'}`}
                                >
                                    {s === 'male' ? 'Homme' : 'Femme'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 2. BIOMÉTRIE */}
                    <div className="grid grid-cols-2 gap-3 pt-2">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-secondary ml-1">POIDS (kg)</label>
                            <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} className="w-full bg-surface-light shadow-soft-in rounded-xl py-3 pl-4 text-sm font-bold text-primary focus:outline-none focus:ring-2 focus:ring-accent/20" placeholder="75" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-secondary ml-1">TAILLE (cm)</label>
                            <input type="number" value={height} onChange={(e) => setHeight(e.target.value)} className="w-full bg-surface-light shadow-soft-in rounded-xl py-3 pl-4 text-sm font-bold text-primary focus:outline-none focus:ring-2 focus:ring-accent/20" placeholder="180" />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-secondary ml-1">ÂGE</label>
                        <input type="number" value={age} onChange={(e) => setAge(e.target.value)} className="w-full bg-surface-light shadow-soft-in rounded-xl py-3 pl-4 text-sm font-bold text-primary focus:outline-none focus:ring-2 focus:ring-accent/20" placeholder="30" />
                    </div>

                    {/* 3. ACTIVITÉ */}
                    <div className="space-y-2 pt-2 border-t border-gray-100">
                        <label className="text-[10px] font-bold text-secondary ml-1 uppercase tracking-wider flex items-center gap-1">
                            <Activity size={10} /> Activité Quotidienne
                        </label>
                        <div className="grid grid-cols-3 p-1 bg-surface-light/50 border border-gray-100 rounded-xl">
                            {[
                                { id: 'sedentaire', label: 'Bureau' },
                                { id: 'debout', label: 'Actif' },
                                { id: 'physique', label: 'Sportif' }
                            ].map(a => (
                                <button 
                                    key={a.id} 
                                    onClick={() => setOccupation(a.id as ActivityLevel)}
                                    className={`py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all ${occupation === a.id ? 'bg-white text-accent shadow-sm ring-1 ring-black/5' : 'text-secondary hover:text-primary'}`}
                                >
                                    {a.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 4. ENTRAINEMENT */}
                    <div className="space-y-3 pt-2 border-t border-gray-100">
                        <label className="text-[10px] font-bold text-secondary ml-1 uppercase tracking-wider flex items-center gap-1">
                            <Dumbbell size={10} /> Entraînement
                        </label>
                        
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[9px] font-bold text-gray-400 ml-1">SÉANCES / SEM</label>
                                <input type="number" value={sessionsPerWeek} onChange={(e) => setSessionsPerWeek(e.target.value)} className="w-full bg-surface-light shadow-soft-in rounded-xl py-3 pl-4 text-sm font-bold text-primary focus:outline-none focus:ring-2 focus:ring-accent/20 border border-gray-100" placeholder="4" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-bold text-gray-400 ml-1">DURÉE (MIN)</label>
                                <input type="number" value={sessionDuration} onChange={(e) => setSessionDuration(e.target.value)} className="w-full bg-surface-light shadow-soft-in rounded-xl py-3 pl-4 text-sm font-bold text-primary focus:outline-none focus:ring-2 focus:ring-accent/20 border border-gray-100" placeholder="60" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[9px] font-bold text-gray-400 ml-1">INTENSITÉ</label>
                                <div className="relative">
                                    <select value={intensity} onChange={(e) => setIntensity(e.target.value as Intensity)} className="w-full bg-surface-light shadow-soft-in rounded-xl py-3 pl-3 text-xs font-bold text-primary focus:outline-none focus:ring-2 focus:ring-accent/20 appearance-none border border-gray-100 cursor-pointer">
                                        <option value="legere">Légère</option>
                                        <option value="moderee">Modérée</option>
                                        <option value="intense">Intense</option>
                                        <option value="tres_intense">Maximale</option>
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-bold text-gray-400 ml-1">PHASE</label>
                                <div className="relative">
                                    <select value={phase} onChange={(e) => setPhase(e.target.value as Phase)} className="w-full bg-surface-light shadow-soft-in rounded-xl py-3 pl-3 text-xs font-bold text-primary focus:outline-none focus:ring-2 focus:ring-accent/20 appearance-none border border-gray-100 cursor-pointer">
                                        <option value="hypertrophie">Hypertrophie</option>
                                        <option value="force">Force</option>
                                        <option value="endurance">Endurance</option>
                                        <option value="cut">Sèche</option>
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 5. STRATÉGIE */}
                    <div className="space-y-3 pt-2 border-t border-gray-100">
                        <label className="text-[10px] font-bold text-secondary ml-1 uppercase tracking-wider flex items-center gap-1">
                            <Target size={10} /> Stratégie
                        </label>
                        
                        <div className="space-y-1">
                            <label className="text-[9px] font-bold text-gray-400 ml-1">OBJECTIF</label>
                            <div className="relative">
                                <select value={goal} onChange={(e) => setGoal(e.target.value as Goal)} className="w-full bg-surface-light shadow-soft-in rounded-xl py-3 pl-3 text-sm font-bold text-primary focus:outline-none focus:ring-2 focus:ring-accent/20 appearance-none border border-gray-100 cursor-pointer">
                                    <option value="aggressive">Perte Agressive (-20%)</option>
                                    <option value="moderate">Perte Modérée (-15%)</option>
                                    <option value="recomp">Recomposition</option>
                                    <option value="performance">Performance</option>
                                    <option value="bulk">Prise de Masse</option>
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[9px] font-bold text-gray-400 ml-1">SENSIBILITÉ INSULINE</label>
                            <div className="relative">
                                <select value={insulin} onChange={(e) => setInsulin(e.target.value as Insulin)} className="w-full bg-surface-light shadow-soft-in rounded-xl py-3 pl-3 text-sm font-bold text-primary focus:outline-none focus:ring-2 focus:ring-accent/20 appearance-none border border-gray-100 cursor-pointer">
                                    <option value="normale">Normale</option>
                                    <option value="elevee">Élevée (Ectomorphe)</option>
                                    <option value="reduite">Réduite (Résistant)</option>
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                            </div>
                        </div>
                    </div>

                    {/* 6. BODY FAT */}
                    <div className="space-y-3 pt-2 border-t border-gray-100">
                        <label className="text-[10px] font-bold text-secondary ml-1 uppercase tracking-wider flex items-center gap-1">
                            <Scale size={10} /> Composition (Optionnel)
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <input type="number" value={bodyFat} onChange={(e) => setBodyFat(e.target.value)} className="w-full bg-surface-light shadow-soft-in rounded-xl py-3 pl-3 text-xs font-bold text-primary border border-gray-100 placeholder:text-gray-300" placeholder="% BF" />
                            <input type="number" value={waist} onChange={(e) => setWaist(e.target.value)} className="w-full bg-surface-light shadow-soft-in rounded-xl py-3 pl-3 text-xs font-bold text-primary border border-gray-100 placeholder:text-gray-300" placeholder="Taille (cm)" />
                        </div>
                    </div>

                    {/* 7. PROTOCOLE */}
                    <div className="space-y-2 pt-2 border-t border-gray-100">
                        <label className="text-[10px] font-bold text-secondary ml-1 uppercase tracking-wider flex items-center gap-1">
                            <Calendar size={10} /> Protocole
                        </label>
                        <div className="grid grid-cols-4 p-1 bg-surface-light/50 border border-gray-100 rounded-xl">
                            {(['2/1', '3/1', '4/1', '5/2'] as Protocol[]).map(p => (
                                <button 
                                    key={p} 
                                    onClick={() => setProtocol(p)}
                                    className={`py-2 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all ${protocol === p ? 'bg-white text-accent shadow-sm ring-1 ring-black/5' : 'text-secondary hover:text-primary'}`}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button 
                        onClick={calculateCycle}
                        disabled={!weight || !height || !age || !sessionsPerWeek || !sessionDuration}
                        className="w-full py-4 bg-accent text-white rounded-xl font-bold text-xs tracking-widest uppercase shadow-lg shadow-accent/20 hover:shadow-accent/40 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                    >
                        Calculer le protocole
                    </button>
                </Card>
            </div>

            {/* COLONNE DROITE */}
            <div className="lg:col-span-8 flex flex-col min-h-[600px]">
                
                <div className="flex-grow space-y-8">
                    {result ? (
                        <div ref={resultsRef} className="animate-in fade-in slide-in-from-bottom-8 duration-700 space-y-8">
                            
                            {/* HERO */}
                            <Card className="relative overflow-hidden border-accent/10">
                                <div className="absolute top-0 right-0 p-4 opacity-10">
                                    <RefreshCw size={100} className="rotate-12" />
                                </div>
                                <div className="relative z-10 flex flex-col md:flex-row items-center md:items-end justify-between gap-6 text-center md:text-left">
                                    <div>
                                        <span className="text-xs font-bold text-accent uppercase tracking-widest bg-accent/5 px-2 py-1 rounded-md border border-accent/10">Protocole Généré</span>
                                        <div className="mt-2 text-6xl md:text-8xl font-bold text-primary tracking-tighter">
                                            {result.tdee}<span className="text-3xl md:text-4xl text-secondary ml-2 font-medium">kcal</span>
                                        </div>
                                        <p className="text-sm text-secondary font-medium mt-1">TDEE (PAL: {result.pal})</p>
                                    </div>
                                    <button onClick={handleCopy} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-xs transition-all ${copied ? 'bg-green-100 text-green-700' : 'bg-surface-light text-secondary hover:text-primary hover:bg-white border border-gray-100'}`}>
                                        {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'COPIÉ' : 'EXPORTER'}
                                    </button>
                                </div>
                            </Card>

                            {/* MÉTRIQUES */}
                            <div className="grid md:grid-cols-3 gap-4">
                                <div className="bg-blue-50 border border-blue-100 text-blue-900 p-5 rounded-2xl">
                                    <div className="text-xs font-bold opacity-60 uppercase mb-1">Body Fat</div>
                                    <div className="text-2xl font-bold">{result.bf}%</div>
                                    <div className="text-[10px] opacity-70 mt-1">LBM: {result.lbm}kg</div>
                                </div>
                                
                                <div className="bg-emerald-50 border border-emerald-100 text-emerald-900 p-5 rounded-2xl">
                                    <div className="text-xs font-bold opacity-60 uppercase mb-1">Moyenne Hebdo</div>
                                    <div className="text-2xl font-bold">{result.weeklyAvg} kcal</div>
                                    <div className="text-[10px] opacity-70 mt-1">
                                      {result.deficit > 0 ? 'Déficit' : result.deficit < 0 ? 'Surplus' : 'Maintenance'}: {Math.abs(result.deficit)}kcal/j
                                    </div>
                                </div>

                                <div className="bg-orange-50 border border-orange-100 text-orange-900 p-5 rounded-2xl">
                                    <div className="text-xs font-bold opacity-60 uppercase mb-1">Protocole</div>
                                    <div className="text-2xl font-bold">{protocol}</div>
                                    <div className="text-[10px] opacity-70 mt-1">{result.days.low}J bas, {result.days.high}J haut</div>
                                </div>
                            </div>

                            {/* WARNINGS */}
                            {result.warnings.length > 0 && (
                                <div className="bg-yellow-50/50 border border-yellow-200 rounded-2xl p-6">
                                    <div className="flex items-center gap-2 mb-3">
                                        <AlertTriangle size={18} className="text-yellow-700" />
                                        <h3 className="text-sm font-bold text-yellow-900 uppercase tracking-wide">Alertes Qualité</h3>
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

                            {/* GRID JOURS */}
                            <div className="grid md:grid-cols-2 gap-6">
                                
                                {/* JOUR HAUT */}
                                <div className="relative p-6 rounded-2xl border border-orange-100 bg-orange-50/50 shadow-sm">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-orange-900/60 block mb-1">Training Days</span>
                                            <h3 className="text-xl font-bold text-orange-900">Jour Haut</h3>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-2xl font-bold text-orange-900">{result.high.kcal}</div>
                                            <div className="text-[10px] font-bold text-orange-900/50">KCAL</div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="bg-white p-2 rounded-lg text-center shadow-sm">
                                            <div className="text-[10px] font-bold text-secondary">PROT</div>
                                            <div className="text-sm font-bold text-primary">{result.high.p}g</div>
                                        </div>
                                        <div className="bg-white p-2 rounded-lg text-center shadow-sm border border-orange-200">
                                            <div className="text-[10px] font-bold text-orange-600">GLU</div>
                                            <div className="text-sm font-bold text-orange-900">{result.high.c}g</div>
                                        </div>
                                        <div className="bg-white p-2 rounded-lg text-center shadow-sm">
                                            <div className="text-[10px] font-bold text-secondary">LIP</div>
                                            <div className="text-sm font-bold text-primary">{result.high.f}g</div>
                                        </div>
                                    </div>
                                    <div className="mt-4 flex items-center gap-2 text-[10px] font-medium text-orange-800 bg-orange-100/50 px-3 py-1.5 rounded-lg">
                                        <Zap size={12} />
                                        <span>Jambes/Dos + Séances intenses</span>
                                    </div>
                                </div>

                                {/* JOUR BAS */}
                                <div className="relative p-6 rounded-2xl border border-blue-100 bg-blue-50/50 shadow-sm">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-blue-900/60 block mb-1">Rest Days</span>
                                            <h3 className="text-xl font-bold text-blue-900">Jour Bas</h3>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-2xl font-bold text-blue-900">{result.low.kcal}</div>
                                            <div className="text-[10px] font-bold text-blue-900/50">KCAL</div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="bg-white p-2 rounded-lg text-center shadow-sm">
                                            <div className="text-[10px] font-bold text-secondary">PROT</div>
                                            <div className="text-sm font-bold text-primary">{result.low.p}g</div>
                                        </div>
                                        <div className="bg-white p-2 rounded-lg text-center shadow-sm">
                                            <div className="text-[10px] font-bold text-secondary">GLU</div>
                                            <div className="text-sm font-bold text-primary">{result.low.c}g</div>
                                        </div>
                                        <div className="bg-white p-2 rounded-lg text-center shadow-sm border border-blue-200">
                                            <div className="text-[10px] font-bold text-blue-600">LIP</div>
                                            <div className="text-sm font-bold text-blue-900">{result.low.f}g</div>
                                        </div>
                                    </div>
                                    <div className="mt-4 flex items-center gap-2 text-[10px] font-medium text-blue-800 bg-blue-100/50 px-3 py-1.5 rounded-lg">
                                        <Utensils size={12} />
                                        <span>Repos + Sources fibreuses</span>
                                    </div>
                                </div>

                            </div>

                        </div>
                    ) : (
                        <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-gray-200 rounded-card opacity-60">
                            <RefreshCw size={48} className="text-gray-300 mb-4" />
                            <h3 className="text-lg font-medium text-primary">En attente de données</h3>
                            <p className="text-sm text-secondary max-w-xs mt-2">Remplissez le formulaire complet pour générer votre protocole scientifiquement validé.</p>
                        </div>
                    )}
                </div>

                <div className="pt-8 mt-auto">
                     <SectionHeader title="Base de Connaissance" subtitle="Comprendre la stratégie cyclique." />
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