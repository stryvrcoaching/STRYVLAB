'use client'

import { motion } from 'framer-motion'
import { GlassCard } from '@/components/ui/glass-card'

const faqs = [
  {
    question: 'L\'IPT est-il une mesure de ma volonté ?',
    answer: 'Absolument pas. L\'IPT est une capacité structurelle mesurable, pas une question d\'adhérence structurelle ou de morale.'
  },
  {
    question: 'Comment Genesis analyse-t-il mon métabolisme sans prise de sang ?',
    answer: 'Nous utilisons des "proxies cliniques" (marqueurs physiques et comportementaux) validés par la littérature scientifique pour estimer votre état biochimique.'
  },
  {
    question: 'Et si mon IPT est bas ?',
    answer: 'Dans ce cas, la stratégie n\'est pas d\'accélérer, mais de restaurer votre capacité à transformer avant d\'intensifier le protocole.'
  }
]

export function FAQSection() {
  return (
    <section className="relative py-12 md:py-16 lg:py-24 bg-gradient-to-br from-[#2D5168] to-[#0F2334]">
      <div className="max-w-4xl mx-auto px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl font-heading font-extralight text-white mb-6">
            Questions fréquentes
          </h2>
        </motion.div>

        <div className="space-y-6">
          {faqs.map((faq, i) => (
            <GlassCard
              key={i}
              glassLevel="medium"
              depth={3}
              withGlow={false}
              animation="slide"
              delay={i * 0.1}
            >
              <div className="space-y-3">
                <h3 className="text-xl font-light text-white">
                  {faq.question}
                </h3>
                <p className="text-base font-extralight text-white/70 leading-relaxed">
                  {faq.answer}
                </p>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>
    </section>
  )
}








