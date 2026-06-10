'use client';

import { useState } from 'react';
import { GlassCard } from '../../components/ui/glass-card';
import { Dropdown } from '../../components/ui/Dropdown';
import type { Language } from '@/lib/i18n/translations';
import { getTranslation } from '@/lib/i18n/translations';
import { Droplet } from 'lucide-react';

// Water glass icon component - represents a glass of water
const WaterGlass = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* Glass body */}
    <rect x="7" y="4" width="10" height="16" rx="1" stroke="currentColor" fill="none" />
    {/* Glass rim */}
    <path d="M7 4h10" stroke="currentColor" strokeWidth="2" />
    {/* Water inside (filled area) */}
    <rect x="8" y="12" width="8" height="6" rx="0.5" fill="currentColor" opacity="0.3" />
    {/* Water surface line */}
    <path d="M8 12h8" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
  </svg>
);

interface WaterIntakeCalculatorProps {
  language?: Language
}

export function WaterIntakeCalculator({ language: propLanguage }: WaterIntakeCalculatorProps = { language: undefined }) {
  const [internalLanguage, setInternalLanguage] = useState<Language>('fr');
  const language = propLanguage ?? internalLanguage;
  const t = getTranslation(language);

  const [weight, setWeight] = useState<string>('');
  const [age, setAge] = useState<string>('');
  const [activity, setActivity] = useState<'sedentary' | 'moderate' | 'active' | 'veryActive'>('moderate');
  const [climate, setClimate] = useState<'temperate' | 'hot' | 'veryHot'>('temperate');
  const [showResults, setShowResults] = useState(false);

  const weightNum = Number(weight) || 0;
  const ageNum = Number(age) || 0;

  const activityBonus = {
    sedentary: 0,
    moderate: 700,
    active: 500,
    veryActive: 700,
  };

  const climateBonus = {
    temperate: 0,
    hot: 300,
    veryHot: 500,
  };

  const baseIntake = weightNum > 0 ? weightNum * 35 : 0; // 35ml per kg
  const totalML = baseIntake + activityBonus[activity] + climateBonus[climate];
  const totalLiters = totalML / 1000;
  const glasses = Math.round(totalML / 250);

  const handleCalculate = () => {
    if (weightNum > 0) {
      setShowResults(true);
    }
  };

  return (
    <section className="relative py-12 md:py-16 lg:py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 md:mb-12">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-heading font-extralight mb-4 text-white tracking-tight">
            {t.waterIntakeCalculator.title}
          </h1>
          <p className="text-base sm:text-lg text-white/70 mb-6">
            {t.waterIntakeCalculator.subtitle}
          </p>
        </div>

        {/* Input Form Card */}
        <GlassCard glassLevel="medium" depth={3} withGlow={true} animation="scale" className="mb-8">
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Weight */}
              <div>
                <label className="block text-sm text-white/70 mb-2 font-sans font-normal">
                  Votre poids ({t.macroCalculator.personalInfo.weightUnit})
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={weight}
                  onChange={(e) => {
                    setWeight(e.target.value.replace(/[^0-9.]/g, ''));
                    setShowResults(false);
                  }}
                  onFocus={(e) => {
                    e.target.select();
                  }}
                  className="w-full min-h-[44px] px-4 py-3 bg-white/5 border border-white/20 rounded-card focus:border-[#19D4FF] focus:outline-none text-white placeholder:text-white/50 transition-all font-sans font-normal text-base"
                  placeholder="69"
                />
              </div>

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
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Activity */}
              <div>
                <label className="block text-sm text-white/70 mb-2 font-sans font-normal">
                  {t.waterIntakeCalculator.activity.label}
                </label>
                <Dropdown
                  value={activity}
                  onChange={(value) => {
                    setActivity(value as typeof activity);
                    setShowResults(false);
                  }}
                  options={[
                    { 
                      value: 'sedentary', 
                      label: t.waterIntakeCalculator.activity.sedentary,
                      description: 'Peu ou pas d\'exercice, travail de bureau'
                    },
                    { 
                      value: 'moderate', 
                      label: t.waterIntakeCalculator.activity.moderate,
                      description: '3 à 5 jours d\'exercice modéré par semaine'
                    },
                    { 
                      value: 'active', 
                      label: t.waterIntakeCalculator.activity.active,
                      description: '6 à 7 jours d\'exercice intense par semaine'
                    },
                    { 
                      value: 'veryActive', 
                      label: t.waterIntakeCalculator.activity.veryActive,
                      description: 'Exercice très intense, travail physique ou entraînement 2x/jour'
                    }
                  ]}
                />
              </div>

              {/* Climate */}
              <div>
                <label className="block text-sm text-white/70 mb-2 font-sans font-normal">
                  {t.waterIntakeCalculator.climate.label}
                </label>
                <Dropdown
                  value={climate}
                  onChange={(value) => {
                    setClimate(value as typeof climate);
                    setShowResults(false);
                  }}
                  options={[
                    { 
                      value: 'temperate', 
                      label: 'Doux / Froid',
                      description: 'Température modérée, peu de transpiration'
                    },
                    { 
                      value: 'hot', 
                      label: t.waterIntakeCalculator.climate.hot,
                      description: 'Température élevée, transpiration modérée'
                    },
                    { 
                      value: 'veryHot', 
                      label: 'Très chaud et humide',
                      description: 'Température très élevée avec forte humidité'
                    }
                  ]}
                />
              </div>
            </div>

            {/* Calculate Button */}
            <button
              onClick={handleCalculate}
              disabled={weightNum === 0}
              className="w-full min-h-[48px] bg-gradient-to-r from-[#19D4FF] via-[#0FA8CC] to-[#0B8FA8] text-white py-3 px-6 rounded-button font-sans font-semibold text-base transition-all hover:from-[#0FA8CC] hover:via-[#0B8FA8] hover:to-[#19D4FF] active:scale-[0.98] disabled:bg-[rgba(15,35,52,0.2)] disabled:text-white/70 disabled:cursor-not-allowed disabled:hover:from-[rgba(15,35,52,0.2)] disabled:active:scale-100 shadow-lg shadow-[#19D4FF]/20 relative z-10"
            >
              {t.waterIntakeCalculator.calculateButton || 'Calculer l\'apport en eau'}
            </button>
          </div>
        </GlassCard>

        {/* Results Section */}
        {showResults && weightNum > 0 && (
          <GlassCard glassLevel="medium" depth={3} withGlow={true} animation="scale" className="mb-8">
            <div className="space-y-8">
              <h2 className="text-xl sm:text-2xl font-heading font-semibold text-white mb-6">
                Votre objectif d'hydratation quotidien
              </h2>

              {/* Main Result with Icon */}
              <div className="text-center mb-8">
                <Droplet className="w-16 h-16 text-[#19D4FF] mx-auto mb-4" />
                <div className="text-5xl font-heading font-bold text-[#19D4FF] mb-2">
                  {totalLiters.toFixed(1).replace('.', ',')} {t.waterIntakeCalculator.units.liters}
                </div>
                <div className="text-sm text-white/60 font-sans font-normal">
                  Litres par jour
                </div>
              </div>

              {/* Breakdown */}
              <div className="p-5 rounded-card bg-white/5 border border-white/10 backdrop-blur-[8px]">
                <h3 className="text-base font-heading font-semibold text-white mb-4">
                  {t.waterIntakeCalculator.results.understandResult}
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2.5 px-3 rounded-lg bg-white/5">
                    <span className="text-sm text-white/80 font-sans font-normal">
                      {t.waterIntakeCalculator.results.baseCalculation}
                    </span>
                    <span className="text-sm font-heading font-bold text-white">
                      {Math.round(baseIntake)} {t.waterIntakeCalculator.units.milliliters}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2.5 px-3 rounded-lg bg-white/5">
                    <span className="text-sm text-white/80 font-sans font-normal">
                      {t.waterIntakeCalculator.results.activityAdjustment}
                    </span>
                    <span className="text-sm font-heading font-bold text-[#19D4FF]">
                      {activityBonus[activity] > 0 ? '+' : ''}{activityBonus[activity]} {t.waterIntakeCalculator.units.milliliters}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2.5 px-3 rounded-lg bg-white/5">
                    <span className="text-sm text-white/80 font-sans font-normal">
                      {t.waterIntakeCalculator.results.climateAdaptation}
                    </span>
                    <span className="text-sm font-heading font-bold text-[#19D4FF]">
                      {climateBonus[climate] > 0 ? '+' : ''}{climateBonus[climate]} {t.waterIntakeCalculator.units.milliliters}
                    </span>
                  </div>
                </div>
              </div>

              {/* Glasses Visualization */}
              <div className="pt-6 border-t border-white/20">
                <p className="text-sm text-white/70 font-sans font-normal mb-4 text-center">
                  Cela équivaut approximativement à :
                </p>
                <div className="flex flex-wrap justify-center gap-2 mb-2">
                  {Array.from({ length: glasses }).map((_, index) => (
                    <div key={index} className="w-6 h-6 flex items-center justify-center">
                      <WaterGlass className="w-6 h-6 text-[#19D4FF]" />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-white/60 font-sans font-normal text-center">
                  ({t.waterIntakeCalculator.results.glassesText})
                </p>
              </div>
            </div>
          </GlassCard>
        )}

        {/* Footer Disclaimer */}
        {showResults && (
          <div className="mt-8 text-center">
            <p className="text-xs text-white/60 font-sans font-normal italic">
              N'oubliez pas : buvez de l'eau tout au long de la journée, n'attendez pas d'avoir soif.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}




