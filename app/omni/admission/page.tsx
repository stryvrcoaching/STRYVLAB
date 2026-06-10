'use client';

import React from 'react';
import Link from 'next/link';
import { InlineWidget } from "react-calendly";
import { 
  ArrowLeft, 
  ShieldCheck, 
  Crown, 
  Activity, 
  CheckCircle2, 
  Info,
  Lock,
  Brain,
  MessageCircle,
  Smartphone
} from 'lucide-react';
import FaqOmniSchema from '@/components/seo/FaqOmniSchema';

export default function OmniAdmissionPage() {
  return (
    <main className="min-h-screen bg-background text-primary font-outfit flex flex-col">
      
      {/* NAVIGATION HAUTE */}
      <nav className="max-w-7xl mx-auto px-6 py-8 w-full">
        <Link
          href="/omni"
          className="inline-flex items-center gap-2 text-secondary hover:text-primary text-[10px] uppercase tracking-widest font-bold transition-all group"
        >
          <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" />
          Retour au programme
        </Link>
      </nav>

      <div className="flex-grow max-w-7xl mx-auto px-6 pb-24 grid lg:grid-cols-12 gap-16 items-start">
        
        {/* === COLONNE GAUCHE : LE CADRE MÉTHODOLOGIQUE === */}
        <div className="lg:col-span-7 space-y-12">
          
          <header className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-light border border-gray-100 text-[10px] font-bold tracking-widest text-accent uppercase shadow-sm">
              <ShieldCheck size={12} />
              Admission Stratégique
            </div>

            <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-[1.1]">
              OMNI Coaching™<br />
              <span className="text-secondary opacity-30 italic">Admission & Conditions</span>
            </h1>

            <p className="text-lg text-secondary border-l-2 border-accent pl-6 leading-relaxed">
              OMNI est un protocole d’optimisation avancée. 
              Il n’est ni automatique, ni standardisé. Son accès repose sur une admission stratégique.
            </p>
          </header>

          <section className="space-y-10 text-secondary leading-relaxed">
            
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-primary flex items-center gap-2">
                <Crown size={20} className="text-amber-500" />
                Un protocole pour systèmes stables
              </h2>
              <p className="text-sm">
                OMNI est conçu pour des profils capables de soutenir un travail profond, continu et évolutif sur leur potentiel de transformation. 
                Il ne force jamais un système instable. Cette exigence protège votre physiologie et garantit un cadre de travail durable.
              </p>
            </div>

            {/* Grid de Fonctionnalités OMNI */}
            <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-surface rounded-2xl border border-white/60 shadow-soft-out">
                    <Brain className="text-primary mb-2" size={18} />
                    <h3 className="text-[10px] font-bold uppercase tracking-wider mb-1">Neuro-Logic</h3>
                    <p className="text-[10px] leading-snug">Adapté à votre profil neuro-biologique.</p>
                </div>
                <div className="p-4 bg-surface rounded-2xl border border-white/60 shadow-soft-out">
                    <MessageCircle className="text-primary mb-2" size={18} />
                    <h3 className="text-[10px] font-bold uppercase tracking-wider mb-1">Daily Support</h3>
                    <p className="text-[10px] leading-snug">Réponse prioritaire 7j/7 par votre coach.</p>
                </div>
            </div>

            <div className="bg-surface p-8 rounded-3xl shadow-soft-out border border-white/60 space-y-6">
              <h3 className="text-xs font-bold text-primary uppercase tracking-widest">Le processus d'admission comprend :</h3>
              <ul className="space-y-4">
                {[
                  "Sécurisation de votre place dans le processus d’admission",
                  "Kick-off stratégique individuel avec un coach STRYV lab",
                  "Analyse approfondie de votre situation (IPT™ + entretien)",
                  "Mobilisation de ressources humaines et méthodologiques dédiées"
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm font-medium">
                    <CheckCircle2 size={16} className="text-accent mt-0.5 shrink-0" strokeWidth={3} />
                    <span dangerouslySetInnerHTML={{ __html: item }} />
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-6 bg-surface-light rounded-2xl border border-gray-100 flex gap-4 items-start">
              <Info size={20} className="text-primary shrink-0 mt-1" />
              <p className="text-[11px] font-medium leading-relaxed italic">
                Note : Si OMNI n’est pas validé, la valeur engagée est automatiquement réaffectée vers la solution la plus cohérente (G+ ou IPT ciblée).
              </p>
            </div>
          </section>
        </div>

        {/* === COLONNE DROITE : RÉSERVATION OBLIGATOIRE === */}
        <div className="lg:col-span-5 sticky top-12">
          
          <div className="bg-surface p-6 rounded-[2.5rem] shadow-soft-out border border-white/60 relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-accent to-transparent opacity-40"></div>
             
             <div className="mb-6 text-center">
                <h2 className="text-sm font-bold text-primary uppercase tracking-widest mb-1">Étape 1 : Appel Stratégique</h2>
                <p className="text-[10px] text-secondary font-medium uppercase tracking-tight">Le kick-off stratégique est obligatoire</p>
             </div>

             {/* WIDGET CALENDLY SMART */}
             <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-inner bg-white min-h-[600px]">
                <InlineWidget 
                  url="https://calendly.com/virtus-smartfit/appel-strategique-30min"
                  styles={{ height: '600px' }}
                  pageSettings={{
                    backgroundColor: 'ffffff',
                    hideEventTypeDetails: true,
                    hideGdprBanner: true,
                    primaryColor: '10b981', // Emerald
                    textColor: '0f172a'    // Slate
                  }}
                />
             </div>

             <div className="mt-6 pt-4 border-t border-gray-100 text-center">
                <p className="text-[9px] text-gray-400 flex items-center justify-center gap-1.5 font-bold uppercase tracking-widest">
                    <Lock size={10} /> Planification SSL Sécurisée
                </p>
             </div>
          </div>

          <div className="mt-6 flex items-center justify-center gap-6 opacity-30 grayscale hover:grayscale-0 transition-all duration-500">
             <Activity size={24} />
             <Smartphone size={24} />
             <ShieldCheck size={24} />
          </div>
        </div>

      </div>

      {/* FOOTER LÉGAL DÉTACHÉ */}
      <footer className="border-t border-gray-100 bg-surface-light py-12 mt-auto">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="text-[10px] text-secondary text-center md:text-left">
            <p className="font-bold text-primary uppercase tracking-[0.2em] mb-1">STRYV lab</p>
            <p>Laboratoire d'Ingénierie du Potentiel Humain</p>
            <p className="mt-1">Admission OMNI™ • Accompagnement 12 Semaines</p>
          </div>
          <div className="flex gap-8 text-[10px] font-bold text-secondary uppercase tracking-widest">
            <Link href="/cgv" className="hover:text-primary transition-colors">CGV</Link>
            <Link href="/confidentialite" className="hover:text-primary transition-colors">Confidentialité</Link>
            <Link href="/mentions-legales" className="hover:text-primary transition-colors">Légal</Link>
          </div>
        </div>
      </footer>

      <FaqOmniSchema />
    </main>
  );
}