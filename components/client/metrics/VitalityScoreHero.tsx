'use client'

import { useClientT } from '@/components/client/ClientI18nProvider'

interface Props {
  score: number | null
  checkinCount: number
}

function scoreLabel(s: number, t: (key: string, params?: Record<string, any>) => string): string {
  if (s >= 90) return t('vitality.excellent')
  if (s >= 70) return t('vitality.good')
  if (s >= 50) return t('vitality.attention')
  return t('vitality.watch')
}

export default function VitalityScoreHero({ score, checkinCount }: Props) {
  const { t } = useClientT()
  if (score == null || checkinCount === 0) {
    return (
      <div className="bg-[#161616] rounded-2xl p-4">
        <p className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.12em] text-[#5a5a5a] mb-2">
          {t('vitality.score')}
        </p>
        <p className="text-[12px] text-[#5a5a5a] leading-relaxed">
          {t('vitality.empty')}
        </p>
      </div>
    )
  }

  return (
    <div className="bg-[#161616] rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.12em] text-[#5a5a5a]">
          {t('vitality.score')}
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
        {scoreLabel(score, t as any)} · {t('vitality.monthCheckins', {
          count: checkinCount,
          suffix: checkinCount > 1 ? t('vitality.monthCheckins.plural') : '',
        })}
      </p>
    </div>
  )
}
