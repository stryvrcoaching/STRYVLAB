'use client';

import { motion } from 'framer-motion';
import { GlassCard } from '@/components/ui/glass-card';

const scores = [
  { label: 'Capacité métabolique', value: 30 },
  { label: 'Infrastructure', value: 25 },
  { label: 'Psychologie', value: 20 },
  { label: 'Physiologie', value: 15 },
  { label: 'Adhérence', value: 10 },
];

export function ScoresSection() {
  return (
    <section className="relative py-12 md:py-16 lg:py-24 bg-[#EDF3F7]">
      <div className="max-w-6xl mx-auto px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <p className="text-xs font-sans font-normal uppercase tracking-widest text-[#2D5168] mb-4">• SCORES IPT</p>
          <h2 className="text-3xl md:text-4xl font-heading font-extralight text-[#0F2334] mb-6 leading-tight">
            Votre transformation<br />
            <span className="text-[#19D4FF]">quantifiée</span>
          </h2>
        </motion.div>

        <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 justify-items-center">
          {scores.map((score, idx) => (
            <motion.div
              key={score.label}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1, type: 'spring', stiffness: 100 }}
              className="w-full max-w-xs"
            >
              <GlassCard
                glassLevel="light"
                depth={3}
                withGlow={false}
                className="text-left"
              >
                <p className="text-sm font-sans font-normal text-[#2D5168] mb-3">
                  {score.label}
                </p>
                <p className="text-3xl font-heading font-semibold text-[#19D4FF] mt-3">
                  {score.value}%
                </p>
                <div className="mt-4 w-full h-1.5 bg-[rgba(255,255,255,0.18)] rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: `${score.value}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: 0.3 + idx * 0.1, ease: 'easeOut' }}
                    className="h-full bg-[#19D4FF] rounded-full"
                  />
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}








