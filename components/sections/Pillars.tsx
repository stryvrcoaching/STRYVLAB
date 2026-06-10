'use client';

import { useEffect, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const PILLARS_DATA = [
  { id: 'metabolic', percent: '30%', title: 'Métabolisme', desc: 'Insuline & Flexibilité[cite: 1683, 1690].' },
  { id: 'infrastructure', percent: '25%', title: 'Logistique', desc: 'Temps & Budget[cite: 1691].' },
  { id: 'psychology', percent: '20%', title: 'Psychologie', desc: 'Locus & Neurotype[cite: 1693, 1826].' },
  { id: 'physiology', percent: '15%', title: 'Physiologie', desc: 'Hormones & Blessures[cite: 1878].' },
  { id: 'environment', percent: '10%', title: 'Adhérence', desc: 'Friction Sociale[cite: 3222].' },
];

const MODAL_DATA: Record<string, { title: string; body: string }> = {
  metabolic: {
    title: 'Métabolisme [30%]',
    body: '<p>Évalue la <strong>sensibilité à l\'insuline</strong> (Root Cause #1). Identification des blocages de l\'oxydation des graisses [cite: 677-684, 1690].</p>',
  },
  infrastructure: {
    title: 'Logistique [25%]',
    body: '<p>Analyse de la disponibilité temps et du budget nutritionnel. Cause #2 d\'abandon si non-calibré [cite: 1691-1692].</p>',
  },
  psychology: {
    title: 'Psychologie [20%]',
    body: '<p>Locus de contrôle et <strong>Neurotype Braverman</strong>. Aligner le plan sur votre chimie cérébrale[cite: 1826].</p>',
  },
  physiology: {
    title: 'Physiologie [15%]',
    body: '<p>Calcul de la charge hormonale (Cortisol/Axe HPA) et historique structurel[cite: 1878].</p>',
  },
  environment: {
    title: 'Adhérence [10%]',
    body: '<p>Friction sociale et pro. L\'environnement prédit 42% de la réussite [cite: 3220-3222].</p>',
  },
};

export function Pillars() {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState<{ title: string; body: string } | null>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const reveals = document.querySelectorAll('#pillars .reveal');
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

  const openPillar = (id: string) => {
    const data = MODAL_DATA[id];
    if (data) {
      setModalData(data);
      setModalOpen(true);
    }
  };

  const closeModal = () => {
    setModalOpen(false);
  };

  return (
    <>
      <section id="pillars" className="py-40 px-6 md:px-10 flex flex-col items-center">
        <div className="max-w-3xl text-center space-y-6 reveal mb-24">
          <div className="text-[10px] tracking-[0.6em] uppercase text-[#00FFC3] font-bold mb-6 flex items-center justify-center gap-3">
            L'Algorithme Forensic
          </div>
          <h2 className="text-5xl font-heading font-light font-display tracking-tighter uppercase">
            Les 5 leviers structurels.
          </h2>
        </div>
        <div className="grid lg:grid-cols-5 gap-6 w-full max-w-7xl">
          {PILLARS_DATA.map((pillar) => (
            <div
              key={pillar.id}
              className="bg-white/[0.01] border border-white/[0.04] backdrop-blur-[40px] transition-all duration-500 rounded-xl p-10 reveal cursor-pointer hover:bg-white/[0.04] hover:border-[#00FFC3]/15 hover:-translate-y-0.5"
              onClick={() => openPillar(pillar.id)}
            >
              <div className="font-mono text-[#00FFC3] text-xs mb-8">{pillar.percent}</div>
              <h3 className="text-[10px] font-bold uppercase tracking-widest mb-4">{pillar.title}</h3>
              <p className="text-[9px] text-[#2D5168] leading-relaxed uppercase">{pillar.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Modal */}
      <div
        className={`fixed inset-0 z-[200] flex items-center justify-center transition-opacity duration-500 ${
          modalOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="absolute inset-0 bg-black/95 backdrop-blur-3xl" onClick={closeModal}></div>
        <div
          className={`bg-white/[0.02] border border-white/[0.04] backdrop-blur-[40px] rounded-xl p-12 md:p-20 max-w-xl w-[90%] relative pointer-events-auto transition-transform duration-500 ${
            modalOpen ? 'scale-100' : 'scale-95'
          }`}
        >
          <button
            onClick={closeModal}
            className="absolute top-10 right-10 text-[#2D5168] hover:text-white transition-colors text-xl"
          >
            ✕
          </button>
          {modalData && (
            <>
              <h2 className="text-2xl font-bold mb-10 text-white tracking-tight italic font-display uppercase">
                {modalData.title}
              </h2>
              <div
                className="space-y-8 text-gray-400 text-sm font-light italic"
                dangerouslySetInnerHTML={{ __html: modalData.body }}
              />
            </>
          )}
        </div>
      </div>
    </>
  );
}











