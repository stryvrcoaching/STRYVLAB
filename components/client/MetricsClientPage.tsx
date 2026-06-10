'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Gear } from '@phosphor-icons/react'
import BodyDataTab from './metrics/BodyDataTab'
import MesurationsTab from './metrics/MesurationsTab'
import VitalityTab from './metrics/VitalityTab'
import dynamic from 'next/dynamic'
import type { BodyDataResponse } from '@/app/api/client/body-data/route'
import type { VitalityResponse } from '@/app/api/client/vitality/route'
import { useClientT } from '@/components/client/ClientI18nProvider'

const MeasurementsEntrySheet = dynamic(
  () => import('./metrics/MeasurementsEntrySheet'),
  { ssr: false }
)

type Tab = 'corps' | 'mensurations' | 'vitalite'

const TABS: { id: Tab; label: string }[] = [
  { id: 'corps',        label: 'Données corporelles' },
  { id: 'mensurations', label: 'Mensurations' },
  { id: 'vitalite',     label: 'Vitalité' },
]

interface Props {
  clientName: string
  clientEmail: string
  avatarInitials: string
  avatarUrl?: string | null
  streak: number
}

export default function MetricsClientPage({ clientName, clientEmail, avatarInitials, avatarUrl, streak }: Props) {
  const { t } = useClientT()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('corps')
  const [bodyData, setBodyData] = useState<BodyDataResponse | null>(null)
  const [vitalityData, setVitalityData] = useState<VitalityResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [entryOpen, setEntryOpen] = useState(false)

  async function refreshBodyData() {
    const body = await fetch('/api/client/body-data').then(r => r.ok ? r.json() : null)
    setBodyData(body)
  }

  useEffect(() => {
    Promise.all([
      fetch('/api/client/body-data').then(r => r.ok ? r.json() : null),
      fetch('/api/client/vitality').then(r => r.ok ? r.json() : null),
    ]).then(([body, vitality]) => {
      setBodyData(body)
      setVitalityData(vitality)
    }).finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex flex-col min-h-full bg-[#0d0d0d]">

      {/* TopBar */}
      <div className="flex items-center justify-between px-4 pt-12 pb-3 shrink-0">
        <div>
          <p className="text-[9px] font-barlow-condensed font-bold uppercase tracking-[0.18em] text-white/30">
            MON PROFIL
          </p>
          <p className="text-[13px] font-barlow font-semibold text-white">Métriques</p>
        </div>
        <button
          onClick={() => router.push('/client/profil')}
          className="h-8 w-8 flex items-center justify-center rounded-xl bg-white/[0.04] text-white/40 active:bg-white/[0.08] transition-colors"
          aria-label="Paramètres"
        >
          <Gear size={16} />
        </button>
      </div>

      {/* Hero */}
      <div className="flex items-center gap-3 px-4 pb-4 shrink-0">
        <div className="w-12 h-12 rounded-full bg-[#111111] shrink-0 overflow-hidden flex items-center justify-center">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={clientName}
              className="w-full h-full object-cover"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          ) : (
            <span className="text-[16px] font-barlow-condensed font-bold text-[#f2f2f2] uppercase">
              {avatarInitials}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-barlow font-semibold text-white truncate">{clientName}</p>
          <p className="text-[11px] text-white/40 truncate">{clientEmail}</p>
        </div>
        {streak > 0 && (
          <div className="px-2.5 py-1 bg-[#222222] rounded-full shrink-0">
            <span className="text-[11px] font-barlow-condensed font-bold text-[#f2f2f2]">
              🔥 {streak}j
            </span>
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 px-4 pb-4 overflow-x-auto scrollbar-hide shrink-0">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.12em] transition-colors ${
              tab === t.id
                ? 'bg-[#f2f2f2] text-[#080808]'
                : 'bg-white/[0.06] text-[#5a5a5a]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 px-4 pb-24">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-white/[0.04] rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {tab === 'corps'        && bodyData     && <BodyDataTab    data={bodyData} />}
            {tab === 'mensurations' && bodyData     && <MesurationsTab data={bodyData} />}
            {tab === 'vitalite'     && vitalityData && <VitalityTab    data={vitalityData} />}
          </>
        )}
      </div>

      {/* FAB — visible uniquement sur l'onglet Mensurations */}
      {tab === 'mensurations' && (
        <button
          onClick={() => setEntryOpen(true)}
          className="fixed z-50 flex items-center justify-center h-12 w-12 rounded-2xl transition-all active:scale-[0.93]"
          style={{ bottom: '88px', right: '16px', background: '#f2f2f2', color: '#080808' }}
          aria-label={t('ui.add.measurements')}
        >
          <Plus size={22} strokeWidth={2.5} />
        </button>
      )}

      <MeasurementsEntrySheet
        open={entryOpen}
        onClose={() => setEntryOpen(false)}
        onSaved={async () => { await refreshBodyData() }}
      />
    </div>
  )
}
