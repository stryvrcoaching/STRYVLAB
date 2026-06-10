'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export function StryvLabHero() {
  return (
    <section className="relative min-h-screen flex items-center bg-[#EDF3F7] px-6 md:px-12 lg:px-24 py-12 md:py-16 lg:py-24">
      <div className="max-w-7xl mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-4xl space-y-8"
        >
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-xs font-sans font-normal uppercase tracking-widest text-[#2D5168]"
          >
            LABORATOIRE DE RECHERCHE & DÉVELOPPEMENT
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="text-5xl md:text-6xl lg:text-7xl font-heading font-extralight text-[#0F2334]"
            style={{ letterSpacing: '-0.05em', lineHeight: '1.1' }}
          >
            La fin des suppositions.<br />
            Bienvenue dans l'ère de l'optimisation humaine.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="text-xl md:text-2xl font-sans font-normal text-[#2D5168] leading-relaxed max-w-3xl"
          >
            L'Indice IPT évalue si votre transformation est biologiquement possible avant même de tenter de la provoquer.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="flex flex-col md:flex-row gap-4 mt-12"
          >
            <Link
              href="/genesis-era"
              className="group inline-flex items-center gap-3 bg-gradient-to-r from-[#19D4FF] via-[#0FA8CC] to-[#0B8FA8] hover:from-[#0FA8CC] hover:via-[#0B8FA8] hover:to-[#19D4FF] text-white px-8 py-4 rounded-button font-sans font-medium text-base transition-all duration-300 hover:shadow-light"
            >
              Accéder à Genesis Era
              <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              href="/outils"
              className="inline-flex items-center gap-2 bg-transparent text-[#0F2334] px-8 py-4 rounded-button font-sans font-medium text-base border-2 border-[rgba(255,255,255,0.25)] transition-all hover:bg-[rgba(255,255,255,0.10)]"
            >
              Explorer les outils
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}











