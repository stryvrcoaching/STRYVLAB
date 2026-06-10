'use client';

import React from 'react';
import { Calculator, ArrowRight, Percent, Sigma } from 'lucide-react';

interface AxisData {
  raw: number;
  normalized: number;
  weight: number;
}

interface IPTFormulaCardProps {
  axes: Record<string, AxisData>;
  globalScore: number;
}

export function IPTFormulaCard({ axes, globalScore }: IPTFormulaCardProps) {
  
  const axesLabels: Record<string, string> = {
    sleep: 'Sommeil',
    nutrition: 'Nutrition',
    stress: 'Stress',
    training: 'Training',
    recovery: 'Récupérat.',
    adherence: 'Adhérence',
  };

  return (
    <div className="bg-surface border border-white/60 p-6 rounded-2xl h-full flex flex-col">
      
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
        <div className="p-2 bg-surface-light rounded-lg text-primary shadow-inner">
          <Calculator size={18} />
        </div>
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-primary">
            Algorithme IPT™
          </h3>
          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-widest">
            Décomposition pondérée
          </p>
        </div>
      </div>

      {/* Table de calcul */}
      <div className="flex-1 space-y-3">
        {Object.entries(axes).map(([key, data]) => {
          const contribution = data.normalized * data.weight;
          const isHighImpact = data.weight >= 0.2; // Mise en avant des gros coefficients

          return (
            <div key={key} className="flex items-center justify-between group">
              
              {/* Label & Poids */}
              <div className="flex items-center gap-3">
                <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${isHighImpact ? 'bg-accent/10 border-accent/20 text-accent' : 'bg-surface-light border-gray-200 text-gray-400'}`}>
                  {(data.weight * 100).toFixed(0)}%
                </div>
                <span className="text-xs font-bold text-secondary uppercase tracking-wide">
                  {axesLabels[key] || key}
                </span>
              </div>

              {/* Visualisation Calcul */}
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-1 text-[10px] text-gray-400 font-mono">
                  <span>{Math.round(data.normalized)}</span>
                  <span className="text-gray-300">×</span>
                  <span>{data.weight}</span>
                </div>
                
                <ArrowRight size={10} className="text-gray-300 hidden sm:block" />
                
                <div className="w-12 text-right font-mono text-xs font-bold text-primary tabular-nums">
                  {contribution.toFixed(1)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Total Footer */}
      <div className="mt-6 pt-4 border-t border-gray-100 bg-surface-light/30 -mx-6 -mb-6 p-6 rounded-b-2xl flex justify-between items-center">
        <div className="flex items-center gap-2 text-secondary">
          <Sigma size={16} />
          <span className="text-xs font-bold uppercase tracking-widest">Score Global</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-primary tabular-nums tracking-tight">
            {Math.round(globalScore)}
          </span>
          <span className="text-xs font-medium text-gray-400">/100</span>
        </div>
      </div>

    </div>
  );
}