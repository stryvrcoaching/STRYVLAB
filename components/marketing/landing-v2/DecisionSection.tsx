"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { ProductFrame } from "./ProductFrame";
import { SectionHeading } from "./primitives";
import { SignalRail } from "./SignalRail";
import { onceViewport, revealScale, staggerContainer } from "./motion";
import { trackLandingV2Event } from "./events";
import { useReducedMotion } from "./useReducedMotion";

const proofs = [
  {
    title: "Score de transformation",
    copy: "Une lecture synthétique de la dynamique du coaché, reliée à ses composantes : adhérence, récupération, évolution corporelle et performance.",
    src: "/landing-v2/intelligence/transformation-score.png",
    alt: "Score de transformation dans STRYVLAB",
  },
  {
    title: "Optimisation de phase",
    copy: "Une lecture de la cohérence entre la phase active, les données observées et l’horizon de décision.",
    src: "/landing-v2/intelligence/phase-optimization.png",
    alt: "Optimisation de phase dans STRYVLAB",
  },
  {
    title: "Prochaine action",
    copy: "Une recommandation contextualisée, accompagnée des signaux qui l’ont déclenchée.",
    src: "/landing-v2/intelligence/next-action.png",
    alt: "Prochaine action performance dans STRYVLAB",
  },
] as const;

export function DecisionSection() {
  const [active, setActive] = useState(2);
  const reduced = useReducedMotion();
  return (
    <section className="scroll-mt-24 border-y border-white/10 bg-[#101312] px-5 py-20 sm:px-8 sm:py-28 lg:px-10 lg:py-36">
      <div className="mx-auto max-w-[1440px]">
        <SectionHeading
          eyebrow="Du signal à l’action"
          title={
            <>
              Les données n’ont de valeur que lorsqu’elles changent la{" "}
              <span className="text-white/38">prochaine décision.</span>
            </>
          }
        >
          Progression, adhérence, récupération, nutrition et charge utile sont
          recroisées pour faire ressortir ce qui mérite votre attention — avec
          les signaux qui expliquent pourquoi.
        </SectionHeading>
        <div className="mt-12 grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
          <motion.div
            initial={false}
            whileInView="visible"
            viewport={onceViewport}
            variants={staggerContainer}
            className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1"
          >
            {proofs.map((proof, index) => (
              <motion.button
                type="button"
                aria-pressed={active === index}
                onMouseEnter={() => setActive(index)}
                onFocus={() => setActive(index)}
                onClick={() => {
                  setActive(index);
                  trackLandingV2Event("intelligence_focus", {
                    proof: proof.title,
                  });
                }}
                key={proof.title}
                variants={revealScale}
                className={`rounded-[20px] border bg-[#0b0e0d] p-5 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c6b48b] ${active === index ? "border-[#c6b48b]/55" : "border-white/10 opacity-75"}`}
              >
                <span className="font-mono text-[11px] text-[#c6b48b]">
                  0{index + 1}
                </span>
                <h3 className="mt-5 font-sans text-xl font-semibold tracking-[-.03em] text-white">
                  {proof.title}
                </h3>
                <p className="mt-3 text-[15px] leading-6 text-white/62">
                  {proof.copy}
                </p>
              </motion.button>
            ))}
          </motion.div>
          <div className="grid gap-3 md:grid-cols-[1.05fr_.95fr]">
            <motion.div
              animate={{
                opacity: active === 0 ? 1 : 0.68,
                scale: active === 0 ? 1 : 0.985,
              }}
              transition={{ duration: reduced ? 0 : 0.32 }}
            >
              <ProductFrame
                priority
                src={proofs[0].src}
                alt={proofs[0].alt}
                className="md:row-span-2"
              />
            </motion.div>
            <motion.div
              animate={{
                opacity: active === 1 ? 1 : 0.68,
                scale: active === 1 ? 1 : 0.985,
              }}
              transition={{ duration: reduced ? 0 : 0.32 }}
            >
              <ProductFrame priority src={proofs[1].src} alt={proofs[1].alt} />
            </motion.div>
            <div className="rounded-[20px] border border-[#c6b48b]/24 bg-[#171611] p-3">
              <motion.div
                animate={{
                  opacity: active === 2 ? 1 : 0.68,
                  scale: active === 2 ? 1 : 0.985,
                }}
                transition={{ duration: reduced ? 0 : 0.32 }}
              >
                <ProductFrame
                  priority
                  src={proofs[2].src}
                  alt={proofs[2].alt}
                />
              </motion.div>
              <SignalRail animate className="mt-4" />
            </div>
          </div>
        </div>
        <p className="mt-6 max-w-2xl border-l border-[#c6b48b]/45 pl-4 text-[16px] leading-7 text-white/72">
          STRYVLAB ne remplace pas le coach. Il rend le contexte plus lisible et
          la décision plus explicite.
        </p>
      </div>
    </section>
  );
}
