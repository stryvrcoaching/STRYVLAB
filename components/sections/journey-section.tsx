'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';

const tags = [
  'Profil métabolique',
  'Habitudes quotidiennes',
  'Charge mentale',
  'Sommeil',
  'Contraintes réelles',
  'Infrastructure',
];

export function JourneySection() {
  return (
    <section className="relative py-12 md:py-16 lg:py-24 bg-[#EDF3F7] overflow-hidden">
      <div className="max-w-6xl mx-auto px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <p className="text-xs font-sans font-normal uppercase tracking-widest text-[#2D5168] mb-4">• DIAGNOSTIC PERSONNALISÉ</p>
          <h2 className="text-4xl md:text-5xl font-heading font-extralight text-[#0F2334] mb-6 leading-tight">
            Un diagnostic aussi unique<br />
            <span className="text-[#19D4FF]">que votre biologie</span>
          </h2>

          <p className="mt-4 font-sans font-normal text-[#2D5168] max-w-2xl mx-auto text-sm md:text-base leading-relaxed">
            Genesis croise 350+ variables issues de votre biologie, psychologie et environnement pour prédire votre capacité réelle de transformation.
          </p>
        </motion.div>

        <div className="relative max-w-lg mx-auto mt-16">
          {/* Phone mockup */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative z-20"
          >
            <div className="w-64 h-[500px] bg-[#0F2334] rounded-container border-8 border-[#0F2334] shadow-soft p-2 mx-auto">
              <div className="w-full h-full bg-gradient-to-br from-transparent to-transparent rounded-card overflow-hidden p-6 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="text-white/60 text-xs font-sans">15:45</div>
                  <div className="flex gap-1">
                    <div className="w-1 h-1 rounded-full bg-white/60" />
                    <div className="w-1 h-1 rounded-full bg-white/60" />
                    <div className="w-1 h-1 rounded-full bg-white/60" />
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 flex flex-col items-center justify-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-transparent flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full bg-[#19D4FF]" />
                  </div>
                  <div className="text-center space-y-2">
                    <div className="text-2xl font-heading font-semibold text-white">350+</div>
                    <div className="text-xs font-sans text-white/60">Variables analysées</div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Floating tags */}
          {tags.map((tag, i) => (
            <motion.div
              key={tag}
              initial={{ opacity: 0, scale: 0.5 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ 
                delay: 0.2 + i * 0.1,
                type: 'spring',
                stiffness: 100,
                damping: 15
              }}
              className="absolute text-xs font-sans font-medium px-4 py-2 rounded-button bg-[rgba(255,255,255,0.08)] backdrop-blur-[16px] border border-[rgba(255,255,255,0.18)] shadow-light text-[#0F2334] whitespace-nowrap z-10"
              style={{
                top: `${30 + i * 8}%`,
                left: i % 2 === 0 ? '-80px' : 'calc(100% + 20px)',
              }}
            >
              {tag}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}









