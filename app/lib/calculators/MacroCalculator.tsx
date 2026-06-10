'use client';

import { useState } from 'react';
import { GlassCard } from '../../../components/ui/glass-card';
import { Accordion } from '../../../components/ui/Accordion';
import { Dropdown } from '../../../components/ui/Dropdown';
import type { Language } from '@/app/lib/i18n/translations';
import { getTranslation } from '@/app/lib/i18n/translations';
import { Dumbbell, Wheat, Droplet } from 'lucide-react';

interface MacroCalculatorProps {
  language?: Language
}

export function MacroCalculator({ language: propLanguage }: MacroCalculatorProps = { language: undefined }) {
  const [internalLanguage, setInternalLanguage] = useState<Language>('fr');
  const language = propLanguage ?? internalLanguage;
  const t = getTranslation(language);

  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [age, setAge] = useState<string>('');
  const [weight, setWeight] = useState<string>('');
  const [height, setHeight] = useState<string>('');
  const [activityLevel, setActivityLevel] = useState<number>(1.375); // Moderate
  const [goal, setGoal] = useState<'deficit' | 'maintenance' | 'surplus'>('maintenance');
  const [showResults, setShowResults] = useState(false);

  const activityLevels = [
    { value: 1.2, label: t.macroCalculator.activityLevel.sedentary, description: 'Peu ou pas d\'exercice, travail de bureau' },
    { value: 1.375, label: t.macroCalculator.activityLevel.light, description: '1 à 3 jours d\'exercice léger par semaine' },
    { value: 1.55, label: t.macroCalculator.activityLevel.moderate, description: '3 à 5 jours d\'exercice modéré par semaine' },
    { value: 1.725, label: t.macroCalculator.activityLevel.active, description: '6 à 7 jours d\'exercice intense par semaine' },
    { value: 1.9, label: t.macroCalculator.activityLevel.veryActive, description: 'Exercice très intense, travail physique ou entraînement 2x/jour' },
  ];

  // Convert string inputs to numbers for calculations
  const ageNum = Number(age) || 0;
  const weightNum = Number(weight) || 0;
  const heightNum = Number(height) || 0;

  const handleCalculate = () => {
    if (ageNum > 0 && weightNum > 0 && heightNum > 0) {
      setShowResults(true);
    }
  };

  // Mifflin-St Jeor Formula
  const calculateBMR = () => {
    if (gender === 'male') {
      return 10 * weightNum + 6.25 * heightNum - 5 * ageNum + 5;
    } else {
      return 10 * weightNum + 6.25 * heightNum - 5 * ageNum - 161;
    }
  };

  const calculateTDEE = () => {
    return calculateBMR() * activityLevel;
  };

  const calculateTargetCalories = () => {
    const tdee = calculateTDEE();
    if (goal === 'deficit') return Math.round(tdee * 0.85); // -15%
    if (goal === 'surplus') return Math.round(tdee * 1.15); // +15%
    return Math.round(tdee);
  };

  const calculateMacros = () => {
    const calories = calculateTargetCalories();
    const protein = Math.round(weightNum * 2.2); // 2.2g per kg
    const proteinCalories = protein * 4;
    const fats = Math.round(calories * 0.25 / 9); // 25% of calories
    const fatCalories = fats * 9;
    const carbs = Math.round((calories - proteinCalories - fatCalories) / 4);
    return { protein, carbs, fats };
  };

  const bmr = calculateBMR();
  const tdee = calculateTDEE();
  const targetCalories = calculateTargetCalories();
  const macros = calculateMacros();

  return (
    <section className="relative py-12 md:py-16 lg:py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 md:mb-12">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-heading font-extralight mb-4 text-white tracking-tight">
            {t.macroCalculator.title}
          </h1>
          <p className="text-base sm:text-lg font-sans font-normal text-white/70 mb-6">
            {t.macroCalculator.subtitle}
          </p>
        </div>

        {/* Input Form Card */}
        <GlassCard glassLevel="medium" depth={3} withGlow={true} animation="scale" className="mb-8">
          <div className="space-y-6">
            {/* Gender */}
            <div>
              <label className="block text-sm text-white/70 mb-3 font-sans font-normal">
                {t.macroCalculator.personalInfo.gender}
              </label>
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setGender('male');
                    setShowResults(false);
                  }}
                  className={`flex-1 min-h-[44px] py-3 px-4 rounded-card border-2 transition-all font-sans font-semibold text-base ${
                    gender === 'male'
                      ? 'bg-[#19D4FF]/20 border-[#19D4FF] text-[#19D4FF]'
                      : 'border-white/20 text-white/70 hover:border-[#19D4FF]/30 bg-white/5'
                  }`}
                >
                  {t.macroCalculator.personalInfo.male}
                </button>
                <button
                  onClick={() => {
                    setGender('female');
                    setShowResults(false);
                  }}
                  className={`flex-1 min-h-[44px] py-3 px-4 rounded-card border-2 transition-all font-sans font-semibold text-base ${
                    gender === 'female'
                      ? 'bg-[#19D4FF]/20 border-[#19D4FF] text-[#19D4FF]'
                      : 'border-white/20 text-white/70 hover:border-[#19D4FF]/30 bg-white/5'
                  }`}
                >
                  {t.macroCalculator.personalInfo.female}
                </button>
              </div>
            </div>

            {/* Input Fields in 2 Columns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Left Column */}
              <div className="space-y-4">
                {/* Age */}
                <div>
                  <label className="block text-sm text-white/70 mb-2 font-sans font-normal">
                    {t.macroCalculator.personalInfo.age} ({t.macroCalculator.personalInfo.ageUnit || 'années'})
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

                {/* Activity Level */}
                <div>
                  <label className="block text-sm text-white/70 mb-2 font-sans font-normal">
                    {t.macroCalculator.activityLevel.label}
                  </label>
                  <Dropdown
                    value={activityLevel}
                    onChange={(value) => {
                      setActivityLevel(Number(value));
                      setShowResults(false);
                    }}
                    options={activityLevels.map((level) => ({
                      value: level.value,
                      label: level.label,
                      description: level.description
                    }))}
                  />
                </div>
              </div>
            </div>

            {/* Goal (Full Width) */}
            <div>
              <label className="block text-sm text-white/70 mb-2 font-sans font-normal">
                {t.macroCalculator.goal.label}
              </label>
              <Dropdown
                value={goal}
                onChange={(value) => {
                  setGoal(value as typeof goal);
                  setShowResults(false);
                }}
                options={[
                  { value: 'deficit', label: t.macroCalculator.goal.deficit },
                  { value: 'maintenance', label: t.macroCalculator.goal.maintenance },
                  { value: 'surplus', label: t.macroCalculator.goal.surplus }
                ]}
              />
            </div>

            {/* Calculate Button */}
            <button
              onClick={handleCalculate}
              disabled={ageNum === 0 || weightNum === 0 || heightNum === 0}
              className="w-full min-h-[48px] bg-gradient-to-r from-[#19D4FF] via-[#0FA8CC] to-[#0B8FA8] text-white py-3 px-6 rounded-button font-sans font-semibold text-base transition-all hover:from-[#0FA8CC] hover:via-[#0B8FA8] hover:to-[#19D4FF] active:scale-[0.98] disabled:bg-[rgba(15,35,52,0.2)] disabled:text-white/70 disabled:cursor-not-allowed disabled:hover:from-[rgba(15,35,52,0.2)] disabled:active:scale-100 shadow-lg shadow-[#19D4FF]/20 relative z-10"
            >
              {t.macroCalculator.calculateButton || 'Macros de calcul'}
            </button>
          </div>
        </GlassCard>

        {/* Results Section */}
        {showResults && ageNum > 0 && weightNum > 0 && heightNum > 0 && (
          <GlassCard glassLevel="medium" depth={3} withGlow={true} animation="scale" className="mb-8">
            <div className="space-y-8">
              <h2 className="text-xl sm:text-2xl font-heading font-semibold text-white mb-6">
                {t.macroCalculator.results.estimatedResults}
              </h2>

              {/* Target Calories */}
              <div className="mb-8">
                <div className="text-sm text-white/70 font-sans font-normal mb-2">
                  {t.macroCalculator.results.caloriesForGoal}
                </div>
                <div className="text-5xl font-heading font-bold text-[#19D4FF] mb-2">
                  {targetCalories}
                </div>
                <div className="text-sm text-white/60 font-sans font-normal">
                  {t.common.kcalPerDay}
                </div>
              </div>

              {/* Macros Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Protein Card */}
                <div className="p-5 rounded-card bg-blue-400/20 border border-blue-400/50 backdrop-blur-[8px]">
                  <div className="flex items-center gap-3 mb-3">
                    <Dumbbell className="w-6 h-6 text-blue-400 flex-shrink-0" />
                    <div className="text-sm font-sans font-semibold text-white">
                      {t.macroCalculator.results.protein}
                    </div>
                  </div>
                  <div className="text-3xl font-heading font-bold text-white">
                    {macros.protein} g
                  </div>
                </div>

                {/* Carbs Card */}
                <div className="p-5 rounded-card bg-yellow-400/20 border border-yellow-400/50 backdrop-blur-[8px]">
                  <div className="flex items-center gap-3 mb-3">
                    <Wheat className="w-6 h-6 text-yellow-400 flex-shrink-0" />
                    <div className="text-sm font-sans font-semibold text-white">
                      {t.macroCalculator.results.carbs}
                    </div>
                  </div>
                  <div className="text-3xl font-heading font-bold text-white">
                    {macros.carbs} g
                  </div>
                </div>

                {/* Fats Card */}
                <div className="p-5 rounded-card bg-pink-400/20 border border-pink-400/50 backdrop-blur-[8px]">
                  <div className="flex items-center gap-3 mb-3">
                    <Droplet className="w-6 h-6 text-pink-400 flex-shrink-0" />
                    <div className="text-sm font-sans font-semibold text-white">
                      {t.macroCalculator.results.fats}
                    </div>
                  </div>
                  <div className="text-3xl font-heading font-bold text-white">
                    {macros.fats} g
                  </div>
                </div>
              </div>
            </div>
          </GlassCard>
        )}

        {/* Formula */}
        <div className="mt-8 text-center">
          <p className="text-xs text-white/50 font-mono font-normal">
            {t.common.formula}: Mifflin-St Jeor (1990)
          </p>
        </div>

        {/* FAQ */}
        <div className="mt-16 max-w-4xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-heading font-extralight text-white mb-8 text-center">
            {t.macroCalculator.faq.title}
          </h2>
          <GlassCard glassLevel="medium" depth={3} withGlow={false}>
            <Accordion
              items={[
                {
                  question: t.macroCalculator.faq.activityLevel.question,
                  answer: (
                    <div className="whitespace-pre-line">
                      {t.macroCalculator.faq.activityLevel.answer}
                    </div>
                  ),
                },
                {
                  question: t.macroCalculator.faq.macrosCalculation.question,
                  answer: (
                    <div className="whitespace-pre-line">
                      {t.macroCalculator.faq.macrosCalculation.answer}
                    </div>
                  ),
                },
                {
                  question: t.macroCalculator.faq.tdee.question,
                  answer: (
                    <div>
                      {t.macroCalculator.faq.tdee.answer}
                    </div>
                  ),
                },
                {
                  question: t.macroCalculator.faq.accuracy.question,
                  answer: (
                    <div>
                      {t.macroCalculator.faq.accuracy.answer}
                    </div>
                  ),
                },
              ]}
            />
          </GlassCard>
        </div>
      </div>
    </section>
  );
}








