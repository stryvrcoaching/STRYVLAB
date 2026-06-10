'use client'

import { useState, useRef, useEffect } from 'react'
import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { NormEvaluation, NormZone, NormRange, NormReference } from '@/lib/health/bioNorms'
import type { MetricSource } from '@/lib/health/useBiometrics'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ZONE_COLORS: Record<NormZone, string> = {
  optimal:   '#1f8a65',
  good:      '#84cc16',
  average:   '#f59e0b',
  poor:      '#f97316',
  high_risk: '#ef4444',
}

const ZONE_BG: Record<NormZone, string> = {
  optimal:   'rgba(31,138,101,0.12)',
  good:      'rgba(132,204,22,0.12)',
  average:   'rgba(245,158,11,0.12)',
  poor:      'rgba(249,115,22,0.12)',
  high_risk: 'rgba(239,68,68,0.12)',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatValue(value: number, unit: string): string {
  if (unit === 'ratio') return value.toFixed(2)
  if (unit === 'niveau (1-30)') return Math.round(value).toString()
  return value.toFixed(1)
}

function formatShortDate(isoDate: string): string {
  const parts = isoDate.split('-')
  if (parts.length < 3) return isoDate
  return `${parts[2]}/${parts[1]}`
}

// Déduplique les zones pour la barre (max 5 segments — une zone par type)
function getDisplaySegments(ranges: NormRange[]): NormZone[] {
  const ORDER: NormZone[] = ['high_risk', 'poor', 'average', 'good', 'optimal']
  const seen = new Set<NormZone>()
  for (const r of ranges) seen.add(r.zone)
  return ORDER.filter(z => seen.has(z))
}

// ---------------------------------------------------------------------------
// InfoTooltip — custom, pas de dépendance base-ui
// ---------------------------------------------------------------------------

interface InfoTooltipProps {
  reference: NormReference
  zone_insight: string
}

function InfoTooltip({ reference, zone_insight }: InfoTooltipProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center justify-center w-5 h-5 rounded-md text-white/25 hover:text-white/55 hover:bg-white/[0.05] transition-all"
        aria-label="Voir l'interprétation"
      >
        <Info size={11} strokeWidth={1.75} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-7 z-50 w-[250px] rounded-xl overflow-hidden"
          style={{
            background: '#0e0e0e',
            border: '0.5px solid rgba(255,255,255,0.08)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4)',
          }}
        >
          {zone_insight && (
            <div style={{ borderBottom: '0.5px solid rgba(255,255,255,0.06)' }} className="px-3.5 py-3">
              <p className="text-[11px] text-white/70 leading-[1.65]">
                {zone_insight}
              </p>
            </div>
          )}
          <div className="px-3.5 py-2.5">
            <p className="text-[9px] font-medium text-white/25 leading-relaxed">
              {reference.source}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// SegmentedBar
// ---------------------------------------------------------------------------

function SegmentedBar({ ranges, activeZone }: { ranges: NormRange[]; activeZone: NormZone }) {
  const segments = getDisplaySegments(ranges)
  return (
    <div className="flex gap-[3px]">
      {segments.map((zone) => (
        <div
          key={zone}
          className="h-[3px] flex-1 rounded-full transition-all duration-300"
          style={{
            backgroundColor: ZONE_COLORS[zone],
            opacity: zone === activeZone ? 1 : 0.18,
          }}
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ZoneBadge
// ---------------------------------------------------------------------------

function ZoneBadge({ zone, label }: { zone: NormZone; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-[3px] rounded-md text-[9px] font-bold uppercase tracking-[0.08em] shrink-0"
      style={{ backgroundColor: ZONE_BG[zone], color: ZONE_COLORS[zone] }}
    >
      {zone === 'high_risk' && <span>⚠</span>}
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// SourceBadge — Mesuré / Calculé avec date et formule cliquable
// ---------------------------------------------------------------------------

function SourceBadge({ source }: { source: MetricSource }) {
  const [formulaOpen, setFormulaOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!formulaOpen) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setFormulaOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [formulaOpen])

  if (source.type === 'measured') {
    return (
      <div className="flex items-center gap-1.5">
        <span
          className="inline-block w-[5px] h-[5px] rounded-full shrink-0"
          style={{ backgroundColor: '#1f8a65' }}
        />
        <span className="text-[9px] font-medium leading-none" style={{ color: 'rgba(31,138,101,0.8)' }}>
          Mesuré le {formatShortDate(source.date)}
        </span>
      </div>
    )
  }

  return (
    <div ref={ref} className="relative flex items-center gap-1.5">
      <span className="inline-block w-[5px] h-[5px] rounded-full bg-white/20 shrink-0" />
      <button
        type="button"
        onClick={() => source.formula ? setFormulaOpen(v => !v) : undefined}
        className={cn(
          'text-[9px] font-medium leading-none text-white/30 text-left',
          source.formula && 'underline decoration-dotted underline-offset-2 cursor-pointer hover:text-white/50',
        )}
      >
        Calculé le {formatShortDate(source.date)}
      </button>
      {formulaOpen && source.formula && (
        <div
          className="absolute left-0 top-5 z-50 rounded-xl px-3 py-2 w-[220px]"
          style={{
            background: '#0e0e0e',
            border: '0.5px solid rgba(255,255,255,0.08)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          }}
        >
          <p className="text-[10px] text-white/50 leading-relaxed font-mono">
            {source.formula}
          </p>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Public export
// ---------------------------------------------------------------------------

export interface BioNormsGaugeProps {
  evaluation: NormEvaluation
  source?: MetricSource
  showSource?: boolean
  className?: string
}

export function BioNormsGauge({ evaluation, source, showSource = true, className }: BioNormsGaugeProps) {
  return (
    <div
      className={cn(
        'bg-white/[0.02] rounded-xl p-4 border-[0.3px] flex flex-col gap-3',
        evaluation.is_critical ? 'border-red-500/25' : 'border-white/[0.06]',
        className,
      )}
    >
      {/* Header : label + tooltip */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/35 leading-none truncate">
          {evaluation.label_fr}
        </p>
        <InfoTooltip reference={evaluation.reference} zone_insight={evaluation.zone_insight} />
      </div>

      {/* Valeur + badge zone */}
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-1 min-w-0">
          <span className="text-[20px] font-black text-white leading-none tabular-nums">
            {formatValue(evaluation.value, evaluation.unit)}
          </span>
          <span className="text-[11px] font-medium text-white/30 shrink-0">
            {evaluation.unit}
          </span>
        </div>
        <ZoneBadge zone={evaluation.zone} label={evaluation.zone_label_fr} />
      </div>

      {/* Source badge — mesuré ou calculé */}
      {source && <SourceBadge source={source} />}

      {/* Barre segmentée */}
      <SegmentedBar ranges={evaluation.ranges} activeZone={evaluation.zone} />

      {/* Source footer optionnel (référence scientifique) */}
      {showSource && (
        <p className="text-[9px] text-white/20 leading-none truncate">
          {evaluation.reference.source}
        </p>
      )}
    </div>
  )
}
