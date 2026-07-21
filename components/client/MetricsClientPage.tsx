'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Gear } from '@phosphor-icons/react'
import ClientTopBar from './ClientTopBar'
import BodyDataTab from './metrics/BodyDataTab'
import MesurationsTab from './metrics/MesurationsTab'
import VitalityTab from './metrics/VitalityTab'
import { ClientMetricsContentSkeleton } from './skeletons/ClientSkeletons'
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

export default function MetricsClientPage() {
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
    <div className="flex min-h-dvh flex-col bg-[#121212]">
      <ClientTopBar
        left={
          <div className="flex gap-0.5 rounded-xl bg-white/[0.04] p-0.5">
            {TABS.map(tabItem => (
              <button
                key={tabItem.id}
                type="button"
                onClick={() => setTab(tabItem.id)}
                className={`rounded-lg px-2.5 py-1.5 text-[12px] font-semibold tracking-[-0.01em] transition-[background-color,color] duration-150 ${
                  tab === tabItem.id
                    ? 'bg-[#f2f2f2] text-[#080808] shadow-sm'
                    : 'text-white/45'
                }`}
              >
                {t(tabItem.label as never)}
              </button>
            ))}
          </div>
        }
        right={
          <button
            type="button"
            onClick={() => router.push('/client/profil')}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.04] text-white/60 transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#1f8a65] active:scale-[0.96]"
            aria-label={t('profil.section.prefs')}
          >
            <Gear size={16} />
          </button>
        }
      />

      <div className="client-page-top mx-auto flex w-full max-w-lg flex-col px-4 pb-24">
        {loading ? (
          <ClientMetricsContentSkeleton />
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
