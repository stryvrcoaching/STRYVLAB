"use client";

import { motion } from "framer-motion";
import { SectionHeading } from "./primitives";
import { useReducedMotion } from "./useReducedMotion";
export function BusinessSection() {
  const reduced = useReducedMotion();
  return (
    <section className="px-5 py-20 sm:px-8 sm:py-28 lg:px-10 lg:py-36">
      <div className="mx-auto max-w-[1440px]">
        <SectionHeading
          eyebrow="Le cockpit opérationnel"
          title="Pilotez les coachés et l’activité depuis le même système de travail."
        >
          Portefeuille, paiements, tâches, agenda et alertes restent réunis
          autour du même contexte opérationnel.
        </SectionHeading>
        <div className="mt-12 grid gap-8 lg:grid-cols-[1.18fr_.82fr]">
          <motion.div initial={false} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.25 }} transition={{ duration: reduced ? 0 : 0.45 }} className="overflow-hidden rounded-[24px] border border-white/12 bg-[#0b0d0c] p-4 shadow-[0_28px_80px_rgba(0,0,0,.36)] sm:p-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <span className="font-barlow-condensed text-[11px] uppercase tracking-[.16em] text-white/55">
                Vue opérationnelle
              </span>
              <span className="rounded-full border border-white/12 px-3 py-1 font-barlow-condensed text-[9px] uppercase tracking-[.14em] text-[#86aeb8]">
                Contexte coach
              </span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                ["Portefeuille", "Coachés à suivre"],
                ["Agenda", "Rendez-vous et tâches"],
                ["Alertes", "Points d’attention"],
              ].map(([title, copy], index) => (
                <div
                  key={title}
                  className="min-h-32 rounded-[18px] border border-white/10 bg-white/[.035] p-4"
                >
                  <span className="font-mono text-[10px] text-[#c6b48b]">
                    0{index + 1}
                  </span>
                  <h3 className="mt-7 font-sans text-base font-semibold tracking-[-.01em] text-white/78">
                    {title}
                  </h3>
                  <p className="mt-2 text-xs leading-5 text-white/45">{copy}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-[1.35fr_.65fr]">
              <div className="min-h-40 rounded-[18px] border border-white/10 bg-[#111514] p-5">
                <p className="font-barlow-condensed text-[10px] uppercase tracking-[.15em] text-white/42">
                  Organisation du jour
                </p>
                <div className="mt-5 space-y-3">
                  {[
                    "Relire un bilan",
                    "Préparer un protocole",
                    "Suivre une alerte",
                  ].map((item) => (
                    <div
                      key={item}
                      className="flex items-center gap-3 border-b border-white/8 pb-3 text-sm text-white/64"
                    >
                      <span className="size-1.5 rounded-full bg-[#c6b48b]" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
              <div className="min-h-40 rounded-[18px] border border-white/10 bg-[#111514] p-5">
                <p className="font-barlow-condensed text-[10px] uppercase tracking-[.15em] text-white/42">
                  Vue cohérente
                </p>
                <p className="mt-7 text-sm leading-6 text-white/62">
                  L’activité reste reliée au dossier et au protocole.
                </p>
              </div>
            </div>
          </motion.div>
          <motion.div initial={false} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.25 }} transition={{ duration: reduced ? 0 : 0.45, delay: reduced ? 0 : 0.08 }} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {[
              ["Portefeuille", "Clients actifs et points de suivi"],
              ["Activité", "Paiements, tâches et agenda"],
              ["Priorités", "Alertes actives et coachés à suivre"],
            ].map(([title, copy], index) => (
              <article
                key={title}
                className="rounded-[22px] border border-white/10 bg-[#111514] p-6"
              >
                <span className="font-mono text-[10px] text-[#86aeb8]">
                  0{index + 1}
                </span>
                <h3 className="mt-8 font-sans text-xl font-semibold tracking-[-.03em]">
                  {title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-white/56">{copy}</p>
              </article>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
