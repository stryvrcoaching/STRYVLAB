'use client'

import Link from 'next/link'

type Session = {
  id: string
  completed_at: string
  program_session_id: string | null
  volume_kg: number
  avg_rir: number | null
}

export default function RecentSessionsStrip({ sessions }: { sessions: Session[] }) {
  if (sessions.length === 0) return null

  return (
    <div className="bg-[#111111] rounded-2xl p-4">
      <div className="font-barlow-condensed font-bold uppercase tracking-[0.18em] text-[11px] text-white mb-3">
        Dernières séances
      </div>
      <div className="flex gap-2 overflow-x-auto">
        {sessions.map(s => (
          <Link
            key={s.id}
            href={`/client/programme/recap/${s.id}`}
            className="min-w-[140px] bg-white/[0.02] rounded-xl p-3 active:scale-[0.99] transition-transform shrink-0"
          >
            <div className="text-[10px] text-white/40 tabular-nums">
              {new Date(s.completed_at).toLocaleDateString('fr-FR')}
            </div>
            <div className="text-[14px] font-black text-white mt-1 tabular-nums">{s.volume_kg} kg</div>
            {s.avg_rir != null && (
              <div className="text-[10px] text-white/55 mt-0.5">RIR moy {s.avg_rir}</div>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}
