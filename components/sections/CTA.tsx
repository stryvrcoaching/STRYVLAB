'use client';

import { motion } from 'framer-motion';
import { Button } from '../ui/Button';

export function CTA() {
  return (
    <section className="py-24 px-6 md:px-12 lg:px-24 relative overflow-hidden">
      {/* Background: Radial glow emerald center */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle 600px at center, var(--synapse-glow) 0%, transparent 70%)',
        }}
      />

      <div className="container mx-auto max-w-2xl text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="space-y-8"
        >
          <h2 
            className="text-3xl font-heading font-light leading-tight"
            style={{
              fontFamily: 'var(--font-deep-tech-body)',
              fontWeight: 200,
              color: 'var(--titanium-white)',
            }}
          >
            Mesurer mon Indice de Potentiel de Transformation
          </h2>

          <p 
            className="text-lg"
            style={{
              fontFamily: 'var(--font-deep-tech-body)',
              color: 'var(--gray-400)',
            }}
          >
            Genesis ne promet pas la transformation. Il mesure si elle est possible.
          </p>

          <div className="flex flex-col items-center gap-6">
            <Button href="/ipt-choice" variant="primary" size="lg">
              Démarrer l'Analyse IPT →
            </Button>

            <p 
              className="text-sm"
              style={{
                fontFamily: 'var(--font-deep-tech-functional)',
                color: 'var(--gray-500)',
              }}
            >
              Analyse structurée • Aucune promesse • Données requises
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}












