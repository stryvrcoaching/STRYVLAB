'use client'

import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

// Configuration des animations harmonisées
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
}

const fadeInUpDelay = (delay: number) => ({
  ...fadeInUp,
  transition: { ...fadeInUp.transition, delay }
})

const scaleIn = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
}

export function HeroMedisync() {
  return (
    <section className="relative min-h-screen overflow-hidden -mt-16">
      {/* Background Image Layer - Extended to cover header */}
      <div className="absolute inset-0" style={{ top: '-64px', height: 'calc(100% + 64px)' }}>
        <div 
          className="absolute inset-0 bg-no-repeat"
          style={{ 
            backgroundImage: 'url(/IMAGE/GEN27.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center center'
          }}
        />
      </div>

      {/* Content Container */}
      <div className="relative z-10 min-h-screen flex flex-col">
        <div className="flex-1 flex items-center">
          <div className="w-full max-w-7xl mx-auto px-6 lg:px-8 py-20 lg:py-24 relative">
            
            {/* Main Content Grid */}
            <div className="flex justify-center lg:justify-start">
              
              {/* Left Column - Hero Content */}
              <div className="space-y-8 lg:space-y-10 relative hero-content-mobile">
                {/* Main Heading */}
                <motion.h1 
                  className="font-heading text-white leading-[1.1] tracking-tight max-w-[500px] text-[40px] md:text-[45px] lg:text-[50px]"
                  style={{
                    color: '#FFFFFF',
                    fontWeight: 375
                  }}
                  {...fadeInUpDelay(0.1)}
                >
                  Le futur de la transformation physique est arrivé.
                </motion.h1>

                {/* CTA Button */}
                <motion.div {...fadeInUpDelay(0.3)}>
                  <Link
                    href="/genesis-era"
                    className="group inline-flex items-center gap-3 bg-gradient-to-r from-[#19D4FF] via-[#0FA8CC] to-[#0B8FA8] hover:from-[#0FA8CC] hover:via-[#0B8FA8] hover:to-[#19D4FF] text-white px-8 py-4 rounded-button text-base font-normal transition-all duration-300 hover:shadow-light hover:scale-[1.02]"
                  >
                    <span>Découvrir <span className="font-medium">Genesis era</span></span>
                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center transition-transform group-hover:translate-x-1">
                      <ArrowRight className="w-4 h-4 text-[#19D4FF]" />
                    </div>
                  </Link>
                </motion.div>
              </div>

            </div>

            {/* Supporting Text - Mobile version (below content) */}
            <motion.p 
              className="mt-8 md:hidden text-sm font-sans font-normal leading-relaxed text-center max-w-full px-4"
              style={{ color: '#FFFFFF' }}
              {...fadeInUpDelay(0.4)}
            >
              <span style={{ fontWeight: 500 }}>90% des transformations échouent.</span><br />N'adaptez plus votre vie à un régime, <span style={{ fontWeight: 480 }}>adaptez votre biologie à vos ambitions.</span>
            </motion.p>

            {/* Supporting Text - Desktop version (Positioned at right center) */}
            <motion.p 
              className="hidden md:block absolute right-4 sm:right-6 md:right-8 lg:right-12 text-sm sm:text-base md:text-lg font-sans font-normal leading-relaxed text-right max-w-[280px] sm:max-w-[320px] md:max-w-[380px]"
              style={{ 
                color: '#FFFFFF',
                top: 'calc(50% - 2cm)',
                transform: 'translateY(-50%)'
              }}
              {...fadeInUpDelay(0.4)}
            >
              <span style={{ fontWeight: 500 }}>90% des transformations échouent.</span><br />N'adaptez plus votre vie à un régime, <span style={{ fontWeight: 480 }}>adaptez votre biologie à vos ambitions.</span>
            </motion.p>
          </div>
        </div>

      </div>
    </section>
  )
}


