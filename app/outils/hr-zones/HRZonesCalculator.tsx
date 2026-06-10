'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import {
  HeartPulse,
  ArrowLeft,
  Copy,
  Check,
  User,
  Activity,
  AlertTriangle
} from 'lucide-react';

// UI Components
import { Card } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Accordion } from '@/components/ui/Accordion';
// Formulas & Store
import { calculateHRZones, type HRGender, type HRZonesResult } from '@/lib/formulas';
import { useClientStore } from '@/lib/stores/useClientStore';

export default function HRZonesCalculator() {
  const setProfile = useClientStore((s) => s.setProfile);

  const [age, setAge] = useState('');
  const [gender, setGender] = useState<HRGender>('male');
  const [restingHR, setRestingHR] = useState('');
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<HRZonesResult | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const calculateZones = () => {
    setCopied(false);
    const a = parseFloat(age);
    if (!a) return;

    const res = calculateHRZones({
      age: a,
      gender,
      restingHR: restingHR ? parseFloat(restingHR) : undefined,
    });

    setResult(res);
    setProfile({ age: a, gender });

    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const faqItems = [
    {
      title: "Qu'est-ce que la méthode Karvonen et pourquoi est-elle supérieure ?",
      content: "La méthode Karvonen (1957, Annals of Medicine) utilise la fréquence cardiaque de réserve (FCR = FC Max - FC Repos) plutôt qu'un simple pourcentage de FC Max. Cette approche intègre votre condition cardiovasculaire individuelle. Validation scientifique : corrélation 0.92 avec seuils lactiques mesurés en laboratoire (Swain & Leutholtz, 1997)."
    },
    {
      title: "Pourquoi des formules différentes homme/femme pour FC Max ?",
      content: "Gulati et al. (2010, Circulation) ont démontré sur 5,437 femmes que la formule classique 220-âge surestime systématiquement la FC Max féminine de 5-13 bpm. La formule spécifique femme (206 - 0.88×âge) corrige ce biais avec précision ±10 bpm. Tanaka (2001, JACC) a affiné pour hommes (208 - 0.7×âge) sur méta-analyse 18,712 sujets."
    },
    {
      title: "Comment mesurer correctement ma FC repos ?",
      content: "Protocole validé ACSM : Au réveil, allongé, avant lever, après 5min repos. Palpation carotide ou radiale pendant 60 secondes. Répéter 3-5 matins consécutifs, éliminer valeurs aberrantes, calculer moyenne. FC repos <50 bpm = excellent (athlètes endurance), 50-60 = très bon, 60-70 = bon, 70-80 = moyen, >80 = amélioration nécessaire."
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
                    <span className="text-[10px] font-bold tracking-widest text-accent uppercase mb-2 block">Cardiovascular Training</span>
                    <h1 className="text-3xl md:text-4xl font-bold text-primary tracking-tight">HR Zones Calculator</h1>
                </div>
                <div className="hidden md:block">
                    <span className="px-3 py-1 bg-surface-light border border-white/50 rounded-lg text-[10px] font-mono text-secondary">CODE: CARDIO_01</span>
                </div>
            </div>
        </header>

        <div className="max-w-5xl mx-auto grid lg:grid-cols-12 gap-8">

            {/* COLONNE GAUCHE */}
            <div className="lg:col-span-4 space-y-6">
                <Card className="space-y-6">
                    <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                        <div className="p-2 bg-surface-light rounded-lg text-accent"><HeartPulse size={20} /></div>
                        <h2 className="text-sm font-bold text-primary uppercase tracking-wide">Configuration</h2>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-secondary ml-1 uppercase tracking-wider flex items-center gap-1">
                            <User size={10} /> Sexe (Formule FC Max)
                        </label>
                        <div className="grid grid-cols-2 p-1 bg-surface-light/50 border border-gray-100 rounded-xl">
                            {(['male', 'female'] as HRGender[]).map(g => (
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

                    <div className="space-y-3 pt-2 border-t border-gray-100">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-secondary ml-1">ÂGE (années)</label>
                            <input
                                type="number"
                                value={age}
                                onChange={(e) => setAge(e.target.value)}
                                placeholder="30"
                                className="w-full bg-surface-light shadow-soft-in rounded-xl py-3 pl-4 text-sm font-bold text-primary focus:outline-none focus:ring-2 focus:ring-accent/20"
                            />
                        </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-gray-100">
                        <label className="text-[10px] font-bold text-secondary ml-1 uppercase tracking-wider flex items-center gap-1">
                            <Activity size={10} /> FC Repos <span className="text-[9px] font-normal text-gray-400">(optionnel)</span>
                        </label>
                        <input
                            type="number"
                            value={restingHR}
                            onChange={(e) => setRestingHR(e.target.value)}
                            placeholder="65"
                            className="w-full bg-surface-light shadow-soft-in rounded-xl py-3 pl-4 text-sm font-bold text-primary focus:outline-none focus:ring-2 focus:ring-accent/20 border border-gray-100"
                        />
                        <div className="text-[9px] text-gray-400 pl-1">Mesurez au réveil, allongé, 3 jours consécutifs</div>
                    </div>

                    <button
                        onClick={calculateZones}
                        disabled={!age}
                        className="w-full py-4 bg-accent text-white rounded-xl font-bold text-xs tracking-widest uppercase shadow-lg shadow-accent/20 hover:shadow-accent/40 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Calculer les zones
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
                                <HeartPulse size={100} className="rotate-12" />
                            </div>
                            <div className="relative z-10 flex flex-col md:flex-row items-center md:items-end justify-between gap-6 text-center md:text-left">
                                <div>
                                    <span className="text-xs font-bold text-accent uppercase tracking-widest bg-accent/5 px-2 py-1 rounded-md border border-accent/10">FC Maximale</span>
                                    <div className="mt-2 text-6xl md:text-8xl font-bold text-primary tracking-tighter">
                                        {result.maxHR}<span className="text-3xl md:text-4xl text-secondary ml-2 font-medium">bpm</span>
                                    </div>
                                    <p className="text-sm text-secondary font-medium mt-1">{result.formulaUsed}</p>
                                </div>
                                <button onClick={() => {
                                    const text = `Bilan Zones Cardiaques - STRYV lab\n\n• FC Max : ${result.maxHR} bpm\n• FC Repos : ${result.restingHR} bpm\n• FC Réserve : ${result.hrReserve} bpm\n\nZones Cibles (Karvonen) :\n• Zone 2 (Endurance) : ${result.zones[1].bpm} bpm\n• Zone 4 (Seuil) : ${result.zones[3].bpm} bpm\n• Zone 5 (VO2 Max) : ${result.zones[4].bpm} bpm\n\nhttps://www.stryvlab.com/outils/hr-zones`;
                                    navigator.clipboard.writeText(text);
                                    setCopied(true);
                                    setTimeout(() => setCopied(false), 2000);
                                }} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-xs transition-all ${copied ? 'bg-green-100 text-green-700' : 'bg-surface-light text-secondary hover:text-primary hover:bg-white border border-gray-100'}`}>
                                    {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'COPIÉ' : 'EXPORTER'}
                                </button>
                            </div>
                        </Card>

                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="bg-blue-50 border border-blue-100 text-blue-900 p-5 rounded-2xl">
                                <div className="text-xs font-bold opacity-60 uppercase mb-1">FC Repos</div>
                                <div className="text-2xl font-bold">{result.restingHR} bpm</div>
                                <div className="text-[10px] opacity-70 mt-1">{restingHR ? 'Renseignée' : 'Estimée (moyenne)'}</div>
                            </div>
                            <div className="bg-emerald-50 border border-emerald-100 text-emerald-900 p-5 rounded-2xl">
                                <div className="text-xs font-bold opacity-60 uppercase mb-1">FC Réserve</div>
                                <div className="text-2xl font-bold">{result.hrReserve} bpm</div>
                                <div className="text-[10px] opacity-70 mt-1">Karvonen 1957</div>
                            </div>
                        </div>

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

                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-primary">6 Zones d&apos;Entraînement</h3>
                            {result.zones.map((zone) => (
                                <div key={zone.zone} className={`bg-gradient-to-br ${zone.color} border ${zone.border} p-6 rounded-2xl`}>
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-sm font-bold text-primary shadow-sm">
                                                {zone.zone}
                                            </div>
                                            <div>
                                                <div className="font-bold text-sm text-primary uppercase tracking-wide">{zone.name}</div>
                                                <div className="text-[10px] text-primary/60">{zone.desc}</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-bold text-2xl text-primary">{zone.bpm} bpm</div>
                                            <div className="text-[9px] text-primary/50 uppercase">{zone.range}</div>
                                        </div>
                                    </div>
                                    <div className="pt-3 border-t border-primary/10">
                                        <div className="text-[10px] text-primary/70 font-medium">{zone.usage}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                    </div>
                ) : (
                    <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-gray-200 rounded-card opacity-60">
                        <HeartPulse size={48} className="text-gray-300 mb-4" />
                        <h3 className="text-lg font-medium text-primary">En attente de données</h3>
                        <p className="text-sm text-secondary max-w-xs mt-2">Renseignez votre âge pour calculer vos zones d&apos;entraînement cardiaque.</p>
                    </div>
                )}
              </div>

              <div className="pt-8 mt-auto">
                   <SectionHeader title="Base de Connaissance" subtitle="Comprendre les zones cardiaques." />
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
