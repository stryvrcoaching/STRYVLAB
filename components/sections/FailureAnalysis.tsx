'use client';

import { motion } from 'framer-motion';
import { SectionHeader } from '../ui/SectionHeader';
import { Card } from '../ui/Card';
import { FAILURE_ANALYSIS } from '@/lib/constants';

export function FailureAnalysis() {
  return (
    <section className="py-24 px-6 md:px-12 lg:px-24 relative">
      <div className="container mx-auto max-w-7xl">
        <SectionHeader
          label="Sans Diagnostic IPT"
          title="Pourquoi vous échouez malgré vos efforts"
          description="Une personne dont l'IPT est bas ne peut pas réussir durablement, même avec la meilleure volonté du monde."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FAILURE_ANALYSIS.failures.map((failure, index) => (
            <motion.div
              key={failure.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Card
                className="relative"
                hover={true}
              >
                <div 
                  className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg"
                  style={{
                    background: 'var(--electric-emerald)',
                  }}
                />
                <div className="pl-6">
                  <h3 
                    className="text-lg font-medium"
                    style={{
                      fontFamily: 'var(--font-deep-tech-body)',
                      color: 'var(--titanium-white)',
                    }}
                  >
                    {failure.title}
                  </h3>
                  <p 
                    className="text-sm mt-2"
                    style={{
                      fontFamily: 'var(--font-deep-tech-body)',
                      color: 'var(--gray-400)',
                    }}
                  >
                    {failure.description}
                  </p>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}











