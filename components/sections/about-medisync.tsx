'use client'

import { motion } from 'framer-motion'
import { Activity } from 'lucide-react'

export function AboutMedisync() {
  return (
    <section className="relative py-12 md:py-16 lg:py-24 bg-[#EDF3F7]">
      <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="space-y-8"
        >
          <p className="text-xs font-sans font-normal uppercase tracking-widest text-[#2D5168]">• À PROPOS DE STRYV lab</p>
          
          <div className="space-y-6 max-w-3xl mx-auto">
            <p className="text-xl md:text-2xl font-sans font-normal text-[#2D5168] leading-relaxed">
              Une plateforme de santé complète qui combine des <span className="text-[#19D4FF] font-medium">analyses avancées</span>, des <span className="text-[#19D4FF] font-medium">conseils personnalisés</span> et un <span className="text-[#19D4FF] font-medium">suivi en temps réel</span> pour vous aider à atteindre des résultats de santé optimaux.
            </p>
          </div>
          
          {/* Interactive circular icon with line */}
          <div className="flex justify-center mt-16">
            <div className="relative flex items-center">
              {/* Horizontal line */}
              <div className="absolute left-1/2 -translate-x-1/2 w-64 h-px bg-gradient-to-r from-transparent via-[#19D4FF] to-transparent" />
              
              {/* Circle with icon */}
              <motion.div
                className="relative z-10 w-16 h-16 rounded-full bg-[#19D4FF] border-2 border-white shadow-light flex items-center justify-center cursor-pointer group"
                whileHover={{ scale: 1.1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <Activity className="w-8 h-8 text-white" />
                <motion.div
                  className="absolute inset-0 rounded-full bg-[#19D4FF] opacity-0 group-hover:opacity-20"
                  animate={{ scale: [1, 1.5, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}








