'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { resetBodyScrollLock } from '@/components/client/useBodyScrollLock'

interface Props {
  label?: string
  icon?: boolean
  href?: string
}

// Force un refresh du Server Component cible au retour — sinon Next.js sert
// la page depuis le router cache (30s TTL) et l'état "séance faite" n'est pas visible.
export default function RecapNavButtons({ label, icon, href = '/client' }: Props) {
  const router = useRouter()

  function go() {
    resetBodyScrollLock()
    router.refresh()
    router.push(href)
  }

  if (icon) {
    return (
      <button
        onClick={go}
        className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.06] text-white/40 hover:bg-white/[0.10] hover:text-white/70 transition-colors shrink-0"
      >
        <ChevronLeft size={16} />
      </button>
    )
  }

  return (
    <button
      onClick={go}
      className="flex items-center justify-center gap-2 bg-white/[0.04] text-white/60 font-semibold py-3.5 rounded-xl hover:bg-white/[0.06] hover:text-white/80 transition-colors text-[12px] w-full"
    >
      <ChevronLeft size={13} />
      {label}
    </button>
  )
}
