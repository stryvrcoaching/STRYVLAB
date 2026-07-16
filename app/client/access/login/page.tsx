'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

export default function ClientMagicLinkLoginPage() {
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    const url = new URL(window.location.href)
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const accessToken = hash.get('access_token')
    const refreshToken = hash.get('refresh_token')
    const code = url.searchParams.get('code')

    async function finishLogin() {
      const result = code
        ? await supabase.auth.exchangeCodeForSession(code)
        : accessToken && refreshToken
          ? await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
          : { error: new Error('missing_auth_token') }

      if (result.error) {
        setError('Ce lien de connexion est invalide ou a expiré. Demandez-en un nouveau à votre coach.')
        return
      }

      window.location.replace('/client')
    }

    void finishLogin()
  }, [])

  return (
    <main className="min-h-dvh bg-[#121212] px-5 py-6 text-white sm:px-8 sm:py-8">
      <header className="mx-auto flex max-w-[1180px] items-center justify-between border-b border-white/[0.06] pb-5">
        <Link href="/" aria-label="Retour à STRYV lab" className="flex items-center gap-2.5">
          <div className="relative h-8 w-8 rounded-lg border border-white/[0.10] bg-[#181818]">
            <Image src="/logo/logo-stryvr-silver.png" alt="STRYVR" fill sizes="32px" className="object-contain p-1.5" />
          </div>
          <span className="font-unbounded text-[13px] font-semibold tracking-[-0.08em]">STRYV <span className="font-normal text-white/45">lab</span></span>
        </Link>
        <span className="font-barlow-condensed text-[12px] font-semibold uppercase tracking-[0.14em] text-white/45">Accès client</span>
      </header>

      <div className="mx-auto grid min-h-[calc(100dvh-112px)] max-w-[1180px] items-center gap-12 py-12 lg:grid-cols-[minmax(0,1fr)_420px] lg:py-16">
        <section className="hidden max-w-[540px] lg:block">
          <p className="font-barlow-condensed text-[12px] font-semibold uppercase tracking-[0.18em] text-white/45">STRYVR</p>
          <h1 className="mt-5 font-barlow text-6xl font-semibold uppercase leading-[0.86] tracking-[-0.045em]">Votre suivi.<br /><span className="text-white/35">Toujours connecté.</span></h1>
          <p className="mt-7 max-w-[440px] text-[16px] leading-7 text-white/55">Votre coach vous a donné accès à votre espace personnel STRYVR.</p>
        </section>

        <section aria-live="polite" className="w-full border border-white/[0.08] bg-[#181818] p-6 sm:p-8">
          <div className="flex items-center gap-3 border-b border-white/[0.07] pb-5">
            <div className="relative h-9 w-9 rounded-lg border border-white/[0.10] bg-[#121212]">
              <Image src="/logo/logo-stryvr-silver.png" alt="STRYVR" fill sizes="36px" className="object-contain p-1.5" />
            </div>
            <div><p className="font-barlow-condensed text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">STRYV lab</p><p className="mt-0.5 text-[13px] font-semibold text-white">Accès client</p></div>
          </div>

          {error ? (
            <div className="mt-8">
              <p className="font-barlow-condensed text-[11px] font-semibold uppercase tracking-[0.16em] text-red-300">Lien non disponible</p>
              <h1 className="mt-3 font-barlow text-4xl font-semibold uppercase leading-[0.9] tracking-[-0.04em]">Demandez un<br /><span className="text-white/42">nouvel accès.</span></h1>
              <p role="alert" className="mt-5 text-sm leading-6 text-white/55">{error}</p>
              <Link href="/client/login" className="mt-8 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-white/[0.10] font-barlow-condensed text-[12px] font-bold uppercase tracking-[0.14em] text-white transition-colors hover:bg-white/[0.05]">
                <ArrowLeft size={15} /> Retour à la connexion
              </Link>
            </div>
          ) : (
            <div className="py-16 text-center sm:py-20">
              <Loader2 aria-hidden size={28} className="mx-auto animate-spin text-[#1f8a65]" />
              <p className="mt-5 font-barlow text-2xl font-semibold uppercase tracking-[-0.025em] text-white">Connexion en cours</p>
              <p className="mt-3 text-sm leading-6 text-white/50">Ouverture sécurisée de votre espace client.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
