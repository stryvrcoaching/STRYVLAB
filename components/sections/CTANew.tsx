'use client';

import { useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Button } from '../ui/Button';

export function CTANew() {
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const reveals = document.querySelectorAll('#cta .reveal');
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

    // Background color transition
    gsap.to('body', {
      scrollTrigger: {
        trigger: '#cta',
        start: 'top center',
        scrub: true,
      },
      backgroundColor: '#FFFFFF',
    });
  }, []);

  return (
    <section
      id="cta"
      className="min-h-screen flex flex-col items-center justify-center text-center px-6 md:px-10 bg-white text-[#050505] transition-colors duration-1000"
    >
      <div className="max-w-4xl space-y-12 reveal">
        <h2 className="text-7xl md:text-9xl font-bold tracking-tighter italic font-display uppercase">
          95%<br />
          <span className="font-light italic">Adhérence.</span>
        </h2>
        <p className="text-xl text-[#2D5168] mb-12 max-w-2xl mx-auto font-light italic">
          Genesis ne promet pas la transformation. Il identifie si elle est biologiquement possible[cite: 4015].
        </p>
        <Button href="/ipt-choice" variant="primary" size="lg" className="px-16 py-6 text-[11px]">
          Démarrer l'Analyse IPT →
        </Button>
        <p className="text-[10px] font-bold tracking-[0.4em] text-gray-400 uppercase italic">
          Analyse structurée • Aucune promesse • Données requises
        </p>
      </div>
    </section>
  );
}












