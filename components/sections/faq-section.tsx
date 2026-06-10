'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { GlassCard } from '@/components/ui/glass-card';

const data = [
  {
    question: 'Comment Genesis analyse mon métabolisme ?',
    answer: 'Genesis utilise une analyse forensique de 350+ variables issues de votre biologie, psychologie et environnement. Notre IA croise ces données pour identifier les freins structurels à votre transformation et prédire votre capacité réelle de changement.',
  },
  {
    question: 'Dois-je faire une prise de sang ?',
    answer: 'Non, Genesis fonctionne sans prise de sang. Nous analysons vos habitudes, contraintes, infrastructure et historique pour identifier les freins métaboliques. Une prise de sang peut être recommandée dans certains cas pour affiner le diagnostic.',
  },
  {
    question: "Qu'est-ce que l'IPT ?",
    answer: "L'Indice de Potentiel de Transformation (IPT) est un score de 0 à 100 qui évalue si votre transformation est biologiquement et comportementalement possible. Il mesure 5 piliers : capacité métabolique, infrastructure, psychologie, physiologie et adhérence.",
  },
  {
    question: 'Que mesure exactement le Body System ?',
    answer: 'Le Body System analyse votre composition corporelle, votre métabolisme de base, vos besoins énergétiques et votre capacité de récupération. Il identifie les déséquilibres structurels qui limitent vos résultats.',
  },
];

export function FaqSection() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq" className="relative py-12 md:py-16 lg:py-24 bg-[#EDF3F7]">
      <div className="max-w-3xl mx-auto px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <p className="text-xs font-sans font-normal uppercase tracking-widest text-[#2D5168] mb-4">• FAQ</p>
          <h2 className="text-3xl md:text-4xl font-heading font-extralight text-[#0F2334] mb-6 leading-tight">
            Tout ce que vous devez savoir
          </h2>
        </motion.div>

        <div className="space-y-4">
          {data.map((item, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
            >
              <GlassCard
                glassLevel="light"
                depth={2}
                withGlow={false}
                className="border border-[rgba(255,255,255,0.18)]"
              >
                <button
                  className="flex justify-between items-center w-full text-left"
                  onClick={() => setOpen(open === idx ? null : idx)}
                >
                  <span className="text-base md:text-lg font-heading font-medium text-[#0F2334] pr-8">
                    {item.question}
                  </span>
                  <motion.div
                    animate={{ rotate: open === idx ? 180 : 0 }}
                    transition={{ duration: 0.3 }}
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      open === idx 
                        ? 'bg-transparent border border-transparent' 
                        : 'bg-[rgba(255,255,255,0.10)]'
                    }`}
                  >
                    <ChevronDown 
                      className={`w-4 h-4 ${
                        open === idx 
                          ? 'text-[#19D4FF]' 
                          : 'text-[#2D5168]'
                      }`}
                    />
                  </motion.div>
                </button>

                <AnimatePresence>
                  {open === idx && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <p className="mt-4 text-sm md:text-base font-sans font-normal text-[#2D5168] leading-relaxed pt-2 border-t border-[rgba(255,255,255,0.18)]">
                        {item.answer}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}






