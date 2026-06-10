'use client';

import { motion } from 'framer-motion';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const metabolicData = [
  { name: 'Jan', insuline: 85, cortisol: 45 },
  { name: 'Fév', insuline: 78, cortisol: 52 },
  { name: 'Mar', insuline: 72, cortisol: 48 },
  { name: 'Avr', insuline: 68, cortisol: 42 },
  { name: 'Mai', insuline: 65, cortisol: 38 },
  { name: 'Juin', insuline: 62, cortisol: 35 },
];

export function BentoInsights() {
  return (
    <section className="py-24 px-6 md:px-12 lg:px-24 bg-white">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-black mb-6" style={{ letterSpacing: '-0.05em', lineHeight: '1.1' }}>
            Optimisation humaine adaptée à votre biologie unique
          </h2>
        </motion.div>

        {/* Asymmetric Bento Grid */}
        <div className="relative">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Side - Mini Chart 1 */}
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="lg:col-span-4"
            >
              <div
                className="glass-card p-6 rounded-3xl h-full"
                style={{
                  background: 'rgba(255, 255, 255, 0.4)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255, 255, 255, 0.5)',
                  transform: 'rotate(-2deg)',
                }}
              >
                <h3 className="text-lg font-bold text-black mb-4">Restauration Métabolique</h3>
                <p className="text-sm text-[#2D5168] mb-4">Marqueurs Insuline & Cortisol</p>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={metabolicData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis dataKey="name" stroke="#9CA3AF" fontSize={12} />
                      <YAxis stroke="#9CA3AF" fontSize={12} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="insuline"
                        stroke="#2563EB"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="cortisol"
                        stroke="#10B981"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </motion.div>

            {/* Center - iPhone Mockup with IPT Gauge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="lg:col-span-4 flex justify-center items-center"
            >
              <div className="relative">
                {/* iPhone Frame */}
                <div
                  className="glass-card p-4 rounded-[3rem]"
                  style={{
                    background: 'rgba(255, 255, 255, 0.7)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255, 255, 255, 0.5)',
                    width: '320px',
                    height: '640px',
                    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)',
                  }}
                >
                  {/* Screen Content */}
                  <div className="bg-white rounded-[2.5rem] h-full p-8 flex flex-col items-center justify-center space-y-8">
                    {/* IPT Gauge */}
                    <div className="relative w-48 h-48">
                      <svg className="transform -rotate-90 w-48 h-48">
                        <circle
                          cx="96"
                          cy="96"
                          r="88"
                          stroke="#E5E7EB"
                          strokeWidth="12"
                          fill="none"
                        />
                        <circle
                          cx="96"
                          cy="96"
                          r="88"
                          stroke="#2563EB"
                          strokeWidth="12"
                          fill="none"
                          strokeDasharray="552.92"
                          strokeDashoffset="99.53"
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <div className="text-5xl font-bold text-black mb-1">82</div>
                        <div className="text-sm text-[#2D5168]">Score IPT</div>
                      </div>
                    </div>

                    {/* Indicators */}
                    <div className="space-y-4 w-full">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-blue-600 rounded-full" />
                        <span className="text-sm text-gray-700">Apprentissage de vos habitudes</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-green-600 rounded-full" />
                        <span className="text-sm text-gray-700">Activité quotidienne</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-amber-600 rounded-full" />
                        <span className="text-sm text-gray-700">Déverrouillage des changements subtils</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Right Side - Mini Chart 2 */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="lg:col-span-4"
            >
              <div
                className="glass-card p-6 rounded-3xl h-full"
                style={{
                  background: 'rgba(255, 255, 255, 0.4)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255, 255, 255, 0.5)',
                  transform: 'rotate(2deg)',
                }}
              >
                <h3 className="text-lg font-bold text-black mb-4">Tendances Comportementales</h3>
                <p className="text-sm text-[#2D5168] mb-4">Adhérence structurelle sur 6 mois</p>
                <div className="h-48 w-full min-w-0">
                  <ResponsiveContainer width="100%" height={192}>
                    <LineChart data={metabolicData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis dataKey="name" stroke="#9CA3AF" fontSize={12} />
                      <YAxis stroke="#9CA3AF" fontSize={12} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="cortisol"
                        stroke="#8B5CF6"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}











