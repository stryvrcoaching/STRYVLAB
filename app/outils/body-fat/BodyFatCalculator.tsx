"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import {
  BarChart3,
  ArrowLeft,
  Copy,
  Check,
  Ruler,
  User,
  Scale,
  AlertTriangle,
} from "lucide-react";

// UI Components
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Accordion } from "@/components/ui/Accordion";
// Formulas & Store
import {
  navyBodyFat,
  skinfoldBodyFat,
  getBodyFatCategory,
  getOptimalBFZone,
  clampBodyFat,
  buildBodyFatWarnings,
  type BodyFatGender,
  type BodyFatMethod,
  type BodyFatResult,
} from "@/lib/formulas";
import { useClientStore } from "@/lib/stores/useClientStore";

export default function BodyFatCalculator() {
  const setProfile = useClientStore((s) => s.setProfile);

  const [method, setMethod] = useState<BodyFatMethod>("navy");
  const [gender, setGender] = useState<BodyFatGender>("male");
  const [age, setAge] = useState("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");

  // US Navy Inputs
  const [neck, setNeck] = useState("");
  const [waist, setWaist] = useState("");
  const [hips, setHips] = useState("");

  // Skinfold Inputs
  const [chest, setChest] = useState("");
  const [abdominal, setAbdominal] = useState("");
  const [thigh, setThigh] = useState("");
  const [triceps, setTriceps] = useState("");
  const [suprailiac, setSuprailiac] = useState("");

  const [copied, setCopied] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);
  const [result, setResult] = useState<BodyFatResult | null>(null);

  const calculateBodyFat = () => {
    setCopied(false);
    const w = parseFloat(weight);
    const h = parseFloat(height);
    const a = parseFloat(age);
    if (!w || !h || !a) return;

    let bf: number;
    let methodName: string;
    let marginOfError: BodyFatResult["marginOfError"];

    if (method === "navy") {
      const n = parseFloat(neck);
      const wa = parseFloat(waist);
      const hi = parseFloat(hips);
      if (!n || !wa || (gender === "female" && !hi)) return;
      bf = navyBodyFat({
        gender,
        weight: w,
        height: h,
        neck: n,
        waist: wa,
        hips: hi,
      });
      methodName = "US Navy";
      marginOfError = "±3-5%";
    } else {
      if (gender === "male") {
        const ch = parseFloat(chest);
        const ab = parseFloat(abdominal);
        const th = parseFloat(thigh);
        if (!ch || !ab || !th) return;
        bf = skinfoldBodyFat({
          gender,
          age: a,
          chest: ch,
          abdominal: ab,
          thigh: th,
        });
      } else {
        const tr = parseFloat(triceps);
        const su = parseFloat(suprailiac);
        const th = parseFloat(thigh);
        if (!tr || !su || !th) return;
        bf = skinfoldBodyFat({
          gender,
          age: a,
          triceps: tr,
          suprailiac: su,
          thigh: th,
        });
      }
      methodName = "Jackson-Pollock 3-Site";
      marginOfError = "±3-4%";
    }

    bf = clampBodyFat(bf, gender);
    const category = getBodyFatCategory(bf, gender);
    const fm = (w * bf) / 100;
    const lm = w - fm;
    const bmi = w / (h / 100) ** 2;
    const warnings = buildBodyFatWarnings(
      bf,
      bmi,
      gender,
      method,
      parseFloat(waist) || undefined,
      h,
    );

    const res: BodyFatResult = {
      bodyFat: Math.round(bf * 10) / 10,
      fatMass: Math.round(fm * 10) / 10,
      leanMass: Math.round(lm * 10) / 10,
      bmi: Math.round(bmi * 10) / 10,
      category,
      marginOfError,
      methodUsed: methodName,
      warnings,
    };

    setResult(res);

    // Propagate bodyFat and weight to shared store
    setProfile({ weight: w, height: h, age: a, gender, bodyFat: res.bodyFat });

    setTimeout(() => {
      resultsRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 100);
  };

  const optimalZone = result ? getOptimalBFZone(gender) : null;

  const faqItems = [
    {
      title: "BF% vs IMC : Quelle différence ?",
      content:
        'L\'IMC est un simple rapport poids/taille qui ignore totalement la composition corporelle. Le BF% mesure précisément la quantité de graisse vs muscle. Un bodybuilder peut avoir un IMC "obèse" avec 8% de BF. Inversement, une personne sédentaire peut avoir un IMC "normal" avec 30% de BF (obésité sarcopénique).',
    },
    {
      title: "Méthode Navy vs Jackson-Pollock : Laquelle choisir ?",
      content:
        "US Navy utilise des circonférences (facile à mesurer seul, ±3-5% de précision). Jackson-Pollock utilise une pince à plis cutanés (plus précis ±3-4% mais nécessite de la pratique et un partenaire). Navy est idéal pour un suivi régulier, Jackson-Pollock pour une mesure ponctuelle précise.",
    },
    {
      title: "Que signifient les catégories ACE ?",
      content:
        "L'American Council on Exercise définit les zones de santé. Hommes : 14-17% (Fitness optimal, équilibre santé/performance). Femmes : 21-24% (Fitness optimal, fonction hormonale préservée). Descendre plus bas nécessite une discipline stricte et n'améliore pas forcément la santé.",
    },
  ];

  return (
    <div className="min-h-screen bg-background text-primary font-outfit">
      <main className="max-w-7xl mx-auto px-6 md:px-12 pt-6 pb-20">
        <section className="mb-10">
          <div className="max-w-3xl space-y-3">
            <p className="text-[10px] uppercase tracking-[0.26em] text-white/40">
              Composition corporelle
            </p>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white">
              Body Fat Calculator
            </h1>
            <p className="text-sm leading-relaxed text-white/60">
              Analyse validée US Navy et Jackson-Pollock 3-site, avec
              catégorisation ACE et bilan de votre masse grasse, masse maigre et
              IMC.
            </p>
          </div>
        </section>

        <div className="grid gap-8 lg:grid-cols-[420px_minmax(0,1fr)]">
          <div className="p-6 rounded-2xl border-[0.3px] border-white/[0.06] bg-white/[0.02]">
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="section-label">Genre</p>
                <div className="grid grid-cols-2 gap-2 rounded-xl border-[0.3px] border-white/[0.06] bg-white/[0.03] p-1">
                  {(["male", "female"] as BodyFatGender[]).map((g) => (
                    <button
                      key={g}
                      onClick={() => {
                        setGender(g);
                        setResult(null);
                      }}
                      className={`rounded-xl px-3 py-3 text-[11px] font-bold uppercase tracking-[0.18em] transition-all ${
                        gender === g
                          ? "bg-white/10 text-white"
                          : "text-white/60 hover:text-white"
                      }`}
                    >
                      {g === "male" ? "Homme" : "Femme"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="section-label">Méthode</p>
                <div className="grid grid-cols-2 gap-2 rounded-xl border-[0.3px] border-white/[0.06] bg-white/[0.03] p-1">
                  {[
                    { id: "navy" as BodyFatMethod, label: "US Navy" },
                    { id: "skinfold" as BodyFatMethod, label: "Pince" },
                  ].map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        setMethod(m.id);
                        setResult(null);
                      }}
                      className={`rounded-xl px-3 py-3 text-[11px] font-bold uppercase tracking-[0.18em] transition-all ${
                        method === m.id
                          ? "bg-white/10 text-white"
                          : "text-white/60 hover:text-white"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/50">
                      Âge
                    </p>
                    <input
                      type="number"
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      className="field-input"
                      placeholder="30"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/50">
                      Poids (kg)
                    </p>
                    <input
                      type="number"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      className="field-input"
                      placeholder="75"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/50">
                    Taille (cm)
                  </p>
                  <input
                    type="number"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    className="field-input"
                    placeholder="180"
                  />
                </div>
              </div>

              <div className="space-y-3">
                {method === "navy" ? (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/50">
                        Tour de cou (cm)
                      </p>
                      <input
                        type="number"
                        value={neck}
                        onChange={(e) => setNeck(e.target.value)}
                        className="field-input"
                        placeholder="38"
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/50">
                        Tour de taille (cm)
                      </p>
                      <input
                        type="number"
                        value={waist}
                        onChange={(e) => setWaist(e.target.value)}
                        className="field-input"
                        placeholder="85"
                      />
                    </div>
                    {gender === "female" && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/50">
                          Tour de hanches (cm)
                        </p>
                        <input
                          type="number"
                          value={hips}
                          onChange={(e) => setHips(e.target.value)}
                          className="field-input"
                          placeholder="95"
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {gender === "male" ? (
                      <>
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/50">
                            Pectoral (mm)
                          </p>
                          <input
                            type="number"
                            value={chest}
                            onChange={(e) => setChest(e.target.value)}
                            className="field-input"
                            placeholder="12"
                          />
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/50">
                            Abdominal (mm)
                          </p>
                          <input
                            type="number"
                            value={abdominal}
                            onChange={(e) => setAbdominal(e.target.value)}
                            className="field-input"
                            placeholder="20"
                          />
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/50">
                            Cuisse (mm)
                          </p>
                          <input
                            type="number"
                            value={thigh}
                            onChange={(e) => setThigh(e.target.value)}
                            className="field-input"
                            placeholder="15"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/50">
                            Triceps (mm)
                          </p>
                          <input
                            type="number"
                            value={triceps}
                            onChange={(e) => setTriceps(e.target.value)}
                            className="field-input"
                            placeholder="14"
                          />
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/50">
                            Supra-iliaque (mm)
                          </p>
                          <input
                            type="number"
                            value={suprailiac}
                            onChange={(e) => setSuprailiac(e.target.value)}
                            className="field-input"
                            placeholder="16"
                          />
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/50">
                            Cuisse (mm)
                          </p>
                          <input
                            type="number"
                            value={thigh}
                            onChange={(e) => setThigh(e.target.value)}
                            className="field-input"
                            placeholder="18"
                          />
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={calculateBodyFat}
                disabled={!weight || !height || !age}
                className="btn-accent w-full uppercase tracking-[0.16em]"
              >
                Lancer l&apos;analyse
              </button>
            </div>

            <div className="space-y-6">
              <div className="flex-grow space-y-6">
                {result && optimalZone ? (
                  <div ref={resultsRef} className="space-y-6">
                    <Card className="relative overflow-hidden border-[0.3px] border-white/[0.06] bg-white/[0.02] p-6">
                      <div className="absolute top-0 right-0 p-5 opacity-10">
                        <BarChart3 size={100} className="rotate-12" />
                      </div>
                      <div className="relative z-10 flex flex-col gap-6 text-center md:text-left md:flex-row md:items-end md:justify-between">
                        <div>
                          <span className="inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-white/70">
                            Résultat Analyse
                          </span>
                          <div className="mt-4 text-6xl md:text-7xl font-bold tracking-tight text-white">
                            {result.bodyFat}
                            <span className="ml-3 text-3xl font-medium text-white/70">
                              %
                            </span>
                          </div>
                          <div
                            className={`mt-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.24em] font-bold ${result.category.colorClass}`}
                          >
                            {result.category.label}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(
                              `Bilan Body Fat : ${result.bodyFat}% (${result.category.label}) - FM: ${result.fatMass}kg | LBM: ${result.leanMass}kg - https://www.stryvlab.com/outils/body-fat`,
                            );
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          }}
                          className={`btn-ghost inline-flex items-center gap-2 ${copied ? "bg-[#1f8a65]/10 text-[#1f8a65]" : ""}`}
                        >
                          {copied ? <Check size={14} /> : <Copy size={14} />}{" "}
                          {copied ? "Copié" : "Exporter"}
                        </button>
                      </div>
                    </Card>

                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="rounded-2xl border-[0.3px] border-white/[0.06] bg-white/[0.02] p-5">
                        <p className="text-[10px] uppercase tracking-[0.24em] text-white/50">
                          Masse Grasse
                        </p>
                        <p className="mt-3 text-2xl font-bold text-white">
                          {result.fatMass} kg
                        </p>
                        <p className="mt-2 text-[10px] text-white/60">
                          Tissu adipeux
                        </p>
                      </div>
                      <div className="rounded-2xl border-[0.3px] border-white/[0.06] bg-white/[0.02] p-5">
                        <p className="text-[10px] uppercase tracking-[0.24em] text-white/50">
                          Masse Maigre
                        </p>
                        <p className="mt-3 text-2xl font-bold text-white">
                          {result.leanMass} kg
                        </p>
                        <p className="mt-2 text-[10px] text-white/60">
                          Muscle + os + eau
                        </p>
                      </div>
                      <div className="rounded-2xl border-[0.3px] border-white/[0.06] bg-white/[0.02] p-5">
                        <p className="text-[10px] uppercase tracking-[0.24em] text-white/50">
                          Cible Santé
                        </p>
                        <p className="mt-3 text-2xl font-bold text-white">
                          {optimalZone.range}
                        </p>
                        <p className="mt-2 text-[10px] text-white/60">
                          {optimalZone.desc}
                        </p>
                      </div>
                    </div>

                    {result.warnings.length > 0 && (
                      <div className="rounded-2xl border-[0.3px] border-white/[0.06] bg-white/[0.02] p-6">
                        <div className="flex items-center gap-2 mb-3 text-white">
                          <AlertTriangle size={18} className="text-accent" />
                          <p className="text-sm font-bold uppercase tracking-[0.24em]">
                            Alertes Qualité
                          </p>
                        </div>
                        <ul className="space-y-2 text-sm text-white/70">
                          {result.warnings.map((warning, index) => (
                            <li key={index} className="flex gap-2">
                              <span className="text-accent">•</span>
                              <span>{warning}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <Card className="rounded-2xl border-[0.3px] border-white/[0.06] bg-white/[0.02] p-6">
                      <div className="grid gap-6 md:grid-cols-2">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.24em] text-white/50">
                            Méthode utilisée
                          </p>
                          <p className="mt-3 text-xl font-bold text-white">
                            {result.methodUsed}
                          </p>
                          <p className="mt-2 text-sm text-white/60">
                            Marge d&apos;erreur : {result.marginOfError}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.24em] text-white/50">
                            IMC (référence)
                          </p>
                          <p className="mt-3 text-xl font-bold text-white">
                            {result.bmi}
                          </p>
                          <p className="mt-2 text-sm text-white/60">
                            {result.bmi < 18.5
                              ? "Sous-poids"
                              : result.bmi < 25
                                ? "Normal"
                                : result.bmi < 30
                                  ? "Surpoids"
                                  : "Obésité"}
                          </p>
                        </div>
                      </div>
                    </Card>
                  </div>
                ) : (
                  <div className="min-h-[400px] flex flex-col items-center justify-center rounded-2xl border-[0.3px] border-white/[0.06] bg-white/[0.02] p-10 text-center text-white/70">
                    <BarChart3 size={48} className="mb-4 text-white/40" />
                    <h3 className="text-xl font-semibold text-white">
                      En attente de mesures
                    </h3>
                    <p className="mt-2 max-w-sm text-sm text-white/60">
                      Remplissez le formulaire complet pour obtenir votre
                      analyse scientifiquement validée.
                    </p>
                  </div>
                )}
              </div>

              <Card className="rounded-2xl border-[0.3px] border-white/[0.06] bg-white/[0.02] p-6">
                <SectionHeader
                  title="Base de Connaissance"
                  subtitle="Comprendre la composition corporelle."
                />
                <div className="mt-6">
                  <Accordion items={faqItems} />
                </div>
              </Card>
            </div>
          </div>
        </div>
      </main>

    </div>
  );
}
