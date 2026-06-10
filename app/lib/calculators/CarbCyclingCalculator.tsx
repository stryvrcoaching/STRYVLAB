'use client';

import { useState } from 'react';
import { GlassCard } from '../../../components/ui/glass-card';
import type { Language } from '@/app/lib/i18n/translations';
import { getTranslation } from '@/app/lib/i18n/translations';
import { Check, Circle, Activity } from 'lucide-react';

interface CarbCyclingCalculatorProps {
  language?: Language
}

export function CarbCyclingCalculator({ language: propLanguage }: CarbCyclingCalculatorProps = { language: undefined }) {
  const [internalLanguage, setInternalLanguage] = useState<Language>('fr');
  const language = propLanguage ?? internalLanguage;
  const t = getTranslation(language);

  const [protein, setProtein] = useState<string>('');
  const [carbs, setCarbs] = useState<string>('');
  const [fats, setFats] = useState<string>('');
  const [protocol, setProtocol] = useState<'2/1' | '3/1' | '4/1'>('3/1');
  const [showResults, setShowResults] = useState(false);

  const proteinNum = Number(protein) || 0;
  const carbsNum = Number(carbs) || 0;
  const fatsNum = Number(fats) || 0;

  // Nouvelle logique selon spécifications :
  // Gb = Gm × 0.50 (jours bas)
  // Total_cycle = (a + b) × Gm
  // Gh = Total_cycle − (a × Gb) (jour haut)
  // P et L restent constants
  
  const getProtocolDays = () => {
    switch (protocol) {
      case '2/1':
        return { a: 2, b: 1 }; // a = jours bas, b = jours haut
      case '3/1':
        return { a: 3, b: 1 };
      case '4/1':
        return { a: 4, b: 1 };
    }
  };

  const days = getProtocolDays();
  
  // Calcul glucides jour bas : Gb = Gm × 0.50
  const lowDayCarbs = carbsNum > 0 ? Math.round(carbsNum * 0.5) : 0;
  
  // Calcul total glucides sur cycle : Total_cycle = (a + b) × Gm
  const totalCycleCarbs = (days.a + days.b) * carbsNum;
  
  // Calcul glucides jour haut : Gh = Total_cycle − (a × Gb)
  const highDayCarbs = carbsNum > 0 ? Math.round(totalCycleCarbs - (days.a * lowDayCarbs)) : 0;
  
  // Calcul calories : kcal = (P×4) + (glucides×4) + (L×9)
  const calculateCalories = (carbs: number) => {
    return (proteinNum * 4) + (carbs * 4) + (fatsNum * 9);
  };

  const calculateLowDay = () => {
    return {
      protein: proteinNum,
      carbs: lowDayCarbs,
      fats: fatsNum, // Lipides constants
      calories: calculateCalories(lowDayCarbs),
    };
  };

  const calculateHighDay = () => {
    return {
      protein: proteinNum,
      carbs: highDayCarbs,
      fats: fatsNum, // Lipides constants
      calories: calculateCalories(highDayCarbs),
    };
  };

  const handleCalculate = () => {
    if (proteinNum > 0 && carbsNum > 0 && fatsNum > 0) {
      setShowResults(true);
    }
  };

  const lowDay = calculateLowDay();
  const highDay = calculateHighDay();
  
  // Calcul moyenne du cycle
  const cycleAverage = (days.a + days.b) > 0 
    ? (lowDay.calories * days.a + highDay.calories * days.b) / (days.a + days.b)
    : 0;

  return (
    <section className="relative py-12 md:py-16 lg:py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 md:mb-12">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-heading font-extralight mb-4 text-white tracking-tight">
            {t.carbCyclingCalculator.title}
          </h1>
          <p className="text-base sm:text-lg text-white/70 mb-6">
            {t.carbCyclingCalculator.subtitle}
          </p>
          
          {/* Instructions Card - Light blue-grey background */}
          <GlassCard glassLevel="light" depth={2} withGlow={false} className="mb-8 bg-[rgba(255,255,255,0.12)]">
            <h3 className="text-sm font-sans font-semibold text-white mb-3">
              {t.carbCyclingCalculator.howToUse}
            </h3>
            <ol className="space-y-2 text-xs text-white/80 list-decimal list-inside font-sans font-normal">
              <li>{t.carbCyclingCalculator.instructions.step1}</li>
              <li>{t.carbCyclingCalculator.instructions.step2}</li>
              <li>{t.carbCyclingCalculator.instructions.step3}</li>
            </ol>
          </GlassCard>
        </div>

        {/* Main Calculator Card */}
        <GlassCard glassLevel="medium" depth={3} withGlow={true} animation="scale" className="mb-8">
          <div className="space-y-8">
            {/* Section 1: Input Macros */}
            <div>
              <h2 className="text-base sm:text-lg font-sans font-semibold text-white mb-4">
                1. {t.carbCyclingCalculator.maintenanceTitle}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Protein */}
                <div>
                  <label className="block text-sm text-white/70 mb-2 font-sans font-normal">
                    {t.carbCyclingCalculator.maintenanceMacros.protein} ({t.carbCyclingCalculator.unit})
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={protein}
                    onChange={(e) => {
                      setProtein(e.target.value.replace(/[^0-9.]/g, ''));
                      setShowResults(false);
                    }}
                    onFocus={(e) => {
                      e.target.select();
                    }}
                    className="w-full min-h-[44px] px-4 py-3 bg-white/5 border border-white/20 rounded-card focus:border-[#19D4FF] focus:outline-none text-white placeholder:text-white/50 transition-all font-sans font-normal text-base"
                    placeholder="170"
                  />
                </div>

                {/* Fats */}
                <div>
                  <label className="block text-sm text-white/70 mb-2 font-sans font-normal">
                    {t.carbCyclingCalculator.maintenanceMacros.fats} ({t.carbCyclingCalculator.unit})
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={fats}
                    onChange={(e) => {
                      setFats(e.target.value.replace(/[^0-9.]/g, ''));
                      setShowResults(false);
                    }}
                    onFocus={(e) => {
                      e.target.select();
                    }}
                    className="w-full min-h-[44px] px-4 py-3 bg-white/5 border border-white/20 rounded-card focus:border-[#19D4FF] focus:outline-none text-white placeholder:text-white/50 transition-all font-sans font-normal text-base"
                    placeholder="70"
                  />
                </div>

                {/* Carbs */}
                <div>
                  <label className="block text-sm text-white/70 mb-2 font-sans font-normal">
                    {t.carbCyclingCalculator.maintenanceMacros.carbs} ({t.carbCyclingCalculator.unit})
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={carbs}
                    onChange={(e) => {
                      setCarbs(e.target.value.replace(/[^0-9.]/g, ''));
                      setShowResults(false);
                    }}
                    onFocus={(e) => {
                      e.target.select();
                    }}
                    className="w-full min-h-[44px] px-4 py-3 bg-white/5 border border-white/20 rounded-card focus:border-[#19D4FF] focus:outline-none text-white placeholder:text-white/50 transition-all font-sans font-normal text-base"
                    placeholder="250"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Protocol Selection */}
            <div>
              <h2 className="text-base sm:text-lg font-sans font-semibold text-white mb-4">
                2. {t.carbCyclingCalculator.protocol.label}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                {/* Protocol 2/1 */}
                <button
                  onClick={() => {
                    setProtocol('2/1');
                    setShowResults(false);
                  }}
                  className={`p-4 rounded-card border-2 transition-all text-left ${
                    protocol === '2/1'
                      ? 'border-[#19D4FF] bg-[#19D4FF]/10'
                      : 'border-white/20 bg-white/5 hover:border-white/30'
                  }`}
                >
                  <div className={`text-lg font-heading font-semibold mb-1 ${
                    protocol === '2/1' ? 'text-[#19D4FF]' : 'text-white'
                  }`}>
                    2/1
                  </div>
                  <div className="text-xs text-white/70 font-sans font-normal">
                    {t.carbCyclingCalculator.protocol.twoOne}
                  </div>
                </button>

                {/* Protocol 3/1 */}
                <button
                  onClick={() => {
                    setProtocol('3/1');
                    setShowResults(false);
                  }}
                  className={`p-4 rounded-card border-2 transition-all text-left ${
                    protocol === '3/1'
                      ? 'border-[#19D4FF] bg-[#19D4FF]/10'
                      : 'border-white/20 bg-white/5 hover:border-white/30'
                  }`}
                >
                  <div className={`text-lg font-heading font-semibold mb-1 ${
                    protocol === '3/1' ? 'text-[#19D4FF]' : 'text-white'
                  }`}>
                    3/1
                  </div>
                  <div className="text-xs text-white/70 font-sans font-normal">
                    {t.carbCyclingCalculator.protocol.threeOne}
                  </div>
                </button>

                {/* Protocol 4/1 */}
                <button
                  onClick={() => {
                    setProtocol('4/1');
                    setShowResults(false);
                  }}
                  className={`p-4 rounded-card border-2 transition-all text-left ${
                    protocol === '4/1'
                      ? 'border-[#19D4FF] bg-[#19D4FF]/10'
                      : 'border-white/20 bg-white/5 hover:border-white/30'
                  }`}
                >
                  <div className={`text-lg font-heading font-semibold mb-1 ${
                    protocol === '4/1' ? 'text-[#19D4FF]' : 'text-white'
                  }`}>
                    4/1
                  </div>
                  <div className="text-xs text-white/70 font-sans font-normal">
                    {t.carbCyclingCalculator.protocol.fourOne}
                  </div>
                </button>
              </div>

              {/* Calculate Button */}
              <button
                onClick={handleCalculate}
                disabled={proteinNum === 0 || carbsNum === 0 || fatsNum === 0}
                className="w-full min-h-[48px] bg-gradient-to-r from-[#19D4FF] via-[#0FA8CC] to-[#0B8FA8] text-white py-3 px-6 rounded-button font-sans font-semibold text-base transition-all hover:from-[#0FA8CC] hover:via-[#0B8FA8] hover:to-[#19D4FF] active:scale-[0.98] disabled:bg-[rgba(15,35,52,0.2)] disabled:text-white/70 disabled:cursor-not-allowed disabled:hover:from-[rgba(15,35,52,0.2)] disabled:active:scale-100 shadow-lg shadow-[#19D4FF]/20 relative z-10"
              >
                {t.common.calculate || 'Calculer'}
              </button>
            </div>
          </div>
        </GlassCard>

        {/* Results Section - 2 Cards Side by Side */}
        {showResults && (
          <div className="grid md:grid-cols-2 gap-6 md:gap-8">
            {/* Low Carb Day Card */}
            <div className="p-6 rounded-card border border-red-500/50 bg-[rgba(255,255,255,0.08)] backdrop-blur-[16px]">
              <h3 className="text-lg font-heading font-semibold text-red-400 mb-4">
                {t.carbCyclingCalculator.results.lowDay}
              </h3>
              
              {/* Calories Total */}
              <div className="mb-6">
                <div className="text-xs text-white/70 font-sans font-normal mb-1">
                  {t.carbCyclingCalculator.results.calories}
                </div>
                <div className="text-4xl font-heading font-bold text-red-400 mb-1">
                  {Math.round(lowDay.calories)}
                </div>
                <div className="text-xs text-white/60 font-sans font-normal">
                  {t.common.kcalPerDay}
                </div>
              </div>

              {/* Macros Breakdown */}
              <div className="space-y-3">
                {/* Protein */}
                <div className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-[#19D4FF] flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-sm text-white/70 font-sans font-normal">
                      {t.macroCalculator.results.protein}
                    </div>
                    <div className="text-lg font-heading font-semibold text-white">
                      {lowDay.protein} {t.carbCyclingCalculator.unit}
                    </div>
                  </div>
                </div>

                {/* Carbs */}
                <div className="flex items-center gap-3">
                  <Activity className="w-5 h-5 text-[#F3B544] flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-sm text-white/70 font-sans font-normal">
                      {t.macroCalculator.results.carbs}
                    </div>
                    <div className="text-lg font-heading font-semibold text-white">
                      {lowDay.carbs} {t.carbCyclingCalculator.unit}
                    </div>
                  </div>
                </div>

                {/* Fats */}
                <div className="flex items-center gap-3">
                  <Circle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-sm text-white/70 font-sans font-normal">
                      {t.macroCalculator.results.fats}
                    </div>
                    <div className="text-lg font-heading font-semibold text-white">
                      {lowDay.fats} {t.carbCyclingCalculator.unit}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* High Carb Day Card */}
            <div className="p-6 rounded-card border border-blue-500/50 bg-[rgba(255,255,255,0.08)] backdrop-blur-[16px]">
              <h3 className="text-lg font-heading font-semibold text-blue-400 mb-4">
                {t.carbCyclingCalculator.results.highDay}
              </h3>
              
              {/* Calories Total */}
              <div className="mb-6">
                <div className="text-xs text-white/70 font-sans font-normal mb-1">
                  {t.carbCyclingCalculator.results.calories}
                </div>
                <div className="text-4xl font-heading font-bold text-blue-400 mb-1">
                  {Math.round(highDay.calories)}
                </div>
                <div className="text-xs text-white/60 font-sans font-normal">
                  {t.common.kcalPerDay}
                </div>
              </div>

              {/* Macros Breakdown */}
              <div className="space-y-3">
                {/* Protein */}
                <div className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-[#19D4FF] flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-sm text-white/70 font-sans font-normal">
                      {t.macroCalculator.results.protein}
                    </div>
                    <div className="text-lg font-heading font-semibold text-white">
                      {highDay.protein} {t.carbCyclingCalculator.unit}
                    </div>
                  </div>
                </div>

                {/* Carbs */}
                <div className="flex items-center gap-3">
                  <Activity className="w-5 h-5 text-[#F3B544] flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-sm text-white/70 font-sans font-normal">
                      {t.macroCalculator.results.carbs}
                    </div>
                    <div className="text-lg font-heading font-semibold text-white">
                      {highDay.carbs} {t.carbCyclingCalculator.unit}
                    </div>
                  </div>
                </div>

                {/* Fats */}
                <div className="flex items-center gap-3">
                  <Circle className="w-5 h-5 text-blue-400 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-sm text-white/70 font-sans font-normal">
                      {t.macroCalculator.results.fats}
                    </div>
                    <div className="text-lg font-heading font-semibold text-white">
                      {highDay.fats} {t.carbCyclingCalculator.unit}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer Disclaimer */}
        {showResults && (
          <div className="mt-8 text-center">
            <p className="text-xs text-white/60 font-sans font-normal italic">
              N'oubliez pas : la régularité est la clé du succès de tout régime.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}








