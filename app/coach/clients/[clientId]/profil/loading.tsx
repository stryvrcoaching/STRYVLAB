import React from 'react'

function Pulse({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`animate-pulse rounded-lg bg-white/[0.05] ${className ?? ''}`} style={style} />
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-2xl p-4 ${className ?? ''}`}>
      {children}
    </div>
  )
}

// 62-tick meter — matches real ScoreMeter / PhaseMeter exactly
function TickMeter() {
  return (
    <div className="flex items-end gap-[2.5px]" style={{ height: '44px' }}>
      {Array.from({ length: 62 }).map((_, i) => {
        const h = 18 + Math.round(Math.sin((i / 61) * Math.PI) * 12)
        return (
          <div
            key={i}
            className="flex-1 rounded-[1px] animate-pulse bg-white/[0.06]"
            style={{ height: `${h}px`, animationDelay: `${i * 0.012}s` }}
          />
        )
      })}
    </div>
  )
}

function SectionAccordionSkeleton() {
  return (
    <div className="border-t border-white/[0.06] py-4">
      <div className="flex items-center gap-3">
        <Pulse className="h-3 w-3 rounded-full" />
        <Pulse className="h-2.5 w-32" />
      </div>
    </div>
  )
}

function InsightHeroSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[radial-gradient(circle_at_top_right,rgba(31,138,101,0.18),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-4">
      <div className="mb-5 flex items-start justify-between gap-3">
        <Pulse className="h-2 w-24" />
        <Pulse className="h-7 w-24 rounded-md" />
      </div>

      <div className="mb-5 flex flex-col items-center gap-2 text-center">
        <Pulse className="h-[68px] w-[88px] rounded-xl" />
        <Pulse className="h-3 w-28 rounded-full" />
      </div>

      <div className="mb-4">
        <TickMeter />
        {compact ? (
          <div className="mt-1.5 flex justify-between">
            <Pulse className="h-2 w-3" />
            <Pulse className="h-2 w-6" />
          </div>
        ) : null}
      </div>

      {compact ? null : (
        <>
          <div className="grid gap-2 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-lg bg-white/[0.03] px-3 py-2.5">
                <Pulse className="h-2 w-16 mb-2" />
                <Pulse className="h-3.5 w-24 mb-1.5" />
                <Pulse className="h-2.5 w-20" />
              </div>
            ))}
          </div>

          <div className="mt-3 rounded-lg bg-white/[0.03] px-3 py-2.5">
            <Pulse className="h-2 w-12 mb-2" />
            <Pulse className="h-2.5 w-full mb-1.5" />
            <Pulse className="h-2.5 w-4/5" />
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {[0, 1].map((i) => (
              <div key={i} className="rounded-lg bg-white/[0.03] px-2.5 py-2">
                <Pulse className="h-2 w-16 mb-2" />
                <Pulse className="h-3 w-24 mb-1.5" />
                <Pulse className="h-2.5 w-20" />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// Matches InfoCell: icon box (7×7) + label line + value line
function InfoCellSkel({ wide }: { wide?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-7 h-7 rounded-lg bg-white/[0.04] animate-pulse shrink-0" />
      <div className="flex flex-col gap-1 min-w-0">
        <Pulse className="h-2 w-12" />
        <Pulse className={wide ? 'h-3 w-32' : 'h-3 w-24'} />
      </div>
    </div>
  )
}

export default function ProfilLoading() {
  return (
    <main className="min-h-screen bg-[#121212]">
      <div className="px-6 pb-24">

        <div className="grid grid-cols-2 gap-4 items-start">

          {/* ── COLONNE GAUCHE ── */}
          <div className="flex flex-col gap-4">

            {/* TransformationScoreWidget */}
            <div className="bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-2xl px-6 py-5">
              <div className="flex items-center justify-between mb-6">
                <Pulse className="h-2 w-36" />
                <Pulse className="h-6 w-16 rounded-lg" />
              </div>
              <InsightHeroSkeleton compact />
              <div className="mt-5 flex gap-2 justify-center">
                {[52, 52, 64, 52].map((w, i) => (
                  <div
                    key={i}
                    className="bg-white/[0.04] animate-pulse rounded-lg flex flex-col items-center justify-center gap-1"
                    style={{ width: `${w}px`, height: '52px' }}
                  >
                    <Pulse className="h-4 w-7 rounded" />
                    <Pulse className="h-1.5 w-5 rounded" />
                  </div>
                ))}
              </div>
              <div className="mt-5 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-white/[0.10] animate-pulse shrink-0" />
                <Pulse className="h-2.5 w-52" />
              </div>
            </div>

            {/* Informations card */}
            <Card>
              <div className="flex items-center justify-between mb-3">
                <Pulse className="h-2 w-24" />
                <Pulse className="h-5 w-14 rounded-lg" />
              </div>
              {/* Contact: email, phone, depuis */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <InfoCellSkel wide />
                <InfoCellSkel />
                <InfoCellSkel />
              </div>
              {/* Separator */}
              <div className="mt-4 mb-3 h-px bg-white/[0.05]" />
              <Pulse className="h-2 w-44 mb-3" />
              {/* Complementary: DOB, genre, adresse, contact urgence, acquisition */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                {[0, 1, 2, 3, 4].map(i => (
                  <InfoCellSkel key={i} />
                ))}
              </div>
            </Card>

            {/* Profil sportif card */}
            <Card>
              <div className="flex items-center justify-between mb-3">
                <Pulse className="h-2 w-28" />
                <Pulse className="h-5 w-14 rounded-lg" />
              </div>
              {/* Restrictions physiques */}
              <Pulse className="h-2 w-36 mb-2" />
              <div className="flex flex-wrap gap-2 mb-4">
                <Pulse className="h-6 w-32 rounded-xl" />
                <Pulse className="h-6 w-24 rounded-xl" />
              </div>
              <div className="h-px bg-white/[0.05] mb-3" />
              {/* Paramètres sub-label + 3-col grid */}
              <Pulse className="h-2 w-20 mb-3" />
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[0, 1, 2, 3, 4].map(i => (
                  <div key={i} className="bg-white/[0.03] animate-pulse rounded-xl px-3 py-2.5 h-14" />
                ))}
              </div>
              <div className="h-px bg-white/[0.05] mb-3" />
              {/* Équipement disponible */}
              <Pulse className="h-2 w-36 mb-3" />
              <div className="flex flex-wrap gap-2">
                <Pulse className="h-6 w-28 rounded-xl" />
                <Pulse className="h-6 w-20 rounded-xl" />
              </div>
            </Card>

            {/* Zone dangereuse */}
            <div className="bg-red-950/20 border-[0.3px] border-red-500/20 rounded-2xl px-4 py-3 flex items-center justify-between">
              <Pulse className="h-2 w-28" />
              <Pulse className="h-2.5 w-36" />
            </div>
          </div>

          {/* ── COLONNE DROITE ── */}
          <div className="flex flex-col gap-4">

            {/* PhaseOptimizationWidget */}
            <div className="bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-2xl px-6 py-5">
              <div className="flex items-start justify-between mb-5">
                <div className="space-y-2">
                  <Pulse className="h-2 w-36" />
                  <Pulse className="h-2 w-20" />
                </div>
                <div className="flex gap-2">
                  <Pulse className="h-6 w-12 rounded-lg" />
                  <Pulse className="h-6 w-14 rounded-lg" />
                </div>
              </div>
              <InsightHeroSkeleton />
              <div className="mt-4">
                <SectionAccordionSkeleton />
                <SectionAccordionSkeleton />
                <SectionAccordionSkeleton />
                <SectionAccordionSkeleton />
              </div>
            </div>

            {/* Accès client card */}
            <Card>
              <Pulse className="h-2 w-24 mb-4" />
              {/* Status row: icon + label + badge */}
              <div className="flex items-center gap-3 mb-3">
                <div className="w-7 h-7 rounded-full bg-white/[0.04] animate-pulse shrink-0" />
                <Pulse className="h-3 w-28" />
                <Pulse className="h-5 w-12 rounded-lg ml-auto" />
              </div>
              {/* Description text */}
              <Pulse className="h-2.5 w-full mb-1.5" />
              <Pulse className="h-2.5 w-3/4 mb-4" />
              {/* Primary action button */}
              <Pulse className="h-10 w-full rounded-xl mb-2" />
              {/* Secondary buttons */}
              <div className="flex gap-2">
                <Pulse className="h-8 flex-1 rounded-lg" />
                <Pulse className="h-8 flex-1 rounded-lg" />
              </div>
            </Card>

            {/* Formules & abonnement card */}
            <Card>
              <div className="flex items-center justify-between mb-4">
                <Pulse className="h-2 w-40" />
                <Pulse className="h-5 w-14 rounded-lg" />
              </div>
              <div className="space-y-2">
                {[0, 1].map(i => (
                  <div key={i} className="bg-white/[0.03] animate-pulse rounded-xl px-3 py-3 h-14" />
                ))}
              </div>
            </Card>

            {/* Tags card */}
            <Card>
              <div className="flex items-center justify-between mb-3">
                <Pulse className="h-2 w-12" />
                <Pulse className="h-5 w-14 rounded-lg" />
              </div>
              <div className="flex flex-wrap gap-2">
                {[60, 80, 52, 70, 64].map((w, i) => (
                  <Pulse key={i} className="h-6 rounded-full" style={{ width: `${w}px` }} />
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </main>
  )
}
