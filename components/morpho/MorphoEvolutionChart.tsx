'use client'

import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface DataPoint { date: string; score: number }

interface Props { clientId: string }

export function MorphoEvolutionChart({ clientId }: Props) {
  const [points, setPoints] = useState<DataPoint[]>([])

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/clients/${clientId}/morpho/analyses?limit=20`)
      const data = await res.json()
      const mapped = (data.analyses ?? [])
        .filter((a: { analysis_result?: { score?: number }; status: string }) => a.status === 'completed' && a.analysis_result?.score != null)
        .map((a: { analysis_date: string; analysis_result: { score: number } }) => ({
          date: new Date(a.analysis_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
          score: a.analysis_result.score,
        }))
        .reverse()
      setPoints(mapped)
    }
    load()
  }, [clientId])

  if (points.length < 2) return null

  return (
    <div className="space-y-1">
      <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/30">Évolution du score</p>
      <ResponsiveContainer width="100%" height={80}>
        <LineChart data={points}>
          <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: '#181818', border: '0.3px solid rgba(255,255,255,0.06)', borderRadius: 8, fontSize: 11 }}
            itemStyle={{ color: '#1f8a65' }}
          />
          <Line type="monotone" dataKey="score" stroke="#1f8a65" strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
