'use client'

import { motion } from 'framer-motion'
import { GlassCard } from '@/components/ui/glass-card'
import Link from 'next/link'
import { Dna, BarChart3, RefreshCw, HeartPulse, Droplet, Dumbbell } from 'lucide-react'

const instruments = [
  {
    icon: Dna,
    title: 'Calculateur de Macronutriments',
    description: 'Formule Mifflin-St Jeor pour déterminer vos besoins caloriques et macro structurels',
    href: '/outils/macros'
  },
  {
    icon: BarChart3,
    title: 'Taux de Masse Grasse',
    description: 'Méthode US Navy pour l\'estimation de composition corporelle',
    href: '/outils/body-fat'
  },
  {
    icon: RefreshCw,
    title: 'Cyclage Glucidique',
    description: 'Protocoles de restauration métabolique via redistribution glucidique',
    href: '/outils/carb-cycling'
  },
  {
    icon: HeartPulse,
    title: 'Zones Cardiaques',
    description: 'Méthode Karvonen pour l\'optimisation de l\'intensité d\'entraînement',
    href: '/outils/hr-zones'
  },
  {
    icon: Droplet,
    title: 'Hydratation Optimale',
    description: 'Calcul de besoins hydriques selon activité et environnement',
    href: '/outils/hydratation'
  },
  {
    icon: Dumbbell,
    title: 'Estimation 1RM',
    description: 'Formule Brzycki pour la prédiction de force maximale',
    href: '/outils/1rm'
  }
]

export function InstrumentsSection() {
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
          <p className="text-sm font-light text-[#19D4FF] uppercase tracking-wider mb-4">
            Instruments de Mesure
          </p>
          <h2 className="text-4xl font-heading font-extralight text-white mb-6">
            Suite d'outils scientifiques
          </h2>
          <p className="text-lg font-extralight text-white/60 max-w-2xl mx-auto">
            Développés par STRYV lab pour l'évaluation quantitative de votre biologie
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {instruments.map((instrument, i) => (
            <Link key={i} href={instrument.href}>
              <GlassCard
                glassLevel="medium"
                depth={3}
                withGlow={true}
                animation="scale"
                delay={i * 0.1}
                className="group hover:scale-105 transition-all duration-500 cursor-pointer h-full"
              >
                <div className="space-y-4">
                  <div>
                    <instrument.icon className="w-10 h-10 text-[#19D4FF]" />
                  </div>
                  <h3 className="text-xl font-light text-white group-hover:text-[#19D4FF] transition-colors">
                    {instrument.title}
                  </h3>
                  <p className="text-sm font-extralight text-white/60 leading-relaxed">
                    {instrument.description}
                  </p>
                  <div className="flex items-center gap-2 text-[#19D4FF] text-sm font-medium pt-2">
                    <span>Accéder</span>
                    <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </GlassCard>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}






