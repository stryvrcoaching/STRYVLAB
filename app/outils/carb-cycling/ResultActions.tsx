'use client';

import { useState } from 'react';
import jsPDF from 'jspdf';

interface ResultData {
  tdee: number;
  goal: string;
  protocol: string;
  macros: {
    high: { p: number; f: number; c: number; cal: number };
    low: { p: number; f: number; c: number; cal: number };
  };
}

interface ResultActionsProps {
  data: ResultData;
}

export default function ResultActions({ data }: ResultActionsProps) {
  const [copied, setCopied] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // --- COPIE TEXTE ---
  const handleCopy = async () => {
    const text = `STRYV lab - PROTOCOLE CARB CYCLING\nObjectif: ${data.goal}\nProtocole: ${data.protocol}\n\n1. MAINTENANCE (TDEE): ${data.tdee} kcal\n\n2. JOUR HAUT (Training)\nCalories: ${data.macros.high.cal} kcal\nP: ${data.macros.high.p}g | F: ${data.macros.high.f}g | C: ${data.macros.high.c}g\n\n3. JOUR BAS (Repos)\nCalories: ${data.macros.low.cal} kcal\nP: ${data.macros.low.p}g | F: ${data.macros.low.f}g | C: ${data.macros.low.c}g`;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Erreur copie', err);
    }
  };

  // --- PDF ---
  const handleDownloadPDF = () => {
    setGeneratingPdf(true);
    setTimeout(() => {
      const doc = new jsPDF();
      doc.setFont("helvetica");
      doc.setFontSize(10);
      doc.text("STRYV lab // REPORT", 20, 20);
      doc.setFontSize(8);
      doc.text(`DATE: ${new Date().toLocaleDateString()}`, 160, 20);
      doc.line(20, 25, 190, 25);

      // DATA
      doc.setFontSize(12);
      doc.text("PROTOCOLE CYCLIQUE", 20, 40);
      
      doc.setFontSize(10);
      doc.text(`Objectif: ${data.goal}`, 20, 50);
      doc.text(`Structure: ${data.protocol}`, 20, 56);
      doc.text(`Maintenance: ${data.tdee} kcal`, 20, 62);

      // HIGH
      doc.setDrawColor(200);
      doc.rect(20, 75, 80, 40);
      doc.text("JOUR HAUT", 25, 85);
      doc.text(`${data.macros.high.cal} kcal`, 25, 92);
      doc.setFontSize(9);
      doc.text(`P: ${data.macros.high.p}g  F: ${data.macros.high.f}g  C: ${data.macros.high.c}g`, 25, 105);

      // LOW
      doc.rect(110, 75, 80, 40);
      doc.setFontSize(10);
      doc.text("JOUR BAS", 115, 85);
      doc.text(`${data.macros.low.cal} kcal`, 115, 92);
      doc.setFontSize(9);
      doc.text(`P: ${data.macros.low.p}g  F: ${data.macros.low.f}g  C: ${data.macros.low.c}g`, 115, 105);

      doc.save("stryv-protocol.pdf");
      setGeneratingPdf(false);
    }, 500);
  };

  return (
    <div className="grid grid-cols-2 gap-4 pt-6 border-t border-white/5">
      {/* BOUTON COPIER - Design Accordé */}
      <button
        onClick={handleCopy}
        className="flex items-center justify-center gap-2 py-4 rounded-xl bg-[#252525] border border-white/10 text-white text-xs font-bold uppercase tracking-widest hover:bg-[#3D3D3D] hover:border-white/20 transition-all"
      >
        {copied ? "Copié !" : "Copier"}
      </button>

      {/* BOUTON PDF - Design Accordé */}
      <button
        onClick={handleDownloadPDF}
        disabled={generatingPdf}
        className="flex items-center justify-center gap-2 py-4 rounded-xl bg-[#252525] border border-white/10 text-white text-xs font-bold uppercase tracking-widest hover:bg-[#3D3D3D] hover:border-white/20 transition-all disabled:opacity-50"
      >
        {generatingPdf ? "..." : "PDF"}
      </button>
    </div>
  );
}