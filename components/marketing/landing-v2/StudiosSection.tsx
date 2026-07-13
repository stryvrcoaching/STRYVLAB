"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ProductFrame } from "./ProductFrame";
import { SectionHeading } from "./primitives";
import { onceViewport, revealScale } from "./motion";
import { trackLandingV2Event } from "./events";
import { useReducedMotion } from "./useReducedMotion";

const studioContent = [
  {
    label: "Workout Studio",
    tone: "#c6b48b",
    title: "Programmer avec une vision immédiate de la cohérence.",
    body: "Construisez chaque séance, contrôlez le volume, l’intensité et la répartition, puis identifiez les redondances ou les points d’attention avant publication.",
    points: [
      "Structure des séances et prescriptions par série",
      "Volume programmé et recommandations contextualisées",
      "Publication vers l’expérience coaché",
    ],
    src: "/landing-v2/studios/workout-studio.png",
    mobileSrc: "/landing-v2/studios/workout-focus-mobile.png",
    alt: "Workout Studio STRYVLAB avec prescriptions par série et recommandations de cohérence",
  },
  {
    label: "Nutrition Studio",
    tone: "#86aeb8",
    title: "Piloter un protocole nutritionnel relié au terrain.",
    body: "Organisez calories, macros, repas, hydratation, jours d’entraînement et jours de repos dans un protocole cohérent, lisible et ajustable.",
    points: [
      "Jours types et planning sur plusieurs semaines",
      "Repas, aliments, calories et macros",
      "Cohérence du protocole au même endroit",
    ],
    src: "/landing-v2/studios/nutrition-studio.png",
    mobileSrc: "/landing-v2/studios/nutrition-focus-mobile.png",
    alt: "Nutrition Studio STRYVLAB montrant le planning, les repas et les apports nutritionnels",
  },
] as const;

export function StudiosSection() {
  const [active, setActive] = useState(0);
  const reduced = useReducedMotion();
  return (
    <section
      id="produit"
      className="scroll-mt-24 border-y border-white/10 bg-[#101312] px-5 py-20 sm:px-8 sm:py-28 lg:px-10 lg:py-36"
    >
      <div className="mx-auto max-w-[1440px]">
        <SectionHeading
          eyebrow="Construire la méthode"
          title="Votre méthode devient un protocole exploitable."
        >
          Workout Studio et Nutrition Studio structurent la prescription sans
          séparer le programme de son contexte.
        </SectionHeading>
        <div
          role="tablist"
          aria-label="Studios"
          className="mt-12 flex w-fit max-w-full overflow-x-auto rounded-full border border-white/14 bg-white/[.055] p-1.5 font-barlow-condensed text-[11px] uppercase tracking-[.14em] text-white/65 shadow-[0_14px_40px_rgba(0,0,0,.3)] backdrop-blur-xl"
        >
          {studioContent.map((studio, index) => (
            <button
              key={studio.label}
              role="tab"
              aria-selected={active === index}
              onClick={() => {
                setActive(index);
                trackLandingV2Event("studio_select", { studio: studio.label });
              }}
              className={`rounded-full px-4 py-2 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c6b48b] ${active === index ? "bg-white text-[#101312]" : ""}`}
            >
              {studio.label}
            </button>
          ))}
        </div>
        <div className="mt-8">
          <AnimatePresence mode="wait" initial={false}>
          {(() => {
            const studio = studioContent[active];
            return (
            <motion.article key={studio.label} initial={false} animate={{ opacity: 1, y: 0 }} exit={reduced ? undefined : { opacity: 0, y: -8 }} transition={{ duration: reduced ? 0 : 0.28 }}>
              <p
                className="font-barlow-condensed text-[11px] uppercase tracking-[.16em]"
                style={{ color: studio.tone }}
              >
                {studio.label}
              </p>
              <h3 className="mt-4 max-w-xl font-sans text-3xl font-semibold uppercase leading-[.98] tracking-[-.04em] text-white sm:text-4xl">
                {studio.title}
              </h3>
              <p className="mt-5 max-w-xl text-[16px] leading-7 text-white/64">
                {studio.body}
              </p>
              <ul className="mt-6 grid gap-2 text-sm text-white/68">
                {studio.points.map((point) => (
                  <li key={point} className="flex gap-2">
                    <span aria-hidden style={{ color: studio.tone }}>
                      —
                    </span>
                    {point}
                  </li>
                ))}
              </ul>
              <motion.div initial={false} whileInView="visible" viewport={onceViewport} variants={revealScale} className="relative max-w-4xl">
                <ProductFrame
                  src={studio.src}
                  mobileSrc={studio.mobileSrc}
                  alt={studio.alt}
                  className="mt-8"
                />
                <div className="pointer-events-none absolute inset-x-4 bottom-4 flex flex-wrap gap-2">
                  {(studio.label === "Workout Studio" ? ["Programme cohérent", "Prescription par série", "Redondance détectée"] : ["Planning multi-semaines", "Jours training / repos", "Macros contextualisées"]).map((item, index) => (
                    <motion.span key={item} initial={false} whileInView={{ opacity: 1, y: 0 }} viewport={onceViewport} transition={{ delay: reduced ? 0 : index * 0.08 }} className="rounded-full border border-white/15 bg-[#101312]/90 px-3 py-1.5 font-barlow-condensed text-[10px] uppercase tracking-[.12em] text-white/78 backdrop-blur-md">{item}</motion.span>
                  ))}
                </div>
              </motion.div>
            </motion.article>
            );
          })()}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
