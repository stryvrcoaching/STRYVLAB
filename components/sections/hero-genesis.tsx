'use client'

import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'
import Link from 'next/link'
import { GlassCard } from '@/components/ui/glass-card'
import { Button } from '@/components/ui/Button'

/**
 * HERO SECTION - Medical Grade Design
 * 
 * Features implémentées (Medisync-level):
 * ✓ Parallax multi-layer
 * ✓ Glassmorphism cards flottantes
 * ✓ Animations orchestrées (stagger)
 * ✓ Gradient backgrounds animés
 * ✓ Micro-interactions sur hover
 * ✓ Typographie golden ratio
 * ✓ Spacing vertical massif (12rem)
 */

export function HeroGenesis() {
  const containerRef = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"]
  })

  // Parallax transforms
  const y1 = useTransform(scrollYProgress, [0, 1], [0, -50])
  const y2 = useTransform(scrollYProgress, [0, 1], [0, -100])
  const y3 = useTransform(scrollYProgress, [0, 1], [0, -150])
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0])

  // Stagger animation config
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.12,
        delayChildren: 0.3,
      }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.8,
        type: "spring" as const,
        stiffness: 100,
        damping: 15
      }
    }
  }

  return (
    <section 
      ref={containerRef}
      className="relative min-h-screen overflow-hidden bg-[#EDF3F7]"
    >
      {/* Background gradient animé */}
      <div className="absolute inset-0 bg-gradient-medical" />
      
      {/* Gradient spots animés */}
      <motion.div 
        className="absolute top-0 right-0 w-[800px] h-[800px] bg-[#19D4FF]/20 rounded-full blur-3xl"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.2, 0.3, 0.2],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      
      <motion.div 
        className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-[#19D4FF]/10 rounded-full blur-3xl"
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.1, 0.2, 0.1],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2
        }}
      />

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:100px_100px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,black,transparent)]" />

      {/* Content container */}
      <motion.div 
        className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 pt-32 pb-48"
        style={{ opacity }}
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Eyebrow */}
        <motion.div 
          className="flex justify-center mb-8"
          variants={itemVariants}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[rgba(255,255,255,0.10)] backdrop-blur-sm border border-[#19D4FF]/30">
            <div className="w-2 h-2 rounded-full bg-[#19D4FF] animate-pulse" />
            <span className="text-xs font-light text-[#19D4FF] uppercase tracking-wider">
              Laboratoire de Recherche & Développement
            </span>
          </div>
        </motion.div>

        {/* Main headline */}
        <motion.div 
          className="text-center mb-12 space-y-6"
          style={{ y: y1 }}
        >
          <motion.h1 
            className="text-6xl font-heading font-extralight tracking-tight text-white leading-[1.1]"
            variants={itemVariants}
          >
            La fin du coaching{' '}
            <span className="block mt-2 bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500 bg-clip-text text-transparent">
              générique
            </span>
          </motion.h1>

          <motion.p 
            className="text-xl md:text-2xl font-extralight text-white/60 max-w-3xl mx-auto leading-relaxed"
            variants={itemVariants}
          >
            Bienvenue dans l'ère de l'optimisation humaine basée sur des données mesurables, pas sur des suppositions.
          </motion.p>
        </motion.div>

        {/* CTA Buttons */}
        <motion.div 
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-24"
          variants={itemVariants}
        >
          <Link 
            href="/ipt-choice"
            className="group relative overflow-hidden bg-[#19D4FF] hover:bg-[#19D4FF] text-[#0F2334] font-medium px-8 py-6 rounded-xl text-lg transition-all duration-300 hover:shadow-glow-md hover:scale-105 inline-block"
          >
            <span className="relative z-10">Calculer mon IPT</span>
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </Link>

          <Button 
            size="lg" 
            variant="secondary"
            className="border-[rgba(255,255,255,0.25)] text-white hover:bg-white/5 backdrop-blur-sm px-8 py-6 rounded-xl text-lg font-light transition-all duration-300 hover:border-[#19D4FF]/50"
          >
            Explorer Genesis Era
          </Button>
        </motion.div>

        {/* Floating cards grid (parallax) */}
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8"
          style={{ y: y2 }}
        >
          {/* Card 1 - Métabolique */}
          <GlassCard
            glassLevel="medium"
            depth={3}
            withGlow={true}
            animation="scale"
            delay={0.4}
            className="group hover:scale-105 transition-transform duration-500"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-[#19D4FF]/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-[#19D4FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              
              <h3 className="text-2xl font-heading font-light text-white">
                Capacité Métabolique
              </h3>
              
              <p className="text-base font-extralight text-white/60 leading-relaxed">
                Analyse des freins "Root Cause" : Insuline, Cortisol, Thyroïde.
              </p>
              
              <div className="pt-4 flex items-center gap-2 text-[#19D4FF] text-sm font-medium">
                <span>30% du score IPT</span>
                <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </GlassCard>

          {/* Card 2 - Infrastructure */}
          <GlassCard
            glassLevel="medium"
            depth={4}
            withGlow={true}
            animation="scale"
            delay={0.5}
            className="group hover:scale-105 transition-transform duration-500 md:translate-y-8"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-[#19D4FF]/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-[#19D4FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              
              <h3 className="text-2xl font-heading font-light text-white">
                Infrastructure
              </h3>
              
              <p className="text-base font-extralight text-white/60 leading-relaxed">
                Audit de vos contraintes réelles : temps, budget et équipement.
              </p>
              
              <div className="pt-4 flex items-center gap-2 text-[#19D4FF] text-sm font-medium">
                <span>25% du score IPT</span>
                <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </GlassCard>

          {/* Card 3 - Psychologie */}
          <GlassCard
            glassLevel="medium"
            depth={3}
            withGlow={true}
            animation="scale"
            delay={0.6}
            className="group hover:scale-105 transition-transform duration-500"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-[#19D4FF]/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-[#19D4FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              
              <h3 className="text-2xl font-heading font-light text-white">
                Psychologie
              </h3>
              
              <p className="text-base font-extralight text-white/60 leading-relaxed">
                Le prédicteur n°1 du succès (r=0.57). Locus de contrôle et auto-efficacité.
              </p>
              
              <div className="pt-4 flex items-center gap-2 text-[#19D4FF] text-sm font-medium">
                <span>20% du score IPT</span>
                <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </GlassCard>
        </motion.div>

        {/* Stats bar (extra parallax layer) */}
        <motion.div 
          className="mt-24 grid grid-cols-3 gap-8"
          style={{ y: y3 }}
        >
          {[
            { value: '350+', label: 'Points de données' },
            { value: '300+', label: 'Études scientifiques' },
            { value: '50+', label: 'Clients transformés' },
          ].map((stat, i) => (
            <motion.div
              key={i}
              className="text-center space-y-2"
              variants={itemVariants}
            >
              <div className="text-4xl font-heading font-extralight text-[#19D4FF]">
                {stat.value}
              </div>
              <div className="text-sm font-light text-white/50 uppercase tracking-wider">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Scroll indicator */}
        <motion.div 
          className="absolute bottom-12 left-1/2 -translate-x-1/2"
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="w-6 h-10 rounded-full border-2 border-[rgba(255,255,255,0.25)] flex items-start justify-center p-2">
            <motion.div 
              className="w-1.5 h-1.5 rounded-full bg-[#19D4FF]"
              animate={{ y: [0, 12, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>
        </motion.div>
      </motion.div>
    </section>
  )
}

/**
 * USAGE:
 * 
 * import { HeroGenesis } from '@/app/components/sections/hero-genesis'
 * 
 * export default function HomePage() {
 *   return (
 *     <>
 *       <HeroGenesis />
 *     </>
 *   )
 * }
 */





