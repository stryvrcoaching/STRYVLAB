'use client';

import { motion } from 'framer-motion';

export function ScientificTruthBanner() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8 }}
      className="py-12 md:py-16 lg:py-24 px-6 bg-black text-white"
    >
      <div className="max-w-5xl mx-auto text-center">
        <motion.h2
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-4xl md:text-5xl font-bold mb-8"
          style={{ letterSpacing: '-0.05em' }}
        >
          Le problème n'est pas l'individu. C'est l'absence de lecture structurelle.
        </motion.h2>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-12 p-8 bg-white/5 rounded-2xl border border-[rgba(255,255,255,0.25)]"
        >
          <p className="text-lg md:text-xl text-gray-300 leading-relaxed mb-4 font-semibold">
            SCIENCE PROOF
          </p>
          <p className="text-lg md:text-xl text-white leading-relaxed mb-6">
            La Psychologie est le prédicteur n°1 du succès ($r=0.57$), surpassant le métabolisme et l'environnement.
          </p>
          <p className="text-base text-gray-400 italic">
            Données issues de 300+ études scientifiques validées par la littérature peer-reviewed
          </p>
        </motion.div>
      </div>
    </motion.section>
  );
}











