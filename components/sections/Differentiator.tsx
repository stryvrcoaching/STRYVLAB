'use client';

import { motion } from 'framer-motion';

export function Differentiator() {
  return (
    <section 
      className="py-24 px-6 md:px-12 lg:px-24 relative"
      style={{
        background: 'var(--gray-900)',
      }}
    >
      <div className="container mx-auto max-w-7xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          {/* Left Column */}
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 
              className="text-3xl font-heading font-light mb-8"
              style={{
                fontFamily: 'var(--font-deep-tech-body)',
                fontWeight: 200,
                color: 'var(--titanium-white)',
              }}
            >
              Pourquoi certains réussissent… et d'autres jamais
            </h2>
          </motion.div>

          {/* Right Column */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-6"
          >
            <p 
              className="text-lg leading-relaxed"
              style={{
                fontFamily: 'var(--font-deep-tech-body)',
                color: 'var(--gray-400)',
              }}
            >
              Deux personnes peuvent suivre le même protocole.
            </p>
            <p 
              className="text-lg leading-relaxed"
              style={{
                fontFamily: 'var(--font-deep-tech-body)',
                color: 'var(--gray-400)',
              }}
            >
              L'une progresse. L'autre stagne, se fatigue, puis abandonne.
            </p>
            <p 
              className="text-lg leading-relaxed"
              style={{
                fontFamily: 'var(--font-deep-tech-body)',
                color: 'var(--gray-400)',
              }}
            >
              La différence n'est ni la discipline, ni la motivation.
            </p>
            <p 
              className="text-lg leading-relaxed"
              style={{
                fontFamily: 'var(--font-deep-tech-body)',
                color: 'var(--electric-emerald)',
                fontWeight: 400,
              }}
            >
              C'est leur Indice de Potentiel de Transformation.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}











