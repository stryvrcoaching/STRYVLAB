'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export function Simulation() {
  const [iptValue, setIptValue] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const gaugeRef = useRef<SVGCircleElement>(null);
  const valueRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const reveals = document.querySelectorAll('#simulation .reveal');
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

  const triggerSimulation = () => {
    const target = 68;
    const gauge = gaugeRef.current;
    const valueEl = valueRef.current;

    if (gauge) {
      gsap.to(gauge, {
        strokeDashoffset: 880 - target * 8.8,
        duration: 4,
        ease: 'expo.inOut',
      });
    }

    const obj = { val: 0 };
    gsap.to(obj, {
      val: target,
      duration: 4,
      onUpdate: () => {
        if (valueEl) {
          setIptValue(Math.floor(obj.val));
        }
      },
      onComplete: () => {
        setShowResult(true);
      },
    });
  };

  return (
    <section id="simulation" className="py-40 px-6 md:px-10 flex flex-col items-center">
      <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-24 items-center">
        <div className="reveal relative flex justify-center">
          <div className="absolute w-full h-full bg-[#00FFC3]/5 blur-[100px]"></div>
          <svg className="w-80 h-80 transform -rotate-90">
            <circle
              cx="160"
              cy="160"
              r="140"
              stroke="rgba(255,255,255,0.03)"
              strokeWidth="2"
              fill="transparent"
            />
            <circle
              ref={gaugeRef}
              id="ipt-gauge"
              cx="160"
              cy="160"
              r="140"
              stroke="#00FFC3"
              strokeWidth="6"
              fill="transparent"
              strokeDasharray="880"
              strokeDashoffset="880"
              strokeLinecap="square"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span ref={valueRef} className="text-8xl font-bold tracking-tighter">
              {iptValue}
            </span>
            <span className="text-[10px] font-bold tracking-[0.5em] text-[#2D5168] uppercase mt-4 italic">
              Score IPT
            </span>
          </div>
        </div>
        <div className="reveal space-y-10">
          <h2 className="text-4xl font-heading font-light font-display tracking-tighter uppercase">
            Calculez votre <span className="text-[#00FFC3] font-bold italic">Signature.</span>
          </h2>
          <p className="text-[#2D5168] font-light text-lg italic">
            Nous analysons 358 points de données pour isoler vos blocages Root Cause[cite: 6, 651].
          </p>
          <button
            id="trigger-simulation"
            onClick={triggerSimulation}
            className="bg-[#00FFC3] text-[#050505] px-10 py-5 rounded-[6px] font-semibold text-[10px] tracking-[0.3em] uppercase transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(0,255,195,0.4)]"
          >
            Lancer le Séquençage
          </button>
          <div
            className={`transition-opacity duration-1000 ${showResult ? 'opacity-100' : 'opacity-0'}`}
            id="ipt-result"
          >
            <div className="text-[#00FFC3] font-bold uppercase tracking-widest text-xl mb-2 italic">
              Potentiel Solide
            </div>
            <p className="text-xs text-[#2D5168] italic">
              Capacité structurelle validée pour amorcer la transformation[cite: 1980].
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}











