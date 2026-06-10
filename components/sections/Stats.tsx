'use client';

import { motion } from 'framer-motion';
import { STATS } from '@/lib/constants';

export function Stats() {
  return (
    <section className="py-24 px-6 md:px-12 lg:px-24 relative">
      <div className="container mx-auto max-w-7xl">
        <div
          className="grid grid-cols-2 md:grid-cols-4 gap-px"
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.03)',
          }}
        >
          {STATS.map((stat: { value: string; label: string }, index: number) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="p-8"
              style={{
                background: 'rgba(255, 255, 255, 0.01)',
                borderRight: index < STATS.length - 1 ? '1px solid rgba(255, 255, 255, 0.03)' : 'none',
              }}
            >
              <div
                className="text-5xl font-heading font-light mb-2"
                style={{
                  fontFamily: 'var(--font-deep-tech-functional)',
                  color: 'var(--electric-emerald)',
                  fontWeight: 200,
                }}
              >
                {stat.value}
              </div>
              <p
                className="text-sm"
                style={{
                  fontFamily: 'var(--font-deep-tech-body)',
                  color: 'var(--gray-500)',
                }}
              >
                {stat.label}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}











