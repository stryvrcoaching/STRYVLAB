'use client'

import { motion } from 'framer-motion'
import { GlassCard } from '@/components/ui/glass-card'
import { Check, Loader2, Zap } from 'lucide-react'

const steps = [
  { id: 1, label: 'Connecter vos données', active: false },
  { id: 2, label: 'IA analyse', active: true },
  { id: 3, label: 'Obtenir votre protocole', active: false },
  { id: 4, label: 'Suivre & améliorer', active: false }
]

const analysisItems = [
  { label: 'Biomarqueurs analysés', status: 'completed', value: '847 points de données', icon: Check },
  { label: 'Modèles d\'activité', status: 'completed', value: '30 jours', icon: Check },
  { label: 'Tendances nutritionnelles', status: 'processing', value: 'Traitement...', icon: Loader2 },
  { label: 'Calcul des risques', status: 'processing', value: 'Traitement...', icon: Loader2 },
]

export function AnalyzeMedisync() {
  return (
    <section className="relative py-12 md:py-16 lg:py-24 bg-gradient-to-br from-[#2D5168] to-[#0F2334] overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 backdrop-blur-[64px] bg-[rgba(15,35,52,0.5)]" />
      
      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8">
        {/* Stepper horizontal */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <div className="flex items-center justify-center gap-2 max-w-4xl mx-auto">
            {steps.map((step, i) => (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-14 h-14 rounded-card flex items-center justify-center text-sm font-medium transition-all ${
                    step.active 
                      ? 'bg-[rgba(255,255,255,0.30)] backdrop-blur-[16px] text-white shadow-light border-2 border-[rgba(255,255,255,0.50)]' 
                      : 'bg-[rgba(255,255,255,0.10)] backdrop-blur-sm text-white/60 border border-[rgba(255,255,255,0.25)]'
                  }`}>
                    {String(step.id).padStart(2, '0')}
                  </div>
                  <span className={`text-xs mt-3 text-center font-light ${
                    step.active ? 'text-white font-medium' : 'text-white/60'
                  }`}>
                    {step.label}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-4 ${
                    step.active ? 'bg-white/40' : 'bg-white/20'
                  }`} style={{ borderStyle: 'dashed' }} />
                )}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Grande Glass Card */}
        <GlassCard
          glassLevel="strong"
          depth={5}
          withGlow={true}
          animation="scale"
          className="max-w-4xl mx-auto bg-white/10 backdrop-blur-xl border border-[rgba(255,255,255,0.25)]"
        >
          <div className="space-y-8 p-8">
            <div>
              <p className="text-xs font-light uppercase tracking-widest text-white/60 mb-2">ANALYSANT VOS DONNÉES DE SANTÉ...</p>
            </div>

            <div className="space-y-6">
              {analysisItems.map((item, i) => {
                const Icon = item.icon
                return (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Icon 
                        className={`w-5 h-5 ${
                          item.status === 'completed' 
                            ? 'text-[#37E6A5]' 
                            : 'text-white/60'
                        }`}
                        style={item.status === 'processing' ? { animation: 'spin 2s linear infinite' } : {}}
                      />
                      <span className="text-white/90 text-sm font-light">{item.label}</span>
                    </div>
                    <span className={`text-sm font-light ${
                      item.status === 'completed' 
                        ? 'text-white' 
                        : 'text-white/60'
                    }`}>
                      {item.value}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Progress bars */}
            <div className="pt-4 border-t border-[rgba(255,255,255,0.25)]">
              <div className="flex gap-1">
                {Array.from({ length: 20 }).map((_, i) => (
                  <motion.div
                    key={i}
                    className={`h-2 flex-1 rounded ${
                      i < 16 ? 'bg-white' : 'bg-white/20'
                    }`}
                    initial={{ opacity: 0, scaleY: 0 }}
                    whileInView={{ opacity: 1, scaleY: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: i * 0.02 }}
                  />
                ))}
              </div>
            </div>

            {/* Button */}
            <div className="flex justify-center pt-4">
              <button className="px-6 py-3 bg-white text-[#0F2334] rounded-card font-medium text-sm flex items-center gap-2 shadow-light hover:shadow-soft transition-all">
                <Zap className="w-4 h-4" />
                80% Analyse
              </button>
            </div>
          </div>
        </GlassCard>

        {/* Descriptive text */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-16 text-center max-w-3xl mx-auto"
        >
          <p className="text-xl md:text-2xl font-light text-white/90 leading-relaxed mb-4">
            Notre IA analyse vos données de santé des biomarqueurs aux habitudes quotidiennes, et fournit un score de santé clair, des insights sur les risques, et des opportunités personnalisées d'amélioration.
          </p>
          <p className="text-xs font-medium uppercase tracking-widest text-white/60">• COMMENT ÇA MARCHE</p>
        </motion.div>
      </div>
    </section>
  )
}








