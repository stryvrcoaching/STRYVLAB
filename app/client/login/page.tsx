'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Eye, EyeOff, ArrowRight } from 'lucide-react'
import { clientDemoLogin, clientLogin } from './actions'
import { useClientT } from '@/components/client/ClientI18nProvider'

const demoLoginEnabled = process.env.NEXT_PUBLIC_CLIENT_DEMO_ENABLED === 'true'

export default function ClientLoginPage() {
  const router = useRouter()
  const { t } = useClientT()
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const [hashError, setHashError] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // If an invite/magiclink token lands here (misconfigured redirect URL),
    // forward to the correct onboarding page instead of staying on login.
    const hash = window.location.hash
    if (hash && hash.includes('access_token=')) {
      window.location.replace('/client/onboarding' + hash)
      return
    }

    const queryParams = new URLSearchParams(window.location.search)
    if (queryParams.get('error') === 'link_expired') {
      setHashError(t('login.error.expired'))
      return
    }

    const hashParams = new URLSearchParams((hash ?? '').replace(/^#/, ''))
    const errorCode = hashParams.get('error_code')
    if (!errorCode) return
    if (errorCode === 'otp_expired') {
      setHashError(t('login.error.otpExpired'))
    } else {
      setHashError(t('login.error.invalid'))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await clientLogin(formData)
      if (result.error) {
        setError(result.error)
      } else {
        router.push('/client')
      }
    })
  }

  function handleDemoLogin() {
    setError('')
    startTransition(async () => {
      const result = await clientDemoLogin()
      if (result.error) {
        setError(result.error)
      } else {
        router.push('/client')
      }
    })
  }

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex flex-col items-center justify-center p-6">

      {/* Logo */}
      <div className="mb-10 flex flex-col items-center gap-3">
        <img src="/logo/logo-stryvr-silver.png" alt="STRYVR" className="w-12 h-12 object-contain" />
        <div className="text-center">
          <p className="text-[11px] text-white/30 mt-1.5">{t('login.mySpace')}</p>
        </div>
      </div>

      {/* Erreur lien */}
      {hashError && (
        <div className="w-full max-w-sm mb-4 bg-red-500/[0.08] border-[0.3px] border-red-500/20 rounded-xl px-4 py-3">
          <p className="text-[12px] text-red-400 leading-relaxed">{hashError}</p>
        </div>
      )}

      {/* Card connexion */}
      <div className="bg-white/[0.02] rounded-xl p-6 w-full max-w-sm">
        <div className="mb-5">
          <h2 className="text-[15px] font-bold text-white">{t('login.title')}</h2>
          <p className="text-[12px] text-white/40 mt-1">
            {t('login.subtitle')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/40 mb-1.5">
              {t('login.email')}
            </label>
            <input
              name="email"
              type="email"
              placeholder={t('login.placeholder.email')}
              required
              className="w-full h-[48px] rounded-xl bg-[#222222] px-4 text-[14px] font-medium text-white placeholder:text-white/20 outline-none  transition-colors"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/40 mb-1.5">
              {t('login.password')}
            </label>
            <div className="relative">
              <input
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                required
                className="w-full h-[48px] rounded-xl bg-[#222222] px-4 pr-11 text-[14px] font-medium text-white placeholder:text-white/20 outline-none  transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/[0.08] border-[0.3px] border-red-500/20 rounded-xl px-4 py-2.5">
              <p className="text-[12px] text-red-400">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="mt-1 flex h-[48px] items-center justify-between rounded-xl bg-[#f2f2f2] pl-5 pr-2 transition-all hover:bg-[#ffffff] active:scale-[0.99] disabled:opacity-50"
          >
            <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#080808]">
              {isPending ? t('login.pending') : t('login.submit')}
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-black/[0.12]">
              {isPending
                ? <Loader2 size={15} className="animate-spin text-[#080808]" />
                : <ArrowRight size={15} className="text-[#080808]" />
              }
            </div>
          </button>

          {demoLoginEnabled && (
            <button
              type="button"
              onClick={handleDemoLogin}
              disabled={isPending}
              className="flex h-[44px] items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 text-[11px] font-bold uppercase tracking-[0.14em] text-white/72 transition-all hover:bg-white/[0.05] active:scale-[0.99] disabled:opacity-50"
            >
              {isPending ? t('login.pending') : t('login.demo')}
            </button>
          )}
        </form>
      </div>

      <p className="mt-6 text-[11px] text-white/20 text-center">
        {t('login.footer')}
      </p>
    </div>
  )
}
