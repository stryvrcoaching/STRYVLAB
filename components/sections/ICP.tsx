'use client';

import { useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export function ICP() {
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const reveals = document.querySelectorAll('#icp .reveal');
    reveals.forEach((elem) => {
      gsap.fromTo(
        elem,
        { opacity: 0, y: 30 },
        {
          opacity: 1,
          y: 0,
          duration: 1.2,
          ease: 'power4.out',
          scrollTrigger: {
            trigger: elem as Element,
            start: 'top 95%',
          },
        }
      );
    });
  }, []);

  return (
    <section id="icp" className="py-40 px-6 md:px-10">
      <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-24 items-center">
        <div className="reveal">
          <div className="text-[10px] tracking-[0.6em] uppercase text-[#00FFC3] font-bold mb-6 flex items-center gap-3">
            Profil Cible
          </div>
          <h2 className="text-5xl font-heading font-light mb-10 leading-tight font-display tracking-tighter uppercase">
            Pour ceux qui ont <span className="text-[#00FFC3] font-bold italic">tout essayé.</span>
          </h2>
          <p className="text-lg text-[#2D5168] font-light leading-relaxed italic">
            85% des personnes abandonnent en 12 semaines car les programmes génériques ignorent leurs blocages structurels [cite: 4-5].
          </p>
        </div>
        <div className="grid gap-6 reveal">
          <div className="bg-white/[0.01] border border-white/[0.04] backdrop-blur-[40px] transition-all duration-500 rounded-xl p-8 border-l-2 border-[#00FFC3]/50">
            <h4 className="text-[10px] font-bold tracking-widest text-[#00FFC3] uppercase mb-2">
              Serial Dieters
            </h4>
            <p className="text-xs text-[#2D5168]">
              Vous avez échoué à 3+ programmes par manque de lecture structurelle[cite: 79, 3973].
            </p>
          </div>
          <div className="bg-white/[0.01] border border-white/[0.04] backdrop-blur-[40px] transition-all duration-500 rounded-xl p-8 border-l-2 border-[#00FFC3]/50">
            <h4 className="text-[10px] font-bold tracking-widest text-[#00FFC3] uppercase mb-2">
              Blocages
            </h4>
            <p className="text-xs text-[#2D5168]">
              Votre corps refuse de répondre malgré une discipline irréprochable[cite: 105].
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}











