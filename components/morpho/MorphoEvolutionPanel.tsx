'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Minus, CheckCircle2, AlertCircle, Calendar } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import type { EvolutionReport } from '@/lib/morpho/evolution'

interface Props {
  clientId: string
}

const TREND_CONFIG = {
  improving:  { label: 'En progression',  color: '#1f8a65', Icon: TrendingUp   },
  stable:     { label: 'Stable',          color: 'rgba(255,255,255,0.4)', Icon: Minus },
  worsening:  { label: 'En régression',   color: '#ef4444', Icon: TrendingDown },
  mixed:      { label: 'Mixte',           color: '#f59e0b', Icon: Minus        },
}

const METRIC_LABELS: Record<string, string> = {
  score: 'Score postural',
  shoulder_imbalance_cm: 'Épaules (asymétrie)',
  hip_imbalance_cm: 'Hanches (asymétrie)',
  arm_diff_cm: 'Bras (diff.)',
  leg_length_diff_cm: 'Jambes (diff.)',
  pelvic_rotation_deg: 'Rotation pelvienne',
  upper_crossed_severity: 'Syndrome croisé sup.',
  lower_crossed_severity: 'Syndrome croisé inf.',
  layered_severity: 'Syndrome en couches',
  trunk_to_femur_ratio: 'Ratio tronc/fémur',
  arm_to_torso_ratio: 'Ratio bras/tronc',
}

function DeltaBadge({ delta, unit = '' }: { delta: number | null; unit?: string }) {
  if (delta == null) return <span className="text-white/25 text-[10px]">—</span>
  const pos = delta > 0
  const zero = delta === 0
  return (
    <span className={`text-[10px] font-bold font-mono ${zero ? 'text-white/30' : pos ? 'text-[#1f8a65]' : 'text-amber-400'}`}>
      {pos ? '+' : ''}{typeof delta === 'number' ? delta.toFixed(1) : delta}{unit}
    </span>
  )
}

export function MorphoEvolutionPanel({ clientId }: Props) {
  const [report, setReport] = useState<EvolutionReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [noData, setNoData] = useState(false)

  useEffect(() => {
    fetch(`/api/clients/${clientId}/morpho/evolution`)
      .then(r => {
        if (r.status === 404) { setNoData(true); return null }
        return r.json()
      })
      .then(data => {
        if (data?.report) setReport(data.report)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [clientId])

  if (loading) return <Skeleton className="h-[120px] w-full rounded-xl" />
  if (noData || !report) return null

  const trend = TREND_CONFIG[report.overall_trend]
  const TrendIcon = trend.Icon
  const scorePos = report.score_delta >= 0
  const resolvedCount = report.highlights.resolved_flags.length
  const newCount = report.highlights.new_flags.length

  return (
    <div className="bg-white/[0.02] rounded-xl border-[0.3px] border-white/[0.06] p-4 space-y-3">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/30">Évolution</p>
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full border-[0.3px]"
            style={{ background: `${trend.color}12`, borderColor: `${trend.color}30` }}>
            <TrendIcon size={9} style={{ color: trend.color }} />
            <span className="text-[9px] font-semibold" style={{ color: trend.color }}>{trend.label}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 text-white/30">
          <Calendar size={10} />
          <span className="text-[9px]">{report.span_days}j</span>
        </div>
      </div>

      {/* Score delta + flag changes */}
      <div className="flex items-center gap-3">

        {/* Score */}
        <div className="bg-white/[0.03] rounded-xl px-4 py-2.5 border-[0.3px] border-white/[0.06] flex items-center gap-3 shrink-0">
          <div className="text-center">
            <p className="text-[8px] text-white/30 mb-0.5">Avant</p>
            <p className="text-[16px] font-bold font-mono text-white/50">
              {report.score_delta != null ? Math.round(report.score_delta > 0
                ? (report.score_delta > 0 ? 0 : 0)  // placeholder
                : 0) : '—'}
            </p>
          </div>
          {/* Arrow + delta */}
          <div className="flex flex-col items-center gap-0.5">
            <span className={`text-[13px] font-bold font-mono ${scorePos ? 'text-[#1f8a65]' : 'text-amber-400'}`}>
              {scorePos ? '+' : ''}{report.score_delta}
            </span>
            <span className="text-[8px] text-white/25">score</span>
          </div>
        </div>

        {/* Flags */}
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          {resolvedCount > 0 && (
            <div className="flex items-center gap-2">
              <CheckCircle2 size={11} className="text-[#1f8a65] shrink-0" />
              <p className="text-[10px] text-[#1f8a65]">
                {resolvedCount} flag{resolvedCount > 1 ? 's' : ''} corrigé{resolvedCount > 1 ? 's' : ''}
              </p>
            </div>
          )}
          {newCount > 0 && (
            <div className="flex items-center gap-2">
              <AlertCircle size={11} className="text-amber-400 shrink-0" />
              <p className="text-[10px] text-amber-400">
                {newCount} nouveau{newCount > 1 ? 'x' : ''} flag{newCount > 1 ? 's' : ''}
              </p>
            </div>
          )}
          {resolvedCount === 0 && newCount === 0 && (
            <p className="text-[10px] text-white/30">Aucun changement de flag</p>
          )}
        </div>
      </div>

      {/* Top deltas */}
      {(report.highlights.biggest_improvement || report.highlights.biggest_regression) && (
        <div className="grid grid-cols-2 gap-2">
          {report.highlights.biggest_improvement && (
            <div className="bg-[#1f8a65]/[0.05] rounded-xl px-3 py-2 border-[0.3px] border-[#1f8a65]/15">
              <p className="text-[8px] text-[#1f8a65]/70 mb-0.5">Meilleure amélioration</p>
              <p className="text-[10px] font-semibold text-white/70 truncate">
                {METRIC_LABELS[report.highlights.biggest_improvement.metric] ?? report.highlights.biggest_improvement.metric}
              </p>
              <DeltaBadge delta={report.highlights.biggest_improvement.delta} />
            </div>
          )}
          {report.highlights.biggest_regression && (
            <div className="bg-amber-500/[0.05] rounded-xl px-3 py-2 border-[0.3px] border-amber-500/15">
              <p className="text-[8px] text-amber-400/70 mb-0.5">Plus forte régression</p>
              <p className="text-[10px] font-semibold text-white/70 truncate">
                {METRIC_LABELS[report.highlights.biggest_regression.metric] ?? report.highlights.biggest_regression.metric}
              </p>
              <DeltaBadge delta={report.highlights.biggest_regression.delta} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
