'use client';

import { motion } from 'framer-motion';
import { SectionHeader } from '../ui/SectionHeader';
import { Card } from '../ui/Card';
import { IPT_DEFINITION } from '@/lib/constants';

export function IPTDefinition() {
  return (
    <section id="ipt-definition" className="py-24 px-6 md:px-12 lg:px-24 relative">
      <div className="container mx-auto max-w-7xl">
        <SectionHeader
          label="Définition IPT"
          title="L'IPT est le résultat de l'interaction entre 5 piliers"
          description="Une capacité structurelle mesurable — pas la motivation, pas la discipline, pas la volonté."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {IPT_DEFINITION.pillars.map((pillar, index) => (
            <motion.div
              key={pillar.number}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Card>
                <div
                  className="text-xs font-mono mb-4"
                  style={{
                    fontFamily: 'var(--font-deep-tech-functional)',
                    color: 'var(--electric-emerald)',
                  }}
                >
                  {pillar.number}
                </div>
                <h3
                  className="text-lg font-medium mb-4"
                  style={{
                    fontFamily: 'var(--font-deep-tech-body)',
                    color: 'var(--titanium-white)',
                  }}
                >
                  {pillar.title}
                </h3>
                <ul className="space-y-2">
                  {pillar.items.map((item: string, itemIndex: number) => (
                    <li
                      key={itemIndex}
                      className="flex items-start gap-2 text-sm"
                      style={{
                        fontFamily: 'var(--font-deep-tech-body)',
                        color: 'var(--gray-400)',
                      }}
                    >
                      <span
                        className="mt-1.5 w-1 h-1 rounded-full flex-shrink-0"
                        style={{
                          background: 'var(--electric-emerald)',
                        }}
                      />
                      {item}
                    </li>
                  ))}
                </ul>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}











