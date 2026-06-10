'use client';

import { motion } from 'framer-motion';

const neurotypes = [
  {
    id: 'dopamine',
    name: 'Dopamine',
    traits: 'Action / Intensité',
    description: 'Profils orientés vers la performance immédiate et les défis intenses',
    color: 'blue',
  },
  {
    id: 'acetylcholine',
    name: 'Acétylcholine',
    traits: 'Créativité / Technique',
    description: 'Profils favorisant l\'innovation et la maîtrise technique',
    color: 'emerald',
  },
  {
    id: 'gaba',
    name: 'GABA',
    traits: 'Stabilité / Structure',
    description: 'Profils privilégiant la routine et la prévisibilité',
    color: 'amber',
  },
  {
    id: 'serotonin',
    name: 'Sérotonine',
    traits: 'Plaisir / Social',
    description: 'Profils axés sur le bien-être et les interactions sociales',
    color: 'rose',
  },
];

const colorClasses = {
  blue: 'bg-blue-50 border-blue-600 text-blue-900',
  emerald: 'bg-emerald-50 border-emerald-600 text-emerald-900',
  amber: 'bg-amber-50 border-amber-600 text-amber-900',
  rose: 'bg-rose-50 border-rose-600 text-rose-900',
};

export function NeurotypesVisualizer() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8 }}
      className="py-12 md:py-16 lg:py-24 px-6 md:px-12 lg:px-24"
    >
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-xs font-bold uppercase tracking-widest text-black/40 mb-4">
            Neuro-Profiling
          </p>
          <h2 className="text-6xl md:text-7xl font-bold text-black mb-6 tracking-tighter" style={{ fontFamily: 'Inter, sans-serif', lineHeight: '1.1' }}>
            Le Visualiseur de Neurotypes
          </h2>
          <p className="text-xl text-black font-semibold max-w-3xl mx-auto mb-4">
            Votre biochimie dicte votre adhérence. Nous n'utilisons pas votre volonté, nous utilisons vos neurotransmetteurs.
          </p>
          <p className="text-lg text-[#2D5168] max-w-3xl mx-auto">
            Les 4 natures dominantes identifiées par l'algorithme Braverman expliquent pourquoi la "volonté" est une erreur de lecture.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {neurotypes.map((neurotype, index) => (
            <motion.div
              key={neurotype.id}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className={`glass-card rounded-2xl p-6 ${colorClasses[neurotype.color as keyof typeof colorClasses]}`}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                boxShadow: 'none',
              }}
            >
              <div className="mb-4">
                <h3 className="text-2xl font-bold mb-2">{neurotype.name}</h3>
                <p className="text-sm font-semibold uppercase tracking-wider opacity-80">
                  {neurotype.traits}
                </p>
              </div>
              <p className="text-sm leading-relaxed opacity-90">
                {neurotype.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}











