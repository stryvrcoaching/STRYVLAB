'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Clock } from 'lucide-react'
import { useClientT } from '@/components/client/ClientI18nProvider'

export default function ExpiredTokenPage() {
  const { t } = useClientT()
  return (
    <div className="min-h-dvh bg-[#121212] flex flex-col items-center justify-center p-6 overflow-x-hidden" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="mb-8 flex flex-col items-center gap-3">
        <Image src="/logo/logo-stryvr-silver.png" alt="STRYVR" width={48} height={48} className="w-12 h-12 object-contain" />
      </div>

      <div className="bg-[#161616] rounded-xl p-8 max-w-sm w-full text-center">
        <div className="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Clock size={24} className="text-amber-400" />
        </div>
        <h2 className="text-[15px] font-bold text-white mb-2">{t('access.expired.title')}</h2>
        <p className="text-[13px] text-white/50 leading-relaxed mb-6">
          {t('access.expired.desc')}
        </p>
        <Link
          href="/client/login"
          className="inline-flex items-center justify-center w-full h-10 rounded-xl bg-white/[0.04] text-[12px] font-semibold text-white/60 hover:text-white hover:bg-white/[0.07] transition-colors"
        >
          {t('access.login.manual')}
        </Link>
      </div>
    </div>
  )
}
