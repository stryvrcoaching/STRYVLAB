'use client';

import { useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Button } from '../ui/Button';

export function HeroNew() {
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const reveals = document.querySelectorAll('#hero .reveal');
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
    <section id="hero" className="min-h-screen flex flex-col justify-center px-6 md:px-10 pt-20 max-w-5xl mx-auto">
      <div className="reveal">
        <div className="text-[10px] tracking-[0.6em] uppercase text-[#00FFC3] font-bold mb-6 flex items-center gap-3">
          <span className="w-2 h-2 bg-[#00FFC3] rounded-full animate-pulse"></span>
          Signature Unique Détectée
        </div>
        <h1 className="text-[clamp(2.5rem,7vw,4.209rem)] font-light leading-[1.1] mb-10 font-display tracking-tighter uppercase">
          Sans connaître votre IPT, toute tentative de transformation est une{' '}
          <span className="text-[#00FFC3] font-medium italic">supposition.</span>
        </h1>
        <p className="text-xl text-[#2D5168] font-light max-w-2xl leading-relaxed mb-12 italic">
          L'IPT évalue si une transformation est biologiquement possible, avant même de tenter de la provoquer[cite: 3940, 3975].
        </p>
        <Button href="/ipt-choice" variant="primary" size="lg">
          Mesurer mon Indice IPT →
        </Button>
      </div>
    </section>
  );
}












