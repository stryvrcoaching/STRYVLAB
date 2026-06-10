'use client';

import { motion } from 'framer-motion';
import { SectionHeader } from '../ui/SectionHeader';
import { Card } from '../ui/Card';
import { COMPARISON } from '@/lib/constants';

export function Comparison() {
  return (
    <section className="py-24 px-6 md:px-12 lg:px-24 relative">
      <div className="container mx-auto max-w-7xl">
        <SectionHeader
          label="Standard vs Genesis"
          title="Aucun programme standard ne mesure ça"
          description="Les approches génériques traitent les symptômes. Genesis identifie les causes structurelles."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-px" style={{ background: 'rgba(255, 255, 255, 0.03)' }}>
          {/* Left Card - Approche Standard */}
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <Card className="h-full">
              <div className="flex items-center gap-3 mb-6">
                <span 
                  className="px-3 py-1 rounded text-xs font-medium"
                  style={{
                    background: 'rgba(34, 197, 94, 0.1)',
                    color: '#22c55e',
                    fontFamily: 'var(--font-deep-tech-body)',
                  }}
                >
                  {COMPARISON.standard.badge}
                </span>
                <span 
                  className="text-sm"
                  style={{
                    fontFamily: 'var(--font-deep-tech-body)',
                    color: 'var(--gray-400)',
                  }}
                >
                  {COMPARISON.standard.status}
                </span>
              </div>

              <div className="space-y-0">
                {COMPARISON.standard.metrics.map((metric, index) => (
                  <div
                    key={metric.name}
                    className="flex justify-between items-center py-4"
                    style={{
                      borderBottom: index < COMPARISON.standard.metrics.length - 1 
                        ? '1px solid rgba(255, 255, 255, 0.03)' 
                        : 'none',
                    }}
                  >
                    <span 
                      className="text-sm"
                      style={{
                        fontFamily: 'var(--font-deep-tech-body)',
                        color: 'var(--gray-500)',
                      }}
                    >
                      {metric.name}
                    </span>
                    <span 
                      className="text-sm font-mono"
                      style={{
                        fontFamily: 'var(--font-deep-tech-functional)',
                        color: 'var(--titanium-white)',
                      }}
                    >
                      {metric.value}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>

          {/* Right Card - Genesis IPT */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Card className="h-full">
              <div className="flex items-center gap-3 mb-6">
                <span 
                  className="px-3 py-1 rounded text-xs font-medium"
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    color: '#ef4444',
                    fontFamily: 'var(--font-deep-tech-body)',
                  }}
                >
                  {COMPARISON.genesis.badge}
                </span>
                <span 
                  className="text-sm"
                  style={{
                    fontFamily: 'var(--font-deep-tech-body)',
                    color: 'var(--gray-400)',
                  }}
                >
                  {COMPARISON.genesis.status}
                </span>
              </div>

              <div className="space-y-0">
                {COMPARISON.genesis.metrics.map((metric, index) => (
                  <div
                    key={metric.name}
                    className="flex justify-between items-center py-4"
                    style={{
                      borderBottom: index < COMPARISON.genesis.metrics.length - 1 
                        ? '1px solid rgba(255, 255, 255, 0.03)' 
                        : 'none',
                    }}
                  >
                    <span 
                      className="text-sm"
                      style={{
                        fontFamily: 'var(--font-deep-tech-body)',
                        color: 'var(--gray-500)',
                      }}
                    >
                      {metric.name}
                    </span>
                    <span 
                      className="text-sm font-mono"
                      style={{
                        fontFamily: 'var(--font-deep-tech-functional)',
                        color: 'var(--titanium-white)',
                      }}
                    >
                      {metric.value}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </section>
  );
}











