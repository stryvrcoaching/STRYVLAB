'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { GlassCard } from '@/components/ui/glass-card'
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

const faqs = [
  {
    question: 'Qu\'est-ce que Genesis ?',
    answer: 'Genesis est une plateforme de santé complète qui combine des analyses avancées, des conseils personnalisés et un suivi en temps réel pour vous aider à atteindre des résultats de santé optimaux grâce à des insights basés sur les données.'
  },
  {
    question: 'Comment fonctionne l\'analyse de santé ?',
    answer: 'Notre plateforme utilise des algorithmes avancés pour analyser vos données de santé provenant de diverses sources, fournissant des insights personnalisés et des recommandations basées sur votre profil de santé unique.'
  },
  {
    question: 'Mes données sont-elles sécurisées ?',
    answer: 'Oui, nous utilisons un chiffrement de pointe et des mesures de sécurité pour protéger vos données de santé. Votre confidentialité est notre priorité absolue.'
  },
  {
    question: 'Puis-je synchroniser plusieurs appareils ?',
    answer: 'Absolument ! Genesis prend en charge la synchronisation sur tous vos appareils, garantissant que vos données de santé sont toujours à jour où que vous soyez.'
  }
]

export function FAQAccordion() {
  const [openIndex, setOpenIndex] = useState(0)

  return (
    <section className="relative py-12 md:py-16 lg:py-24 bg-[#EDF3F7]">
      <div className="max-w-4xl mx-auto px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="text-xs font-sans font-normal uppercase tracking-widest text-[#2D5168] mb-4">• FAQ</p>
          <h2 className="text-5xl font-heading font-extralight text-[#0F2334] mb-6 leading-tight">
            Tout ce que vous devez savoir
          </h2>
        </motion.div>

        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <GlassCard
              key={i}
              glassLevel="light"
              depth={3}
              withGlow={false}
              animation="slide"
              delay={i * 0.1}
              className="cursor-pointer bg-[rgba(255,255,255,0.08)] backdrop-blur-[16px] border border-[rgba(255,255,255,0.18)]"
              onClick={() => setOpenIndex(openIndex === i ? -1 : i)}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-[#0F2334] pr-8">
                    {faq.question}
                  </h3>
                  <motion.div
                    animate={{ rotate: openIndex === i ? 180 : 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex-shrink-0"
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      openIndex === i 
                        ? 'bg-gray-100 border border-[#19D4FF]' 
                        : 'bg-gray-100'
                    }`}>
                      <ChevronDown 
                        className={`w-4 h-4 ${
                          openIndex === i 
                            ? 'text-[#19D4FF]' 
                            : 'text-[#2D5168]'
                        }`} 
                      />
                    </div>
                  </motion.div>
                </div>
                
                <AnimatePresence>
                  {openIndex === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <p className="text-base font-light text-[#0F2334] leading-relaxed pt-2">
                        {faq.answer}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>
    </section>
  )
}








