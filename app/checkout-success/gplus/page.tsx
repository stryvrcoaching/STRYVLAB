'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Check, ArrowUpRight, ShieldCheck } from 'lucide-react';

export default function SuccessGPlusPage() {
  
  useEffect(() => {
    // 🔐 LOGIQUE CRITIQUE : Autorisation serveur G+
    document.cookie = "stryv_access=gplus; path=/; max-age=86400";
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
                <ShieldCheck size={12} />
                Accès G+ Autorisé
            </span>
        </div>

        <p className="text-secondary text-sm leading-relaxed mb-8">
          Votre protocole <strong className="text-primary">G+</strong> est activé.
          L'architecture de votre programme nécessite désormais une calibration précise via l'analyse IPT.
        </p>

        {/* ENCART D'INFORMATION */}
        <div className="text-left bg-surface-light border-l-2 border-accent p-4 rounded-r-lg mb-8">
          <p className="text-xs text-secondary leading-relaxed font-medium">
            <strong className="text-primary block mb-1">Prochaine étape : Calibration</strong>
            Vous allez être redirigé vers la phase de pré-analyse IPT. Ces données serviront de socle à l'adaptation de votre protocole.
          </p>
        </div>

        {/* BOUTON D'ACTION */}
        <Link
          href="/ipt/pre-analyse?mode=gplus"
          className="group w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-accent text-white text-sm font-bold shadow-lg shadow-accent/20 hover:shadow-accent/40 hover:scale-[1.02] transition-all duration-300"
        >
          Initialiser le Protocole
          <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
        </Link>

        {/* FOOTER NOTE */}
        <p className="mt-8 text-[10px] text-gray-400 leading-relaxed max-w-xs mx-auto">
          Le protocole G+ inclut une analyse IPT complète. 
          Aucun résultat n’est garanti sans une exécution rigoureuse du diagnostic préalable.
        </p>

      </div>
    </main>
  );
}