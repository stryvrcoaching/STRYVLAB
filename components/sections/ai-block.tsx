'use client';

import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

export function AiBlock() {
  return (
    <section className="relative py-12 md:py-16 lg:py-24 bg-gradient-to-b from-[#B5D5E7] to-[#7FB3CE] overflow-hidden">
      <div className="max-w-xl mx-auto px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="bg-[rgba(255,255,255,0.08)] backdrop-blur-[16px] p-10 border border-[rgba(255,255,255,0.18)] rounded-container shadow-soft"
        >
          <h2 className="text-xl md:text-2xl font-heading font-medium text-white mb-6">
            Génération intelligente du plan
          </h2>

          <p className="text-sm md:text-base font-sans font-normal text-white/90 mb-8 leading-relaxed">
            Notre IA analyse 358 variables pour prédire votre capacité réelle à tenir un protocole.
          </p>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="group inline-flex items-center gap-2 px-6 py-3 rounded-button bg-white text-[#0F2334] font-sans font-medium transition-all duration-300 hover:shadow-light"
          >
            Générer mon Plan Genesis
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </motion.button>
        </motion.div>
      </div>
    </section>
  );
}








