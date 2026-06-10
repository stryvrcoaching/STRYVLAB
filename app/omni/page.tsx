import Link from 'next/link';
import { ArrowLeft, Activity, ShieldCheck } from 'lucide-react';
import OmniCheckoutButton from '@/app/api/stripe/OmniCheckoutButton';


export const metadata = {
  title: 'OMNI — protocole d’optimisation avancée | STRYV lab',
  description:
    'OMNI est le protocole d’optimisation le plus avancé de STRYV lab. Admission stratégique, ingénierie du potentiel et supervision continue.',
};

export default function OmniPage() {
  return (
    <main className="bg-[#303030] text-white min-h-screen px-6 sm:px-10 md:px-16 lg:px-24 py-24">

      <div className="max-w-5xl mx-auto space-y-20">

        {/* retour */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-white/40 hover:text-white text-[10px] uppercase tracking-[0.2em] font-bold transition-colors"
        >
          <ArrowLeft className="w-3 h-3" />
          Retour
        </Link>

        {/* HERO */}
        <header className="space-y-8 max-w-4xl">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#DAFA72]/10 flex items-center justify-center">
              <Activity className="w-6 h-6 text-[#DAFA72]" />
            </div>
            <span className="text-[10px] uppercase tracking-widest text-white/40 border border-white/10 px-3 py-1 rounded-full bg-white/5">
              Protocole avancé
            </span>
          </div>

          <h1 className="font-outfit text-5xl md:text-6xl font-medium leading-[0.95] tracking-[-0.02em]">
            OMNI<br />
            <span className="text-white/30">
              Optimisation continue du potentiel
            </span>
          </h1>

          <p className="text-white/60 text-lg leading-relaxed border-l border-[#DAFA72]/30 pl-4 max-w-3xl">
            OMNI est le protocole le plus avancé de STRYV lab.
            Il s’adresse aux profils nécessitant une supervision stratégique,
            évolutive et individualisée du potentiel de transformation.
          </p>
        </header>

        {/* CONTENU */}
        <section className="space-y-14 text-white/70 leading-relaxed max-w-4xl">

          <h2 className="text-white text-2xl font-medium">
            OMNI n’est pas un programme
          </h2>

          <p>
            OMNI n’est ni un plan, ni un cadre figé, ni une méthode standardisée.
            C’est un système d’ingénierie du potentiel,
            conçu pour accompagner l’évolution réelle d’un individu
            dans le temps.
          </p>

          <h2 className="text-white text-2xl font-medium">
            À qui s’adresse OMNI
          </h2>

          <ul className="space-y-3 pl-4 border-l border-white/10">
            <li>• Profils avancés ou atypiques</li>
            <li>• Historique de plateaux ou d’échecs répétés</li>
            <li>• Besoin de recalibrage stratégique continu</li>
            <li>• Volonté d’optimisation long terme, pas de solution rapide</li>
          </ul>

          <h2 className="text-white text-2xl font-medium">
            Ce que fait réellement OMNI
          </h2>

          <p>
            OMNI ne pousse jamais un système.
            Il observe, mesure, ajuste et synchronise
            les leviers physiologiques, comportementaux
            et contextuels dans le temps.
          </p>

          <p>
            L’analyse IPT™ constitue la base,
            mais OMNI dépasse le diagnostic :
            il orchestre l’évolution du potentiel.
          </p>

          <h2 className="text-white text-2xl font-medium">
            Pourquoi une admission est nécessaire
          </h2>

          <p>
            Tous les systèmes ne sont pas prêts
            pour une optimisation avancée.
            Forcer un protocole inadapté crée
            de la fatigue, des blocages et des régressions.
          </p>

          <p>
            L’admission protège à la fois l’individu
            et l’intégrité du protocole.
          </p>

        </section>

        {/* CTA admission */}
<section className="pt-12 border-t border-white/10 max-w-4xl space-y-6">

<div className="flex items-center gap-3 text-white/40 text-sm">
  <ShieldCheck className="w-4 h-4 text-[#DAFA72]" />
  OMNI est un protocole à admission stratégique
</div>

{/* boutons */}
<div className="flex flex-col sm:flex-row gap-4">

  {/* voie rationnelle */}
  <Link
    href="/omni/admission"
    className="inline-flex items-center justify-center px-8 py-4 rounded-xl border border-white/15 text-white/70 hover:text-white hover:border-white/30 text-[13px] transition-all duration-200"
  >
    Consulter les conditions d’admission
  </Link>

  {/* voie directe */}
  <OmniCheckoutButton />


</div>

<p className="text-[10px] text-white/30 max-w-2xl">
  Le paiement déclenche une évaluation stratégique.
  L’admission n’est jamais automatique.
</p>

</section>


      </div>
    </main>
  );
}
