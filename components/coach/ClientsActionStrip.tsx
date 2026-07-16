import { CreditCard, ListTodo, TrendingUp, Users } from 'lucide-react'

type Stats = { total: number; active: number; withoutFormula: number; toFollow: number }

export default function ClientsActionStrip({
  stats,
  onOpenWithoutFormula,
  onOpenToFollow,
}: {
  stats: Stats
  onOpenWithoutFormula: () => void
  onOpenToFollow: () => void
}) {
  const items = [
    { key: 'total', label: 'Total clients', value: stats.total, icon: Users, onClick: undefined },
    { key: 'active', label: 'Clients actifs', value: stats.active, icon: TrendingUp, onClick: undefined },
    { key: 'withoutFormula', label: 'Sans formule', value: stats.withoutFormula, icon: CreditCard, onClick: onOpenWithoutFormula },
    { key: 'toFollow', label: 'À suivre', value: stats.toFollow, icon: ListTodo, onClick: onOpenToFollow },
  ]

  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      {items.map(({ key, label, value, icon: Icon, onClick }) => {
        const content = (
          <>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-white/[0.04]">
              <Icon size={18} className="text-white/45" />
            </div>
            <div>
              <p className="text-2xl font-black text-white tabular-nums">{value}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">{label}</p>
            </div>
          </>
        )

        return onClick ? (
          <button
            key={key}
            type="button"
            aria-label={label}
            onClick={onClick}
            className="rounded-2xl bg-[#181818] px-5 py-4 flex items-center gap-4 text-left hover:bg-[#1d1d1d]"
          >
            {content}
          </button>
        ) : (
          <div key={key} className="rounded-2xl bg-[#181818] px-5 py-4 flex items-center gap-4">
            {content}
          </div>
        )
      })}
    </div>
  )
}
