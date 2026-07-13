"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { SectionHeading } from "./primitives";
import { onceViewport } from "./motion";
import { useReducedMotion } from "./useReducedMotion";

export function StryvrSection() {
  const [started, setStarted] = useState(false);
  const reduced = useReducedMotion();
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (reduced) {
      setStep(2);
      return;
    }
    if (!started) return;
    const ids = [
      window.setTimeout(() => setStep(1), 650),
      window.setTimeout(() => setStep(2), 1300),
    ];
    return () => ids.forEach(clearTimeout);
  }, [started, reduced]);
  // TODO: replace editorial STRYVR placeholder with validated product captures
  return (
    <section
      id="stryvr"
      className="scroll-mt-24 px-5 py-20 sm:px-8 sm:py-28 lg:px-10 lg:py-36"
    >
      <div className="mx-auto grid max-w-[1440px] items-center gap-14 lg:grid-cols-[.88fr_1.12fr] lg:gap-24">
        <SectionHeading
          eyebrow="L’expérience coaché"
          title="La prescription continue en dehors du rendez-vous."
        >
          Le coaché retrouve ses entraînements, son plan nutritionnel, ses
          check-ins et ses données quotidiennes dans STRYVR. L’exécution
          alimente ensuite le suivi du coach.
        </SectionHeading>
        <motion.div
          className="relative mx-auto w-full max-w-[580px] py-8"
          onViewportEnter={() => setStarted(true)}
          viewport={onceViewport}
        >
          <div
            aria-hidden
            className="absolute left-[2%] right-[2%] top-1/2 h-px bg-gradient-to-r from-[#c6b48b]/0 via-[#c6b48b]/60 to-[#86aeb8]/0"
          />
          <div className="relative z-20 mb-3 flex items-center justify-between px-2 font-barlow-condensed text-[9px] uppercase tracking-[.16em] text-white/42">
            <span>Signal envoyé</span><span>Contexte rendu au coach</span>
          </div>
          <motion.div
            animate={reduced ? {} : { scale: step === 1 ? 1.015 : 1 }}
            transition={{ duration: 0.35 }}
            className="relative z-10 mx-auto aspect-[10/19] max-w-[300px] rounded-[43px] border-[7px] border-[#2a2d2c] bg-[#070909] p-3 shadow-[0_34px_90px_rgba(0,0,0,.55)]"
          >
            <div className="h-full rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,#151b18,#0c0f0e)] p-5">
              <div className="mx-auto h-1.5 w-20 rounded-full bg-white/14" />
              <p className="mt-10 font-barlow-condensed text-[10px] uppercase tracking-[.18em] text-[#c6b48b]">
                STRYVR · exécution
              </p>
              <div className="mt-7 space-y-3">
                <div
                  className={`rounded-2xl border p-3 transition ${step >= 0 ? "border-[#c6b48b]/45 bg-white/[.06]" : "border-white/10 bg-white/[.045]"}`}
                >
                  <p className="font-barlow-condensed text-[9px] uppercase tracking-[.14em] text-white/46">
                    Protocole envoyé
                  </p>
                  <p className="mt-2 text-xs text-white/72">
                    Entraînement et nutrition à réaliser
                  </p>
                </div>
                <div
                  className={`grid grid-cols-2 gap-3 transition ${step >= 1 ? "opacity-100" : "opacity-45"}`}
                >
                  <div className="rounded-2xl border border-white/10 bg-white/[.035] p-3">
                    <p className="font-barlow-condensed text-[9px] uppercase tracking-[.12em] text-white/46">
                      Check-ins
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[.035] p-3">
                    <p className="font-barlow-condensed text-[9px] uppercase tracking-[.12em] text-white/46">
                      Données
                    </p>
                  </div>
                </div>
              <div
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px] leading-4 transition ${step >= 2 ? "border-[#86aeb8]/45 bg-white/[.06] text-white/72" : "border-white/10 bg-white/[.025] text-white/58"}`}
                aria-live="polite"
                >
                  Les signaux rejoignent le dossier coaché.
                </div>
              </div>
            </div>
          </motion.div>
          <motion.div
            animate={{ opacity: step >= 0 ? 1 : 0.45 }}
            className="absolute left-0 top-[22%] z-20 max-w-[190px] rounded-[18px] border border-white/14 bg-[#121715]/92 p-3 shadow-xl backdrop-blur-xl"
          >
            <p className="font-barlow-condensed text-[9px] uppercase tracking-[.15em] text-[#86aeb8]">
              1 · Protocole envoyé
            </p>
            <p className="mt-1 text-xs text-white/68">
              Séances et nutrition disponibles.
            </p>
          </motion.div>
          <motion.div
            animate={{ opacity: step >= 1 ? 1 : 0.4 }}
            className="absolute right-0 top-[48%] z-20 max-w-[190px] rounded-[18px] border border-white/14 bg-[#121715]/92 p-3 shadow-xl backdrop-blur-xl"
          >
            <p className="font-barlow-condensed text-[9px] uppercase tracking-[.15em] text-[#c6b48b]">
              2 · Exécution
            </p>
            <p className="mt-1 text-xs text-white/68">
              Le coaché réalise et renseigne.
            </p>
          </motion.div>
          <motion.div
            animate={{ opacity: step >= 2 ? 1 : 0.4 }}
            className="absolute bottom-[10%] left-[8%] z-20 max-w-[220px] rounded-[18px] border border-white/14 bg-[#161612]/92 p-3 shadow-xl backdrop-blur-xl"
          >
            <p className="font-barlow-condensed text-[9px] uppercase tracking-[.15em] text-[#c6b48b]">
              3 · Contexte rendu au coach
            </p>
            <p className="mt-1 text-xs text-white/68">
              Check-ins et données quotidiennes contextualisées.
            </p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
