'use client'

import { useState, useCallback } from 'react'
import AgendaCalendar from '@/components/ui/AgendaCalendar'

export default function DashboardAgenda() {
  const [agendaModalOpen, setAgendaModalOpen] = useState(false)

  return (
    <div className="bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-2xl p-5">
      <AgendaCalendar
        modalOpen={agendaModalOpen}
        setModalOpen={setAgendaModalOpen}
      />
    </div>
  )
}
