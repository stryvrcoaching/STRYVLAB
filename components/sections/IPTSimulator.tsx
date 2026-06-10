'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';

const PILLARS = [
  { id: 'v1', label: 'Métabolique', weight: 0.30, min: 0, max: 100 },
  { id: 'v2', label: 'Infrastructure', weight: 0.25, min: 0, max: 100 },
  { id: 'v3', label: 'Psychologie', weight: 0.20, min: 0, max: 100 },
  { id: 'v4', label: 'Physiologie', weight: 0.15, min: 0, max: 100 },
  { id: 'v5', label: 'Adhérence', weight: 0.10, min: 0, max: 100 },
];

function CircularProgress({ value }: { value: number }) {
  const circumference = 2 * Math.PI * 90;
  const offset = circumference - (value / 100) * circumference;
  
  const getColor = (val: number) => {
    if (val >= 75) return '#2563EB'; // Bleu chirurgical
    if (val >= 60) return '#3B82F6'; // Bleu
    if (val >= 45) return '#60A5FA'; // Bleu clair
    if (val >= 30) return '#F59E0B'; // Orange
    return '#EF4444'; // Rouge
  };

  return (
    <div className="relative w-64 h-64">
      <svg className="transform -rotate-90 w-full h-full" viewBox="0 0 200 200">
        {/* Background circle */}
        <circle
          cx="100"
          cy="100"
          r="90"
          stroke="rgba(255, 255, 255, 0.2)"
          strokeWidth="12"
          fill="none"
        />
        {/* Progress circle */}
        <circle
          cx="100"
          cy="100"
          r="90"
          stroke={getColor(value)}
          strokeWidth="12"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="text-center"
        >
          <motion.span
            key={Math.floor(value)}
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3 }}
            className="text-6xl font-bold"
            style={{ color: getColor(value) }}
          >
            {Math.floor(value)}
          </motion.span>
        </motion.div>
      </div>
    </div>
  );
}

export function IPTSimulator() {
  const [values, setValues] = useState({
    v1: 70,
    v2: 65,
    v3: 75,
    v4: 60,
    v5: 55,
  });

  // Calcul du score : (V1 * 0.30) + (V2 * 0.25) + (V3 * 0.20) + (V4 * 0.15) + (V5 * 0.10)
  const calculateScore = () => {
    return (
      values.v1 * 0.30 +
      values.v2 * 0.25 +
      values.v3 * 0.20 +
      values.v4 * 0.15 +
      values.v5 * 0.10
    );
  };

  const score = calculateScore();

  const getCategory = (s: number) => {
    if (s >= 75) return { label: 'Excellent', color: '#2563EB' };
    if (s >= 60) return { label: 'Solide', color: '#3B82F6' };
    if (s >= 45) return { label: 'Moyen', color: '#60A5FA' };
    if (s >= 30) return { label: 'Limité', color: '#F59E0B' };
    return { label: 'Faible', color: '#EF4444' };
  };

  const category = getCategory(score);

  const handleSliderChange = (id: string, value: number) => {
    setValues((prev) => ({ ...prev, [id]: value }));
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8 }}
      className="py-12 md:py-16 lg:py-24 px-6 md:px-12 lg:px-24"
    >
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-6xl md:text-7xl font-bold text-black mb-6 tracking-tighter"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            Testez votre Signature de Transformation
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-xl text-[#2D5168] max-w-3xl mx-auto"
          >
            Ajustez vos variables pour découvrir votre potentiel structurel actuel.
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="glass-card rounded-3xl p-12"
          style={{
            background: 'rgba(255, 255, 255, 0.6)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.4)',
            boxShadow: 'none',
          }}
        >
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Score Display */}
            <div className="flex flex-col items-center justify-center space-y-8">
              <CircularProgress value={score} />
              
              <div className="text-center space-y-4">
                <motion.p
                  key={category.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-2xl font-semibold"
                  style={{ color: category.color }}
                >
                  Capacité structurelle détectée : {category.label}
                </motion.p>
              </div>
            </div>

            {/* Right: Sliders */}
            <div className="space-y-8">
              {PILLARS.map((pillar, index) => (
                <motion.div
                  key={pillar.id}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="space-y-3"
                >
                  <div className="flex justify-between items-center">
                    <label className="text-lg font-semibold text-black">
                      {pillar.label} ({pillar.weight * 100}%)
                    </label>
                    <span className="text-2xl font-bold text-blue-600">
                      {values[pillar.id as keyof typeof values]}
                    </span>
                  </div>
                  
                  <input
                    type="range"
                    min={pillar.min}
                    max={pillar.max}
                    value={values[pillar.id as keyof typeof values]}
                    onChange={(e) =>
                      handleSliderChange(pillar.id, parseInt(e.target.value))
                    }
                    className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                    style={{
                      background: `linear-gradient(to right, #2563EB 0%, #2563EB ${((values[pillar.id as keyof typeof values] - pillar.min) / (pillar.max - pillar.min)) * 100}%, rgba(0,0,0,0.1) ${((values[pillar.id as keyof typeof values] - pillar.min) / (pillar.max - pillar.min)) * 100}%, rgba(0,0,0,0.1) 100%)`,
                    }}
                  />
                  
                  <div className="flex justify-between text-sm text-[#2D5168]">
                    <span>{pillar.min}</span>
                    <span>{pillar.max}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 }}
            className="mt-12 text-center"
          >
            <Link
              href="/ipt-choice"
              className="inline-flex items-center gap-3 px-8 py-4 bg-black text-white rounded-full font-semibold text-lg transition-all hover:bg-gray-900 hover:scale-105"
            >
              Lancer l'analyse forensique complète (350+ points)
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </motion.div>
        </motion.div>
      </div>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: #2563EB;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(37, 99, 235, 0.4);
        }

        .slider::-moz-range-thumb {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: #2563EB;
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 8px rgba(37, 99, 235, 0.4);
        }
      `}</style>
    </motion.section>
  );
}








