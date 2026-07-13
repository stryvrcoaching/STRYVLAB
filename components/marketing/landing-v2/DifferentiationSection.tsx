"use client";

import { motion } from "framer-motion";
import { comparisonRows } from "./content";
import { SectionHeading } from "./primitives";
import { useReducedMotion } from "./useReducedMotion";
export function DifferentiationSection() {
  const reduced = useReducedMotion();
  return (
    <section className="border-y border-white/10 bg-[#101312] px-5 py-20 sm:px-8 sm:py-28 lg:px-10 lg:py-36">
      <div className="mx-auto max-w-[1440px]">
        <SectionHeading
          eyebrow="Pourquoi STRYVLAB"
          title="Centraliser ne suffit pas. Il faut conserver les relations."
        />
        <motion.div initial={false} whileInView={{ opacity: 1 }} viewport={{ once: true, amount: 0.35 }} transition={{ duration: reduced ? 0 : 0.6 }} className="mt-12 overflow-hidden rounded-[24px] border border-white/10">
          {comparisonRows.map(([left, right], index) => (
            <motion.div
              key={left}
              initial={false}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: reduced ? 0 : 0.3, delay: reduced ? 0 : index * 0.06 }}
              className="grid border-b border-white/10 last:border-b-0 md:grid-cols-[.9fr_auto_1.1fr]"
            >
              <p className="bg-[#0c0e0d] p-5 text-sm leading-6 text-white/44 sm:p-6">
                {left}
              </p>
              <div
                aria-hidden
                className="hidden items-center justify-center bg-[#101312] px-5 text-[#c6b48b] md:flex"
              >
                →
              </div>
              <p className="bg-[#141916] p-5 text-sm leading-6 text-white/78 sm:p-6">
                <span className="mr-2 font-mono text-[10px] text-[#c6b48b]">
                  0{index + 1}
                </span>
                {right}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
