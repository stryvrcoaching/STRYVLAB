'use client';

import { useState } from 'react';
import { GlassCard } from '../../components/ui/glass-card';
import type { Language } from '@/lib/i18n/translations';
import { getTranslation } from '@/lib/i18n/translations';

interface OneRMCalculatorProps {
  language?: Language
}

export function OneRMCalculator({ language: propLanguage }: OneRMCalculatorProps = { language: undefined }) {
  const [internalLanguage, setInternalLanguage] = useState<Language>('fr');
  const language = propLanguage ?? internalLanguage;
  const t = getTranslation(language);

  const [weight, setWeight] = useState<string>('');
  const [reps, setReps] = useState<string>('');
  const [showResults, setShowResults] = useState(false);

  const weightNum = Number(weight) || 0;
  const repsNum = Number(reps) || 0;

  // Brzycki Formula
  const calculate1RM = () => {
    if (repsNum < 2 || repsNum > 12 || weightNum === 0) return null;
    return weightNum / (1.0278 - 0.0278 * repsNum);
  };

  const handleCalculate = () => {
    if (weightNum > 0 && repsNum >= 2 && repsNum <= 12) {
      setShowResults(true);
    }
  };

  const oneRM = calculate1RM();

  // Training zones based on the model
  const trainingZones = oneRM ? [
    { intensity: 100, weight: oneRM, objective: t.oneRMCalculator.trainingZones.maxStrength1RM, isHighlighted: true },
    { intensity: 95, weight: oneRM * 0.95, objective: t.oneRMCalculator.trainingZones.maxStrength },
    { intensity: 90, weight: oneRM * 0.90, objective: t.oneRMCalculator.trainingZones.strength },
    { intensity: 85, weight: oneRM * 0.85, objective: t.oneRMCalculator.trainingZones.hypertrophyStrength },
    { intensity: 80, weight: oneRM * 0.80, objective: t.oneRMCalculator.trainingZones.hypertrophy },
    { intensity: 75, weight: oneRM * 0.75, objective: t.oneRMCalculator.trainingZones.hypertrophyEndurance },
    { intensity: 70, weight: oneRM * 0.70, objective: t.oneRMCalculator.trainingZones.muscularEndurance },
    { intensity: 65, weight: oneRM * 0.65, objective: t.oneRMCalculator.trainingZones.muscularEndurance },
    { intensity: 60, weight: oneRM * 0.60, objective: t.oneRMCalculator.trainingZones.muscularEndurance },
    { intensity: 55, weight: oneRM * 0.55, objective: t.oneRMCalculator.trainingZones.warmupTechnique },
    { intensity: 50, weight: oneRM * 0.50, objective: t.oneRMCalculator.trainingZones.warmupTechnique },
  ] : [];

  return (
    <section className="relative py-12 md:py-16 lg:py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 md:mb-12">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-heading font-extralight mb-4 text-white tracking-tight">
            {t.oneRMCalculator.title}
          </h1>
          <p className="text-base sm:text-lg font-sans font-normal text-white/70 mb-6">
            {t.oneRMCalculator.subtitle}
          </p>
        </div>

        {/* Input Form Card */}
        <GlassCard glassLevel="medium" depth={3} withGlow={true} animation="scale" className="mb-8">
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Weight */}
              <div>
                <label className="block text-sm text-white/70 mb-2 font-sans font-normal">
                  {t.oneRMCalculator.weight}
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
                  placeholder="100"
                />
              </div>

              {/* Reps */}
              <div>
                <label className="block text-sm text-white/70 mb-2 font-sans font-normal">
                  {t.oneRMCalculator.reps} ({t.oneRMCalculator.repsRange})
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={reps}
                  onChange={(e) => {
                    setReps(e.target.value.replace(/[^0-9]/g, ''));
                    setShowResults(false);
                  }}
                  onFocus={(e) => {
                    e.target.select();
                  }}
                  className="w-full min-h-[44px] px-4 py-3 bg-white/5 border border-white/20 rounded-card focus:border-[#19D4FF] focus:outline-none text-white placeholder:text-white/50 transition-all font-sans font-normal text-base"
                  placeholder="4"
                />
              </div>
            </div>

            {/* Calculate Button */}
            <button
              onClick={handleCalculate}
              disabled={weightNum === 0 || repsNum < 2 || repsNum > 12}
              className="w-full min-h-[48px] bg-gradient-to-r from-[#19D4FF] via-[#0FA8CC] to-[#0B8FA8] text-white py-3 px-6 rounded-button font-sans font-semibold text-base transition-all hover:from-[#0FA8CC] hover:via-[#0B8FA8] hover:to-[#19D4FF] active:scale-[0.98] disabled:bg-[rgba(15,35,52,0.2)] disabled:text-white/70 disabled:cursor-not-allowed disabled:hover:from-[rgba(15,35,52,0.2)] disabled:active:scale-100 shadow-lg shadow-[#19D4FF]/20 relative z-10"
            >
              {t.oneRMCalculator.calculateButton || 'Calculer 1RM'}
            </button>
          </div>
        </GlassCard>

        {/* Results Section */}
        {showResults && oneRM && (
          <>
            {/* Estimated 1RM Display */}
            <GlassCard glassLevel="medium" depth={3} withGlow={true} animation="scale" className="mb-8">
              <div className="text-center space-y-4">
                <div className="text-sm text-white/70 font-sans font-normal">
                  {t.oneRMCalculator.results.estimated1RM}
                </div>
                <div className="text-5xl font-heading font-bold text-[#19D4FF]">
                  {oneRM.toFixed(1).replace('.', ',')} {t.oneRMCalculator.unit}
                </div>
                <div className="text-xs text-white/60 font-sans font-normal">
                  {t.oneRMCalculator.results.basedOnFormula}
                </div>
              </div>
            </GlassCard>

            {/* Training Zones Table */}
            <GlassCard glassLevel="medium" depth={3} withGlow={true} animation="scale" className="mb-8">
              <div className="space-y-6">
                <h2 className="text-xl sm:text-2xl font-heading font-semibold text-white mb-6">
                  {t.oneRMCalculator.results.zones}
                </h2>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/20">
                        <th className="text-left py-3 px-4 text-sm font-sans font-semibold text-white/80">
                          {t.oneRMCalculator.trainingZones.intensity}
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-sans font-semibold text-white/80">
                          {t.oneRMCalculator.trainingZones.trainingWeight}
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-sans font-semibold text-white/80">
                          {t.oneRMCalculator.trainingZones.trainingObjective}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {trainingZones.map((zone, index) => (
                        <tr
                          key={index}
                          className={`border-b border-white/10 transition-colors ${
                            zone.isHighlighted
                              ? 'bg-[#19D4FF]/20 hover:bg-[#19D4FF]/25'
                              : 'hover:bg-white/5'
                          }`}
                        >
                          <td className="py-4 px-4 text-sm font-heading font-semibold text-white">
                            {zone.intensity}%
                          </td>
                          <td className="py-4 px-4 text-base font-heading font-bold text-white">
                            {zone.weight.toFixed(1).replace('.', ',')} {t.oneRMCalculator.unit}
                          </td>
                          <td className="py-4 px-4 text-sm font-sans font-normal text-white/90">
                            {zone.objective}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </GlassCard>

            {/* Footer Disclaimer */}
            <div className="text-center">
              <p className="text-xs text-white/60 font-sans font-normal italic">
                {t.oneRMCalculator.warning}
              </p>
            </div>
          </>
        )}
      </div>
    </section>
  );
}









