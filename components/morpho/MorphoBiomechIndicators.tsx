'use client'

import { useState, useEffect, useRef } from 'react'
import { Dna, ChevronDown } from 'lucide-react'
import { isMorphoV2, type SegmentEstimate, type BiomechFrame } from '@/lib/morpho/types'

interface Props {
  clientId: string
  /** compact = header inline (4 gauges + popover), full = standalone block */
  variant?: 'compact' | 'full'
}

// ─── Scales (3-level ordinal → bar gauge) ───────────────────────────────────

type Gauge = { key: string; label: string; filled: number; total: number; levelLabel: string }

const FRAME_3LEVEL: Record<string, { label: string; levels: string[]; levelLabels: string[] }> = {
  biacromial:   { label: 'Clavicules', levels: ['narrow', 'average', 'wide'], levelLabels: ['Étroites', 'Moyennes', 'Larges'] },
  bi_iliac:     { label: 'Bassin',     levels: ['narrow', 'average', 'wide'], levelLabels: ['Étroit', 'Moyen', 'Large'] },
  thorax_depth: { label: 'Thorax',     levels: ['flat', 'average', 'deep'],  levelLabels: ['Plat', 'Moyen', 'Épais'] },
}

const SEG_LEVELS = ['short', 'average', 'long']
const SEG_LABELS = ['Court', 'Moyen', 'Long']

const CARRYING_ANGLE_LABELS: Record<string, string> = {
  normal: 'Normal',
  mild_valgus: 'Valgus léger',
  marked_valgus: 'Valgus marqué',
  varus: 'Varus',
  unknown: '—',
}

const KNEE_LABELS: Record<string, string> = {
  valgus: 'Valgus (X)',
  varus: 'Varus (O)',
  neutral: 'Neutre',
  unknown: '—',
}

const INSERTION_LABELS: Record<string, string> = {
  pec_sternal: 'Pect. sternal',
  pec_clavicular: 'Pect. claviculaire',
  pectorals: 'Pectoraux',
  lats: 'Dorsaux',
  biceps: 'Biceps',
  triceps: 'Triceps',
  gastrocnemius: 'Gastrocnémiens',
  calves: 'Mollets',
  quad_sweep: 'Vaste latéral',
  quadriceps: 'Quadriceps',
  deltoid_anterior: 'Deltoïde ant.',
  deltoids: 'Deltoïdes',
  traps: 'Trapèzes',
  hamstrings: 'Ischio-jambiers',
}

const INSERTION_VALUE_LABELS: Record<string, string> = {
  high: 'Haute', low: 'Basse', balanced: 'Équilibrée', wide: 'Large', narrow: 'Étroit', unknown: '—',
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function segOrdinal(a?: SegmentEstimate, b?: SegmentEstimate): number | null {
  const vals = [a, b]
    .map(s => s ? SEG_LEVELS.indexOf(s.classification) : -1)
    .filter(i => i >= 0)
  if (vals.length === 0) return null
  return Math.round(vals.reduce((x, y) => x + y, 0) / vals.length)
}

function BarGauge({ filled, total }: { filled: number; total: number }) {
  return (
    <div className="flex items-center gap-[2px]">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className="w-[5px] h-[11px] rounded-[1px] transition-colors"
          style={{ background: i < filled ? '#1f8a65' : 'rgba(255,255,255,0.10)' }}
        />
      ))}
    </div>
  )
}

function GaugeRow({ g, dim = false }: { g: Gauge; dim?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={`text-[10px] ${dim ? 'text-white/40' : 'text-white/55'} whitespace-nowrap`}>{g.label}</span>
      <div className="flex items-center gap-2">
        <span className="text-[9px] text-white/35 whitespace-nowrap">{g.levelLabel}</span>
        <BarGauge filled={g.filled} total={g.total} />
      </div>
    </div>
  )
}

// ─── Component ──────────────────────────────────────────────────────────────

type AnalysisData = {
  frame: BiomechFrame | null
  segments: Record<string, SegmentEstimate> | null
  insertions: Array<{ muscle: string; value: string }>
  date: string | null
}

export function MorphoBiomechIndicators({ clientId, variant = 'compact' }: Props) {
  const [data, setData] = useState<AnalysisData | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    fetch(`/api/clients/${clientId}/morpho/analyses?limit=1&offset=0`)
      .then(r => r.json())
      .then(d => {
        if (!alive) return
        const a = d.analyses?.[0]
        const result = a?.analysis_result
        if (result && isMorphoV2(result)) {
          setData({
            frame: result.biomech.frame ?? null,
            segments: result.biomech.segments as unknown as Record<string, SegmentEstimate>,
            insertions: (result.biomech.insertions ?? []).filter((i: { value: string }) => i.value !== 'unknown'),
            date: a.analysis_date ?? null,
          })
        }
      })
      .catch(() => {})
      .finally(() => { if (alive) setLoaded(true) })
    return () => { alive = false }
  }, [clientId])

  // Close popover on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (!loaded || !data) return null

  const { frame, segments, insertions } = data

  // ── Primary gauges (header) : Clavicules, Bassin, Fémur, Bras ──
  const primary: Gauge[] = []
  if (frame && frame.confidence !== 'low') {
    for (const key of ['biacromial', 'bi_iliac'] as const) {
      const def = FRAME_3LEVEL[key]
      const idx = def.levels.indexOf(frame[key] ?? '')
      if (idx >= 0) primary.push({ key, label: def.label, filled: idx + 1, total: 3, levelLabel: def.levelLabels[idx] })
    }
  }
  if (segments) {
    const femur = segOrdinal(segments.femur_l, segments.femur_r)
    if (femur !== null) primary.push({ key: 'femur', label: 'Fémur', filled: femur + 1, total: 3, levelLabel: SEG_LABELS[femur] })
    const arm = segOrdinal(segments.arm_l, segments.arm_r)
    if (arm !== null) primary.push({ key: 'arm', label: 'Bras', filled: arm + 1, total: 3, levelLabel: SEG_LABELS[arm] })
  }

  if (primary.length === 0) return null

  // ── Secondary gauges (popover) : Tibia, Tronc, Thorax ──
  const secondary: Gauge[] = []
  if (segments) {
    const tibia = segOrdinal(segments.tibia_l, segments.tibia_r)
    if (tibia !== null) secondary.push({ key: 'tibia', label: 'Tibia', filled: tibia + 1, total: 3, levelLabel: SEG_LABELS[tibia] })
    const torso = segOrdinal(segments.torso)
    if (torso !== null) secondary.push({ key: 'torso', label: 'Tronc', filled: torso + 1, total: 3, levelLabel: SEG_LABELS[torso] })
  }
  if (frame && frame.confidence !== 'low') {
    const idx = FRAME_3LEVEL.thorax_depth.levels.indexOf(frame.thorax_depth ?? '')
    if (idx >= 0) secondary.push({ key: 'thorax', label: 'Thorax', filled: idx + 1, total: 3, levelLabel: FRAME_3LEVEL.thorax_depth.levelLabels[idx] })
  }

  // ── Angles (popover) ──
  const angles: Array<{ label: string; value: string }> = []
  if (frame?.elbow_carrying_angle && frame.elbow_carrying_angle !== 'unknown') {
    angles.push({ label: 'Valgus coude', value: CARRYING_ANGLE_LABELS[frame.elbow_carrying_angle] })
  }
  if (frame?.knee_alignment && frame.knee_alignment !== 'unknown') {
    angles.push({ label: 'Genoux', value: KNEE_LABELS[frame.knee_alignment] })
  }

  const hasDetail = secondary.length > 0 || angles.length > 0 || insertions.length > 0

  // ── full variant : everything in a block ──
  if (variant === 'full') {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          {[...primary, ...secondary].map(g => <GaugeRow key={g.key} g={g} />)}
        </div>
        {angles.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {angles.map(a => (
              <span key={a.label} className="px-2 py-1 rounded-lg bg-white/[0.03] text-[10px] text-white/55 border-[0.3px] border-white/[0.06]">
                {a.label} : <span className="text-white/75">{a.value}</span>
              </span>
            ))}
          </div>
        )}
        {insertions.length > 0 && (
          <div className="grid grid-cols-2 gap-x-6 gap-y-1">
            {insertions.map(ins => (
              <div key={ins.muscle} className="flex items-center justify-between">
                <span className="text-[10px] text-white/45">{INSERTION_LABELS[ins.muscle] ?? ins.muscle}</span>
                <span className="text-[10px] font-semibold text-white/70">{INSERTION_VALUE_LABELS[ins.value] ?? ins.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── compact variant : 4 gauges + popover ──
  return (
    <div ref={ref} className="relative flex items-center gap-3">
      {/* Inline gauges */}
      <div className="flex items-center gap-3">
        {primary.map(g => (
          <div key={g.key} className="flex items-center gap-1.5" title={`${g.label} : ${g.levelLabel}`}>
            <span className="text-[9px] font-semibold text-white/35 whitespace-nowrap">{g.label}</span>
            <BarGauge filled={g.filled} total={g.total} />
          </div>
        ))}
      </div>

      {/* Detail trigger */}
      {hasDetail && (
        <button
          onClick={() => setOpen(o => !o)}
          className={`flex items-center gap-1 h-6 px-2 rounded-lg text-[9px] font-bold uppercase tracking-[0.08em] transition-all ${
            open ? 'bg-[#1f8a65]/15 text-[#1f8a65]' : 'bg-white/[0.04] text-white/45 hover:bg-white/[0.08] hover:text-white/70'
          }`}
        >
          <Dna size={10} />
          Morpho
          <ChevronDown size={10} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      )}

      {/* Popover */}
      {open && hasDetail && (
        <div className="absolute right-0 top-full mt-2 z-50 w-[280px] rounded-xl border-[0.3px] border-white/[0.08] bg-[#181818] shadow-xl shadow-black/40 overflow-hidden">
          <div className="px-4 py-2.5 border-b-[0.3px] border-white/[0.06] flex items-center gap-2">
            <Dna size={11} className="text-[#1f8a65]" />
            <span className="text-[11px] font-semibold text-white/80">Profil biomécanique</span>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {/* Leviers */}
            {secondary.length > 0 && (
              <div className="px-4 py-3 space-y-2">
                <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-white/25">Leviers complémentaires</p>
                {secondary.map(g => <GaugeRow key={g.key} g={g} dim />)}
              </div>
            )}

            {/* Angles */}
            {angles.length > 0 && (
              <div className="px-4 py-3 space-y-1.5 border-t-[0.3px] border-white/[0.04]">
                <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-white/25">Angles articulaires</p>
                {angles.map(a => (
                  <div key={a.label} className="flex items-center justify-between">
                    <span className="text-[10px] text-white/45">{a.label}</span>
                    <span className="text-[10px] font-semibold text-white/75">{a.value}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Insertions */}
            {insertions.length > 0 && (
              <div className="px-4 py-3 space-y-1.5 border-t-[0.3px] border-white/[0.04]">
                <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-white/25">Insertions musculaires</p>
                {insertions.map(ins => (
                  <div key={ins.muscle} className="flex items-center justify-between">
                    <span className="text-[10px] text-white/45">{INSERTION_LABELS[ins.muscle] ?? ins.muscle}</span>
                    <span className="text-[10px] font-semibold text-white/75">{INSERTION_VALUE_LABELS[ins.value] ?? ins.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
