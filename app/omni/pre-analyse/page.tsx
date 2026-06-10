"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import localFont from "next/font/local";
import SwipeButton from "@/components/ui/SwipeButton";

const michroma = localFont({
  src: "../../fonts/Michroma-Regular.ttf",
  display: "swap",
});

export default function OmniPreAnalysePage() {
  const router = useRouter();

  const handleValidation = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("omni_session_status", "started");
      localStorage.setItem("omni_timestamp", Date.now().toString());
    }
    router.push("/omni/run");
  };

  useEffect(() => {
    document.body.style.overflow = "auto";
  }, []);

  return (
    <main className="app-root p-4 sm:p-6 md:p-10">
      {/* frame */}
      <div className="mx-auto max-w-[1200px] dr-card overflow-hidden">
        <div className="flex flex-col md:flex-row">

          {/* sidebar desktop */}
          <aside className="hidden md:flex w-[84px] flex-col items-center gap-4 p-4 border-r border-black/10">
            <div className="dr-pill w-11 h-11 flex items-center justify-center">
              <span className={`${michroma.className} text-[12px] tracking-[0.14em]`}>
                G
              </span>
            </div>

            <div className="w-full h-px bg-black/10" />

            {Array.from({ length: 4 }).map((_, i) => (
              <button
                key={i}
                className="dr-pill w-11 h-11 transition-transform duration-200 hover:scale-[1.03]"
                aria-label={`nav-${i}`}
              />
            ))}

            <div className="flex-1" />
            <button className="dr-pill w-11 h-11" aria-label="settings" />
          </aside>

          {/* content */}
          <div className="flex-1 p-4 sm:p-6 md:p-8">
            {/* topbar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-baseline gap-3">
                <span className={`${michroma.className} text-[16px] tracking-[0.14em]`}>
                  STRYV lab
                </span>
                <span className="text-xs tracking-[0.25em] uppercase text-black/50">
                  système omni
                </span>
              </div>

              <div className="flex gap-2">
                <span className="dr-pill px-4 py-2 text-xs font-semibold">Pré-analyse</span>
                <span className="dr-pill px-4 py-2 text-xs font-semibold opacity-60">Questionnaire</span>
                <span className="dr-pill px-4 py-2 text-xs font-semibold opacity-60">Résultats</span>
              </div>
            </div>

            <div className="my-6 h-px bg-black/10" />

            {/* grid responsive */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              {/* main card */}
              <section className="lg:col-span-2 dr-widget p-5 sm:p-6 md:p-7">
                <h1 className="text-[22px] sm:text-[24px] font-semibold tracking-tight">
                  Pré-analyse omni
                </h1>

                <p className="mt-3 text-[14px] leading-relaxed text-black/70">
                  Le système établit un point de référence fonctionnel. Les règles suivantes garantissent la cohérence du traitement.
                </p>

                <div className="mt-5 space-y-4">
                  {[
                    {
                      n: "01.",
                      t: "Point de référence.",
                      d: "La situation actuelle est analysée telle qu’elle est. Aucune interprétation n’est appliquée à ce stade.",
                    },
                    {
                      n: "02.",
                      t: "Corrélation multi-axes.",
                      d: "Chaque réponse influence l’équilibre global. Les axes sont traités de manière interdépendante.",
                    },
                    {
                      n: "03.",
                      t: "Précision requise.",
                      d: "Les réponses doivent refléter la réalité actuelle. Une approximation réduit la fiabilité des résultats.",
                    },
                  ].map((x) => (
                    <div key={x.n} className="dr-pill p-4 sm:p-5">
                      <div className="flex gap-3">
                        <span className="font-mono text-black/45">{x.n}</span>
                        <div className="text-[14px] leading-relaxed text-black/75">
                          <strong className="text-black">{x.t}</strong>
                          <br />
                          {x.d}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* assistant card */}
              <aside className="dr-widget p-5 sm:p-6 md:p-7 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-black/50 font-semibold">
                      Conditions requises
                    </p>
                    <p className="mt-2 text-[14px] leading-relaxed text-black/70">
                      Vérifiez ces éléments avant de lancer l’analyse.
                    </p>
                  </div>

                  <div className="w-10 h-10 rounded-[16px] bg-white/35 border border-white/60 shadow-[0_14px_30px_rgba(0,0,0,0.08)] flex items-center justify-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#16A34A]" />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="dr-pill p-4 text-[14px] text-black/75">
                    Environnement calme et sans distraction.
                  </div>
                  <div className="dr-pill p-4 text-[14px] text-black/75">
                    Disponibilité continue d’environ dix minutes.
                  </div>
                </div>

                <div className="h-px bg-black/10" />

                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-black/50 font-semibold">
                    Temps estimé
                  </p>
                  <p className="mt-2 text-[14px] leading-relaxed text-black/70">
                    8–12 minutes. Une analyse commencée doit être menée à son terme.
                  </p>
                </div>
              </aside>
            </div>

            {/* action strip */}
            <section className="mt-6 dr-widget p-5 sm:p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-black/50 font-semibold">
                    Initialisation
                  </p>
                  <p className="mt-1 text-[14px] text-black/70">
                    Glissez pour lancer le protocole.
                  </p>
                </div>

                <div className="w-full md:max-w-[460px]">
                  <SwipeButton onSuccess={handleValidation} text="GLISSER POUR INITIALISER" />
                </div>
              </div>

              <p className="mt-4 text-[11px] text-center text-black/45 leading-relaxed">
                L’analyse fournit une lecture fonctionnelle du potentiel. Elle ne constitue ni un diagnostic médical, ni une prescription.
              </p>
            </section>
          </div>
        </div>
      </div>

      {/* bottom bar mobile (optionnel, dribbble-like) */}
      <div className="md:hidden mt-4 mx-auto max-w-[1200px] dr-pill p-3 flex justify-center gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <button key={i} className="w-11 h-11 dr-pill" aria-label={`mobile-nav-${i}`} />
        ))}
      </div>
    </main>
  );
}
