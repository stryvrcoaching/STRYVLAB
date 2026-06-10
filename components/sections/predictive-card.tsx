'use client'

import { motion } from 'framer-motion'
import { GlassCard } from '@/components/ui/glass-card'
import { AlertTriangle, TrendingDown, CheckCircle2 } from 'lucide-react'

export function PredictiveCard() {
  const chartData = [
    { month: 'Jan', value: 75, status: 'risk' },
    { month: 'Feb', value: 80, status: 'risk' },
    { month: 'Mar', value: 70, status: 'decreasing' },
    { month: 'Apr', value: 60, status: 'decreasing' },
    { month: 'May', value: 45, status: 'success' },
    { month: 'Jun', value: 35, status: 'success' },
  ]

  const maxValue = 100

  return (
    <section className="relative py-12 md:py-16 lg:py-24 bg-[#EDF3F7]">
      <div className="max-w-4xl mx-auto px-6 lg:px-8">
        <GlassCard
          glassLevel="light"
          depth={3}
          withGlow={false}
          className="bg-[rgba(255,255,255,0.08)] backdrop-blur-[16px] border border-[rgba(255,255,255,0.18)]"
        >
          <div className="p-8">
            {/* Chart */}
            <div className="relative h-64 mb-8">
              {/* Grid lines */}
              <div className="absolute inset-0 flex flex-col justify-between">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-px bg-gray-100" />
                ))}
              </div>
              
              {/* Bars */}
              <div className="absolute inset-0 flex items-end justify-between gap-2">
                {chartData.map((data, i) => {
                  const height = (data.value / maxValue) * 100
                  const color = data.status === 'risk' 
                    ? 'bg-[#F3B544]' 
                    : data.status === 'decreasing'
                    ? 'bg-[#F3B544]'
                    : 'bg-[#37E6A5]'
                  
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center">
                      <motion.div
                        className={`w-full ${color} rounded-t`}
                        initial={{ height: 0 }}
                        whileInView={{ height: `${height}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, delay: i * 0.1 }}
                      />
                    </div>
                  )
                })}
              </div>
              
              {/* Labels and indicators */}
              <div className="absolute -top-8 left-0 right-0 flex justify-between">
                {chartData.map((data, i) => {
                  if (data.status === 'risk' && i === 1) {
                    return (
                      <div key={i} className="flex flex-col items-center">
                        <AlertTriangle className="w-4 h-4 text-orange-500 mb-1" />
                        <span className="text-xs text-orange-500 font-medium">Risque identifié</span>
                      </div>
                    )
                  }
                  if (data.status === 'decreasing' && i === 2) {
                    return (
                      <div key={i} className="flex flex-col items-center">
                        <TrendingDown className="w-4 h-4 text-yellow-500 mb-1" />
                        <span className="text-xs text-yellow-500 font-medium">Risque en baisse</span>
                      </div>
                    )
                  }
                  if (data.status === 'success' && i === 4) {
                    return (
                      <div key={i} className="flex flex-col items-center">
                        <CheckCircle2 className="w-4 h-4 text-green-500 mb-1" />
                        <span className="text-xs text-green-500 font-medium">Prévention réussie</span>
                      </div>
                    )
                  }
                  return <div key={i} />
                })}
              </div>
              
              {/* X-axis labels */}
              <div className="absolute -bottom-8 left-0 right-0 flex justify-between">
                {chartData.map((data, i) => (
                  <span key={i} className="text-xs text-[#2D5168]">{data.month}</span>
                ))}
              </div>
            </div>
            
            <p className="text-center text-[#19D4FF] font-light text-lg">Prédictif, pas réactif</p>
          </div>
        </GlassCard>
      </div>
    </section>
  )
}








