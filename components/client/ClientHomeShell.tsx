'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import CheckinModal from '@/components/client/CheckinModal'
import QuickWaterModal from '@/components/client/QuickWaterModal'
import AdherenceScoreCard from '@/components/client/smart/AdherenceScoreCard'
import PriorityActionCard from '@/components/client/smart/PriorityActionCard'
import DayChecklist from '@/components/client/smart/DayChecklist'
import SmartAgendaTimeline from '@/components/client/smart/SmartAgendaTimeline'
import type { AdherenceResult } from '@/lib/client/smart/adherenceScore'
import type { PriorityActionCardProps } from '@/lib/client/smart/priorityAction'
import type { DayChecklistProps } from '@/components/client/smart/DayChecklist'
import type { TimelineEntry } from '@/lib/client/smart/timelineBuilder'

interface Props {
  adherence: AdherenceResult
  priorityAction: PriorityActionCardProps | null
  checklist: Omit<DayChecklistProps, 'onCheckin' | 'onWater'>
  timelineEntries: TimelineEntry[]
}

export default function ClientHomeShell({ adherence, priorityAction, checklist, timelineEntries }: Props) {
  const router = useRouter()
  const [checkinMoment, setCheckinMoment] = useState<'morning' | 'evening' | null>(null)
  const [waterOpen, setWaterOpen] = useState(false)

  const handleCheckin = useCallback((moment: 'morning' | 'evening') => {
    setCheckinMoment(moment)
  }, [])

  const handleCheckinSuccess = useCallback(() => {
    router.refresh()
  }, [router])

  return (
    <>
      <CheckinModal
        moment={checkinMoment ?? 'morning'}
        open={checkinMoment !== null}
        onClose={() => setCheckinMoment(null)}
        onSuccess={handleCheckinSuccess}
      />

      <QuickWaterModal
        open={waterOpen}
        onClose={() => setWaterOpen(false)}
        onLogged={() => { router.refresh() }}
      />

      <AdherenceScoreCard
        score={adherence.score}
        scoreDelta={adherence.scoreDelta}
        dimensions={adherence.dimensions}
      />

      {priorityAction && <PriorityActionCard {...priorityAction} />}

      <DayChecklist
        {...checklist}
        onCheckin={handleCheckin}
        onWater={() => setWaterOpen(true)}
      />

      <SmartAgendaTimeline entries={timelineEntries} />
    </>
  )
}
