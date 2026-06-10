'use client';

import { motion } from 'framer-motion';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { Activity, HardDrive, Brain, User, Users } from 'lucide-react';

const pillars = [
  {
    name: 'Métabolique',
    percentage: 30,
    description: 'Analyse des freins "Root Cause" : Insuline, Cortisol, Thyroïde.',
    icon: Activity,
    sparklineData: Array.from({ length: 12 }, (_, i) => ({ value: 65 + Math.sin(i / 2) * 15 })),
    color: '#2563EB',
    gridSpan: 'col-span-1 row-span-2',
  },
  {
    name: 'Infrastructure',
    percentage: 25,
    description: 'Audit de vos contraintes réelles : temps, budget et équipement.',
    icon: HardDrive,
    sparklineData: Array.from({ length: 12 }, (_, i) => ({ value: 70 + Math.cos(i / 2) * 12 })),
    color: '#3B82F6',
    gridSpan: 'col-span-1 row-span-1',
  },
  {
    name: 'Psychologie',
    percentage: 20,
    description: 'Le prédicteur n°1 du succès ($r=0.57$). Analyse du Locus de contrôle et de l\'auto-efficacité.',
    icon: Brain,
    sparklineData: Array.from({ length: 12 }, (_, i) => ({ value: 75 + Math.sin(i / 1.5) * 10 })),
    color: '#10B981',
    gridSpan: 'col-span-2 row-span-1',
    highlight: true,
  },
  {
    name: 'Physiologie',
    percentage: 15,
    description: 'Étude de votre morphotype et de votre potentiel génétique (FFMI).',
    icon: User,
    sparklineData: Array.from({ length: 12 }, (_, i) => ({ value: 60 + Math.cos(i / 2.5) * 18 })),
    color: '#8B5CF6',
    gridSpan: 'col-span-1 row-span-1',
  },
  {
    name: 'Adhérence',
    percentage: 10,
    description: 'Évaluation de la friction environnementale et du support social.',
    icon: Users,
    sparklineData: Array.from({ length: 12 }, (_, i) => ({ value: 55 + Math.sin(i / 3) * 20 })),
    color: '#F59E0B',
    gridSpan: 'col-span-1 row-span-1',
  },
];

function Sparkline({ data, color }: { data: Array<{ value: number }>, color: string }) {
  return (
    <div className="h-16 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={false}
            strokeLinecap="round"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function IPTPillarsInfographic() {
  return (
    <motion.section
      id="science"
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8 }}
      className="py-12 md:py-16 lg:py-24 px-6 md:px-12 lg:px-24"
    >
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-xs font-bold uppercase tracking-widest text-black/40 mb-4"
          >
            Science
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-6xl md:text-7xl font-bold text-black mb-6 tracking-tighter"
            style={{ fontFamily: 'Inter, sans-serif', lineHeight: '1.1' }}
          >
            Une lecture forensique de votre biologie
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-lg text-[#2D5168] max-w-3xl mx-auto"
          >
            Notre algorithme croise 358 points de données et s'appuie sur plus de 300 études scientifiques pour calculer votre score sur 100.
          </motion.p>
        </div>

        {/* Asymmetric Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 auto-rows-fr">
          {pillars.map((pillar, index) => {
            const Icon = pillar.icon;
            return (
              <motion.div
                key={pillar.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className={`${pillar.gridSpan} bg-white/10 backdrop-blur-md border border-[rgba(255,255,255,0.25)] rounded-2xl p-6 ${
                  pillar.highlight ? 'bg-blue-500/10 border-blue-500/30' : ''
                }`}
              >
                <div className="h-full flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div 
                        className="p-3 rounded-xl"
                        style={{ backgroundColor: `${pillar.color}20` }}
                      >
                        <Icon size={24} style={{ color: pillar.color }} />
                      </div>
                      <span className="text-4xl font-bold text-black">{pillar.percentage}%</span>
                    </div>
                    <h3 className="text-xl font-bold text-black mb-2">{pillar.name}</h3>
                    <p className="text-sm text-[#2D5168] leading-relaxed mb-4">{pillar.description}</p>
                  </div>
                  
                  {/* Sparkline */}
                  <div className="mt-auto">
                    <Sparkline data={pillar.sparklineData} color={pillar.color} />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.section>
  );
}











