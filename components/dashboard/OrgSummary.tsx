'use client'

import { useEffect, useRef, useState } from 'react'
import { Calendar, Kanban, Bell, CheckCircle2, Plus, ArrowRight } from 'lucide-react'
import { type KanbanBoard as KanbanBoardType, type KanbanTask } from '@/components/ui/KanbanBoard'
import { type AgendaEvent } from '@/components/ui/AgendaCalendar'

const NOTIFY_LABELS: Record<number, string> = {
  0: 'au moment',
  5: '5 min',
  10: '10 min',
  15: '15 min',
  30: '30 min',
  60: '1h',
  1440: '1 jour',
}

export default function OrgSummary({
  onOpenAgenda,
  onOpenKanban,
}: {
  onOpenAgenda?: () => void
  onOpenKanban?: () => void
}) {
  const [boards, setBoards] = useState<KanbanBoardType[]>([])
  const [events, setEvents] = useState<AgendaEvent[]>([])
  const [tasks, setTasks] = useState<KanbanTask[]>([])
  const [loading, setLoading] = useState(true)
  const openAgendaRef = useRef<(() => void) | undefined>(onOpenAgenda)
  openAgendaRef.current = onOpenAgenda

  const todayKey = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true)
      try {
        const boardsRes = await fetch('/api/organisation/boards')
        const fetchedBoards: KanbanBoardType[] = boardsRes.ok ? await boardsRes.json() : []
        setBoards(fetchedBoards)

        const [evRes, ...taskResults] = await Promise.all([
          fetch('/api/organisation/events'),
          ...fetchedBoards.map(b => fetch(`/api/organisation/tasks?boardId=${b.id}`)),
        ])

        if (evRes.ok) {
          const data = await evRes.json()
          setEvents(Array.isArray(data) ? data : [])
        }

        const allTasks: KanbanTask[] = []
        for (const res of taskResults) {
          if (res.ok) {
            const data = await res.json()
            if (Array.isArray(data)) allTasks.push(...data)
          }
        }
        setTasks(allTasks)
      } catch { /* silent */ }
      finally { setLoading(false) }
    }
    fetchAll()
  }, [])

  const todayEvents = events
    .filter(e => e.event_date === todayKey)
    .sort((a, b) => (a.event_time ?? '').localeCompare(b.event_time ?? ''))

  const now = new Date()

  const upcoming = events
    .filter(e => {
      if (!e.notify_minutes_before || e.is_completed) return false
      if (!e.event_time) return false
      const evDate = new Date(`${e.event_date}T${e.event_time}`)
      const diffMin = (evDate.getTime() - now.getTime()) / 60000
      return diffMin >= 0 && diffMin <= 1440
    })
    .sort((a, b) => `${a.event_date}T${a.event_time}`.localeCompare(`${b.event_date}T${b.event_time}`))

  // Tâches non complétées, triées par board puis par position
  const pendingTasks = tasks
    .filter(t => !t.is_completed)
    .slice(0, 4)

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-0">
        {[1, 2, 3].map(i => (
          <div key={i} className="rounded-2xl bg-white/[0.02] border-[0.3px] border-white/[0.06] p-5 space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-white/[0.06] animate-pulse shrink-0" />
              <div className="space-y-1">
                <div className="h-2 w-16 rounded-full bg-white/[0.06] animate-pulse" />
                <div className="h-3 w-28 rounded-full bg-white/[0.06] animate-pulse" />
              </div>
            </div>
            <div className="h-20 rounded-xl bg-white/[0.04] animate-pulse" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Card 1 — Aujourd'hui */}
      <div className="rounded-2xl bg-white/[0.02] border-[0.3px] border-white/[0.06] p-5 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1f8a65]/15 shrink-0">
              <Calendar size={13} className="text-[#1f8a65]" />
            </div>
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/30 leading-none mb-0.5">Aujourd&apos;hui</p>
              <p className="text-[12px] font-bold text-white leading-none">Événements du jour</p>
            </div>
          </div>
          <button
            onClick={onOpenAgenda}
            className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/[0.04] text-white/30 hover:bg-[#1f8a65]/15 hover:text-[#1f8a65] transition-all"
            title="Ajouter un événement"
          >
            <Plus size={12} />
          </button>
        </div>

        {todayEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 py-4 gap-2">
            <p className="text-[12px] text-white/25 italic text-center">Aucun événement aujourd&apos;hui</p>
            <button
              onClick={onOpenAgenda}
              className="text-[11px] text-[#1f8a65]/70 hover:text-[#1f8a65] transition-colors"
            >
              + Planifier
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {todayEvents.map(ev => (
              <button
                key={ev.id}
                onClick={onOpenAgenda}
                className={`w-full rounded-xl p-3 text-left transition-colors ${ev.is_completed ? 'bg-white/[0.015]' : 'bg-white/[0.04] hover:bg-white/[0.07]'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {ev.is_completed && <CheckCircle2 size={12} className="text-[#1f8a65] shrink-0" />}
                    <p className={`text-[12px] font-medium truncate ${ev.is_completed ? 'line-through text-white/30' : 'text-white'}`}>{ev.title}</p>
                  </div>
                  {ev.event_time && <span className="text-[10px] text-white/35 shrink-0">{ev.event_time}</span>}
                </div>
                {ev.linked_column_title && (
                  <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-white/[0.05] text-white/40 mt-1.5 w-fit">
                    <Kanban size={8} />
                    {ev.linked_column_title}
                  </span>
                )}
              </button>
            ))}
            <button
              onClick={onOpenAgenda}
              className="w-full text-[11px] text-white/25 hover:text-[#1f8a65]/70 transition-colors py-1 text-center"
            >
              Voir l&apos;agenda complet →
            </button>
          </div>
        )}
      </div>

      {/* Card 2 — Tâches en cours */}
      <div className="rounded-2xl bg-white/[0.02] border-[0.3px] border-white/[0.06] p-5 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.06] shrink-0">
              <Kanban size={13} className="text-white/60" />
            </div>
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/30 leading-none mb-0.5">Kanban</p>
              <p className="text-[12px] font-bold text-white leading-none">Tâches en cours</p>
            </div>
          </div>
          {pendingTasks.length > 0 && (
            <span className="text-[10px] font-semibold text-white/30 bg-white/[0.04] rounded-full px-2 py-0.5">
              {tasks.filter(t => !t.is_completed).length}
            </span>
          )}
        </div>

        {pendingTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 py-4 gap-2">
            <p className="text-[12px] text-[#1f8a65]/80 font-medium text-center">Toutes les tâches sont complètes 🎯</p>
            <button
              onClick={onOpenKanban}
              className="text-[11px] text-white/25 hover:text-white/50 transition-colors"
            >
              Voir le Kanban →
            </button>
          </div>
        ) : (
          <div className="space-y-1.5">
            {pendingTasks.map(task => {
              const board = boards.find(b => b.id === task.board_id)
              return (
                <button
                  key={task.id}
                  onClick={onOpenKanban}
                  className="w-full flex items-center justify-between gap-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] px-3 py-2.5 text-left transition-colors group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-1.5 w-1.5 rounded-full bg-[#1f8a65]/60 shrink-0" />
                    <p className="text-[12px] font-medium text-white/80 truncate">{task.title}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {board && <span className="text-[10px] text-white/25">{board.title}</span>}
                    <ArrowRight size={10} className="text-white/15 group-hover:text-white/40 transition-colors" />
                  </div>
                </button>
              )
            })}
            {tasks.filter(t => !t.is_completed).length > 4 && (
              <button
                onClick={onOpenKanban}
                className="w-full text-[11px] text-white/25 hover:text-white/50 transition-colors py-1 text-center"
              >
                + {tasks.filter(t => !t.is_completed).length - 4} autres tâches →
              </button>
            )}
          </div>
        )}
      </div>

      {/* Card 3 — Rappels 24h */}
      <div className="rounded-2xl bg-white/[0.02] border-[0.3px] border-white/[0.06] p-5 flex flex-col">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.06] shrink-0">
            <Bell size={13} className="text-white/60" />
          </div>
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/30 leading-none mb-0.5">À venir</p>
            <p className="text-[12px] font-bold text-white leading-none">Rappels (24h)</p>
          </div>
        </div>

        {upcoming.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 py-4">
            <p className="text-[12px] text-white/25 italic text-center">Aucun rappel dans les 24h</p>
          </div>
        ) : (
          <div className="space-y-2">
            {upcoming.map(ev => {
              const evDt = new Date(`${ev.event_date}T${ev.event_time}`)
              const diffMin = Math.round((evDt.getTime() - now.getTime()) / 60000)
              const label = diffMin < 60
                ? `dans ${diffMin} min`
                : diffMin < 1440
                ? `dans ${Math.round(diffMin / 60)}h`
                : `dans ${Math.round(diffMin / 1440)}j`
              return (
                <button
                  key={ev.id}
                  onClick={onOpenAgenda}
                  className="w-full flex items-start gap-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] p-3 text-left transition-colors"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#1f8a65]/15 shrink-0 mt-0.5">
                    <Bell size={10} className="text-[#1f8a65]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-white truncate">{ev.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-[#1f8a65]/80">{label}</span>
                      {ev.notify_minutes_before != null && (
                        <span className="text-[10px] text-white/25">
                          rappel {NOTIFY_LABELS[ev.notify_minutes_before] ?? `${ev.notify_minutes_before}min`} avant
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
