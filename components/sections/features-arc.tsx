'use client'

import { motion } from 'framer-motion'
import { GlassCard } from '@/components/ui/glass-card'
import Link from 'next/link'
import { ArrowRight, Heart, Activity, Brain, RefreshCw } from 'lucide-react'

const features = [
  {
    title: 'Prédicteur de risques',
    description: 'Détecte les risques avant qu\'ils ne deviennent des problèmes',
    image: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=400&q=80',
    icon: Heart,
    rotation: -8
  },
  {
    title: 'Suivi des habitudes',
    image: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=400&q=80',
    icon: Activity,
    rotation: -4
  },
  {
    title: 'Constructeur de protocoles',
    image: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400&q=80',
    icon: Brain,
    rotation: 4
  },
  {
    title: 'Hub de synchronisation',
    image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&q=80',
    icon: RefreshCw,
    rotation: 8
  }
]

export function FeaturesArc() {
  return (
    <section className="relative py-12 md:py-16 lg:py-24 bg-[#EDF3F7] overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="text-xs font-sans font-normal uppercase tracking-widest text-[#2D5168] mb-4">• CE QUI EST DANS STRYV lab</p>
          <h2 className="text-5xl font-heading font-extralight text-[#0F2334] mb-6 leading-tight">
            Conçu pour comprendre votre santé
          </h2>
        </motion.div>

        {/* Cards en arc */}
        <div className="flex flex-wrap justify-center gap-8 items-start relative">
          {features.map((feature, i) => {
            const Icon = feature.icon
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30, rotate: feature.rotation }}
                whileInView={{ opacity: 1, y: 0, rotate: feature.rotation }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
                style={{ transform: `rotate(${feature.rotation}deg)` }}
                className="hover:scale-105 transition-transform duration-500"
              >
                <GlassCard
                  glassLevel="medium"
                  depth={3}
                  withGlow={false}
                  className="w-64 h-80 overflow-hidden group cursor-pointer relative bg-white/10 backdrop-blur-lg"
                >
                  {/* Background image */}
                  <div 
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: `url(${feature.image})` }}
                  />
                  
                  {/* Glassmorphism overlay */}
                  <div className="absolute inset-0 bg-[rgba(255,255,255,0.08)] backdrop-blur-[16px]" />
                  
                  {/* Content overlay */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 space-y-4">
                    {/* Icon circle */}
                    <div className="w-16 h-16 rounded-full bg-[rgba(255,255,255,0.20)] backdrop-blur-sm border border-[rgba(255,255,255,0.25)] flex items-center justify-center">
                      <Icon className="w-8 h-8 text-[#19D4FF]" />
                    </div>
                    
                    {/* Title */}
                    <h3 className="text-white font-light text-lg text-center">{feature.title}</h3>
                    
                    {/* Description (only for first card) */}
                    {feature.description && (
                      <p className="text-white/70 text-sm text-center font-extralight">
                        {feature.description}
                      </p>
                    )}
                  </div>
                </GlassCard>
              </motion.div>
            )
          })}
        </div>

        {/* CTA Button */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="flex justify-center mt-16"
        >
          <Link
            href="/genesis-era"
            className="group inline-flex items-center gap-3 bg-gradient-to-r from-[#19D4FF] via-[#0FA8CC] to-[#0B8FA8] hover:from-[#0FA8CC] hover:via-[#0B8FA8] hover:to-[#19D4FF] text-white px-8 py-4 rounded-button text-base font-normal transition-all duration-300 hover:shadow-light"
          >
            Commencer votre parcours
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </motion.div>
      </div>
    </section>
  )
}








