'use client'

import { useState } from 'react'
import { LogOut, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useClientT } from '@/components/client/ClientI18nProvider'

export default function ClientLogoutButton() {
  const router = useRouter()
  const { t } = useClientT()
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleLogout() {
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/client/login')
  }

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className="flex items-center justify-center gap-2 w-full h-11 rounded-xl bg-[#161616] text-[13px] font-medium text-red-400 hover:bg-red-500/[0.06] hover:text-red-400 transition-colors"
      >
        <LogOut size={15} />
        {t('profil.logout')}
      </button>

      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#161616] rounded-xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-white mb-2">{t('profil.logout.confirm.title')}</h3>
            <p className="text-[13px] text-white/55 mb-5">
              {t('profil.logout.confirm.desc')}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/[0.04] text-[13px] text-white/55 hover:text-white/80 transition-colors font-medium"
              >
                {t('profil.logout.cancel')}
              </button>
              <button
                onClick={handleLogout}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl bg-red-500/80 text-white text-[13px] font-bold hover:bg-red-500 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                {loading ? t('profil.logout.loading') : t('profil.logout.action')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
