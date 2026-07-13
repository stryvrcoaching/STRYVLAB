"use client";

import { ProductFrame } from "./ProductFrame";
import { Eyebrow, PrimaryCta, SecondaryCta } from "./primitives";
import { SignalRail } from "./SignalRail";
import { motion } from "framer-motion";
import {
  motionTokens,
  revealScale,
  revealUp,
  staggerContainer,
} from "./motion";
import { useReducedMotion } from "./useReducedMotion";

export function HeroSystem() {
  const reduced = useReducedMotion();
  return (
    <section
      id="top"
      className="relative isolate overflow-hidden px-5 pb-20 pt-32 sm:px-8 sm:pt-40 lg:px-10 lg:pb-32"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_80%_26%,rgba(134,174,184,.1),transparent_27%),radial-gradient(circle_at_24%_38%,rgba(198,180,139,.08),transparent_29%)]"
      />
      <div className="mx-auto grid max-w-[1440px] items-center gap-14 xl:grid-cols-[.76fr_1.24fr] xl:gap-16">
        <motion.div
          className="relative z-20"
          initial={false}
          animate="visible"
          variants={staggerContainer}
        >
          <motion.div variants={revealUp}>
            <Eyebrow>Plateforme de pilotage pour coachs sportifs</Eyebrow>
          </motion.div>
          <motion.h1
            variants={revealUp}
            className="mt-6 max-w-[700px] font-barlow text-[clamp(3rem,6.4vw,6.5rem)] font-semibold uppercase leading-[0.84] tracking-[-0.065em] text-white"
          >
            Reliez chaque prescription à{" "}
            <span className="text-white/38">ce qui se passe réellement.</span>
          </motion.h1>
          <motion.p
            variants={revealUp}
            className="mt-7 max-w-[580px] text-[17px] leading-8 text-white/68"
          >
            STRYVLAB transforme votre méthode en un système continu : vous
            prescrivez, STRYVR guide l’exécution, les données reviennent
            contextualisées, vous ajustez avec une vision complète.
          </motion.p>
          <motion.div
            variants={revealUp}
            className="mt-9 flex flex-col gap-3 sm:flex-row"
          >
            <PrimaryCta eventName="hero_cta">Voir STRYVLAB en action</PrimaryCta>
            <SecondaryCta href="#acces">
              Réserver une démonstration
            </SecondaryCta>
          </motion.div>
          <motion.p
            variants={revealUp}
            className="mt-7 font-barlow-condensed text-[11px] uppercase tracking-[0.13em] text-white/48"
          >
            Plateforme coach + application coaché · Produit fonctionnel · Accès
            anticipé
          </motion.p>
        </motion.div>
        <div className="relative mx-auto w-full max-w-[820px] pt-4 sm:pt-8 xl:min-h-[560px]">
          <div
            aria-hidden
            className="absolute left-[8%] top-[32%] hidden h-px w-[84%] bg-gradient-to-r from-[#c6b48b]/0 via-[#c6b48b]/65 to-[#86aeb8]/0 xl:block"
          />
          <motion.div
            className="relative z-20 mx-auto w-[94%] xl:absolute xl:left-[14%] xl:top-[8%] xl:w-[72%]"
            initial={false}
            animate="visible"
            variants={revealScale}
            transition={{ duration: reduced ? 0 : 0.42, ease: motionTokens.ease }}
          >
            <ProductFrame
              priority
              src="/landing-v2/hero/client-context.png"
              mobileSrc="/landing-v2/hero/client-context-mobile.png"
              alt="Score de transformation et optimisation de phase dans le dossier coaché STRYVLAB"
            />
          </motion.div>
          <motion.div
            className="relative z-10 -mt-5 ml-0 w-[58%] sm:-mt-10 sm:ml-[2%] xl:absolute xl:left-0 xl:top-[42%] xl:mt-0 xl:w-[43%]"
            initial={false}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              duration: reduced ? 0 : 0.32,
              delay: reduced ? 0 : 0.34,
              ease: motionTokens.ease,
            }}
          >
            <ProductFrame
              src="/landing-v2/studios/workout-studio.png"
              mobileSrc="/landing-v2/studios/workout-focus-mobile.png"
              alt="Prescription Workout Studio STRYVLAB"
            />
            <p className="absolute -bottom-8 left-3 rounded-xl border border-white/15 bg-[#121613]/95 px-3 py-2 font-barlow-condensed text-[9px] uppercase tracking-[.14em] text-[#c6b48b] shadow-xl backdrop-blur-xl">
              Prescription
            </p>
          </motion.div>
          <motion.div
            className="relative z-30 -mt-[17%] ml-auto w-[55%] sm:-mt-[16%] xl:absolute xl:right-0 xl:top-[47%] xl:mt-0 xl:w-[41%]"
            initial={false}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              duration: reduced ? 0 : 0.28,
              delay: reduced ? 0 : 0.5,
              ease: motionTokens.ease,
            }}
          >
            <ProductFrame
              src="/landing-v2/intelligence/performance-action.png"
              mobileSrc="/landing-v2/intelligence/performance-focus-mobile.png"
              alt="Analyse de performances et prochaine action STRYVLAB"
            />
            <p className="absolute -right-2 -top-7 rounded-xl border border-white/15 bg-[#111614]/95 px-3 py-2 font-barlow-condensed text-[9px] uppercase tracking-[.14em] text-[#86aeb8] shadow-xl backdrop-blur-xl">
              Données retournées
            </p>
          </motion.div>
          <motion.div
            className="relative z-40 ml-[8%] mt-4 max-w-[260px] rounded-2xl border border-white/15 bg-[#111714]/92 px-4 py-3 shadow-xl backdrop-blur-xl xl:absolute xl:bottom-[3%] xl:left-[28%] xl:mt-0"
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: reduced ? 0 : 0.2,
              delay: reduced ? 0 : 0.7,
              ease: motionTokens.ease,
            }}
          >
            <p className="font-barlow-condensed text-[10px] uppercase tracking-[.16em] text-[#c6b48b]">
              Contexte relié
            </p>
            <p className="mt-1 text-xs leading-5 text-white/68">
              Prescription, exécution et décision dans une seule lecture.
            </p>
            <div className="mt-3 flex items-center justify-between font-barlow-condensed text-[9px] uppercase tracking-[.14em] text-white/38">
              <span>Prescription</span><span>Données retournées</span>
            </div>
            <SignalRail animate className="mt-1" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
