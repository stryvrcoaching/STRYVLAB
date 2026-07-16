'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Gear } from '@phosphor-icons/react'
import ClientTopBar from './ClientTopBar'
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
  { id: 'corps',        label: 'metrics.tab.bodyData' },
  { id: 'mensurations', label: 'metrics.tab.measurements' },
  { id: 'vitalite',     label: 'metrics.tab.vitality' },
]

interface Props {
  clientName: string
  clientEmail: string
  avatarInitials: string
  avatarUrl?: string | null
  streak: number
}

export default function MetricsClientPage({ clientName, clientEmail, avatarInitials, avatarUrl, streak }: Props) {
  const { lang, t } = useClientT()
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
    <div className="flex min-h-dvh flex-col bg-[#0d0d0d]">
      <ClientTopBar
        section="MON PROFIL"
        title={t('metrics.title')}
        right={
          <button
            onClick={() => router.push('/client/profil')}
            className="premium-panel premium-micrograin flex h-9 w-9 items-center justify-center rounded-xl text-white/56 transition-colors active:bg-white/[0.08]"
            aria-label={t('profil.section.prefs')}
          >
            <Gear size={16} />
          </button>
        }
      />

      <div className="mx-auto flex w-full max-w-lg flex-col px-4 pb-24 pt-[104px]">
        <div className="premium-panel premium-micrograin flex items-center gap-3 rounded-[24px] px-4 py-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#111111]">
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
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-barlow font-semibold text-white">{clientName}</p>
            <p className="truncate text-[11px] text-white/40">{clientEmail}</p>
          </div>
          {streak > 0 && (
            <div className="premium-panel premium-micrograin shrink-0 rounded-full px-2.5 py-1">
              <span className="text-[11px] font-barlow-condensed font-bold text-[#f2f2f2]">
                🔥 {streak}{lang === 'fr' ? 'j' : 'd'}
              </span>
            </div>
          )}
        </div>

        <div className="scrollbar-hide mt-4 flex gap-2 overflow-x-auto pb-4">
          {TABS.map(tabItem => (
            <button
              key={tabItem.id}
              onClick={() => setTab(tabItem.id)}
              className={`flex-shrink-0 rounded-full px-3 py-1.5 text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.12em] transition-colors ${
                tab === tabItem.id
                  ? 'bg-[#f2f2f2] text-[#080808]'
                  : 'premium-panel premium-micrograin text-[#8a8a8a]'
              }`}
            >
              {t(tabItem.label as never)}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="premium-panel premium-micrograin h-20 animate-pulse rounded-2xl" />
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
