'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

export function GenesisHero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Image avec Overlay */}
      <div className="absolute inset-0 z-0">
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: 'url("https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80")',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/60 to-black/80" />
      </div>

      {/* Contenu */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12 lg:px-24 py-12 md:py-16 lg:py-24 text-center">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-8"
        >
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-xs font-bold uppercase tracking-widest text-white/60 mb-4"
          >
            Analyse Forensique & Coaching 3.0
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="text-6xl md:text-7xl lg:text-8xl font-bold text-white tracking-tighter leading-none"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            Moteur d'analyse forensique<br />
            et coaching 3.0
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="text-xl md:text-2xl text-white/80 leading-relaxed max-w-3xl mx-auto"
          >
            L'Indice IPT évalue si votre transformation est biologiquement possible avant même de tenter de la provoquer.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="flex flex-col md:flex-row gap-4 justify-center mt-12"
          >
            <Link
              href="/ipt-choice"
              className="inline-flex items-center gap-2 bg-white text-black px-8 py-4 rounded-full font-semibold text-base transition-all hover:bg-white/90 hover:scale-105"
            >
              Démarrer l'analyse
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
            <Link
              href="#science"
              className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-[rgba(255,255,255,0.25)] text-white px-8 py-4 rounded-full font-semibold text-base transition-all hover:bg-white/20"
            >
              Explorer la science
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}












