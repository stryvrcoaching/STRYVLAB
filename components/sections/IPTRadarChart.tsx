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

export function IPTRadarChart() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8 }}
      className="py-24 px-6"
    >
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold text-black mb-6" style={{ letterSpacing: '-0.05em' }}>
            Architecture de l'IPT
          </h2>
          <p className="text-lg text-[#2D5168] max-w-2xl mx-auto">
            L'IPT mesure votre capacité structurelle réelle à transformer et stabiliser votre physique
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-12 items-center">
          {/* Radar Chart */}
          <div className="flex-1 w-full min-w-0" style={{ height: '400px' }}>
            <ResponsiveContainer width="100%" height={400}>
              <RadarChart data={data}>
                <PolarGrid stroke="#E5E7EB" />
                <PolarAngleAxis
                  dataKey="pillar"
                  tick={{ fill: '#000000', fontSize: 12, fontWeight: 600 }}
                  style={{ fontFamily: 'Inter, sans-serif' }}
                />
                <PolarRadiusAxis
                  angle={90}
                  domain={[0, 100]}
                  tick={{ fill: '#9CA3AF', fontSize: 10 }}
                  axisLine={false}
                />
                <Radar
                  name="IPT"
                  dataKey="value"
                  stroke="#2563EB"
                  fill="#2563EB"
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="flex-1 space-y-4">
            {data.map((item, index) => (
              <motion.div
                key={item.pillar}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="glass-card flex items-center justify-between p-4 rounded-2xl"
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  boxShadow: 'none',
                }}
              >
                <span className="text-base font-semibold text-black">{item.pillar}</span>
                <span className="text-2xl font-bold text-blue-600">{item.value}%</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </motion.section>
  );
}











