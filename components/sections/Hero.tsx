'use client';

import { motion } from 'framer-motion';
import { IPTVisualization } from '../canvas/IPTVisualization';
import { Button } from '../ui/Button';

export function Hero() {
  return (
    <section className="min-h-screen flex items-center py-24 px-6 md:px-12 lg:px-24 relative overflow-hidden">
      {/* Background: Radial gradient emerald glow top-right */}
      <div 
        className="absolute top-0 right-0 w-1/2 h-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle at top right, var(--synapse-glow) 0%, transparent 70%)',
        }}
      />

      <div className="container mx-auto max-w-7xl grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-16 items-center relative z-10">
        {/* Left Column - Content */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-8"
        >
          {/* Eyebrow */}
          <div className="flex items-center gap-2">
            <span 
              className="w-2 h-2 rounded-full bg-[var(--electric-emerald)]"
              style={{
                animation: 'pulse 2s ease-in-out infinite',
              }}
            />
            <p 
              className="text-sm font-mono uppercase tracking-wider"
              style={{ 
                fontFamily: 'var(--font-deep-tech-functional)',
                color: 'var(--gray-500)',
              }}
            >
              Indice de Potentiel de Transformation
            </p>
          </div>

          {/* Title */}
          <h1 
            className="text-5xl font-heading font-light leading-tight"
            style={{
              fontFamily: 'var(--font-deep-tech-body)',
              fontWeight: 200,
              fontSize: 'clamp(2rem, 7vw, 4.5rem)',
            }}
          >
            Sans connaître votre IPT, toute tentative de transformation est une{' '}
            <strong style={{ fontWeight: 500, color: 'var(--electric-emerald)' }}>
              supposition
            </strong>
            .
          </h1>

          {/* Description */}
          <p 
            className="text-xl text-gray-400 leading-relaxed max-w-2xl"
            style={{
              fontFamily: 'var(--font-deep-tech-body)',
            }}
          >
            L'IPT évalue si une transformation est biologiquement et comportementalement possible, avant même de tenter de la provoquer.
          </p>

          {/* Actions */}
          <div className="flex flex-wrap gap-4">
            <Button href="/ipt-choice" variant="primary" size="lg">
              Mesurer mon Indice IPT →
            </Button>
            <Button href="#ipt-definition" variant="secondary" size="lg">
              Comprendre l'IPT
            </Button>
          </div>
        </motion.div>

        {/* Right Column - Canvas */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center justify-center"
        >
          <div className="w-full max-w-[600px] aspect-square">
            <IPTVisualization />
          </div>
        </motion.div>
      </div>
    </section>
  );
}












