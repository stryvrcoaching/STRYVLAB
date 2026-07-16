'use client'

import HeaderIconLink from '@/components/layout/HeaderIconLink'
import { ChevronLeft } from 'lucide-react'
import { useClientT } from '@/components/client/ClientI18nProvider'

interface Props {
  left?: React.ReactNode
  section?: string
  title?: string
  backHref?: string
  right?: React.ReactNode
  hideCoachButton?: boolean
}

export default function ClientTopBar({ left, section, title, backHref, right }: Props) {
  const { t } = useClientT()
  return (
    <header
      className="fixed inset-x-0 top-0 z-40 bg-[var(--client-chrome-bg)] shadow-[0_10px_28px_rgba(0,0,0,0.26)]"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="mx-auto flex min-h-[64px] w-full max-w-[520px] items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {left ?? (
            <>
              {backHref && (
                <HeaderIconLink
                  href={backHref}
                  icon={<ChevronLeft size={16} />}
                  label={t('common.back')}
                  className="shrink-0 rounded-xl border-white/[0.05] bg-white/[0.05] text-white/62 hover:bg-white/[0.08] hover:text-white"
                />
              )}
              <div className="min-w-0">
                {section && (
                  <p className="mb-0.5 text-[9px] font-barlow-condensed font-bold uppercase leading-none tracking-[0.22em] text-white/34">
                    {section}
                  </p>
                )}
                {title && (
                  <p className="truncate text-[15px] font-barlow-condensed font-bold uppercase leading-tight tracking-[0.12em] text-[#e0e0e0]">
                    {title}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {right && <>{right}</>}
        </div>
      </div>
    </header>
  )
}
