'use client';

import { motion } from 'framer-motion';

const cases = [
  {
    id: 'marc',
    name: 'Marc',
    profile: 'Profil Androïde / Métabolique Challenge',
    data: [
      { label: 'WHR', value: '1.03', status: 'critique', description: 'Androïde critique' },
    ],
    diagnosis: 'Résistance à l\'insuline probable, risque métabolique maximal',
    strategy: 'Stratégie Genesis : Priorité à la restauration métabolique (cyclage glucidique contrôlé) avant toute intensification',
  },
  {
    id: 'sophie',
    name: 'Sophie',
    profile: 'Profil Ectomorphe / Adhérence Favorable',
    data: [
      { label: 'FFMI', value: '16.2', status: 'favorable', description: 'sous-développé' },
      { label: 'WHR', value: '0.71', status: 'protecteur', description: 'Gynoïde protecteur' },
    ],
    diagnosis: 'Potentiel de gain musculaire énorme (+10kg théoriques) avec un risque métabolique faible',
    strategy: 'Stratégie Genesis : Surplus calorique agressif et haute fréquence d\'entraînement',
  },
];

export function ForensicCaseStudies() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8 }}
      className="py-12 md:py-16 lg:py-24 px-6 md:px-12 lg:px-24"
    >
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-xs font-bold uppercase tracking-widest text-black/40 mb-4">
            Études de Cas
          </p>
          <h2 className="text-6xl md:text-7xl font-bold text-black mb-6 tracking-tighter" style={{ fontFamily: 'Inter, sans-serif', lineHeight: '1.1' }}>
            Études de Cas Forensiques
          </h2>
          <p className="text-lg text-[#2D5168] max-w-3xl mx-auto">
            Diagnostics précis basés sur des données mesurables, pas sur des suppositions
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {cases.map((caseStudy, index) => (
            <motion.div
              key={caseStudy.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.2 }}
              className="glass-card rounded-2xl p-8"
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                boxShadow: 'none',
              }}
            >
              {/* Case Header */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-2xl font-bold text-black">Cas #{index + 1} : {caseStudy.name}</h3>
                  <span className="text-xs font-mono uppercase tracking-wider text-[#2D5168] bg-gray-100 px-3 py-1 rounded-full">
                    {caseStudy.profile}
                  </span>
                </div>
              </div>

              {/* Data Points */}
              <div className="mb-6 space-y-3">
                <p className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Données :</p>
                {caseStudy.data.map((dataPoint, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div>
                      <span className="text-sm font-bold text-black">${dataPoint.label}$</span>
                      <span className="text-sm text-[#2D5168] ml-2">= {dataPoint.value}</span>
                      <span className="text-xs text-[#2D5168] ml-2">({dataPoint.description})</span>
                    </div>
                    {dataPoint.status === 'critique' && (
                      <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-1 rounded">
                        Critique
                      </span>
                    )}
                    {dataPoint.status === 'protecteur' && (
                      <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                        Protecteur
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Diagnosis */}
              <div className="mb-6 p-4 bg-blue-50 border-l-4 border-blue-600 rounded-r-xl">
                <p className="text-sm font-semibold text-blue-900 uppercase tracking-wider mb-2">Diagnostic :</p>
                <p className="text-base text-blue-800 leading-relaxed">{caseStudy.diagnosis}</p>
              </div>

              {/* Strategy */}
              <div className="p-4 bg-gray-900 rounded-xl">
                <p className="text-sm font-semibold text-white uppercase tracking-wider mb-2">Stratégie Genesis :</p>
                <p className="text-base text-gray-100 leading-relaxed">{caseStudy.strategy}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}











