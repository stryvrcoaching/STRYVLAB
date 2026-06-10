"use client";

import { useClientTopBar } from "@/components/clients/useClientTopBar";
import Link from "next/link";
import { BarChart3, ArrowRight } from "lucide-react";

export default function CompositionPage() {
  useClientTopBar("Composition");

  return (
    <main className="min-h-screen bg-[#121212]">
      <div className="px-6 pb-24">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40 mb-4">
          Outils composition corporelle
        </p>
        <Link
          href="/outils/body-fat"
          className="group flex items-center gap-4 bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-2xl p-4 hover:bg-white/[0.04] transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center shrink-0 text-white/40 group-hover:text-[#1f8a65] transition-colors">
            <BarChart3 size={18} strokeWidth={1.5} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-white">Body Fat %</p>
            <p className="text-[11px] text-white/40 leading-relaxed mt-0.5">
              Estimation masse grasse via Navy Method & Jackson-Pollock.
            </p>
          </div>
          <ArrowRight size={14} className="text-white/20 group-hover:text-[#1f8a65] transition-colors shrink-0" />
        </Link>
      </div>
    </main>
  );
}
