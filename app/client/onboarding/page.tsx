'use client'

import { useEffect, useState, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Eye, EyeOff, XCircle, ArrowRight, Dumbbell, Activity, Target, CheckSquare, BarChart2, MessageSquare, LineChart, Utensils, Bell, UserCircle } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useClientT } from '@/components/client/ClientI18nProvider'
import type { ClientLang } from '@/lib/i18n/clientTranslations'

type Step = 'exchanging' | 'password' | 'language' | 'welcome' | 'error'

function FeatureRow({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-xl bg-[#f2f2f2]/10 flex items-center justify-center shrink-0">
        <Icon size={15} className="text-[#f2f2f2]" strokeWidth={1.75} />
      </div>
      <p className="text-[13px] text-white/70 leading-snug">{text}</p>
    </div>
  )
}

type WelcomeScreen = {
  icon: React.ElementType | null
  titleKey: string
  subtitleKey: string
  rows: { icon: React.ElementType; textKey: string }[] | null
}

const WELCOME_SCREENS: WelcomeScreen[] = [
  {
    icon: null,
    titleKey: 'onboarding.screen0.title',
    subtitleKey: 'onboarding.screen0.subtitle',
    rows: null,
  },
  {
    icon: Dumbbell,
    titleKey: 'onboarding.screen1.title',
    subtitleKey: 'onboarding.screen1.subtitle',
    rows: [
      { icon: Target,      textKey: 'onboarding.screen1.row0' },
      { icon: Activity,    textKey: 'onboarding.screen1.row1' },
      { icon: UserCircle,  textKey: 'onboarding.screen1.row2' },
    ],
  },
  {
    icon: CheckSquare,
    titleKey: 'onboarding.screen2.title',
    subtitleKey: 'onboarding.screen2.subtitle',
    rows: [
      { icon: CheckSquare,  textKey: 'onboarding.screen2.row0' },
      { icon: BarChart2,    textKey: 'onboarding.screen2.row1' },
      { icon: MessageSquare,textKey: 'onboarding.screen2.row2' },
    ],
  },
  {
    icon: Utensils,
    titleKey: 'onboarding.screen3.title',
    subtitleKey: 'onboarding.screen3.subtitle',
    rows: [
      { icon: Utensils, textKey: 'onboarding.screen3.row0' },
      { icon: Target,   textKey: 'onboarding.screen3.row1' },
      { icon: Activity, textKey: 'onboarding.screen3.row2' },
    ],
  },
  {
    icon: MessageSquare,
    titleKey: 'onboarding.screen4.title',
    subtitleKey: 'onboarding.screen4.subtitle',
    rows: [
      { icon: Bell,          textKey: 'onboarding.screen4.row0' },
      { icon: MessageSquare, textKey: 'onboarding.screen4.row1' },
      { icon: LineChart,     textKey: 'onboarding.screen4.row2' },
    ],
  },
]

function OnboardingFlow() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t, lang, setLang } = useClientT()

  const [step, setStep] = useState<Step>('exchanging')
  const [errorMsg, setErrorMsg] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [loading, setLoading] = useState(false)
  const [welcomeIndex, setWelcomeIndex] = useState(0)
  const [firstName, setFirstName] = useState('')
  const [checkinsEnabled, setCheckinsEnabled] = useState(false)
  const [selectedLang, setSelectedLang] = useState<ClientLang | null>(null)

  const resolved = useRef(false)

  function fail(msg: string) {
    if (resolved.current) return
    resolved.current = true
    setErrorMsg(msg)
    setStep('error')
  }

  async function succeed() {
    if (resolved.current) return
    resolved.current = true
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const name = user?.user_metadata?.first_name ?? user?.email?.split('@')[0] ?? ''
    setFirstName(name)
    setStep('password')  // password first, then language selector
  }

  useEffect(() => {
    const supabase = createClient()

    const urlError = searchParams.get('error_code') ?? searchParams.get('error') ?? searchParams.get('error_description')
    if (urlError) {
      fail(t('onboarding.error.linkExpired'))
      return
    }

    const hash = typeof window !== 'undefined' ? window.location.hash : ''

    if (hash.includes('error=') || hash.includes('error_code=')) {
      fail(t('onboarding.error.linkUsed'))
      return
    }

    if (hash.includes('access_token=')) {
      const params = new URLSearchParams(hash.replace(/^#/, ''))
      const accessToken = params.get('access_token')
      const refreshToken = params.get('refresh_token')

      if (accessToken && refreshToken) {
        supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
          .then(({ data, error }) => {
            if (error || !data.session) {
              fail(t('onboarding.error.session'))
            } else {
              succeed()
            }
          })
        return
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        succeed()
      } else {
        fail(t('onboarding.error.noSession'))
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPasswordError('')

    if (password.length < 8) {
      setPasswordError(t('onboarding.password.error.length'))
      return
    }
    if (password !== confirm) {
      setPasswordError(t('onboarding.password.error.mismatch'))
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setPasswordError(t('onboarding.password.error.failed'))
      setLoading(false)
      return
    }

    fetch('/api/client/welcome', { method: 'POST' }).catch(() => {})
    const checkinsRes = await fetch('/api/client/checkin/config').catch(() => null)
    if (checkinsRes?.ok) {
      const checkinsData = await checkinsRes.json().catch(() => null)
      setCheckinsEnabled(!!checkinsData?.active)
    }
    // Show language selector before welcome screens
    setStep('language')
  }

  // ─── Exchanging ───────────────────────────────────────────────────────────
  if (step === 'exchanging') {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center p-6">
        <div className="text-center">
          <Loader2 size={32} className="animate-spin text-[#f2f2f2] mx-auto mb-4" />
          <p className="text-base font-semibold text-white mb-1">{t('onboarding.verifying')}</p>
          <p className="text-sm text-white/50">{t('onboarding.verifying.desc')}</p>
        </div>
      </div>
    )
  }

  // ─── Error ─────────────────────────────────────────────────────────────────
  if (step === 'error') {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center p-6">
        <div className="bg-white/[0.02] rounded-xl p-8 max-w-sm w-full text-center">
          <XCircle size={44} className="text-red-400 mx-auto mb-4" />
          <h2 className="text-base font-bold text-white mb-2">{t('onboarding.error.title')}</h2>
          <p className="text-sm text-white/55 mb-6 leading-relaxed">{errorMsg}</p>
          <a
            href="/client/login"
            className="block w-full py-2.5 px-4 bg-white/[0.04] hover:bg-white/[0.08] text-white/60 hover:text-white font-semibold rounded-xl transition-colors text-sm"
          >
            {t('onboarding.error.goLogin')}
          </a>
        </div>
      </div>
    )
  }

  // ─── Language Selector ─────────────────────────────────────────────────────
  if (step === 'language') {
    const languages: Array<{ code: ClientLang; label: string; flag: string }> = [
      { code: 'fr', label: 'Français', flag: '🇫🇷' },
      { code: 'es', label: 'Español', flag: '🇪🇸' },
      { code: 'en', label: 'English', flag: '🇬🇧' },
    ]

    const handleLanguageSelect = async (langCode: ClientLang) => {
      setSelectedLang(langCode)
      // Update language in provider context and localStorage
      setLang(langCode)
      // Proceed to welcome screens
      setTimeout(() => setStep('welcome'), 300)
    }

    return (
      <div className="min-h-screen bg-[#0d0d0d] flex flex-col items-center justify-center p-6">
        <div className="mb-12 flex flex-col items-center gap-3">
          <img src="/logo/logo-stryvr-silver.png" alt="STRYVR" className="w-12 h-12 object-contain" />
        </div>

        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-black text-white mb-2">{t('onboarding.language.title')}</h2>
            <p className="text-sm text-white/55">{t('onboarding.language.subtitle')}</p>
          </div>

          <div className="flex flex-col gap-3">
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageSelect(lang.code)}
                className="w-full flex items-center justify-between px-5 py-4 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] active:scale-[0.98] border border-white/[0.08] transition-all"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{lang.flag}</span>
                  <span className="text-sm font-semibold text-white">{lang.label}</span>
                </div>
                {selectedLang === lang.code && (
                  <div className="w-5 h-5 rounded-full bg-[#f2f2f2] flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-[#0d0d0d]" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ─── Password ──────────────────────────────────────────────────────────────
  if (step === 'password') {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex flex-col items-center justify-center p-6">
        <div className="mb-8 flex flex-col items-center gap-3">
          <img src="/logo/logo-stryvr-silver.png" alt="STRYVR" className="w-12 h-12 object-contain" />
        </div>

        <div className="bg-white/[0.02] rounded-xl p-6 w-full max-w-sm">
          <h2 className="text-base font-bold text-white mb-1">{t('onboarding.password.title')}</h2>
          <p className="text-xs text-white/55 mb-5">{t('onboarding.password.subtitle')}</p>

          <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-white/55 block mb-1.5">
                {t('onboarding.password.label')}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('onboarding.password.placeholder')}
                  required
                  minLength={8}
                  autoFocus
                  className="w-full h-11 px-4 bg-[#222222] rounded-xl text-sm text-white placeholder:text-white/20 outline-none  transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-white/55 block mb-1.5">
                {t('onboarding.password.confirm')}
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder={t('onboarding.password.placeholder.confirm')}
                required
                className="w-full h-11 px-4 bg-[#222222] rounded-xl text-sm text-white placeholder:text-white/20 outline-none  transition-colors"
              />
            </div>

            {passwordError && (
              <p className="text-xs text-red-400 bg-red-500/[0.08] border border-red-500/20 rounded-xl px-3 py-2">
                {passwordError}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 h-11 flex items-center justify-center gap-2 bg-[#f2f2f2] hover:bg-[#ffffff] active:scale-[0.98] disabled:opacity-50 text-[#080808] font-bold rounded-xl transition-all"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              {loading ? t('onboarding.password.creating') : t('onboarding.password.cta')}
            </button>
          </form>
        </div>

        <a
          href="/client/login"
          className="mt-5 block text-center text-[11px] text-white/25 hover:text-white/50 transition-colors"
        >
          {t('onboarding.password.alreadyAccount')}
        </a>
      </div>
    )
  }

  // ─── Welcome (5-screen swipable tour) ─────────────────────────────────────
  if (step === 'welcome') {
    const screen = WELCOME_SCREENS[welcomeIndex]
    const isLast = welcomeIndex === WELCOME_SCREENS.length - 1
    const isFirst = welcomeIndex === 0
    const IconComponent = screen.icon

    // Title: screen0 interpolates firstName
    const titleText = welcomeIndex === 0
      ? t('onboarding.screen0.title', { n: firstName })
      : t(screen.titleKey as Parameters<typeof t>[0])

    const goNext = () => {
      if (isLast) {
        localStorage.setItem('onboarding_tour_done', 'false')
        if (checkinsEnabled) {
          router.push('/client/checkin/onboarding')
        } else {
          router.push('/client')
        }
      } else {
        setWelcomeIndex((i) => i + 1)
      }
    }

    return (
      <div className="min-h-screen bg-[#0d0d0d] flex flex-col">
        {/* Logo */}
        <div className="flex items-center justify-center pt-12 pb-6">
          <img src="/logo/logo-stryvr-silver.png" alt="STRYVR" className="w-8 h-8 object-contain" />
        </div>

        {/* Content — centered vertically on screen 0, top-aligned on others */}
        <div className={`flex-1 flex flex-col px-6 max-w-sm mx-auto w-full ${isFirst ? 'justify-center items-center' : ''}`}>
          {/* Icon (screens 1-4) */}
          {IconComponent && (
            <div className="w-14 h-14 rounded-xl bg-[#f2f2f2]/10 flex items-center justify-center mb-6">
              <IconComponent size={26} className="text-[#f2f2f2]" strokeWidth={1.75} />
            </div>
          )}

          {/* Title */}
          <h1 className={`font-black text-white mb-3 leading-tight ${isFirst ? 'text-center text-[28px]' : 'text-[22px]'}`}>
            {titleText}
          </h1>

          {/* Subtitle */}
          <p className={`text-[13px] text-white/55 leading-relaxed mb-8 ${isFirst ? 'text-center' : ''}`}>
            {t(screen.subtitleKey as Parameters<typeof t>[0])}
          </p>

          {/* Feature rows (screens 1-4) */}
          {screen.rows && (
            <div className="flex flex-col gap-4 mb-8">
              {screen.rows.map((row, i) => (
                <FeatureRow key={i} icon={row.icon} text={t(row.textKey as Parameters<typeof t>[0])} />
              ))}
            </div>
          )}
        </div>

        {/* Bottom controls */}
        <div className="px-6 pb-10 max-w-sm mx-auto w-full">
          {/* Progress dots */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {WELCOME_SCREENS.map((_, i) => (
              <div
                key={i}
                className={`rounded-full transition-all duration-300 ${
                  i === welcomeIndex
                    ? 'w-5 h-1.5 bg-[#f2f2f2]'
                    : 'w-1.5 h-1.5 bg-white/20'
                }`}
              />
            ))}
          </div>

          {/* CTA button */}
          <button
            onClick={goNext}
            className="group w-full h-12 flex items-center justify-between bg-[#f2f2f2] hover:bg-[#ffffff] active:scale-[0.98] rounded-xl transition-all pl-5 pr-1.5"
          >
            <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#080808]">
              {isLast ? t('onboarding.welcome.cta.last') : t('onboarding.welcome.cta.next')}
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-black/[0.12]">
              <ArrowRight size={16} className="text-[#080808]" />
            </div>
          </button>

          {/* Skip on non-last screens */}
          {!isLast && !isFirst && (
            <button
              onClick={() => {
                localStorage.setItem('onboarding_tour_done', 'false')
                router.push('/client')
              }}
              className="w-full mt-3 py-2 text-[11px] text-white/25 hover:text-white/45 transition-colors text-center"
            >
              {t('onboarding.welcome.skip')}
            </button>
          )}
        </div>
      </div>
    )
  }

  return null
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
          <Loader2 size={32} className="animate-spin text-[#f2f2f2]" />
        </div>
      }
    >
      <OnboardingFlow />
    </Suspense>
  )
}
