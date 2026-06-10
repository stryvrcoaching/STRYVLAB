'use client';

import React from 'react';

interface ProgressBarProps {
  progress: number; // 0 à 100
}

export function ProgressBar({ progress }: ProgressBarProps) {
  return (
    <div className="w-full">
      <div className="h-1.5 w-full bg-surface-light border border-gray-100 rounded-full overflow-hidden">
        <div 
          className="h-full bg-accent transition-all duration-500 ease-out shadow-[0_0_10px_rgba(16,185,129,0.3)]"
          style={{ width: `${Math.max(5, progress)}%` }} // Min 5% pour visibilité
        />
      </div>
    </div>
  );
}