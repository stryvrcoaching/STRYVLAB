'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import {
  Droplet,
  ArrowLeft,
  Copy,
  Check,
  User,
  Activity,
  Sun,
  AlertTriangle
} from 'lucide-react';

// UI Components
import { Card } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Accordion } from '@/components/ui/Accordion';
// Formulas & Store
import {
  calculateHydration, type HydrationGender, type HydrationActivity,
  type HydrationClimate, type HydrationResult,
} from '@/lib/formulas';
import { useClientStore } from '@/lib/stores/useClientStore';

export default function HydrationCalculator() {
  const setProfile = useClientStore((s) => s.setProfile);

  const [weight, setWeight] = useState('');
  const [gender, setGender] = useState<HydrationGender>('male');
  const [activity, setActivity] = useState<HydrationActivity>('moderate');
  const [climate, setClimate] = useState<HydrationClimate>('temperate');
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<HydrationResult | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const calculateIntake = () => {
    setCopied(false);
    const w = parseFloat(weight);
    if (!w) return;

    const res = calculateHydration({ weight: w, gender, activity, climate });
    setResult(res);
    setProfile({ weight: w, gender, activityLevel: activity, climate });

    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const faqItems = [
    {
      title: "Quelle est la base scientifique des 35ml/kg ?",
      content: "La recommandation 35ml/kg provient de l'European Food Safety Authority (EFSA, 2010) et reflète les besoins physiologiques réels selon la masse corporelle. La règle populaire '8 verres/2L par jour' n'a aucune validation scientifique. L'approche poids corporel (ml/kg) s'ajuste automatiquement selon la taille de l'individu."
    },
    {
      title: "Pourquoi différencier homme/femme ?",
      content: "Différences physiologiques validées (EFSA 2010). Hommes : masse maigre supérieure (+10-15% métabolisme), volume sanguin accru, sudation plus importante. Femmes : composition corporelle avec adiposité relative supérieure (tissu adipeux contient <25% eau vs muscle >75%), besoins légèrement réduits en valeur absolue."
    },
    {
      title: "Comment l'activité physique augmente les besoins ?",
      content: "Pertes hydriques exercice = sudation (principal) + respiration. Taux sudation varie 0.5-2.5L/h selon intensité (Sawka et al., 2007 ACSM Position Stand). Déshydratation -2% poids corporel = -10-20% performance. Optimal : boire 150% pertes sudation sur 4-6h post-effort."
    }
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
                    <span className="text-[10px] font-bold tracking-widest text-accent uppercase mb-2 block">Health &amp; Performance</span>
                    <h1 className="text-3xl md:text-4xl font-bold text-primary tracking-tight">Hydration Calculator</h1>
                </div>
                <div className="hidden md:block">
                    <span className="px-3 py-1 bg-surface-light border border-white/50 rounded-lg text-[10px] font-mono text-secondary">CODE: HEALTH_01</span>
                </div>
            </div>
        </header>

        <div className="max-w-5xl mx-auto grid lg:grid-cols-12 gap-8">

            {/* COLONNE GAUCHE */}
            <div className="lg:col-span-4 space-y-6">
                <Card className="space-y-6">
                    <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                        <div className="p-2 bg-surface-light rounded-lg text-accent"><Droplet size={20} /></div>
                        <h2 className="text-sm font-bold text-primary uppercase tracking-wide">Configuration</h2>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-secondary ml-1 uppercase tracking-wider flex items-center gap-1">
                            <User size={10} /> Sexe
                        </label>
                        <div className="grid grid-cols-2 p-1 bg-surface-light/50 border border-gray-100 rounded-xl">
                            {(['male', 'female'] as HydrationGender[]).map(g => (
                                <button
                                    key={g}
                                    onClick={() => setGender(g)}
                                    className={`py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-all ${gender === g ? 'bg-white text-accent shadow-sm ring-1 ring-black/5' : 'text-secondary hover:text-primary'}`}
                                >
                                    {g === 'male' ? 'Homme' : 'Femme'}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-gray-100">
                        <label className="text-[10px] font-bold text-secondary ml-1">POIDS (kg)</label>
                        <input
                            type="number"
                            value={weight}
                            onChange={(e) => setWeight(e.target.value)}
                            placeholder="75"
                            className="w-full bg-surface-light shadow-soft-in rounded-xl py-3 pl-4 text-sm font-bold text-primary focus:outline-none focus:ring-2 focus:ring-accent/20"
                        />
                    </div>

                    <div className="space-y-2 pt-2 border-t border-gray-100">
                        <label className="text-[10px] font-bold text-secondary ml-1 uppercase tracking-wider flex items-center gap-1">
                            <Activity size={10} /> Activité Physique (quotidien)
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { val: 'sedentary' as HydrationActivity, label: 'Sédentaire', desc: '<30min/j' },
                                { val: 'light' as HydrationActivity, label: 'Léger', desc: '30-60min' },
                                { val: 'moderate' as HydrationActivity, label: 'Modéré', desc: '60-90min' },
                                { val: 'intense' as HydrationActivity, label: 'Intense', desc: '90-120min' },
                                { val: 'athlete' as HydrationActivity, label: 'Athlète', desc: '>2h/j' }
                            ].map((opt) => (
                                <button
                                    key={opt.val}
                                    onClick={() => setActivity(opt.val)}
                                    className={`p-3 rounded-xl border text-left transition-all ${activity === opt.val ? 'border-accent/30 bg-accent/5 text-primary' : 'border-gray-100 bg-surface-light text-secondary hover:border-gray-200'}`}
                                >
                                    <div className="text-[11px] font-bold">{opt.label}</div>
                                    <div className="text-[9px] text-gray-400">{opt.desc}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-gray-100">
                        <label className="text-[10px] font-bold text-secondary ml-1 uppercase tracking-wider flex items-center gap-1">
                            <Sun size={10} /> Climat
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { val: 'cold' as HydrationClimate, label: 'Froid', desc: '<10°C' },
                                { val: 'temperate' as HydrationClimate, label: 'Tempéré', desc: '10-25°C' },
                                { val: 'hot' as HydrationClimate, label: 'Chaud', desc: '25-30°C' },
                                { val: 'veryHot' as HydrationClimate, label: 'Extrême', desc: '>30°C' }
                            ].map((opt) => (
                                <button
                                    key={opt.val}
                                    onClick={() => setClimate(opt.val)}
                                    className={`p-3 rounded-xl border text-left transition-all ${climate === opt.val ? 'border-accent/30 bg-accent/5 text-primary' : 'border-gray-100 bg-surface-light text-secondary hover:border-gray-200'}`}
                                >
                                    <div className="text-[11px] font-bold">{opt.label}</div>
                                    <div className="text-[9px] text-gray-400">{opt.desc}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={calculateIntake}
                        disabled={!weight}
                        className="w-full py-4 bg-accent text-white rounded-xl font-bold text-xs tracking-widest uppercase shadow-lg shadow-accent/20 hover:shadow-accent/40 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Calculer mes besoins
                    </button>
                </Card>
            </div>

            {/* COLONNE DROITE */}
            <div className="lg:col-span-8 flex flex-col min-h-[600px]">

              <div className="flex-grow space-y-8">
                {result ? (
                    <div ref={resultsRef} className="animate-in fade-in slide-in-from-bottom-8 duration-700 space-y-8">

                        <Card className="relative overflow-hidden border-accent/10">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <Droplet size={100} className="rotate-12" />
                            </div>
                            <div className="relative z-10 flex flex-col md:flex-row items-center md:items-end justify-between gap-6 text-center md:text-left">
                                <div>
                                    <span className="text-xs font-bold text-accent uppercase tracking-widest bg-accent/5 px-2 py-1 rounded-md border border-accent/10">Besoin Quotidien</span>
                                    <div className="mt-2 text-6xl md:text-8xl font-bold text-primary tracking-tighter">
                                        {result.liters}<span className="text-3xl md:text-4xl text-secondary ml-2 font-medium">L</span>
                                    </div>
                                    <p className="text-sm text-secondary font-medium mt-1">≈ {result.glasses} verres (250ml)</p>
                                </div>
                                <button onClick={() => {
                                    const text = `Bilan Hydratation - STRYV lab\n\n• Objectif Quotidien : ${result.liters} Litres\n• Équivalent : ~${result.glasses} verres (250ml)\n\nhttps://www.stryvlab.com/outils/hydratation`;
                                    navigator.clipboard.writeText(text);
                                    setCopied(true);
                                    setTimeout(() => setCopied(false), 2000);
                                }} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-xs transition-all ${copied ? 'bg-green-100 text-green-700' : 'bg-surface-light text-secondary hover:text-primary hover:bg-white border border-gray-100'}`}>
                                    {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'COPIÉ' : 'EXPORTER'}
                                </button>
                            </div>
                        </Card>

                        {result.warnings.length > 0 && (
                            <div className="bg-yellow-50/50 border border-yellow-200 rounded-2xl p-6">
                                <div className="flex items-center gap-2 mb-3">
                                    <AlertTriangle size={18} className="text-yellow-700" />
                                    <h3 className="text-sm font-bold text-yellow-900 uppercase tracking-wide">Informations</h3>
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

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-blue-50 border border-blue-100 text-blue-900 p-5 rounded-2xl">
                                <div className="text-xs font-bold opacity-60 uppercase mb-1">Base</div>
                                <div className="text-2xl font-bold">{result.breakdown.base} ml</div>
                                <div className="text-[10px] opacity-70 mt-1">EFSA 2010</div>
                            </div>
                            <div className="bg-purple-50 border border-purple-100 text-purple-900 p-5 rounded-2xl">
                                <div className="text-xs font-bold opacity-60 uppercase mb-1">Genre</div>
                                <div className="text-2xl font-bold">{result.breakdown.gender > 0 ? '+' : ''}{result.breakdown.gender} ml</div>
                                <div className="text-[10px] opacity-70 mt-1">Composition</div>
                            </div>
                            <div className="bg-emerald-50 border border-emerald-100 text-emerald-900 p-5 rounded-2xl">
                                <div className="text-xs font-bold opacity-60 uppercase mb-1">Activité</div>
                                <div className="text-2xl font-bold">+{result.breakdown.activity} ml</div>
                                <div className="text-[10px] opacity-70 mt-1">ACSM 2007</div>
                            </div>
                            <div className="bg-orange-50 border border-orange-100 text-orange-900 p-5 rounded-2xl">
                                <div className="text-xs font-bold opacity-60 uppercase mb-1">Climat</div>
                                <div className="text-2xl font-bold">+{result.breakdown.climate} ml</div>
                                <div className="text-[10px] opacity-70 mt-1">Thermorégulation</div>
                            </div>
                        </div>

                    </div>
                ) : (
                    <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-gray-200 rounded-card opacity-60">
                        <Droplet size={48} className="text-gray-300 mb-4" />
                        <h3 className="text-lg font-medium text-primary">En attente de données</h3>
                        <p className="text-sm text-secondary max-w-xs mt-2">Renseignez votre poids pour calculer vos besoins hydriques.</p>
                    </div>
                )}
              </div>

              <div className="pt-8 mt-auto">
                   <SectionHeader title="Base de Connaissance" subtitle="Comprendre l'hydratation." />
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
