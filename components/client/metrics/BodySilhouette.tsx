'use client'

import { useState } from 'react'
import { useClientT } from '@/components/client/ClientI18nProvider'
import type { BilanMeasures } from '@/app/api/client/body-data/route'

interface Props {
  bilanList: BilanMeasures[]
}

const FILL   = 'rgba(255,255,255,0.05)'
const STROKE = 'rgba(255,255,255,0.16)'
const LINE   = 'rgba(255,255,255,0.18)'
const TEXT_V = '#a0a0a0'
const TEXT_L = '#5a5a5a'

// Measurement anchors in viewBox "0 0 280 460"
// lx = left body edge, rx = right body edge (null = left-only)
const ANCHORS = {
  chest_cm: { y: 130, lx: 80,  rx: 200  as number | null, labelRight: 'Poitrine' },
  waist_cm: { y: 195, lx: 96,  rx: 184  as number | null, labelRight: 'Taille'   },
  hips_cm:  { y: 240, lx: 83,  rx: 197  as number | null, labelRight: 'Hanches'  },
  arm_cm:   { y: 158, lx: 44,  rx: null as number | null, labelRight: 'Bras'     },
} as const

type MeasureKey = keyof typeof ANCHORS

function formatVal(v: number | null): string {
  return v != null ? `${v}` : '—'
}

function deltaInfo(cur: number | null, prev: number | null): { text: string; color: string } | null {
  if (cur == null || prev == null) return null
  const diff = cur - prev
  if (Math.abs(diff) < 0.5) return null
  const sign = diff > 0 ? '+' : ''
  const color = diff < 0 ? '#6aab8e' : '#ef4444'
  return { text: `${sign}${diff}`, color }
}

export default function BodySilhouette({ bilanList }: Props) {
  const { t, lang } = useClientT()
  const [selectedIdx, setSelectedIdx] = useState(bilanList.length - 1)

  if (bilanList.length === 0) return null

  const selected = bilanList[Math.min(selectedIdx, bilanList.length - 1)]
  const prev     = selectedIdx > 0 ? bilanList[selectedIdx - 1] : null

  function renderAnnotation(key: MeasureKey) {
    const { y, lx, rx, labelRight } = ANCHORS[key]
    const val   = selected[key]
    const delta = prev ? deltaInfo(val, prev[key]) : null
    const translatedLabel =
      labelRight === 'Poitrine'
        ? t('metrics.body.chest')
        : labelRight === 'Taille'
          ? t('metrics.body.waist')
          : labelRight === 'Hanches'
            ? t('metrics.body.hips')
            : t('metrics.body.arm')

    return (
      <g key={key}>
        {/* left dashed line */}
        <line x1={lx} y1={y} x2="8" y2={y}
          stroke={LINE} strokeWidth="0.8" strokeDasharray="3,3" />

        {/* left value */}
        <text x="6" y={y - 4} textAnchor="end" fontSize="9.5"
          fill={TEXT_V} fontWeight="700" fontFamily="Barlow Condensed, sans-serif">
          {formatVal(val)}
        </text>
        <text x="6" y={y + 7} textAnchor="end" fontSize="7"
          fill={TEXT_L} fontFamily="sans-serif">
          cm
        </text>
        {delta && (
          <text x="6" y={y + 17} textAnchor="end" fontSize="7" fill={delta.color} fontFamily="sans-serif">
            {t('metrics.delta.cm', { n: delta.text })}
          </text>
        )}

        {/* right dashed line + label */}
        {rx != null && (
          <>
            <line x1={rx} y1={y} x2="272" y2={y}
              stroke={LINE} strokeWidth="0.8" strokeDasharray="3,3" />
            <text x="274" y={y - 4} textAnchor="start" fontSize="8"
              fill={TEXT_L} fontFamily="sans-serif">
              {translatedLabel}
            </text>
          </>
        )}
        {rx == null && (
          <text x="274" y={y - 4} textAnchor="start" fontSize="8"
            fill={TEXT_L} fontFamily="sans-serif">
            {translatedLabel}
          </text>
        )}
      </g>
    )
  }

  return (
    <div className="space-y-3">
      {/* Bilan selector — hidden when only 1 bilan */}
      {bilanList.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {bilanList.map((b, i) => {
            const active = i === selectedIdx
            const dt = new Date(b.date + 'T00:00:00')
            const label = dt.toLocaleDateString(lang === 'es' ? 'es-ES' : lang === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'short' })
            return (
              <button
                key={b.bilanIndex}
                onClick={() => setSelectedIdx(i)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.12em] transition-colors ${
                  active
                    ? 'bg-[#f2f2f2] text-[#080808]'
                    : 'bg-white/[0.06] text-[#5a5a5a]'
                }`}
              >
                B{b.bilanIndex} · {label}
              </button>
            )
          })}
        </div>
      )}

      {/* SVG */}
      <svg
        viewBox="0 0 280 460"
        className="w-full max-w-[240px] mx-auto"
        style={{ height: 'auto' }}
        aria-label={t('metrics.body.silhouetteAria')}
      >
        {/* ── Head ── */}
        <ellipse cx="140" cy="32" rx="26" ry="30"
          fill={FILL} stroke={STROKE} strokeWidth="1.2" />

        {/* ── Neck ── */}
        <path d="M 126,60 L 126,76 Q 140,80 154,76 L 154,60"
          fill={FILL} stroke={STROKE} strokeWidth="1.2" />

        {/* ── Full body silhouette ──
            Traces outer contour clockwise:
            left neck → left shoulder → left arm outer →
            left wrist reconnect → left torso → left hip →
            left leg → feet → right leg → right hip →
            right torso → right wrist reconnect →
            right arm outer → right shoulder → right neck
        ── */}
        <path
          d={[
            'M 126,76',
            'C 100,80 76,90 60,102',
            'C 44,114 38,132 38,154',
            'C 38,170 40,186 44,200',
            'C 46,210 48,220 50,228',
            'L 58,222',
            'C 68,216 80,212 92,210',
            'C 88,224 84,238 82,252',
            'C 80,268 80,285 82,305',
            'C 83,323 84,340 84,358',
            'C 84,373 84,386 85,398',
            'C 85,412 84,426 84,440',
            'L 78,446 L 72,450',
            'L 108,452 L 110,446',
            'L 134,446 L 146,446',
            'L 170,446 L 172,452',
            'L 208,450 L 202,446',
            'C 196,426 196,412 196,398',
            'C 196,386 196,373 196,358',
            'C 196,340 197,323 198,305',
            'C 200,285 200,268 198,252',
            'C 196,238 192,224 188,210',
            'C 200,212 212,216 222,222',
            'L 230,228',
            'C 232,220 234,210 236,200',
            'C 240,186 242,170 242,154',
            'C 242,132 236,114 220,102',
            'C 204,90 180,80 154,76',
            'Z',
          ].join(' ')}
          fill={FILL}
          stroke={STROKE}
          strokeWidth="1.2"
        />

        {/* ── Measurement annotation lines ── */}
        {(Object.keys(ANCHORS) as MeasureKey[]).map(renderAnnotation)}
      </svg>
    </div>
  )
}
