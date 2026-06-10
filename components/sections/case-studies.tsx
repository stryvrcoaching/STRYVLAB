'use client'

import { motion } from 'framer-motion'
import { GlassCard } from '@/components/ui/glass-card'

const cases = [
  {
    name: 'Marc',
    profile: 'Profil Androïde / Métabolique Challenge',
    whr: '1.03',
    whrStatus: 'Critique',
    diagnostic: 'Résistance à l\'insuline probable, risque métabolique maximal',
    strategy: 'Priorité à la restauration métabolique (cyclage glucidique contrôlé) avant toute intensification'
  },
  {
    name: 'Sophie',
    profile: 'Profil Ectomorphe / Adhérence Favorable',
    ffmi: '16.2',
    whr: '0.71',
    whrStatus: 'Protecteur',
    diagnostic: 'Potentiel de gain musculaire énorme (+10kg théoriques) avec un risque métabolique faible',
    strategy: 'Surplus calorique agressif et haute fréquence d\'entraînement'
  }
]

export function CaseStudiesSection() {
  return (
    <section className="relative py-12 md:py-16 lg:py-24 bg-gradient-to-br from-[#2D5168] to-[#0F2334]">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl font-heading font-extralight text-white mb-6">
            Études de Cas Forensiques
          </h2>
          <p className="text-lg font-extralight text-white/60 max-w-2xl mx-auto">
            Diagnostics précis basés sur des données mesurables, pas sur des suppositions
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {cases.map((c, i) => (
            <GlassCard
              key={i}
              glassLevel="medium"
              depth={4}
              withGlow={true}
              animation="slide"
              delay={i * 0.2}
            >
              <div className="space-y-6">
                <div>
                  <h3 className="text-3xl font-heading font-light text-white mb-2">Cas #{i + 1} : {c.name}</h3>
                  <p className="text-sm font-light text-[#19D4FF]">{c.profile}</p>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-white/80 uppercase tracking-wider">Données :</h4>
                  <div className="flex gap-4">
                    {c.whr && (
                      <div className="flex-1">
                        <div className="text-2xl font-heading font-light text-[#19D4FF]">WHR = {c.whr}</div>
                        <div className={`text-xs font-medium mt-1 ${c.whrStatus === 'Critique' ? 'text-red-500' : 'text-green-500'}`}>
                          {c.whrStatus}
                        </div>
                      </div>
                    )}
                    {c.ffmi && (
                      <div className="flex-1">
                        <div className="text-2xl font-heading font-light text-[#19D4FF]">FFMI = {c.ffmi}</div>
                        <div className="text-xs font-medium mt-1 text-white/60">
                          Sous-développé
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-white/80 uppercase tracking-wider">Diagnostic :</h4>
                  <p className="text-sm font-extralight text-white/70 leading-relaxed">
                    {c.diagnostic}
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-white/80 uppercase tracking-wider">Stratégie Genesis :</h4>
                  <p className="text-sm font-extralight text-white/70 leading-relaxed">
                    {c.strategy}
                  </p>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>
    </section>
  )
}








