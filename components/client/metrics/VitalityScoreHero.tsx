'use client'

interface Props {
  score: number | null
  checkinCount: number
}

function scoreLabel(s: number): string {
  if (s >= 90) return 'Excellent'
  if (s >= 70) return 'Bonne forme'
  if (s >= 50) return 'Attention'
  return 'À surveiller'
}

export default function VitalityScoreHero({ score, checkinCount }: Props) {
  if (score == null || checkinCount === 0) {
    return (
      <div className="bg-[#161616] rounded-2xl p-4">
        <p className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.12em] text-[#5a5a5a] mb-2">
          Score forme
        </p>
        <p className="text-[12px] text-[#5a5a5a] leading-relaxed">
          Complétez vos check-ins quotidiens pour voir votre score de forme.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-[#161616] rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.12em] text-[#5a5a5a]">
          Score forme
        </p>
        <span className="text-[20px] font-black text-[#f2f2f2] leading-none">
          {score}
          <span className="text-[11px] font-medium text-[#5a5a5a] ml-1">/ 100</span>
        </span>
      </div>

      <div className="h-1.5 rounded-full bg-[#222222] overflow-hidden">
        <div
          className="h-full bg-[#f2f2f2] rounded-full transition-all duration-500"
          style={{ width: `${score}%` }}
        />
      </div>

      <p className="text-[11px] text-[#808080]">
        {scoreLabel(score)} · {checkinCount} check-in{checkinCount > 1 ? 's' : ''} ce mois
      </p>
    </div>
  )
}
