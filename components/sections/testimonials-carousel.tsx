'use client'

import { motion } from 'framer-motion'
import { GlassCard } from '@/components/ui/glass-card'
import { Play } from 'lucide-react'

const testimonials = [
  {
    name: 'Sarah Martin',
    role: 'Passionnée de Santé',
    quote: 'Genesis a transformé ma compréhension de mes données de santé.',
    image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=80'
  },
  {
    name: 'Michael Chen',
    role: 'Professionnel du Fitness',
    quote: 'Les insights sont incroyablement détaillés et actionnables.',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80'
  },
  {
    name: 'Emily Rodriguez',
    role: 'Coach Bien-être',
    quote: 'Meilleure plateforme de santé que j\'ai jamais utilisée pour le suivi.',
    image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&q=80'
  },
  {
    name: 'David Thompson',
    role: 'Biohacker',
    quote: 'Les analyses prédictives changent la donne.',
    image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&q=80'
  }
]

export function TestimonialsCarousel() {
  return (
    <section className="relative py-12 md:py-16 lg:py-24 bg-[#EDF3F7] overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="text-xs font-normal uppercase tracking-widest text-[#2D5168] mb-4">• TÉMOIGNAGES</p>
          <h2 className="text-5xl font-heading font-extralight text-[#0F2334] mb-6 leading-tight">
            Des insights basés sur de vraies expériences
          </h2>
        </motion.div>

        {/* Carousel horizontal scroll */}
        <div className="overflow-x-auto pb-8 -mx-6 px-6 scrollbar-hide">
          <div className="flex gap-6 min-w-max">
            {testimonials.map((testimonial, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
                className="flex-shrink-0"
              >
                <GlassCard
                  glassLevel="light"
                  depth={3}
                  withGlow={false}
                  className="w-80 h-[500px] overflow-hidden group cursor-pointer bg-[rgba(255,255,255,0.08)] backdrop-blur-[16px] border border-[rgba(255,255,255,0.18)]"
                >
                  {/* Image de portrait - top 2/3 */}
                  <div className="relative h-[66%] overflow-hidden">
                    <div 
                      className="w-full h-full bg-cover bg-center"
                      style={{ backgroundImage: `url(${testimonial.image})` }}
                    />
                    
                    {/* Glassmorphism overlay en bas de l'image */}
                    <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[rgba(255,255,255,0.12)] to-transparent backdrop-blur-[16px]" />
                    
                    {/* Play button centré dans l'overlay */}
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
                      <button className="px-4 py-2 rounded-full bg-[rgba(255,255,255,0.20)] backdrop-blur-sm border border-[rgba(255,255,255,0.25)] flex items-center gap-2 group-hover:bg-[rgba(255,255,255,0.30)] transition-colors">
                        <span className="text-sm font-medium text-[#0F2334]">Play</span>
                        <div className="flex gap-0.5">
                          <Play className="w-3 h-3 text-[#0F2334]" fill="currentColor" />
                          <Play className="w-3 h-3 text-[#0F2334] ml-[-2px]" fill="currentColor" />
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Content - bottom 1/3 */}
                  <div className="p-6 space-y-4 flex flex-col justify-center h-[34%]">
                    <p className="text-[#0F2334] text-base leading-relaxed text-center font-light">
                      "{testimonial.quote}"
                    </p>
                    <div className="text-center">
                      <p className="text-[#0F2334] font-medium text-sm">{testimonial.name}</p>
                      <p className="text-[#2D5168] text-xs mt-1">{testimonial.role}</p>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}








