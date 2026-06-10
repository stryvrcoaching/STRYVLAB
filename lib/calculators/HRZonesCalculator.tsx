'use client';

import { useState } from 'react';
import { GlassCard } from '../../components/ui/glass-card';
import type { Language } from '@/lib/i18n/translations';
import { getTranslation } from '@/lib/i18n/translations';

interface HRZonesCalculatorProps {
  language?: Language
}

export function HRZonesCalculator({ language: propLanguage }: HRZonesCalculatorProps = { language: undefined }) {
  const [internalLanguage, setInternalLanguage] = useState<Language>('fr');
  const language = propLanguage ?? internalLanguage;
  const t = getTranslation(language);

  const [age, setAge] = useState<string>('');
  const [restingHR, setRestingHR] = useState<string>('');
  const [showResults, setShowResults] = useState(false);

  // Convert to numbers for calculations
  const ageNum = Number(age) || 0;
  const restingHRNum = Number(restingHR) || 60; // Default if not provided

  // Karvonen Method
  const maxHR = ageNum > 0 ? 220 - ageNum : 0;
  const hrReserve = maxHR - restingHRNum;

  const calculateZone = (percentage: number) => {
    const targetHR = Math.round((hrReserve * percentage / 100) + restingHRNum);
    return targetHR;
  };

  const handleCalculate = () => {
    if (ageNum > 0) {
      setShowResults(true);
    }
  };

  const zones = [
    { 
      number: 1,
      nameKey: 'recovery',
      min: 50, 
      max: 60, 
      color: 'bg-blue-400/20', 
      borderColor: 'border-blue-400/50',
      textColor: 'text-blue-400',
    },
    { 
      number: 2,
      nameKey: 'endurance',
      min: 60, 
      max: 70, 
      color: 'bg-green-400/20', 
      borderColor: 'border-green-400/50',
      textColor: 'text-green-400',
    },
    { 
      number: 3,
      nameKey: 'tempo',
      min: 70, 
      max: 80, 
      color: 'bg-yellow-400/20', 
      borderColor: 'border-yellow-400/50',
      textColor: 'text-yellow-400',
    },
    { 
      number: 4,
      nameKey: 'threshold',
      min: 80, 
      max: 90, 
      color: 'bg-orange-400/20', 
      borderColor: 'border-orange-400/50',
      textColor: 'text-orange-400',
    },
    { 
      number: 5,
      nameKey: 'maximum',
      min: 90, 
      max: 100, 
      color: 'bg-red-400/20', 
      borderColor: 'border-red-400/50',
      textColor: 'text-red-400',
    },
  ];

  return (
    <section className="relative py-12 md:py-16 lg:py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 md:mb-12">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-heading font-extralight mb-4 text-white tracking-tight">
            {t.hrZonesCalculator.title}
          </h1>
          <p className="text-base sm:text-lg text-white/70 mb-6">
            {t.hrZonesCalculator.subtitle}
          </p>
        </div>

        {/* Input Form Card */}
        <GlassCard glassLevel="medium" depth={3} withGlow={true} animation="scale" className="mb-8">
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Age */}
              <div>
                <label className="block text-sm text-white/70 mb-2 font-sans font-normal">
                  {t.macroCalculator.personalInfo.age}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={age}
                  onChange={(e) => {
                    setAge(e.target.value.replace(/[^0-9]/g, ''));
                    setShowResults(false);
                  }}
                  onFocus={(e) => {
                    e.target.select();
                  }}
                  className="w-full min-h-[44px] px-4 py-3 bg-white/5 border border-white/20 rounded-card focus:border-[#19D4FF] focus:outline-none text-white placeholder:text-white/50 transition-all font-sans font-normal text-base"
                  placeholder="29"
                />
              </div>

              {/* Resting HR */}
              <div>
                <label className="block text-sm text-white/70 mb-2 font-sans font-normal">
                  {t.hrZonesCalculator.restingHR} ({t.common.optional})
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={restingHR}
                  onChange={(e) => {
                    setRestingHR(e.target.value.replace(/[^0-9]/g, ''));
                    setShowResults(false);
                  }}
                  onFocus={(e) => {
                    e.target.select();
                  }}
                  className="w-full min-h-[44px] px-4 py-3 bg-white/5 border border-white/20 rounded-card focus:border-[#19D4FF] focus:outline-none text-white placeholder:text-white/50 transition-all font-sans font-normal text-base"
                  placeholder="55"
                />
              </div>
            </div>

            {/* Calculate Button */}
            <button
              onClick={handleCalculate}
              disabled={ageNum === 0}
              className="w-full min-h-[48px] bg-gradient-to-r from-[#19D4FF] via-[#0FA8CC] to-[#0B8FA8] text-white py-3 px-6 rounded-button font-sans font-semibold text-base transition-all hover:from-[#0FA8CC] hover:via-[#0B8FA8] hover:to-[#19D4FF] active:scale-[0.98] disabled:bg-[rgba(15,35,52,0.2)] disabled:text-white/70 disabled:cursor-not-allowed disabled:hover:from-[rgba(15,35,52,0.2)] disabled:active:scale-100 shadow-lg shadow-[#19D4FF]/20 relative z-10"
            >
              {t.hrZonesCalculator.calculateButton || 'Calculer les zones'}
            </button>
          </div>
        </GlassCard>

        {/* Results Section */}
        {showResults && maxHR > 0 && (
          <>
            {/* Estimated MHR Display */}
            <div className="mb-8 text-center">
              <p className="text-sm text-white/70 font-sans font-normal mb-2">
                Votre fréquence cardiaque maximale estimée (FCM) est de :
              </p>
              <div className="text-4xl font-heading font-bold text-[#19D4FF] mb-2">
                {maxHR} {t.hrZonesCalculator.bpm}
              </div>
              <p className="text-xs text-white/60 font-sans font-normal">
                Zones calculées avec la formule de Karvonen (fréquence cardiaque au repos)
              </p>
            </div>

            {/* Heart Rate Zones Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {zones.map((zone) => {
                const minHR = calculateZone(zone.min);
                const maxHRZone = calculateZone(zone.max);
                return (
                  <div
                    key={zone.number}
                    className={`p-5 rounded-card border-2 ${zone.borderColor} ${zone.color} backdrop-blur-[16px]`}
                  >
                    <div className="mb-3">
                      <div className={`text-lg font-heading font-semibold ${zone.textColor} mb-1`}>
                        Zone {zone.number}: {t.hrZonesCalculator.zones[zone.nameKey as keyof typeof t.hrZonesCalculator.zones]}
                      </div>
                      <div className="text-sm text-white/80 font-sans font-normal mb-2">
                        {zone.min}-{zone.max}%
                      </div>
                      <div className="text-xl font-heading font-bold text-white mb-2">
                        {minHR} - {maxHRZone} {t.hrZonesCalculator.bpm}
                      </div>
                      <div className="text-xs text-white/70 font-sans font-normal">
                        {t.hrZonesCalculator.zoneDescriptions[zone.nameKey as keyof typeof t.hrZonesCalculator.zoneDescriptions]}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer Disclaimer */}
            <div className="mt-8 text-center">
              <p className="text-xs text-white/60 font-sans font-normal italic">
                {t.hrZonesCalculator.disclaimer || 'Pour une évaluation précise, consultez un professionnel de l\'éducation physique ou un cardiologue.'}
              </p>
            </div>
          </>
        )}
      </div>
    </section>
  );
}




