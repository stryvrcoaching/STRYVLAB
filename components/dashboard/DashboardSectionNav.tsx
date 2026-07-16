import { ArrowDown } from 'lucide-react'

export type DashboardSectionLink = {
  id: string
  label: string
  description?: string
}

export function DashboardSectionNav({ items }: { items: DashboardSectionLink[] }) {
  return (
    <nav aria-label="Navigation dans la page" className="overflow-x-auto rounded-2xl border border-white/[0.06] bg-[#181818] p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex min-w-max items-center gap-1">
        <span className="px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">Aller à</span>
        {items.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className="group inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-left transition hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-white/20"
          >
            <ArrowDown size={12} className="text-white/30 transition group-hover:translate-y-0.5 group-hover:text-white/65" />
            <span>
              <span className="block text-[11px] font-semibold text-white/72 group-hover:text-white">{item.label}</span>
              {item.description ? <span className="hidden text-[9px] text-white/30 xl:block">{item.description}</span> : null}
            </span>
          </a>
        ))}
      </div>
    </nav>
  )
}
