'use client';

import Link from 'next/link';
import { ArrowUpRight, Activity, Zap, Brain, Flame, BedDouble, ShieldCheck, Database } from 'lucide-react';
import FaqIPTSchema from '@/components/seo/FaqIPTSchema';
import { Accordion } from '@/components/ui/Accordion';

export default function IPTPage() {
  
  const faqItems = [
    { 
        title: "L’IPT est-il un diagnostic médical ?", 
        content: "Non. L’IPT™ n’est pas un diagnostic médical et n’a pas vocation à identifier ou traiter une pathologie. Il s’agit d’un outil d’analyse fonctionnelle permettant d’évaluer la capacité d’un système à s’adapter à une transformation. La méthode repose sur une approche innovante et multidimensionnelle, sans se substituer aux cadres cliniques." 
    },
    { 
        title: "L’IPT garantit-il des résultats ?", 
        content: "Non. L’IPT™ mesure un potentiel, pas une promesse. Cependant, le Rapport IPT identifie vos leviers de progression. Couplé à nos solutions (Protocol G+, OMNI Coaching), il permet d’augmenter ce potentiel physiologique, maximisant ainsi les probabilités d’une transformation réelle." 
    },
    { 
        title: "Pourquoi ne pas commencer directement par un programme ?", 
        content: "Parce que l’efficacité d’un programme dépend de la capacité réelle du système à s’adapter. Lorsque certaines contraintes physiologiques sont présentes, l’organisme limite volontairement la transformation. La mesure du potentiel permet d’objectiver ces contraintes avant toute intervention." 
    },
    { 
        title: "À qui s’adresse l’analyse IPT ?", 
        content: "L’analyse IPT™ s’adresse à toute personne souhaitant comprendre les mécanismes qui influencent sa capacité à se transformer. Elle est particulièrement pertinente pour celles et ceux qui rencontrent des stagnations, des échecs répétés ou une difficulté à maintenir des résultats." 
    }
  ];

  return (
    <main className="flex flex-col lg:flex-row min-h-screen font-outfit text-primary bg-background">

      {/* ================= GAUCHE (HERO FIXE) ================= */}
      <section className="w-full lg:w-5/12 lg:max-w-[500px] bg-surface p-8 md:p-12 lg:p-16 flex flex-col justify-between relative overflow-hidden min-h-[40vh] lg:min-h-screen lg:sticky lg:top-0 border-r border-gray-100 shadow-soft-out z-20">
        
        {/* Filigrane */}
        <div className="absolute -bottom-10 -right-10 text-accent/5 pointer-events-none select-none">
           <Activity className="w-96 h-96 stroke-[0.5]" />
        </div>

        <div className="relative z-10">
          {/* RETOUR */}
          <Link href="/" className="group inline-flex items-center text-secondary hover:text-primary text-[10px] uppercase tracking-[0.2em] font-bold mb-12 transition-colors">
            ← RETOUR LAB
          </Link>

          {/* ICONE */}
          <div className="mb-8">
             <div className="w-16 h-16 rounded-2xl bg-surface shadow-soft-out flex items-center justify-center text-accent">
                <Activity className="w-8 h-8 stroke-[1.5]" />
             </div>
          </div>

          {/* TITRE AZONIX (EXCEPTION CHARTE) */}
          <h1 className="text-4xl md:text-5xl font-bold tracking-tighter mb-6 leading-none text-primary">
            <span className="font-azonix">IPT</span>
            <span className="text-xs text-accent font-sans font-bold align-top ml-1 select-none">TM</span>
            <br />
            <span className="text-2xl md:text-3xl text-secondary font-medium tracking-tight block mt-2">
              Index de Potentiel <br/> de Transformation
            </span>
          </h1>

          <div className="space-y-8 border-t border-gray-100 pt-8">
            <p className="text-lg text-secondary leading-relaxed font-light border-l-2 border-accent pl-4">
               La transformation physique n’est pas une question d’effort. 
               <strong className="block text-primary font-bold mt-1">C’est une question de potentiel.</strong>
            </p>
            
            <div>
               <Link
                href="/analyse-ipt"
                className="group inline-flex items-center gap-3 px-8 py-4 bg-accent text-white font-bold rounded-xl text-sm shadow-lg shadow-accent/20 hover:shadow-accent/40 hover:scale-[1.02] transition-all duration-300"
              >
                Mesurer mon potentiel
                <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </Link>
            </div>
          </div>
        </div>

        <div className="relative z-10 mt-12 md:mt-0 flex justify-between items-end text-gray-400">
          <p className="text-[10px] uppercase tracking-[0.2em] font-bold">STRYV lab</p>
          <span className="text-xs font-mono opacity-50">V2.1</span>
        </div>
      </section>


      {/* ================= DROITE (CONTENU SCROLLABLE) ================= */}
      <section className="flex-1 relative overflow-y-auto py-12 px-6 md:px-12 lg:py-20 bg-background">
        <div className="max-w-3xl mx-auto space-y-16">

            {/* INTRO */}
            <div className="space-y-6">
                <p className="text-lg leading-relaxed text-secondary">
                    L’<strong className="text-primary">IPT™</strong> (Index de Potentiel de Transformation) est un indicateur 
                    propriétaire développé par STRYV lab pour évaluer la capacité réelle 
                    d’un individu à se transformer <strong className="text-primary">avant toute tentative de programme, 
                    de protocole ou de changement de mode de vie</strong>.
                </p>

                <p className="text-base text-secondary">
                    Contrairement aux approches classiques, l’IPT ne mesure ni la motivation, 
                    ni la discipline. Il mesure l’état fonctionnel du système 
                    biologique, comportemental et environnemental à un instant donné.
                </p>
            </div>

            {/* SECTION 1 : COMPRENDRE */}
            <div>
                <h2 className="text-2xl font-bold text-primary mb-6 flex items-center gap-3">
                    <Brain className="w-6 h-6 text-accent" />
                    La Mécanique du Potentiel
                </h2>
                <div className="bg-surface p-8 rounded-2xl shadow-soft-out border border-white/60 space-y-4">
                    <p className="text-secondary text-sm leading-relaxed">
                        Deux personnes peuvent suivre le même programme, fournir le même effort 
                        et appliquer les mêmes recommandations, tout en obtenant 
                        des résultats radicalement différents.
                    </p>
                    <p className="text-primary font-medium text-sm leading-relaxed">
                        Cette différence s’explique par le potentiel de transformation réel du 
                        système. Lorsque ce potentiel est altéré, le corps résiste, l’énergie chute, 
                        l’adhérence s’effondre et la transformation échoue malgré la bonne volonté.
                    </p>
                </div>
            </div>

            {/* SECTION 2 : POURQUOI */}
            <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-surface-light p-6 rounded-xl border border-gray-100">
                    <h3 className="text-sm font-bold text-primary uppercase mb-2">Le Problème</h3>
                    <p className="text-xs text-secondary leading-relaxed">
                        Forcer la transformation d’un système déjà contraint (stress, inflammation, fatigue) conduit inévitablement à l’échec ou au rebond.
                    </p>
                </div>
                <div className="bg-surface-light p-6 rounded-xl border border-gray-100">
                    <h3 className="text-sm font-bold text-primary uppercase mb-2">La Solution</h3>
                    <p className="text-xs text-secondary leading-relaxed">
                        Mesurer le potentiel permet d’identifier les freins invisibles et d'adapter la stratégie avant même de commencer l'effort.
                    </p>
                </div>
            </div>

            {/* SECTION 3 : CE QUE ÇA MESURE */}
            <div>
                <h2 className="text-2xl font-bold text-primary mb-6 flex items-center gap-3">
                    <Database className="w-6 h-6 text-accent" />
                    Métriques Analysées
                </h2>
                <p className="text-secondary text-sm mb-6">
                    L’analyse IPT repose sur un questionnaire adaptatif intelligent. 
                    Seules les questions pertinentes pour votre profil sont activées.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                        { icon: Flame, label: "Fonctionnement métabolique" },
                        { icon: Zap, label: "Réponse hormonale et stress" },
                        { icon: BedDouble, label: "Qualité du sommeil & récupération" },
                        { icon: Brain, label: "Adhérence psychologique" },
                        { icon: ShieldCheck, label: "Contraintes environnementales" },
                        { icon: Activity, label: "Capacité de réponse au stimulus" }
                    ].map((item, i) => (
                        <div key={i} className="flex items-center gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                            <div className="p-2 bg-surface-light rounded-lg text-accent">
                                <item.icon size={18} />
                            </div>
                            <span className="text-sm font-medium text-primary">{item.label}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* SECTION 4 : LE SCORE */}
            <div className="bg-surface border border-white/60 p-8 rounded-2xl shadow-soft-out">
                <h2 className="text-xl font-bold text-primary mb-4">
                    Lecture du Score IPT
                </h2>
                <div className="flex flex-col md:flex-row gap-8 items-center">
                    <div className="w-24 h-24 rounded-full border-4 border-accent flex items-center justify-center text-2xl font-bold text-primary bg-surface-light shadow-inner">
                        0-100
                    </div>
                    <div className="space-y-4 flex-1">
                        <p className="text-sm text-secondary">
                            Le score est une échelle de viabilité. Plus il est élevé, plus le système est réceptif à une transformation efficace.
                        </p>
                        <div className="p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg">
                            <p className="text-xs text-yellow-800 font-medium">
                                <strong>Note importante :</strong> Un IPT élevé ne garantit pas un résultat (il faut l'action). 
                                Un IPT faible explique pourquoi les résultats n’arrivent pas (malgré l'action).
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* SECTION 5 : FAQ */}
            <div className="pt-8 border-t border-gray-200">
                <h2 className="text-2xl font-bold text-primary mb-8">
                    Questions Fréquentes
                </h2>
                <Accordion items={faqItems} />
            </div>

            {/* CTA MOBILE */}
            <div className="lg:hidden sticky bottom-4 z-30">
                 <Link
                    href="/analyse-ipt"
                    className="w-full flex justify-center items-center gap-2 px-8 py-4 rounded-xl bg-accent text-white font-bold text-sm shadow-xl shadow-accent/30"
                  >
                    Lancer l'analyse
                    <ArrowUpRight className="w-4 h-4" />
                </Link>
            </div>

        </div>
      </section>

      <FaqIPTSchema />
    </main>
  );
}