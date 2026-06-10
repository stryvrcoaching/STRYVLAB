'use client';

import { motion } from 'framer-motion';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts';

const data = [
  { pillar: 'Métabolique', value: 30, fullMark: 100 },
  { pillar: 'Infrastructure', value: 25, fullMark: 100 },
  { pillar: 'Psychologie', value: 20, fullMark: 100 },
  { pillar: 'Physiologie', value: 15, fullMark: 100 },
  { pillar: 'Adhérence', value: 10, fullMark: 100 },
];

export function GenesisRadarChart() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8 }}
      className="py-12 md:py-16 lg:py-24 px-6 md:px-12 lg:px-24"
    >
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold text-black mb-6" style={{ letterSpacing: '-0.05em', lineHeight: '1.1' }}>
            Visualisation IPT
          </h2>
          <p className="text-lg text-[#2D5168] max-w-2xl mx-auto">
            Architecture des 5 piliers déterminant votre capacité structurelle de transformation
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-12 items-center">
          {/* Radar Chart */}
          <div className="flex-1 w-full min-w-0" style={{ height: '500px' }}>
            <ResponsiveContainer width="100%" height={500}>
              <RadarChart data={data}>
                <PolarGrid stroke="#E5E7EB" />
                <PolarAngleAxis
                  dataKey="pillar"
                  tick={{ fill: '#000000', fontSize: 14, fontWeight: 600 }}
                  style={{ fontFamily: 'Inter, sans-serif' }}
                />
                <PolarRadiusAxis
                  angle={90}
                  domain={[0, 100]}
                  tick={{ fill: '#9CA3AF', fontSize: 12 }}
                  axisLine={false}
                />
                <Radar
                  name="IPT"
                  dataKey="value"
                  stroke="#2563EB"
                  fill="#2563EB"
                  fillOpacity={0.3}
                  strokeWidth={3}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Legend with Psychology Highlight */}
          <div className="flex-1 space-y-4">
            {data.map((item, index) => (
              <motion.div
                key={item.pillar}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className={`p-5 rounded-2xl ${
                  item.pillar === 'Psychologie' 
                    ? 'bg-blue-50 border-2 border-blue-600' 
                    : 'glass-card'
                }`}
                style={
                  item.pillar !== 'Psychologie' ? {
                    background: 'rgba(255, 255, 255, 0.6)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    boxShadow: 'none',
                    border: '1px solid rgba(255, 255, 255, 0.5)',
                  } : {}
                }
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg font-bold text-black">{item.pillar}</span>
                  <span className="text-3xl font-bold text-blue-600">{item.value}%</span>
                </div>
                {item.pillar === 'Psychologie' && (
                  <div className="mt-3 pt-3 border-t border-blue-200">
                    <p className="text-sm text-blue-900 font-semibold">
                      Prédicteur n°1 du succès : $r=0.57$
                    </p>
                    <p className="text-xs text-blue-700 mt-1">
                      Corrélation validée par 300+ études scientifiques
                    </p>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </motion.section>
  );
}











