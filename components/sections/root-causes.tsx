'use client'

import { motion } from 'framer-motion'
import { GlassCard } from '@/components/ui/glass-card'

const rootCauses = [
  {
    title: 'Résistance à l\'Insuline',
    description: 'Anomalie métabolique : stockage prioritaire au lieu de mobilisation lipidique. Requiert une restauration métabolique ciblée avant toute intensification.'
  },
  {
    title: 'Dysfonction HPA (Cortisol)',
    description: 'Le stress chronique qui sabote votre métabolisme et votre sommeil.'
  },
  {
    title: 'Thyroïde Subclinique',
    description: 'Hypométabolisme détecté : réduction de la dépense énergétique de repos. Rendre chaque effort inefficace sans restauration préalable.'
  },
  {
    title: 'Inflammation Chronique',
    description: 'Barrière intestinale altérée (dysbiose) : bloque la récupération et limite l\'efficacité des protocoles de restauration métabolique.'
  }
]

export function RootCausesSection() {
  return (
    <section className="relative py-12 md:py-16 lg:py-24 bg-[#EDF3F7]">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl font-heading font-extralight text-white mb-6">
            Identifiez ce qui vous freine réellement
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {rootCauses.map((cause, i) => (
            <GlassCard
              key={i}
              glassLevel="medium"
              depth={3}
              withGlow={true}
              animation="scale"
              delay={i * 0.1}
              className="hover:scale-105 transition-transform duration-500"
            >
              <div className="space-y-4">
                <h3 className="text-2xl font-heading font-light text-white">
                  {cause.title}
                </h3>
                <p className="text-base font-extralight text-white/70 leading-relaxed">
                  {cause.description}
                </p>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>
    </section>
  )
}








