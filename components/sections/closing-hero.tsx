'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';

export function ClosingHero() {
  return (
    <section className="relative overflow-hidden py-12 md:py-16 lg:py-24 min-h-[500px] flex items-center">
      {/* Background Image */}
      <div className="absolute inset-0">
        <Image
          src="/images/closing-hero.jpg"
          alt="STRYV lab closing hero"
          fill
          className="object-cover opacity-80"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[rgba(15,35,52,0.6)] via-[rgba(15,35,52,0.5)] to-[rgba(15,35,52,0.7)]" />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-3xl mx-auto text-center px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="space-y-6"
        >
          <p className="text-xs font-sans font-normal uppercase tracking-widest text-white/80 mb-4">
            • COMMENCEZ MAINTENANT
          </p>
          
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-heading font-extralight text-white leading-tight">
            Démarrez votre parcours<br />
            de transformation personnalisé
          </h2>
          
          <p className="text-base md:text-lg font-sans font-normal text-white/80 mt-4 max-w-2xl mx-auto leading-relaxed">
            Découvrez si votre corps est réellement prêt à changer avant d'investir.
          </p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-8"
          >
            <motion.a
              href="/ipt-choice"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="group inline-flex items-center gap-2 px-8 py-3 rounded-button bg-[#19D4FF] text-[#0F2334] font-sans font-medium transition-all duration-300 hover:shadow-light"
            >
              Démarrer l'analyse IPT
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </motion.a>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}




