'use client'

import Link from 'next/link'
import { ChevronRight, Utensils } from 'lucide-react'
import { useClientT } from '@/components/client/ClientI18nProvider'

interface NewProtocolBannerProps {
  unviewedCount: number
  protocolName?: string
}

export default function NewProtocolBanner({
  unviewedCount,
  protocolName,
}: NewProtocolBannerProps) {
  const { t } = useClientT()
  if (unviewedCount === 0) return null

  const label = unviewedCount === 1
    ? t('protocol.banner.single', { name: protocolName || t('protocol.banner.defaultName') })
    : t('protocol.banner.multiple', { n: unviewedCount })

  return (
    <Link href="/client/nutrition">
      <div className="bg-[#1a1a1a] rounded-xl p-4 flex items-center justify-between gap-3 hover:bg-[#222222] transition-colors duration-150">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[#1a1a1a] flex items-center justify-center shrink-0">
            <Utensils size={18} className="text-[#f2f2f2]" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#f2f2f2] mb-0.5">
              {t('protocol.banner.new')}
            </p>
            <p className="text-[13px] text-white/90 font-medium truncate">
              {label}
            </p>
          </div>
        </div>
        <ChevronRight size={16} className="text-[#f2f2f2] shrink-0" />
      </div>
    </Link>
  )
}
