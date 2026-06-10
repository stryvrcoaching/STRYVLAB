'use client';

import { useEffect, useState } from 'react';
import gsap from 'gsap';

export function StartOverlay() {
  const [isVisible, setIsVisible] = useState(true);

  const handleInitialize = () => {
    const overlay = document.getElementById('start-overlay');
    if (overlay) {
      gsap.to(overlay, {
        opacity: 0,
        pointerEvents: 'none',
        duration: 1.2,
        onComplete: () => setIsVisible(false),
      });
    }
  };

  if (!isVisible) return null;

  return (
    <div
      id="start-overlay"
      className="fixed inset-0 bg-[#050505] z-[1000] flex flex-col items-center justify-center"
    >
      <div className="mb-12 text-center">
        <div className="text-[10px] tracking-[0.8em] text-gray-600 mb-2 uppercase">
          Laboratory Init
        </div>
        <div className="text-3xl font-bold tracking-tighter">
          STRYV<span className="text-[#00FFC3]">.</span>
        </div>
      </div>
      <button
        id="initialize-btn"
        onClick={handleInitialize}
        className="bg-[#00FFC3] text-[#050505] px-10 py-5 rounded-[6px] font-semibold text-[10px] tracking-[0.3em] uppercase transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(0,255,195,0.4)]"
      >
        Initialiser l'Analyse
      </button>
    </div>
  );
}











