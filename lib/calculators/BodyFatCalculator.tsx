'use client';

import { useState } from 'react';
import { GlassCard } from '../../components/ui/glass-card';
import type { Language } from '@/lib/i18n/translations';
import { getTranslation } from '@/lib/i18n/translations';

interface BodyFatCalculatorProps {
  language?: Language
}

export function BodyFatCalculator({ language: propLanguage }: BodyFatCalculatorProps = { language: undefined }) {
  const [internalLanguage, setInternalLanguage] = useState<Language>('fr');
  const language = propLanguage ?? internalLanguage;
  const t = getTranslation(language);

  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [age, setAge] = useState<string>('');
  const [weight, setWeight] = useState<string>('');
  const [height, setHeight] = useState<string>('');
  const [neck, setNeck] = useState<string>('');
  const [waist, setWaist] = useState<string>('');
  const [hips, setHips] = useState<string>('');
  const [showResults, setShowResults] = useState(false);

  // Convert to numbers for calculations
  const ageNum = Number(age) || 30;
  const weightNum = Number(weight) || 70;
  const heightNum = Number(height) || 175;
  const neckNum = Number(neck) || 38;
  const waistNum = Number(waist) || 80;
  const hipsNum = Number(hips) || 95;

  // Estimate skinfolds based on anthropometric measurements
  // CORRECTED for lean profiles (BMI < 22.5, WHR < 0.44)
  const estimateSkinfolds = (weight: number, height: number, waist: number, neck: number, age: number): number => {
    const bmi = weight / ((height / 100) ** 2);
    const waistHeightRatio = waist / height;
    const neckFactor = neck / height;
    
    // CORRECTION PROFILS LEAN (IMC < 22.5)
    const leanBias = bmi < 22.5 ? (22.5 - bmi) * 3.5 : 0; // +10.5mm max pour IMC 19.5
    
    // Plis recalibrés
    const abdominal = (waistHeightRatio - 0.35) * 280 + (bmi - 20) * 2.4 + leanBias;
    const chest = (bmi - 18.5) * 2.1 + (age - 25) * 0.2;
    const thigh = (bmi - 19.5) * 1.8 - (neckFactor - 0.175) * 70;
    
    const sum = abdominal + chest + thigh;
    
    // Plancher rehaussé pour profils lean
    return Math.max(bmi < 22 ? 25 : 20, sum);
  };

  // VALIDATION POST-CALCUL
  const validateBodyFat = (bodyFat: number, bmi: number, waistHeightRatio: number, neck: number, height: number): number => {
    // Si profil lean + WHR très bas → ajouter 2-3%
    if (bmi < 22 && waistHeightRatio < 0.44) {
      bodyFat += 2.5;
    }
    
    // Si cou musclé (proxy masse maigre élevée)
    if (neck / height > 0.19) {
      bodyFat += 1.2;
    }
    
    return Math.min(50, Math.max(5, bodyFat));
  };

  // Jackson-Pollock 3-Site Body Density Calculation
  const calculateBodyFat = (): { bodyFat: number; precisionWarning: string | null } => {
    if (weightNum <= 0 || heightNum <= 0 || waistNum <= 0 || neckNum <= 0) {
      return { bodyFat: 0, precisionWarning: null };
    }

    // Estimate sum of 3 skinfolds (corrected for lean profiles)
    const sum3Skinfolds = estimateSkinfolds(weightNum, heightNum, waistNum, neckNum, ageNum);
    
    // Calculate Body Density using Jackson-Pollock formula
    let bodyDensity: number;
    if (gender === 'male') {
      // Men: BD = 1.10938 - (0.0008267 × sum3Skinfolds) + (0.0000016 × (sum3Skinfolds²)) - (0.0002574 × age)
      bodyDensity = 1.10938 - (0.0008267 * sum3Skinfolds) + (0.0000016 * (sum3Skinfolds ** 2)) - (0.0002574 * ageNum);
    } else {
      // Women: BD = 1.0994921 - (0.0009929 × sum3Skinfolds) + (0.0000023 × (sum3Skinfolds²)) - (0.0001392 × age)
      bodyDensity = 1.0994921 - (0.0009929 * sum3Skinfolds) + (0.0000023 * (sum3Skinfolds ** 2)) - (0.0001392 * ageNum);
    }
    
    // Convert Body Density to Body Fat % using Siri Equation
    // BF% = ((4.95 / BD) - 4.50) × 100
    let bodyFat = ((4.95 / bodyDensity) - 4.50) * 100;
    
    // Apply validation corrections for lean profiles
    const bmi = weightNum / ((heightNum / 100) ** 2);
    const waistHeightRatio = waistNum / heightNum;
    bodyFat = validateBodyFat(bodyFat, bmi, waistHeightRatio, neckNum, heightNum);
    
    // Physiological limits
    if (gender === 'male') {
      if (bodyFat < 5) bodyFat = 5;   // Minimum viable for men
    } else {
      if (bodyFat < 10) bodyFat = 10; // Minimum viable for women
    }
    if (bodyFat > 50) bodyFat = 50;  // Maximum calculable
    
    // Precision warnings
    let precisionWarning: string | null = null;
    
    if (bmi < 18.5 || bmi > 30) {
      precisionWarning = "IMC hors norme - estimation moins précise pour morphologies extrêmes";
    }
    
    if (waistHeightRatio > 0.60) {
      precisionWarning = "Ratio taille/hauteur élevé - recommandation DEXA scan";
    }
    
    return { bodyFat, precisionWarning };
  };

  const { bodyFat: bodyFatPercentage, precisionWarning } = calculateBodyFat();

  const fatMass = (weightNum * bodyFatPercentage) / 100;
  const leanMass = weightNum - fatMass;

  // Reference ranges based on gender - CONTIGUOUS RANGES (no gaps)
  // Men: Athlète < 13%, Fit 13-17.9%, Moyenne 18-24.9%, Obésité ≥ 25%
  // Women: Athlète < 21%, Fit 21-24.9%, Moyenne 25-31.9%, Obésité ≥ 32%
  const referenceRanges = gender === 'male' 
    ? [
        { label: t.bodyFatCalculator.reference.athlete, min: 0, max: 12.99, color: 'bg-blue-500' },
        { label: t.bodyFatCalculator.reference.fit, min: 13, max: 17.99, color: 'bg-green-500' },
        { label: t.bodyFatCalculator.reference.average, min: 18, max: 24.99, color: 'bg-yellow-500' },
        { label: t.bodyFatCalculator.reference.obese, min: 25, max: 100, color: 'bg-red-500' },
      ]
    : [
        { label: t.bodyFatCalculator.reference.athlete, min: 0, max: 20.99, color: 'bg-blue-500' },
        { label: t.bodyFatCalculator.reference.fit, min: 21, max: 24.99, color: 'bg-green-500' },
        { label: t.bodyFatCalculator.reference.average, min: 25, max: 31.99, color: 'bg-yellow-500' },
        { label: t.bodyFatCalculator.reference.obese, min: 32, max: 100, color: 'bg-red-500' },
      ];

  // Strict conditional logic - covers 100% of spectrum 0-50%
  const getBodyFatCategory = (bodyFat: number): string => {
    if (gender === 'male') {
      if (bodyFat < 13) return t.bodyFatCalculator.categories.athletic;
      if (bodyFat >= 13 && bodyFat < 18) return t.bodyFatCalculator.categories.fitness;
      if (bodyFat >= 18 && bodyFat < 25) return t.bodyFatCalculator.categories.average;
      return t.bodyFatCalculator.categories.obese;
    } else {
      if (bodyFat < 21) return t.bodyFatCalculator.categories.athletic;
      if (bodyFat >= 21 && bodyFat < 25) return t.bodyFatCalculator.categories.fitness;
      if (bodyFat >= 25 && bodyFat < 32) return t.bodyFatCalculator.categories.average;
      return t.bodyFatCalculator.categories.obese;
    }
  };

  const getCurrentRange = () => {
    // Use strict conditional logic first, then find matching range
    const category = getBodyFatCategory(bodyFatPercentage);
    return referenceRanges.find(range => {
      if (category === t.bodyFatCalculator.categories.athletic) {
        return range.label === t.bodyFatCalculator.reference.athlete;
      } else if (category === t.bodyFatCalculator.categories.fitness) {
        return range.label === t.bodyFatCalculator.reference.fit;
      } else if (category === t.bodyFatCalculator.categories.average) {
        return range.label === t.bodyFatCalculator.reference.average;
      } else if (category === t.bodyFatCalculator.categories.obese) {
        return range.label === t.bodyFatCalculator.reference.obese;
      }
      return false;
    }) || referenceRanges[referenceRanges.length - 1]; // Safety fallback
  };

  const getCategory = () => {
    return getBodyFatCategory(bodyFatPercentage);
  };

  const currentRange = getCurrentRange();
  
  // Calculate position on gauge (0-100% of visual scale)
  const maxGaugeValue = gender === 'male' ? 35 : 45;
  const gaugePosition = Math.min(100, (bodyFatPercentage / maxGaugeValue) * 100);

  return (
    <section className="relative py-12 md:py-16 lg:py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 md:mb-12">
          <div>
            <p className="text-xs font-sans font-normal uppercase tracking-widest text-white/60 mb-2">
              {t.common.calculator}
            </p>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-heading font-extralight mb-4 text-white tracking-tight">{t.bodyFatCalculator.title}</h1>
            <p className="text-base sm:text-lg font-sans font-normal text-white/70 mb-6">{t.bodyFatCalculator.subtitle}</p>
            
            {/* Instructions */}
            <GlassCard glassLevel="light" depth={2} withGlow={false} className="mb-6">
              <h3 className="text-sm font-sans font-normal text-white mb-2">{t.bodyFatCalculator.instructions.title}</h3>
              <p className="text-xs text-white/70 mb-3">{t.bodyFatCalculator.instructions.subtitle}</p>
              <ul className="space-y-1.5 text-xs text-white/70">
                <li className="flex items-start gap-2">
                  <span className="text-[#19D4FF] font-sans font-normal">•</span>
                  <span>{t.bodyFatCalculator.instructions.waist}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#19D4FF] font-sans font-normal">•</span>
                  <span>{t.bodyFatCalculator.instructions.neck}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#19D4FF] font-sans font-normal">•</span>
                  <span>{t.bodyFatCalculator.instructions.hips}</span>
                </li>
              </ul>
            </GlassCard>
          </div>
        </div>

        {/* Input Form Card */}
        <GlassCard glassLevel="medium" depth={3} withGlow={true} animation="scale" className="mb-8">
            <div className="space-y-6">
            {/* Gender Selection */}
              <div>
              <label className="block text-sm text-white/70 mb-3 font-sans font-normal">
                Sélectionnez le sexe :
              </label>
                <div className="flex gap-4">
                  <button
                  onClick={() => {
                    setGender('male');
                    setShowResults(false);
                  }}
                  className={`flex-1 py-4 px-4 rounded-card border-2 transition-all font-sans font-semibold text-base ${
                      gender === 'male'
                        ? 'bg-[#19D4FF]/20 border-[#19D4FF] text-[#19D4FF]'
                        : 'border-white/20 text-white/70 hover:border-[#19D4FF]/30 bg-white/5'
                    }`}
                  >
                  ♂ {t.macroCalculator.personalInfo.male}
                  </button>
                  <button
                  onClick={() => {
                    setGender('female');
                    setShowResults(false);
                  }}
                  className={`flex-1 py-4 px-4 rounded-card border-2 transition-all font-sans font-semibold text-base ${
                      gender === 'female'
                        ? 'bg-[#19D4FF]/20 border-[#19D4FF] text-[#19D4FF]'
                        : 'border-white/20 text-white/70 hover:border-[#19D4FF]/30 bg-white/5'
                    }`}
                  >
                  ♀ {t.macroCalculator.personalInfo.female}
                  </button>
                </div>
              </div>

            {/* Input Fields in 2 Columns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Left Column */}
              <div className="space-y-4">
              {/* Weight */}
              <div>
                  <label className="block text-sm text-white/70 mb-2 font-sans font-normal">
                    {t.macroCalculator.personalInfo.weight} ({t.macroCalculator.personalInfo.weightUnit})
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

                {/* Neck */}
              <div>
                  <label className="block text-sm text-white/70 mb-2 font-sans font-normal">
                    {t.bodyFatCalculator.measurements.neck}
                  </label>
                <input
                  type="text"
                  inputMode="numeric"
                    value={neck}
                    onChange={(e) => {
                      setNeck(e.target.value.replace(/[^0-9.]/g, ''));
                      setShowResults(false);
                    }}
                  onFocus={(e) => {
                    e.target.select();
                  }}
                    className="w-full min-h-[44px] px-4 py-3 bg-white/5 border border-white/20 rounded-card focus:border-[#19D4FF] focus:outline-none text-white placeholder:text-white/50 transition-all font-sans font-normal text-base"
                    placeholder="35"
                />
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-4">
                {/* Height */}
              <div>
                  <label className="block text-sm text-white/70 mb-2 font-sans font-normal">
                    {t.macroCalculator.personalInfo.height} ({t.macroCalculator.personalInfo.heightUnit})
                  </label>
                <input
                  type="text"
                  inputMode="numeric"
                    value={height}
                    onChange={(e) => {
                      setHeight(e.target.value.replace(/[^0-9]/g, ''));
                      setShowResults(false);
                    }}
                  onFocus={(e) => {
                    e.target.select();
                  }}
                    className="w-full min-h-[44px] px-4 py-3 bg-white/5 border border-white/20 rounded-card focus:border-[#19D4FF] focus:outline-none text-white placeholder:text-white/50 transition-all font-sans font-normal text-base"
                    placeholder="180"
                />
              </div>

              {/* Waist */}
              <div>
                  <label className="block text-sm text-white/70 mb-2 font-sans font-normal">
                    {t.bodyFatCalculator.measurements.waist}
                  </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={waist}
                    onChange={(e) => {
                      setWaist(e.target.value.replace(/[^0-9.]/g, ''));
                      setShowResults(false);
                    }}
                  onFocus={(e) => {
                    e.target.select();
                  }}
                    className="w-full min-h-[44px] px-4 py-3 bg-white/5 border border-white/20 rounded-card focus:border-[#19D4FF] focus:outline-none text-white placeholder:text-white/50 transition-all font-sans font-normal text-base"
                    placeholder="76"
                  />
                </div>
              </div>
            </div>

            {/* Age Field (Full Width) */}
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

              {/* Hips (only for females) */}
              {gender === 'female' && (
                <div>
                <label className="block text-sm text-white/70 mb-2 font-sans font-normal">
                  {t.bodyFatCalculator.measurements.hips}
                </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={hips}
                  onChange={(e) => {
                    setHips(e.target.value.replace(/[^0-9.]/g, ''));
                    setShowResults(false);
                  }}
                    onFocus={(e) => {
                      e.target.select();
                    }}
                  className="w-full min-h-[44px] px-4 py-3 bg-white/5 border border-white/20 rounded-card focus:border-[#19D4FF] focus:outline-none text-white placeholder:text-white/50 transition-all font-sans font-normal text-base"
                    placeholder="95"
                  />
                </div>
              )}

            {/* Calculate Button */}
            <button
              onClick={() => {
                if (weightNum > 0 && heightNum > 0 && waistNum > 0 && neckNum > 0) {
                  setShowResults(true);
                }
              }}
              disabled={weightNum === 0 || heightNum === 0 || waistNum === 0 || neckNum === 0}
              className="w-full min-h-[48px] bg-gradient-to-r from-[#19D4FF] via-[#0FA8CC] to-[#0B8FA8] text-white py-3 px-6 rounded-button font-sans font-semibold text-base transition-all hover:from-[#0FA8CC] hover:via-[#0B8FA8] hover:to-[#19D4FF] active:scale-[0.98] disabled:bg-[rgba(15,35,52,0.2)] disabled:text-white/70 disabled:cursor-not-allowed disabled:hover:from-[rgba(15,35,52,0.2)] disabled:active:scale-100 shadow-lg shadow-[#19D4FF]/20 relative z-10"
            >
              {t.bodyFatCalculator.calculateButton || 'Calculer le pourcentage de graisse corporelle'}
            </button>
            </div>
          </GlassCard>

        {/* Results Section */}
        {showResults && weightNum > 0 && heightNum > 0 && waistNum > 0 && neckNum > 0 && (
          <GlassCard glassLevel="medium" depth={3} withGlow={true} animation="scale" className="mb-8">
            <div className="space-y-8">
              <h2 className="text-2xl font-heading font-semibold text-white mb-6">
                {t.bodyFatCalculator.results.title}
              </h2>

              {/* Body Fat % */}
              <div className="mb-6">
                <div className="text-sm text-white/70 font-sans font-normal mb-2">
                  {t.bodyFatCalculator.results.bodyFat} (MG)
                </div>
                <div className="text-5xl font-heading font-bold text-[#19D4FF] mb-2">
                  {bodyFatPercentage.toFixed(1).replace('.', ',')}%
                </div>
                <div className={`text-base font-heading font-semibold ${
                  getCategory() === t.bodyFatCalculator.categories.athletic ? 'text-green-400' :
                  getCategory() === t.bodyFatCalculator.categories.fitness ? 'text-green-400' :
                  getCategory() === t.bodyFatCalculator.categories.average ? 'text-yellow-400' :
                  'text-red-400'
                }`}>
                  {getCategory()}
                </div>
                
                {/* Precision Warning */}
                {precisionWarning && (
                  <div className="mt-4 p-3 rounded-card bg-[#F3B544]/20 border border-[#F3B544]/30">
                    <p className="text-xs text-[#F3B544] font-sans font-normal">{precisionWarning}</p>
                  </div>
                )}
              </div>

              {/* Visual Gauge */}
              <div className="mb-6">
                <div className="relative h-6 bg-gradient-to-r from-white/5 via-white/8 to-white/5 rounded-full overflow-hidden border border-white/10 shadow-inner">
                  {/* Background gradient zones */}
                  {referenceRanges.map((range) => {
                    const rangeStart = (range.min / maxGaugeValue) * 100;
                    const rangeWidth = ((range.max - range.min) / maxGaugeValue) * 100;
                    
                    return (
                      <div
                        key={range.label}
                        className={`absolute h-full ${range.color} opacity-60 rounded-full transition-all duration-300`}
                        style={{
                          left: `${rangeStart}%`,
                          width: `${rangeWidth}%`,
                        }}
                      />
                    );
                  })}
                  
                  {/* Current position indicator - Elegant design */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 z-30 transition-all duration-500 ease-out"
                    style={{ left: `${Math.min(100, gaugePosition)}%`, transform: 'translate(-50%, -50%)' }}
                  >
                    {/* Main indicator line with gradient */}
                    <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-1 bg-gradient-to-b from-[#19D4FF] to-[#0FA8CC] rounded-full shadow-[0_0_6px_rgba(25,212,255,0.5)]" />
                    
                    {/* Elegant indicator dot */}
                    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-5 h-5 bg-gradient-to-br from-[#19D4FF] to-[#0B8FA8] rounded-full border-2 border-white shadow-[0_2px_8px_rgba(25,212,255,0.4),0_0_0_2px_rgba(25,212,255,0.2)]">
                      <div className="absolute inset-0.5 bg-white/30 rounded-full" />
                    </div>
                    
                    {/* Subtle glow effect */}
                    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-5 h-5 bg-[#19D4FF]/20 rounded-full blur-md -z-10" />
                  </div>
                  
                  {/* Subtle tick marks for better readability */}
                  <div className="absolute inset-0 flex justify-between items-center px-1 pointer-events-none">
                    {[0, 25, 50, 75, 100].map((tick) => (
                      <div
                        key={tick}
                        className="w-px h-2 bg-white/20 rounded-full"
                        style={{ opacity: tick % 25 === 0 ? 0.4 : 0.2 }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Reference Table */}
              <div className="pt-6 border-t border-white/20">
                <h3 className="text-base font-heading font-semibold text-white mb-4">
                  {t.bodyFatCalculator.reference.table}
                </h3>
                <div className="space-y-2">
                  {referenceRanges.map((range) => {
                    const isCurrent = range.label === currentRange.label;
                    return (
                      <div
                        key={range.label}
                        className={`flex items-center justify-between px-4 py-3 rounded-card border ${
                          isCurrent ? 'bg-[#19D4FF]/20 border-[#19D4FF]' : 'bg-white/5 border-white/20'
                        }`}
                      >
                        <span className={`text-sm font-sans font-normal ${isCurrent ? 'text-[#19D4FF] font-semibold' : 'text-white/70'}`}>
                            {range.label}
                          </span>
                        <span className={`text-sm font-heading font-semibold ${isCurrent ? 'text-[#19D4FF]' : 'text-white/70'}`}>
                          {range.min === 0 
                            ? `${t.bodyFatCalculator.reference.upTo} ${Math.ceil(range.max)}%` 
                            : range.max >= 100 
                            ? `${t.bodyFatCalculator.reference.above} ${range.min}%` 
                            : `${range.min}% - ${Math.ceil(range.max)}%`}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-white/60 font-sans font-normal mt-3">
                  ({gender === 'male' ? t.bodyFatCalculator.reference.men : t.bodyFatCalculator.reference.women})
                </p>
              </div>

              {/* Mass Details - Two Boxes Side by Side */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {/* Fat Mass */}
                <div className="p-4 rounded-card bg-white/5 border border-white/10">
                  <div className="text-xs text-white/70 font-sans font-normal mb-1">
                    masse grasse
                  </div>
                  <div className="text-2xl font-heading font-bold text-white">
                    {fatMass.toFixed(1).replace('.', ',')} kg
                  </div>
              </div>

              {/* Lean Mass */}
                <div className="p-4 rounded-card bg-white/5 border border-white/10">
                  <div className="text-xs text-white/70 font-sans font-normal mb-1">
                    masse maigre
                  </div>
                  <div className="text-2xl font-heading font-bold text-white">
                    {leanMass.toFixed(1).replace('.', ',')} kg
                  </div>
                </div>
              </div>
            </div>
          </GlassCard>
        )}

        {/* Disclaimer */}
        {showResults && (
        <div className="mt-8 text-center">
            <p className="text-xs text-white/60 font-sans font-normal italic">
              Cette méthode ne donne qu'une estimation. Pour une évaluation complète, veuillez consulter un professionnel.
          </p>
        </div>
        )}
      </div>
    </section>
  );
}








