'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Check, ArrowUpRight, FileText } from 'lucide-react';

export default function SuccessIPTPage() {
  
  useEffect(() => {
    // 🔐 LOGIQUE CRITIQUE : Autorisation serveur IPT
    document.cookie = "stryv_access=ipt; path=/; max-age=86400";
  }, []);

  return (
    <main className="min-h-screen bg-background text-primary flex items-center justify-center px-6 font-outfit">
      
      {/* CARTE CENTRALE NEUMORPHIC */}
      <div className="max-w-md w-full bg-surface border border-white/60 shadow-soft-out rounded-2xl p-8 md:p-12 text-center">

        {/* ICONE SUCCÈS */}
        <div className="w-16 h-16 mx-auto rounded-full bg-accent/10 flex items-center justify-center mb-8 shadow-inner">
          <Check className="w-8 h-8 text-accent" strokeWidth={3} />
        </div>

        <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-4 text-primary">
          Paiement confirmé
        </h1>

        <div className="flex justify-center mb-6">
            <span className="px-3 py-1 bg-surface-light border border-gray-200 rounded-full text-[10px] font-bold tracking-widest text-accent uppercase flex items-center gap-2">
                <FileText size={12} />
                Analyse IPT™ Active
            </span>
        </div>

        <p className="text-secondary text-sm leading-relaxed mb-8">
          Vous venez d’activer une <strong className="text-primary">analyse IPT™</strong>.
          Cette procédure permet d’évaluer votre potentiel réel de transformation et de générer un rapport d’ingénierie structuré.
        </p>

        {/* ENCART D'INFORMATION */}
        <div className="text-left bg-surface-light border-l-2 border-accent p-4 rounded-r-lg mb-8">
          <p className="text-xs text-secondary leading-relaxed font-medium">
            <strong className="text-primary block mb-1">Prochaine étape : Pré-analyse</strong>
            Vous allez accéder à la phase d'introduction qui explique le fonctionnement de l’analyse adaptative avant de commencer.
          </p>
        </div>

        {/* BOUTON D'ACTION */}
        <Link
          href="/ipt/pre-analyse?mode=ipt"
          className="group w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-accent text-white text-sm font-bold shadow-lg shadow-accent/20 hover:shadow-accent/40 hover:scale-[1.02] transition-all duration-300"
        >
          Accéder à la pré-analyse IPT™
          <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
        </Link>

        {/* FOOTER NOTE */}
        <p className="mt-8 text-[10px] text-gray-400 leading-relaxed max-w-xs mx-auto">
          Ce service correspond à une analyse de données et à un rapport d’interprétation. 
          Aucun programme d'entraînement ni promesse de transformation n’est inclus à ce stade.
        </p>

      </div>
    </main>
  );
}