"use client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { faqs } from "./content";
import { SectionHeading } from "./primitives";
import { trackLandingV2Event } from "./events";
import { useReducedMotion } from "./useReducedMotion";

export function FaqSection() {
  const [open, setOpen] = useState<number | null>(null);
  const reduced = useReducedMotion();
  return (
    <section
      id="faq"
      className="scroll-mt-24 border-t border-white/10 px-5 py-20 sm:px-8 sm:py-28 lg:px-10 lg:py-36"
    >
      <div className="mx-auto grid max-w-[1440px] gap-12 lg:grid-cols-[.68fr_1.32fr]">
        <SectionHeading
          eyebrow="Questions fréquentes"
          title="Tout voir dans un cas coaché complet."
        />
        <div className="border-t border-white/10">
          {faqs.map(([question, answer], index) => (
            <article key={question} className="border-b border-white/10">
              <button
                type="button"
                aria-expanded={open === index}
                aria-controls={`faq-panel-${index}`}
                onClick={() => {
                  const next = open === index ? null : index;
                  setOpen(next);
                  if (next !== null) trackLandingV2Event("faq_open", { question });
                }}
                className="flex min-h-12 w-full items-center justify-between gap-5 py-5 text-left font-sans text-[17px] font-semibold tracking-[-.02em] text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#c6b48b] sm:text-xl"
              >
                <span>{question}</span>
                <ChevronDown
                  aria-hidden
                  className={`size-5 shrink-0 text-[#c6b48b] transition-transform ${open === index ? "rotate-180" : ""}`}
                />
              </button>
              <AnimatePresence initial={false}>
                {open === index && (
                  <motion.div
                    id={`faq-panel-${index}`}
                    initial={reduced ? false : { height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={reduced ? undefined : { height: 0, opacity: 0 }}
                    transition={{ duration: reduced ? 0 : 0.22 }}
                    className="max-w-2xl overflow-hidden pr-8 text-[15px] leading-7 text-white/60"
                  >
                    <div className="pb-6">{answer}</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
