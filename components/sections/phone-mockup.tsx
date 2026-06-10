'use client'

import { motion } from 'framer-motion'
import { GlassCard } from '@/components/ui/glass-card'
import { Activity, Heart, Zap } from 'lucide-react'

const bubbleFeatures = [
  { id: 1, label: 'Adaptation des routines quotidiennes', active: false, icon: Activity },
  { id: 2, label: 'Détection de changements subtils', active: true, icon: Heart },
  { id: 3, label: 'Personnalisation des conseils', active: false, icon: Zap },
  { id: 4, label: 'Apprentissage de vos habitudes', active: false, icon: Activity },
]

export function PhoneMockup() {
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
          <p className="text-xs font-sans font-normal uppercase tracking-widest text-[#2D5168] mb-4">• POURQUOI STRYV lab</p>
          <h2 className="text-5xl font-heading font-extralight text-[#0F2334] mb-6 leading-tight">
            Des conseils de santé aussi <br />uniques que vous
          </h2>
          <p className="text-lg font-light text-[#2D5168] mt-8">
            Vraiment personnalisé, construit autour de vous
          </p>
        </motion.div>

        <div className="relative">
          {/* Phone Mockup central */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="relative z-10 flex justify-center mb-12"
          >
            <div className="w-64 h-[500px] bg-[#0F2334] rounded-container border-8 border-[#0F2334] shadow-soft p-2">
              <div className="w-full h-full bg-gradient-to-br from-transparent to-transparent rounded-card overflow-hidden p-6 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="text-white/60 text-xs">15:45</div>
                  <div className="flex gap-1">
                    <div className="w-1 h-1 rounded-full bg-white/60" />
                    <div className="w-1 h-1 rounded-full bg-white/60" />
                    <div className="w-1 h-1 rounded-full bg-white/60" />
                  </div>
                </div>
                
                {/* Content */}
                <div className="flex-1 flex flex-col items-center justify-center space-y-6">
                  <div className="text-left w-full">
                    <p className="text-white/60 text-xs mb-1">Bonjour ! Noële Floren</p>
                    <p className="text-white text-sm font-medium">Score d'amélioration de la santé</p>
                  </div>
                  
                  {/* Circular progress */}
                  <div className="relative w-32 h-32">
                    <svg className="transform -rotate-90 w-32 h-32">
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        stroke="rgba(255,255,255,0.2)"
                        strokeWidth="8"
                        fill="none"
                      />
                      <motion.circle
                        cx="64"
                        cy="64"
                        r="56"
                        stroke="#19D4FF"
                        strokeWidth="8"
                        fill="none"
                        strokeDasharray={`${2 * Math.PI * 56}`}
                        strokeDashoffset={`${2 * Math.PI * 56 * 0.2}`}
                        initial={{ strokeDashoffset: 2 * Math.PI * 56 }}
                        animate={{ strokeDashoffset: 2 * Math.PI * 56 * 0.2 }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <p className="text-3xl font-bold text-white">80%</p>
                        <p className="text-xs text-white/60">Continuez ! Vie saine.</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Footer metrics */}
                  <div className="grid grid-cols-3 gap-2 w-full">
                    {[6500, 8, 320].map((value, i) => (
                      <div key={i} className="bg-[rgba(255,255,255,0.08)] rounded-card p-2 text-center">
                        <p className="text-xs text-white/60">{['Pas', 'Heures', 'Cal'][i]}</p>
                        <p className="text-sm font-medium text-white">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Bubble Cards en arc autour du phone */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-full h-full">
              {bubbleFeatures.map((feature, i) => {
                const Icon = feature.icon
                const angle = (i * 90) - 45 // Arc de -45° à 45°
                const radius = 280
                const x = Math.cos((angle * Math.PI) / 180) * radius
                const y = Math.sin((angle * Math.PI) / 180) * radius - 50
                
                return (
                  <motion.div
                    key={feature.id}
                    className="absolute"
                    style={{
                      left: `calc(50% + ${x}px)`,
                      top: `calc(50% + ${y}px)`,
                      transform: 'translate(-50%, -50%)'
                    }}
                    initial={{ opacity: 0, scale: 0 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: i * 0.1 }}
                  >
                    <GlassCard
                      glassLevel={feature.active ? "medium" : "light"}
                      depth={feature.active ? 4 : 2}
                      withGlow={feature.active}
                      className={`w-56 h-28 rounded-full flex items-center gap-3 px-6 cursor-pointer transition-all bg-[rgba(255,255,255,0.08)] backdrop-blur-[16px] ${
                        feature.active 
                          ? 'border-2 border-[#19D4FF] shadow-light' 
                          : 'border border-[rgba(255,255,255,0.25)]'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        feature.active 
                          ? 'bg-blue-500/20' 
                          : 'bg-white/10'
                      }`}>
                        <Icon className={`w-5 h-5 ${
                          feature.active 
                            ? 'text-blue-500' 
                            : 'text-gray-400'
                        }`} />
                      </div>
                      <span className={`text-sm font-light ${
                        feature.active 
                          ? 'text-blue-500' 
                          : 'text-gray-400'
                      }`}>
                        {feature.label}
                      </span>
                    </GlassCard>
                  </motion.div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}








