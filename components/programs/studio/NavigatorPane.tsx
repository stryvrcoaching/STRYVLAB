// components/programs/studio/NavigatorPane.tsx
'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, ChevronUp, Plus, GripVertical, Dumbbell } from 'lucide-react'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export interface NavSession {
  name: string
  exercises: { name: string }[]
}

interface Props {
  sessions: NavSession[]
  activeSessionIndex: number | null
  activeExerciseKey: string | null // format "si-ei"
  sessionMode: 'day' | 'cycle'
  onSelectSession: (si: number) => void
  onSelectExercise: (si: number, ei: number) => void
  onAddSession: () => void
  onMoveSession: (fromSi: number, toSi: number) => void
}

export default function NavigatorPane({
  sessions,
  activeSessionIndex,
  activeExerciseKey,
  sessionMode,
  onSelectSession,
  onSelectExercise,
  onAddSession,
  onMoveSession,
}: Props) {
  const [expandedSessions, setExpandedSessions] = useState<Record<number, boolean>>(
    Object.fromEntries(sessions.map((_, i) => [i, true]))
  )

  function toggleSession(i: number) {
    setExpandedSessions(prev => ({ ...prev, [i]: !prev[i] }))
  }

  return (
    <div className="flex flex-col h-full bg-[#121212] border-r-[0.3px] border-white/[0.06] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b-[0.3px] border-white/[0.06] shrink-0">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
          Séances
        </span>
        <button
          onClick={onAddSession}
          className="flex items-center gap-1 h-6 px-2 rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-white/50 hover:text-white/80 transition-colors"
        >
          <Plus size={11} />
          <span className="text-[10px] font-medium">Séance</span>
        </button>
      </div>

      {/* Session tree */}
      <div className="flex-1 overflow-y-auto overscroll-contain py-1">
        {sessions.length === 0 && (
          <p className="text-[11px] text-white/25 text-center py-6 px-3">
            Aucune séance
          </p>
        )}
        <SortableContext
          items={sessions.map((_, si) => `nav-session-${si}`)}
          strategy={verticalListSortingStrategy}
        >
          {sessions.map((session, si) => {
            const isExpanded = expandedSessions[si] ?? true
            const isActive = activeSessionIndex === si
            return (
              <SortableSessionRow
                key={si}
                session={session}
                si={si}
                isActive={isActive}
                isExpanded={isExpanded}
                sessionMode={sessionMode}
                activeExerciseKey={activeExerciseKey}
                onSelect={() => onSelectSession(si)}
                onToggle={() => toggleSession(si)}
                onSelectExercise={(ei) => onSelectExercise(si, ei)}
                onMoveUp={si > 0 ? () => onMoveSession(si, si - 1) : undefined}
                onMoveDown={si < sessions.length - 1 ? () => onMoveSession(si, si + 1) : undefined}
              />
            )
          })}
        </SortableContext>
      </div>
    </div>
  )
}

// ─── SortableSessionRow ────────────────────────────────────────────────────────

interface SortableSessionRowProps {
  session: NavSession
  si: number
  isActive: boolean
  isExpanded: boolean
  sessionMode: 'day' | 'cycle'
  activeExerciseKey: string | null
  onSelect: () => void
  onToggle: () => void
  onSelectExercise: (ei: number) => void
  onMoveUp?: () => void
  onMoveDown?: () => void
}

function SortableSessionRow({
  session, si, isActive, isExpanded, sessionMode,
  activeExerciseKey, onSelect, onToggle, onSelectExercise,
  onMoveUp, onMoveDown,
}: SortableSessionRowProps) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: `nav-session-${si}` })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="mb-0.5">
      <div
        className={[
          'w-full flex items-center gap-1 px-2 py-2 text-left transition-colors group cursor-pointer',
          isActive
            ? 'bg-[#1f8a65]/10 text-[#1f8a65]'
            : 'text-white/70 hover:bg-white/[0.03] hover:text-white/90',
        ].join(' ')}
      >
        {/* Drag handle — only in cycle mode */}
        {sessionMode === 'cycle' && (
          <span
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-0.5 text-white/20 hover:text-white/50 shrink-0"
            onClick={e => e.stopPropagation()}
          >
            <GripVertical size={10} />
          </span>
        )}

        {/* Up/down arrows — only in cycle mode */}
        {sessionMode === 'cycle' && (
          <div className="flex flex-col shrink-0">
            <button
              onClick={e => { e.stopPropagation(); onMoveUp?.() }}
              disabled={!onMoveUp}
              className="p-0.5 text-white/20 hover:text-white/50 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronUp size={8} />
            </button>
            <button
              onClick={e => { e.stopPropagation(); onMoveDown?.() }}
              disabled={!onMoveDown}
              className="p-0.5 text-white/20 hover:text-white/50 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronDown size={8} />
            </button>
          </div>
        )}

        {/* Collapse/expand + session name — clickable area */}
        <button
          onClick={() => { onSelect(); onToggle() }}
          className="flex items-center gap-1 flex-1 min-w-0 text-left"
        >
          {isExpanded
            ? <ChevronDown size={11} className="shrink-0 opacity-50" />
            : <ChevronRight size={11} className="shrink-0 opacity-50" />
          }
          <span
            className="text-[11px] font-medium truncate flex-1"
            title={session.name || `Séance ${si + 1}`}
          >
            {session.name || `Séance ${si + 1}`}
          </span>
          <span className="text-[9px] text-white/25 shrink-0">
            {session.exercises.length}
          </span>
        </button>
      </div>

      {/* Exercises */}
      {isExpanded && session.exercises.map((ex, ei) => {
        const key = `${si}-${ei}`
        const isActiveEx = activeExerciseKey === key
        return (
          <button
            key={ei}
            onClick={() => onSelectExercise(ei)}
            className={[
              'w-full flex items-center gap-2 pl-8 pr-3 py-1.5 text-left transition-colors',
              isActiveEx
                ? 'bg-[#1f8a65]/5 text-[#1f8a65]/80'
                : 'text-white/40 hover:bg-white/[0.02] hover:text-white/60',
            ].join(' ')}
          >
            <Dumbbell size={9} className="shrink-0 opacity-60" />
            <span
              className="text-[10px] truncate"
              title={ex.name || `Exercice ${ei + 1}`}
            >
              {ex.name || `Exercice ${ei + 1}`}
            </span>
          </button>
        )
      })}
    </div>
  )
}
