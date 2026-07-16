'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'

type FlexWorkoutItem = {
  session: {
    id: string
    started_at: string
    ended_at: string | null
    type: string
    relation_to_planned_workout: string | null
    notes: string | null
  }
  exercises: Array<{
    id: string
    display_name: string
    sets: Array<{ id: string }>
    muscle_groups: string[] | null
  }>
  summary: {
    total_sets: number
    hard_sets: number
    tonnage: number
    duration_seconds: number | null
    muscle_group_volume: Record<string, number>
  }
}

function formatDate(dateIso: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(dateIso))
}

function resolveLabel(session: FlexWorkoutItem['session']) {
  if (session.relation_to_planned_workout === 'replace' || session.type === 'replacement') {
    return 'Remplacement de séance prévue'
  }
  if (session.relation_to_planned_workout === 'bonus' || session.type === 'bonus') {
    return 'Séance bonus'
  }
  return 'Séance libre réalisée'
}

function resolveMicrocopy(session: FlexWorkoutItem['session']) {
  if (session.relation_to_planned_workout === 'replace' || session.type === 'replacement') {
    return 'Volume additionnel détecté'
  }
  if (session.relation_to_planned_workout === 'bonus' || session.type === 'bonus') {
    return 'Séance bonus hors programme'
  }
  return 'Flex Workout'
}

export default function FlexWorkoutHistory({ clientId }: { clientId: string }) {
  const [items, setItems] = useState<FlexWorkoutItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/coach/clients/${clientId}/flex-workouts?limit=6`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!cancelled) setItems(data?.sessions ?? [])
      })
      .catch(() => {
        if (!cancelled) setItems([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [clientId])

  if (loading || items.length === 0) return null

  return (
    <Card className="border-white/[0.06] bg-[#181818]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-white/[0.08] text-white/80">Flex Workout</Badge>
          Séances libres récentes
        </CardTitle>
        <CardDescription>Lecture rapide des séances flex réalisées par le client.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => (
          <Link
            key={item.session.id}
            href={`/coach/clients/${clientId}/data/performances/flex-workouts/${item.session.id}`}
            className="block rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 transition-colors hover:bg-white/[0.05]"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">{formatDate(item.session.ended_at ?? item.session.started_at)}</p>
                <p className="mt-1 text-sm font-semibold text-white">{resolveLabel(item.session)}</p>
                <p className="mt-1 text-[11px] text-white/45">{resolveMicrocopy(item.session)}</p>
              </div>
              <Badge variant="secondary" className="bg-white/[0.06] text-white/80">Flex Workout</Badge>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-white/55 md:grid-cols-4">
              <MiniStat label="Durée" value={item.summary.duration_seconds ? `${Math.round(item.summary.duration_seconds / 60)} min` : '—'} />
              <MiniStat label="Exercices" value={String(item.exercises.length)} />
              <MiniStat label="Séries" value={String(item.summary.total_sets)} />
              <MiniStat label="Tonnage" value={new Intl.NumberFormat('fr-FR').format(item.summary.tonnage)} />
            </div>

            {Object.keys(item.summary.muscle_group_volume).length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(item.summary.muscle_group_volume).slice(0, 4).map(([group, value]) => (
                  <Badge key={group} variant="secondary" className="bg-white/[0.06] text-white/75">
                    {group} · {value}
                  </Badge>
                ))}
              </div>
            )}

            {item.session.notes && (
              <p className="mt-3 text-[11px] text-white/45">
                Note client : {item.session.notes}
              </p>
            )}
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2">
      <p className="text-[9px] uppercase tracking-[0.16em] text-white/30">{label}</p>
      <p className="mt-1 font-medium text-white">{value}</p>
    </div>
  )
}
