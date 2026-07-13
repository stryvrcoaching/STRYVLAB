"use client";

import { systemSteps } from "./content";
import { SectionHeading } from "./primitives";
import { SignalRail } from "./SignalRail";
import { motion } from "framer-motion";
import { onceViewport, revealUp, staggerContainer } from "./motion";
import { useReducedMotion } from "./useReducedMotion";

export function SystemLoop() {
  const reduced = useReducedMotion();
  return (
    <section className="scroll-mt-24 px-5 py-20 sm:px-8 sm:py-28 lg:px-10 lg:py-36">
      <div className="mx-auto max-w-[1440px]">
        <SectionHeading
          eyebrow="Un système continu"
          title="Du premier bilan à la prochaine décision."
        >
          STRYVLAB ne juxtapose pas des fonctionnalités. La plateforme conserve
          le lien entre ce que le coach prescrit, ce que le coaché exécute et ce
          que les données permettent ensuite de comprendre.
        </SectionHeading>
        <motion.div
          className="relative mt-12 overflow-hidden rounded-[28px] border border-white/12 bg-[#101413] p-5 sm:p-8 lg:p-12"
          initial={false}
          whileInView="visible"
          viewport={onceViewport}
          variants={staggerContainer}
        >
          <SignalRail animate className="mb-6 max-w-md" />
          <motion.div variants={revealUp} className="relative">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {systemSteps.map(([number, title, body]) => {
                const decision = title === "Décider";
                const adjust = title === "Ajuster";
                return (
                  <article
                    key={number}
                    className={`relative flex min-h-[220px] flex-col justify-between rounded-[20px] border p-5 ${decision ? "border-[#c6b48b]/60 bg-[#191710] shadow-[0_22px_60px_rgba(0,0,0,.28)] lg:min-h-[280px]" : adjust ? "border-[#86aeb8]/35 bg-[#111816]" : "border-white/10 bg-[#0c0e0d]"}`}
                  >
                    <div>
                      <span className={`font-mono text-[10px] ${decision ? "text-[#c6b48b]" : "text-white/45"}`}>{number}</span>
                      <h3 className={`mt-7 font-barlow font-semibold uppercase tracking-[-.04em] ${decision ? "text-4xl" : "text-2xl"}`}>{title}</h3>
                      <p className={`mt-3 text-sm leading-6 ${decision ? "text-white/70" : "text-white/58"}`}>{body}</p>
                    </div>
                    <p className={`mt-5 border-t border-white/10 pt-4 font-barlow-condensed text-[10px] uppercase tracking-[.14em] ${decision ? "text-[#c6b48b]" : "text-[#86aeb8]"}`}>
                      {decision ? "Point de convergence" : adjust ? "↺ retour vers Prescrire" : "Signal relié"}
                    </p>
                  </article>
                );
              })}
            </div>
            <div aria-hidden className="mt-5 flex items-center gap-3 text-white/38">
              <span className="h-px flex-1 bg-gradient-to-r from-transparent via-[#c6b48b]/40 to-transparent" />
              <span className="font-barlow-condensed text-[10px] uppercase tracking-[.16em]">Ajuster relance discrètement Prescrire</span>
              <span className="h-px flex-1 bg-gradient-to-r from-transparent via-[#86aeb8]/40 to-transparent" />
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
