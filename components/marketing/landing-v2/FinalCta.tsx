"use client";
import { motion } from "framer-motion";
import { Brand, Eyebrow, PrimaryCta } from "./primitives";
import { useReducedMotion } from "./useReducedMotion";

export function FinalCtaAndFooter() {
  const reduced = useReducedMotion();
  return (
    <>
      <section className="border-y border-white/10 bg-[#c6b48b] px-5 py-20 text-[#0d0d0d] sm:px-8 sm:py-28 lg:px-10 lg:py-32">
        <div className="mx-auto flex max-w-[1440px] flex-col items-start justify-between gap-9 lg:flex-row lg:items-end">
          <motion.div initial={false} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.4 }} transition={{ duration: reduced ? 0 : 0.42 }}>
            <Eyebrow>Votre prochain système de travail</Eyebrow>
            <h2 className="mt-5 max-w-4xl font-barlow text-[clamp(2.5rem,5vw,4.7rem)] font-semibold uppercase leading-[.88] tracking-[-.055em]">
              Votre méthode mérite un système capable de la suivre.
            </h2>
            <p className="mt-6 max-w-2xl text-[17px] leading-8 text-[#0d0d0d]/68">
              Voyez comment STRYVLAB relie votre prescription, l’exécution du
              coaché et la prochaine décision.
            </p>
          </motion.div>
          <motion.div initial={false} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.4 }} transition={{ duration: reduced ? 0 : 0.42, delay: reduced ? 0 : 0.1 }}><PrimaryCta eventName="final_cta">Voir STRYVLAB en action</PrimaryCta></motion.div>
        </div>
      </section>
      <footer className="mx-auto flex max-w-[1440px] flex-col gap-6 px-5 py-10 text-white/42 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-10">
        <Brand />
        <div className="flex flex-wrap gap-x-5 gap-y-3 font-barlow-condensed text-[11px] uppercase tracking-[.14em]">
          <a
            className="rounded transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#c6b48b]"
            href="/auth/login"
          >
            Accès coach
          </a>
          <a
            className="rounded transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#c6b48b]"
            href="/confidentialite"
          >
            Confidentialité
          </a>
          <a
            className="rounded transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#c6b48b]"
            href="/mentions-legales"
          >
            Mentions légales
          </a>
        </div>
        <p className="font-barlow-condensed text-[11px] uppercase tracking-[.14em]">
          © {new Date().getFullYear()} STRYVLAB
        </p>
      </footer>
    </>
  );
}
