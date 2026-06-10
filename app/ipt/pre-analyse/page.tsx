'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { 
  ScanFace, 
  Target, 
  ShieldAlert, 
  ListOrdered, 
  Play, 
  Clock 
} from 'lucide-react';

export default function PreAnalysePage() {

  // --- LOGIQUE (INTOUCHABLE) ---
  const handleSessionInit = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("stryv_session_status", "started");
      localStorage.setItem("stryv_timestamp", Date.now().toString());
    }
  };

  useEffect(() => {
    document.body.style.overflow = "auto";
  }, []);

  return (
    <main className="min-h-screen w-full bg-background text-primary flex items-center justify-center p-6 font-outfit">
      
      <div className="w-full max-w-lg flex flex-col gap-6 relative z-10">

        {/* --- MODULE 1 : HEADER & IDENTITÉ --- */}
        <div className="bg-surface border border-white/60 p-8 rounded-2xl shadow-soft-out flex flex-col items-center text-center">
          
          <div className="w-16 h-16 rounded-xl bg-accent/10 flex items-center justify-center mb-6 shadow-inner">
             <ScanFace className="w-8 h-8 text-accent" strokeWidth={1.5} />
          </div>

          <div className="space-y-2 mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-primary">
              Pré-analyse IPT™
            </h1>
            <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-accent">
              STRYV lab
            </p>
          </div>

          <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent mb-6"></div>

          <div className="text-sm text-secondary leading-relaxed font-light">
            Initialisation du protocole de profilage métabolique.
            <br />
            Calibration du point de départ.
          </div>
        </div>

        {/* --- MODULE 2 : DIRECTIVES OPÉRATIONNELLES --- */}
        <div className="bg-surface border border-white/60 p-6 rounded-2xl shadow-soft-out space-y-6">
          
          {/* Item 1 */}
          <div className="flex gap-4 items-start">
            <div className="mt-1 p-1.5 rounded-lg bg-surface-light text-accent shadow-sm border border-white/50">
                <Target size={16} />
            </div>
            <div>
                <h3 className="text-xs font-bold uppercase tracking-wide text-primary mb-1">Le But : Fixer le Point Zéro</h3>
                <p className="text-xs text-secondary leading-relaxed">
                    Le système doit savoir exactement où vous en êtes <em>maintenant</em>. Sans ce point précis, impossible de tracer la route vers votre objectif.
                </p>
            </div>
          </div>

          {/* Item 2 */}
          <div className="flex gap-4 items-start">
            <div className="mt-1 p-1.5 rounded-lg bg-red-50 text-red-500 shadow-sm border border-red-100">
                <ShieldAlert size={16} />
            </div>
            <div>
                <h3 className="text-xs font-bold uppercase tracking-wide text-primary mb-1">La Règle : Zéro Mensonge</h3>
                <p className="text-xs text-secondary leading-relaxed">
                    Ne dites pas ce que vous <em>aimeriez</em> faire, dites ce que vous faites vraiment. Si vous trichez ici, tout le calcul sera faux. Le système exige des faits.
                </p>
            </div>
          </div>

          {/* Item 3 */}
          <div className="flex gap-4 items-start">
            <div className="mt-1 p-1.5 rounded-lg bg-surface-light text-primary shadow-sm border border-white/50">
                <ListOrdered size={16} />
            </div>
            <div>
                <h3 className="text-xs font-bold uppercase tracking-wide text-primary mb-1">Ordre & Précision</h3>
                <p className="text-xs text-secondary leading-relaxed">
                    Ayez vos chiffres exacts sous les yeux (poids, mensurations, sommeil) avant de cliquer. L'à-peu-près est interdit.
                </p>
            </div>
          </div>

        </div>

        {/* --- MODULE 3 : PROTOCOLE & ACTION --- */}
        <div className="bg-surface border border-white/60 p-6 rounded-2xl shadow-soft-out">
            
          {/* Info Timer */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-light border border-gray-100">
                <Clock size={12} className="text-accent" />
                <span className="text-[10px] font-bold text-secondary uppercase tracking-wide">10-15 Minutes</span>
            </div>
            <span className="text-[10px] font-medium text-gray-400">Session ID: #INIT_01</span>
          </div>

          {/* BOUTON ACTION */}
          <Link href="/questionnaire?session=test123" className="block w-full group">
            <button
              onClick={handleSessionInit}
              className="w-full py-5 rounded-xl bg-accent text-white text-xs font-bold tracking-[0.15em] uppercase shadow-lg shadow-accent/20 hover:shadow-accent/40 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
            >
              Lancer l'analyse
              <Play size={14} fill="currentColor" />
            </button>
          </Link>

          <p className="mt-4 text-[9px] text-center leading-relaxed text-gray-400 font-medium px-4">
            L’analyse fournit une lecture fonctionnelle du potentiel.
            Elle ne constitue ni un diagnostic médical, ni une prescription.
          </p>
        </div>

      </div>
    </main>
  );
}