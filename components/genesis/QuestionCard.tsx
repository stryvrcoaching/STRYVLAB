'use client';

import React from 'react';
import { Check } from 'lucide-react';

interface QuestionCardProps {
  question: {
    id: string;
    text: string;
    response_type: string;
    options?: string[];
    min?: number;
    max?: number;
  };
  value: any;
  onAnswer: (questionId: string, value: any) => void;
}

export function QuestionCard({ question, value, onAnswer }: QuestionCardProps) {

  const renderInput = () => {
    switch (question.response_type) {

      /* =========================
         Échelle 1–10
         ========================= */
      case 'Échelle 1-10':
        return (
          <div className="space-y-8 pt-2">

            <div className="flex justify-between items-end text-xs tracking-widest text-secondary/60 uppercase">
              <span>Faible</span>
              <span className="text-5xl font-semibold text-primary tabular-nums leading-none">
                {value || 5}
              </span>
              <span>Élevé</span>
            </div>

            <input
              type="range"
              value={value || 5}
              onChange={(e) => onAnswer(question.id, parseInt(e.target.value))}
              min={1}
              max={10}
              step={1}
              className="w-full h-2 rounded-full appearance-none cursor-pointer focus:outline-none"
              style={{
                background: `linear-gradient(
                  to right,
                  #10b981 0%,
                  #10b981 ${((value || 5) - 1) * 11.11}%,
                  #e5e7eb ${((value || 5) - 1) * 11.11}%,
                  #e5e7eb 100%
                )`,
              }}
            />

            <div className="flex justify-between text-[9px] text-secondary/60 tabular-nums px-0.5">
              {[1,2,3,4,5,6,7,8,9,10].map(n => (
                <span
                  key={n}
                  className={value === n ? 'text-accent font-medium' : ''}
                >
                  {n}
                </span>
              ))}
            </div>
          </div>
        );

      /* =========================
         Choix unique
         ========================= */
      case 'Choix unique':
        return (
          <div className="space-y-3">
            {question.options?.map((option, idx) => {
              const selected = value === option;
              return (
                <div
                  key={idx}
                  onClick={() => onAnswer(question.id, option)}
                  className={`
                    group flex items-center gap-4 p-5 rounded-xl border cursor-pointer transition-all
                    ${selected
                      ? 'bg-accent/10 border-accent text-primary'
                      : 'bg-surface-light border-gray-100 text-secondary hover:bg-white'}
                  `}
                >
                  <div
                    className={`
                      w-5 h-5 rounded-full border flex items-center justify-center transition-all
                      ${selected ? 'border-accent' : 'border-gray-300'}
                    `}
                  >
                    {selected && <div className="w-2.5 h-2.5 rounded-full bg-accent" />}
                  </div>

                  <span className="text-sm font-medium leading-snug">
                    {option}
                  </span>
                </div>
              );
            })}
          </div>
        );

      /* =========================
         Choix multiple
         ========================= */
      case 'Choix multiple':
        return (
          <div className="space-y-3">
            {question.options?.map((option, idx) => {
              const selected = Array.isArray(value) && value.includes(option);
              return (
                <div
                  key={idx}
                  onClick={() => {
                    const current = Array.isArray(value) ? value : [];
                    const next = selected
                      ? current.filter((v: string) => v !== option)
                      : [...current, option];
                    onAnswer(question.id, next);
                  }}
                  className={`
                    group flex items-center gap-4 p-5 rounded-xl border cursor-pointer transition-all
                    ${selected
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'bg-surface-light border-gray-100 text-secondary hover:bg-white'}
                  `}
                >
                  <div
                    className={`
                      w-5 h-5 rounded-md border flex items-center justify-center transition-all
                      ${selected ? 'border-primary' : 'border-gray-300'}
                    `}
                  >
                    {selected && <Check className="w-3 h-3 text-primary" strokeWidth={3} />}
                  </div>

                  <span className="text-sm font-medium leading-snug">
                    {option}
                  </span>
                </div>
              );
            })}
          </div>
        );

      /* =========================
         Numérique
         ========================= */
      case 'Numérique':
        return (
          <div className="space-y-3">
            <input
              type="number"
              value={value || ''}
              onChange={(e) => onAnswer(question.id, e.target.value)}
              placeholder="0"
              min={question.min}
              max={question.max}
              className="
                w-full text-4xl font-semibold text-center tabular-nums
                bg-surface-light rounded-2xl p-6 border border-transparent
                focus:outline-none focus:ring-2 focus:ring-accent/20
                placeholder:text-gray-300
              "
            />
            {question.id.includes('POIDS') && (
              <p className="text-[9px] tracking-widest uppercase text-secondary/60 text-center">
                Kilogrammes
              </p>
            )}
            {question.id.includes('TAILLE') && (
              <p className="text-[9px] tracking-widest uppercase text-secondary/60 text-center">
                Centimètres
              </p>
            )}
          </div>
        );

      /* =========================
         Texte libre
         ========================= */
      case 'Texte libre':
        return (
          <textarea
            value={value || ''}
            onChange={(e) => onAnswer(question.id, e.target.value)}
            placeholder="Saisissez votre réponse ici…"
            className="
              w-full min-h-[140px] resize-none
              bg-surface-light rounded-2xl p-5
              text-sm font-medium text-primary border border-transparent
              focus:outline-none focus:ring-2 focus:ring-accent/20
              placeholder:text-gray-400
            "
          />
        );

      default:
        return (
          <div className="p-4 rounded-xl bg-red-50 text-red-600 text-sm">
            Type de question non supporté
          </div>
        );
    }
  };

  return (
    <div className="bg-surface p-8 md:p-10 rounded-2xl">
      
      {/* Question */}
      <div className="mb-10">
        <p className="text-lg md:text-xl font-medium leading-relaxed text-primary">
          {question.text}
        </p>
      </div>

      {/* Réponse */}
      <div className="animate-in fade-in duration-500">
        {renderInput()}
      </div>
    </div>
  );
}
