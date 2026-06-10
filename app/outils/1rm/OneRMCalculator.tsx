'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import {
  Dumbbell,
  ArrowLeft,
  Copy,
  Check,
  Settings2,
  Info,
  Activity,
  Scale,
  Calculator
} from 'lucide-react';

// UI Components
import { Card } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Accordion } from '@/components/ui/Accordion';
// Formulas & Store
import { calculateOneRM, TRAINING_ZONES, type OneRMFormula, type OneRMResult } from '@/lib/formulas';
import { useClientStore } from '@/lib/stores/useClientStore';

type Unit = 'kg' | 'lbs';

const ZONE_COLORS = [
  { bg: 'bg-red-50',     text: 'text-red-900',     border: 'border-red-100'     },
  { bg: 'bg-orange-50',  text: 'text-orange-900',  border: 'border-orange-100'  },
  { bg: 'bg-yellow-50',  text: 'text-yellow-900',  border: 'border-yellow-100'  },
  { bg: 'bg-emerald-50', text: 'text-emerald-900', border: 'border-emerald-100' },
  { bg: 'bg-blue-50',    text: 'text-blue-900',    border: 'border-blue-100'    },
  { bg: 'bg-slate-50',   text: 'text-slate-900',   border: 'border-slate-100'   },
];

export default function OneRMCalculator() {
  const setOneRMResult = useClientStore((s) => s.setOneRMResult);

  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [formula, setFormula] = useState<OneRMFormula>('average');
  const [unit, setUnit] = useState<Unit>('kg');
  const [showSettings, setShowSettings] = useState(false);
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<OneRMResult | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const calculateRM = () => {
    setCopied(false);
    const w = parseFloat(weight);
    const r = parseFloat(reps);
    if (!w || !r) return;

    const res = calculateOneRM({ weight: w, reps: r }, formula);
    setResult(res);
    setOneRMResult(res);

    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const displayWeight = (w: number): string => {
    const converted = unit === 'lbs' ? w * 2.20462 : w;
    return unit === 'kg' ? `${Math.round(converted * 2) / 2}` : `${Math.round(converted)}`;
  };

  const trainingZones = result
    ? TRAINING_ZONES(result.oneRM).map((z, i) => ({ ...z, ...ZONE_COLORS[i] }))
    : [];

  const faqItems = [
    { title: "Qu'est-ce que le 1RM ?", content: "Le 1RM (One Repetition Maximum) est la charge maximale que vous pouvez soulever pour une seule répétition avec une technique correcte." },
    { title: "Pourquoi 3 formules ?", content: "Brzycki est linéaire (conservateur), Epley arithmétique (charges lourdes) et Lombardi logarithmique. La 'Moyenne' lisse les biais individuels." },
    { title: "Précision des zones", content: "Les zones sont des estimations théoriques basées sur la moyenne de la population. Ajustez de ±2.5kg selon votre forme du jour." },
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
                    <span className="text-[10px] font-bold tracking-widest text-accent uppercase mb-2 block">Strength Analysis</span>
                    <h1 className="text-3xl md:text-4xl font-bold text-primary tracking-tight">Calculateur 1RM</h1>
                </div>
                <div className="hidden md:block">
                    <span className="px-3 py-1 bg-surface-light border border-white/50 rounded-lg text-[10px] font-mono text-secondary">CODE: STR_01</span>
                </div>
            </div>
        </header>

        <div className="max-w-5xl mx-auto grid lg:grid-cols-12 gap-8">

            {/* COLONNE GAUCHE */}
            <div className="lg:col-span-4 space-y-6">
                <Card className="space-y-6">
                    <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                        <div className="p-2 bg-surface-light rounded-lg text-accent"><Activity size={20} /></div>
                        <h2 className="text-sm font-bold text-primary uppercase tracking-wide">Données Entrée</h2>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-secondary ml-1 uppercase tracking-wider flex items-center gap-1">
                            <Scale size={10} /> Unité
                        </label>
                        <div className="grid grid-cols-2 p-1 bg-surface-light/50 border border-gray-100 rounded-xl">
                            {(['kg', 'lbs'] as Unit[]).map(u => (
                                <button
                                    key={u}
                                    onClick={() => setUnit(u)}
                                    className={`py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-all duration-300 ${
                                        unit === u
                                        ? 'bg-white text-accent shadow-sm ring-1 ring-black/5'
                                        : 'text-secondary hover:text-primary hover:bg-white/50'
                                    }`}
                                >
                                    {u.toUpperCase()}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-4 pt-2">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-secondary ml-1">CHARGE ({unit.toUpperCase()})</label>
                            <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="Ex: 80" className="w-full bg-surface-light shadow-soft-in rounded-xl py-3 pl-4 text-sm font-bold text-primary focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all placeholder:text-gray-300" />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-secondary ml-1">RÉPÉTITIONS</label>
                            <input type="number" value={reps} onChange={(e) => setReps(e.target.value)} placeholder="Ex: 6" className="w-full bg-surface-light shadow-soft-in rounded-xl py-3 pl-4 text-sm font-bold text-primary focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all placeholder:text-gray-300" />
                        </div>
                    </div>

                    <div className="pt-2">
                         <button
                            onClick={() => setShowSettings(!showSettings)}
                            className="flex items-center gap-2 text-[10px] font-bold text-secondary hover:text-primary uppercase tracking-wide transition-colors"
                        >
                            <Settings2 size={12} />
                            {showSettings ? 'Masquer paramètres' : 'Paramètres avancés'}
                        </button>

                        {showSettings && (
                            <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-300 space-y-2">
                                <label className="text-[10px] font-bold text-secondary ml-1 uppercase tracking-wider flex items-center gap-1">
                                    <Calculator size={10} /> Algorithme
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {(['average', 'brzycki', 'epley', 'lombardi'] as OneRMFormula[]).map(f => (
                                        <button
                                            key={f}
                                            onClick={() => setFormula(f)}
                                            className={`py-2 px-2 rounded-lg text-[10px] font-bold uppercase border transition-all ${
                                                formula === f
                                                ? 'bg-white border-accent/20 text-accent shadow-sm'
                                                : 'border-transparent text-secondary bg-surface-light/50 hover:bg-white'
                                            }`}
                                        >
                                            {f}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={calculateRM}
                        disabled={!weight || !reps}
                        className="w-full py-4 bg-accent text-white rounded-xl font-bold text-xs tracking-widest uppercase shadow-lg shadow-accent/20 hover:shadow-accent/40 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        CALCULER
                    </button>
                </Card>

                <div className="bg-surface p-4 rounded-xl border border-white/60 shadow-soft-out">
                    <div className="flex gap-3">
                        <Info className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                        <p className="text-xs text-secondary leading-relaxed">
                            Précision maximale avec une charge levée entre <strong className="text-primary">3 et 8 fois</strong>.
                        </p>
                    </div>
                </div>
            </div>

            {/* COLONNE DROITE */}
            <div className="lg:col-span-8 flex flex-col min-h-[600px]">

                <div className="flex-grow space-y-8">
                    {result ? (
                        <div ref={resultsRef} className="animate-in fade-in slide-in-from-bottom-8 duration-700 space-y-8">
                            <Card className="relative overflow-hidden border-accent/10">
                                <div className="absolute top-0 right-0 p-4 opacity-10">
                                    <Dumbbell size={100} className="rotate-12" />
                                </div>
                                <div className="relative z-10 flex flex-col md:flex-row items-center md:items-end justify-between gap-6 text-center md:text-left">
                                    <div>
                                        <span className="text-xs font-bold text-accent uppercase tracking-widest bg-accent/5 px-2 py-1 rounded-md border border-accent/10">Estimation Validée</span>
                                        <div className="mt-2 text-6xl md:text-8xl font-bold text-primary tracking-tighter">
                                            {displayWeight(result.oneRM)}<span className="text-3xl md:text-4xl text-secondary ml-2 font-medium">{unit}</span>
                                        </div>
                                        <p className="text-sm text-secondary font-medium mt-1">One Repetition Max (Théorique)</p>
                                    </div>
                                    <button onClick={() => {
                                        const url = 'https://www.stryvlab.com/outils/1rm';
                                        navigator.clipboard.writeText(`Bilan Force 1RM : ${displayWeight(result.oneRM)} ${unit} (${formula}) - ${url}`);
                                        setCopied(true);
                                        setTimeout(() => setCopied(false), 2000);
                                    }} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-xs transition-all ${copied ? 'bg-green-100 text-green-700' : 'bg-surface-light text-secondary hover:text-primary hover:bg-white border border-gray-100'}`}>
                                        {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'COPIÉ' : 'EXPORTER'}
                                    </button>
                                </div>
                                {result.warnings.length > 0 && (
                                    <div className="mt-6 p-3 bg-yellow-50/50 border border-yellow-100 rounded-lg">
                                        {result.warnings.map((w, i) => (
                                            <p key={i} className="text-[11px] text-yellow-700 font-medium flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-yellow-500"></span>{w}</p>
                                        ))}
                                    </div>
                                )}
                            </Card>

                            <div>
                                <SectionHeader title="Profil de Charge" subtitle="Programmation neuro-musculaire basée sur votre 1RM." />
                                <div className="grid md:grid-cols-2 gap-4 mt-6">
                                    {trainingZones.map((zone) => (
                                        <div key={zone.num} className={`p-5 rounded-2xl border ${zone.border} ${zone.bg} transition-transform hover:-translate-y-1 duration-300`}>
                                            <div className="flex justify-between items-start mb-2">
                                                <span className={`text-[10px] font-black uppercase tracking-widest ${zone.text} opacity-60`}>Zone 0{zone.num}</span>
                                                <span className={`text-xl font-bold ${zone.text}`}>{displayWeight(zone.weight)}{unit}</span>
                                            </div>
                                            <h3 className={`text-base font-bold ${zone.text} mb-1`}>{zone.objective}</h3>
                                            <p className={`text-[11px] ${zone.text} opacity-80 mb-3`}>{zone.desc}</p>
                                            <div className={`inline-flex items-center px-2 py-1 bg-white/50 rounded-md border ${zone.border}`}><span className={`text-[10px] font-bold ${zone.text}`}>{zone.reps} • {zone.intensity}</span></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-gray-200 rounded-card opacity-60">
                            <Dumbbell size={48} className="text-gray-300 mb-4" />
                            <h3 className="text-lg font-medium text-primary">En attente de données</h3>
                            <p className="text-sm text-secondary max-w-xs mt-2">Entrez vos performances à gauche.</p>
                        </div>
                    )}
                </div>

                <div className="pt-8 mt-auto">
                     <SectionHeader title="Base de Connaissance" subtitle="Comprendre la mécanique du 1RM." />
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
