'use client'

import { motion } from 'framer-motion'
import { GlassCard } from '@/components/ui/glass-card'
import { Check, Circle } from 'lucide-react'

const guidanceItems = [
  {
    title: 'Visez un coucher plus tôt ce soir',
    description: 'Un meilleur timing de sommeil peut améliorer la récupération et la concentration demain.',
    active: false
  },
  {
    title: 'Gardez votre routine quotidienne cohérente',
    description: 'La cohérence soutient les modèles de santé à long terme.',
    active: false
  },
  {
    title: 'Buvez 2 litres d\'eau aujourd\'hui',
    description: 'L\'eau aide à améliorer votre métabolisme quotidiennement.',
    active: true
  }
]

export function IntelligentGuidance() {
  return (
    <section className="relative py-12 md:py-16 lg:py-24 bg-[#EDF3F7]">
      <div className="max-w-4xl mx-auto px-6 lg:px-8">
        <GlassCard
          glassLevel="light"
          depth={3}
          withGlow={false}
          className="bg-[rgba(255,255,255,0.08)] backdrop-blur-[16px] border border-[rgba(255,255,255,0.18)]"
        >
          <div className="p-8 space-y-4">
            {guidanceItems.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className={`p-4 rounded-card border transition-all ${
                  item.active
                    ? 'bg-transparent border-transparent'
                    : 'bg-[rgba(255,255,255,0.08)] border-[rgba(255,255,255,0.18)]'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-1 ${
                    item.active ? 'text-[#19D4FF]' : 'text-[#2D5168]'
                  }`}>
                    {item.active ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      <Circle className="w-5 h-5" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className={`font-medium mb-1 ${
                      item.active ? 'text-[#0F2334]' : 'text-[#2D5168]'
                    }`}>
                      {item.title}
                    </h3>
                    <p className={`text-sm ${
                      item.active ? 'text-[#2D5168]' : 'text-[#2D5168]'
                    }`}>
                      {item.description}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
            
            <p className="text-center text-[#19D4FF] font-light text-lg mt-8">Conseils intelligents</p>
          </div>
        </GlassCard>
      </div>
    </section>
  )
}








