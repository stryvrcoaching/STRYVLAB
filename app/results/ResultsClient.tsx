'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Download,
  Activity,
  AlertTriangle,
  CheckCircle2,
  BarChart2,
  Layers,
  FileText,
} from 'lucide-react';

// Composants Genesis
import { CircularProgress } from '@/components/genesis/CircularProgress';
import { AxisBar } from '@/components/genesis/AxisBar';
import { PatternCard } from '@/components/genesis/PatternCard';

// Interfaces (Intouchées)
interface IPTResult {
  scoring_version: string;
  axes: Record<string, {
    raw: number;
    normalized: number;
    weight: number;
  }>;
  ipt_global: number;
  patterns_detected: Array<{
    id: string;
    label: string;
    severity: 'critical' | 'high' | 'moderate';
    constraints: string[];
    recommendations: string[];
  }>;
  output: {
    top_constraints: string[];
    priority_levers: string[];
    plan_7days?: string;
  };
}

export default function ResultsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session');
  
  const [result, setResult] = useState<IPTResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadResults() {
      if (!sessionId) {
        setError('Session invalide');
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/genesis/get-result?session=${sessionId}`);
        const data = await res.json();

        if (data.success && data.result) {
          setResult(data.result);
        } else {
          setError('Résultats introuvables');
        }
      } catch (err) {
        console.error('Error loading results:', err);
        setError('Erreur de chargement');
      } finally {
        setLoading(false);
      }
    }

    loadResults();
  }, [sessionId]);

  // Loading State - Design Lab
  if (loading) {
    return (
      <main className="min-h-screen w-full bg-background flex items-center justify-center p-4">
        <div className="text-center relative z-10">
          <div className="w-16 h-16 rounded-xl bg-surface border border-gray-100 shadow-soft-out flex items-center justify-center mx-auto mb-6">
             <Activity className="w-8 h-8 text-accent animate-pulse" />
          </div>
          <p className="text-sm font-bold tracking-widest text-primary uppercase">Calcul des indicateurs...</p>
        </div>
      </main>
    );
  }

  // Error State - Design Lab
  if (error || !result) {
    return (
      <main className="min-h-screen w-full bg-background flex items-center justify-center p-4 font-outfit">
        <div className="bg-surface border border-white/60 p-8 rounded-2xl shadow-soft-out text-center max-w-md">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-lg font-bold text-primary mb-2">Erreur système</p>
          <p className="text-sm text-secondary mb-6">{error || 'Une erreur est survenue lors du traitement.'}</p>
          <button
            onClick={() => router.push('/questionnaire')}
            className="px-6 py-3 bg-primary text-white rounded-xl shadow-lg hover:bg-gray-800 transition-all font-bold text-sm"
          >
            Relancer l'analyse
          </button>
        </div>
      </main>
    );
  }

  // Logique de risque (Intouchée)
  const getRiskLevel = (score: number): { label: string; color: string; bgColor: string; icon: any } => {
    if (score >= 75) return { label: 'OPTIMAL', color: 'text-emerald-700', bgColor: 'bg-emerald-50 border-emerald-100', icon: CheckCircle2 };
    if (score >= 60) return { label: 'FAVORABLE', color: 'text-green-700', bgColor: 'bg-green-50 border-green-100', icon: CheckCircle2 };
    if (score >= 45) return { label: 'MODÉRÉ', color: 'text-orange-700', bgColor: 'bg-orange-50 border-orange-100', icon: AlertTriangle };
    if (score >= 30) return { label: 'RISQUE ÉLEVÉ', color: 'text-red-700', bgColor: 'bg-red-50 border-red-100', icon: AlertTriangle };
    return { label: 'CRITIQUE', color: 'text-red-900', bgColor: 'bg-red-50 border-red-200', icon: AlertTriangle };
  };

  const risk = getRiskLevel(result.ipt_global);
  const RiskIcon = risk.icon;

  const axesLabels: Record<string, string> = {
    sleep: 'Sommeil & Récupération',
    nutrition: 'Statut Métabolique',
    stress: 'Charge Allostatique',
    training: 'Capacité de Travail',
    recovery: 'Système Nerveux',
    adherence: 'Profil Psychologique',
  };

  return (
    <main className="min-h-screen w-full bg-background text-primary py-8 px-4 font-outfit">
      
      <div className="max-w-5xl mx-auto space-y-8 relative z-10">

        {/* HEADER DASHBOARD */}
        <div className="bg-surface border border-white/60 p-6 rounded-2xl shadow-soft-out flex justify-between items-center">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center shadow-inner">
                <BarChart2 className="w-6 h-6 text-accent" />
             </div>
             <div>
                <h1 className="text-xl font-bold tracking-tight text-primary">Rapport d'Analyse IPT™</h1>
                <p className="text-[10px] font-bold tracking-widest uppercase text-gray-400">Session #{sessionId?.slice(0,8)}</p>
             </div>
          </div>
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-light border border-gray-100 text-xs font-bold uppercase tracking-wide text-secondary hover:bg-white transition-all"
          >
            <ArrowLeft className="w-3 h-3" /> Retour
          </button>
        </div>

        {/* GRILLE PRINCIPALE */}
        <div className="grid lg:grid-cols-12 gap-8">
            
            {/* GAUCHE : SCORE GLOBAL (Sticky possible si besoin) */}
            <div className="lg:col-span-4 space-y-6">
                
                {/* CARTE SCORE */}
                <div className="bg-surface border border-white/60 p-8 rounded-2xl shadow-soft-out text-center relative overflow-hidden">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-secondary mb-6">Index de Potentiel</h2>
                    
                    <div className="flex justify-center mb-6">
                        <div className="relative">
                            <CircularProgress value={Math.round(result.ipt_global)} size={180} />
                        </div>
                    </div>

                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border ${risk.bgColor} mb-6`}>
                        <RiskIcon className={`w-4 h-4 ${risk.color}`} />
                        <span className={`text-xs font-bold uppercase tracking-wide ${risk.color}`}>{risk.label}</span>
                    </div>

                    <p className="text-xs text-secondary leading-relaxed text-left bg-surface-light p-4 rounded-xl border border-gray-50">
                        {result.ipt_global >= 75 && "Système optimisé. Capacité d'adaptation maximale. Feu vert pour intensification."}
                        {result.ipt_global >= 60 && result.ipt_global < 75 && "État favorable. Quelques frictions mineures à corriger pour libérer le plein potentiel."}
                        {result.ipt_global >= 45 && result.ipt_global < 60 && "Contraintes modérées. Le système résiste au changement. Protocole adaptatif requis."}
                        {result.ipt_global >= 30 && result.ipt_global < 45 && "Contraintes significatives. Risque de stagnation élevé. Priorité : restauration métabolique."}
                        {result.ipt_global < 30 && "Système verrouillé. Transformation immédiate déconseillée. Phase de réparation impérative."}
                    </p>
                </div>

                {/* CARTE ACTION (UPGRADE) */}
                <div className="bg-primary text-white p-6 rounded-2xl shadow-xl shadow-primary/20 relative overflow-hidden">
                    <div className="relative z-10">
                        <h3 className="text-lg font-bold mb-2">Passez à l'action</h3>
                        <p className="text-xs text-gray-300 mb-6 leading-relaxed">
                            Votre analyse révèle le "quoi". Le Protocole G+ vous donne le "comment" : plan nutritionnel, entraînement et coaching.
                        </p>
                        <button
                            onClick={() => router.push('/checkout/gplus')}
                            className="w-full py-3 bg-white text-primary rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-gray-100 transition-all shadow-lg"
                        >
                            Débloquer Protocole G+
                        </button>
                        <button
                            onClick={() => window.print()}
                            className="w-full mt-3 flex items-center justify-center gap-2 text-[10px] font-medium text-gray-400 hover:text-white transition-colors"
                        >
                            <Download className="w-3 h-3" /> Télécharger PDF
                        </button>
                    </div>
                    {/* Element décoratif */}
                    <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-accent/20 rounded-full blur-3xl"></div>
                </div>
            </div>

            {/* DROITE : DÉTAILS ANALYTIQUES */}
            <div className="lg:col-span-8 space-y-6">
                
                {/* AXES */}
                <div className="bg-surface border border-white/60 p-8 rounded-2xl shadow-soft-out">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-surface-light rounded-lg text-accent"><Activity size={18} /></div>
                        <h3 className="text-sm font-bold uppercase tracking-wide text-primary">Analyse Dimensionnelle</h3>
                    </div>
                    
                    <div className="space-y-5">
                        {Object.entries(result.axes).map(([axisKey, axisData]) => (
                        <AxisBar
                            key={axisKey}
                            label={axesLabels[axisKey] || axisKey}
                            score={axisData.normalized}
                            weight={axisData.weight}
                        />
                        ))}
                    </div>
                </div>

                {/* GRILLE : PATTERNS & LEVIERS */}
                <div className="grid md:grid-cols-2 gap-6">
                    
                    {/* PATTERNS (Problèmes) */}
                    <div className="bg-surface border border-white/60 p-6 rounded-2xl shadow-soft-out">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-surface-light rounded-lg text-red-500"><AlertTriangle size={18} /></div>
                            <h3 className="text-sm font-bold uppercase tracking-wide text-primary">Points de Friction</h3>
                        </div>
                        
                        {result.patterns_detected && result.patterns_detected.length > 0 ? (
                            <div className="space-y-3">
                                {result.patterns_detected.map((pattern, idx) => (
                                    <PatternCard key={idx} pattern={pattern} />
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-secondary italic">Aucun pattern bloquant majeur détecté.</p>
                        )}
                    </div>

                    {/* LEVIERS (Solutions) */}
                    <div className="bg-surface border border-white/60 p-6 rounded-2xl shadow-soft-out">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-surface-light rounded-lg text-emerald-600"><Layers size={18} /></div>
                            <h3 className="text-sm font-bold uppercase tracking-wide text-primary">Leviers Prioritaires</h3>
                        </div>
                        
                        <div className="space-y-3">
                            {result.output.priority_levers && result.output.priority_levers.length > 0 ? (
                                result.output.priority_levers.map((lever, idx) => (
                                    <div key={idx} className="flex gap-3 p-3 bg-surface-light rounded-xl border border-gray-50 items-start">
                                        <div className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                                            {idx + 1}
                                        </div>
                                        <p className="text-xs text-secondary font-medium leading-relaxed">{lever}</p>
                                    </div>
                                ))
                            ) : (
                                <p className="text-xs text-secondary italic">Analyse en cours de consolidation.</p>
                            )}
                        </div>
                    </div>

                </div>

            </div>

        </div>

      </div>
    </main>
  );
}