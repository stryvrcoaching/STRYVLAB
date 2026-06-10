'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight, Activity, Dumbbell, Droplet, Utensils, Timer, Scale } from 'lucide-react';

const tools = [
  {
    id: 'macros',
    title: 'Calculateur Macros',
    description: 'Définissez vos besoins énergétiques précis selon votre neurotype.',
    href: '/outils/macros',
    icon: Utensils,
    color: 'from-blue-400 to-cyan-300'
  },
  {
    id: 'bodyfat',
    title: 'Masse Grasse',
    description: 'Estimez votre % de gras (Méthode US Navy) pour suivre vos progrès.',
    href: '/outils/body-fat',
    icon: Activity,
    color: 'from-emerald-400 to-teal-300'
  },
  {
    id: 'rm',
    title: 'Calculateur 1RM',
    description: 'Calculez votre force maximale théorique sans risque de blessure.',
    href: '/outils/1rm',
    icon: Dumbbell,
    color: 'from-purple-400 to-pink-300'
  },
  {
    id: 'hydration',
    title: 'Hydratation',
    description: 'Besoins hydriques exacts selon l\'intensité de l\'effort.',
    href: '/outils/hydratation',
    icon: Droplet,
    color: 'from-cyan-400 to-blue-500'
  },
  {
    id: 'zones',
    title: 'Zones Cardiaques',
    description: 'Optimisez votre cardio en ciblant les bonnes filières énergétiques.',
    href: '/outils/hr-zones',
    icon: Timer,
    color: 'from-red-400 to-orange-300'
  },
  {
    id: 'carb',
    title: 'Carb Cycling',
    description: 'Stratégie avancée de modulation des glucides pour la performance.',
    href: '/outils/carb-cycling',
    icon: Scale,
    color: 'from-yellow-400 to-amber-300'
  }
];

export function StryvLabToolsHub() {
  return (
    <section className="relative py-24 bg-[#0E0E0E] overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px]" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-5xl font-bold text-white mb-6 tracking-tight"
          >
            L'Armurerie <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">Métabolique</span>
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-white/60 text-lg max-w-2xl mx-auto"
          >
            Des outils de précision issus de la science du sport pour quantifier, analer et optimiser votre transformation.
          </motion.p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tools.map((tool, index) => (
            <motion.div
              key={tool.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <Link href={tool.href} className="group block h-full">
                <div className="relative h-full bg-white/5 border border-white/10 rounded-2xl p-8 hover:bg-white/10 transition-all duration-300 overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <tool.icon className="w-24 h-24" />
                  </div>
                  
                  <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${tool.color} bg-opacity-10 mb-6`}>
                    <tool.icon className="w-6 h-6 text-black/80" />
                  </div>

                  <h3 className="text-xl font-bold text-white mb-3 group-hover:text-blue-300 transition-colors">
                    {tool.title}
                  </h3>
                  
                  <p className="text-white/60 mb-6 line-clamp-2">
                    {tool.description}
                  </p>

                  <div className="flex items-center text-sm font-medium text-white/40 group-hover:text-white transition-colors">
                    Utiliser l'outil <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
