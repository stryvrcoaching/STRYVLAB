import { useClientT } from '@/components/client/ClientI18nProvider'

type ProtocolDay = {
  name?: string | null
  calories?: number | null
  protein_g?: number | null
  carbs_g?: number | null
  fat_g?: number | null
  hydration_ml?: number | null
  carb_cycle_type?: string | null
  cycle_sync_phase?: string | null
  recommendations?: string | null
}

export default function CoachProtocolCard({ day }: { day: ProtocolDay | null }) {
  const { t } = useClientT()
  if (!day) {
    return (
      <div className="bg-[#111111] rounded-2xl p-4">
        <div className="font-barlow-condensed font-bold uppercase tracking-[0.18em] text-[11px] text-white mb-2">
          {t('nutrition.protocolLabel')}
        </div>
        <p className="text-[12px] text-white/40">{t('nutrition.noProtocol.desc')}</p>
      </div>
    )
  }

  return (
    <div className="bg-[#111111] rounded-2xl p-4 space-y-3">
      <div className="flex items-baseline justify-between">
        <div className="font-barlow-condensed font-bold uppercase tracking-[0.18em] text-[11px] text-white">
          {day.name ?? t('nutrition.protocolLabel')}
        </div>
        {day.carb_cycle_type && (
          <span className="text-[9px] uppercase font-bold tracking-[0.1em] text-[#f2f2f2]">{day.carb_cycle_type}</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 text-[11px] text-white/70 tabular-nums">
        <div>{Math.round(Number(day.calories ?? 0))} kcal</div>
        <div>P {Math.round(Number(day.protein_g ?? 0))} · G {Math.round(Number(day.carbs_g ?? 0))} · L {Math.round(Number(day.fat_g ?? 0))}</div>
        <div>{t('nutrition.hydration')} : {(Number(day.hydration_ml ?? 0) / 1000).toFixed(1)}L</div>
        {day.cycle_sync_phase && <div>{t('nutrition.protocol.phase', { name: day.cycle_sync_phase })}</div>}
      </div>
      {day.recommendations && (
        <p className="text-[11px] text-white/55 leading-relaxed whitespace-pre-wrap">{day.recommendations}</p>
      )}
    </div>
  )
}
