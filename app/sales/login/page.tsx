'use client'

import { Suspense, useState } from 'react'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, Loader2 } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

export default function SalesLoginPage() {
  return (
    <Suspense fallback={<SalesLoginFallback />}>
      <SalesLoginContent />
    </Suspense>
  )
}

function SalesLoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState(searchParams?.get('access') === 'denied' ? 'Cet espace est réservé aux partenaires commerciaux STRYV.' : '')
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    setError('')

    const formData = new FormData(event.currentTarget)
    const { error: signInError } = await createClient().auth.signInWithPassword({
      email: String(formData.get('email') ?? ''),
      password: String(formData.get('password') ?? ''),
    })

    if (signInError) {
      setError('Identifiants de connexion invalides.')
      setIsLoading(false)
      return
    }

    router.replace('/sales')
    router.refresh()
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#121212] px-5 py-10 text-white">
      <section className="w-full max-w-[430px] rounded-[28px] border border-white/[0.08] bg-[linear-gradient(135deg,rgba(255,255,255,0.10)_0%,rgba(255,255,255,0.04)_45%,rgba(92,98,104,0.16)_100%)] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_26px_80px_rgba(0,0,0,0.42)] sm:p-9">
        <div className="flex items-center gap-3">
          <Image src="/images/logo.png" alt="STRYV lab" width={102} height={32} className="h-7 w-auto brightness-0 invert" priority />
          <span className="border-l border-white/[0.12] pl-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/42">STRYV Connect</span>
        </div>
        <div className="mt-12">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/42">Connexion partenaire</p>
          <h1 className="mt-3 font-barlow text-5xl font-semibold uppercase leading-[0.88] tracking-[-0.045em]">Piloter<br /><span className="text-white/35">vos ventes.</span></h1>
          <p className="mt-5 text-sm leading-6 text-white/55">Accédez à votre portefeuille, vos actions de suivi et vos commissions STRYV Connect.</p>
        </div>
        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <label className="block"><span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.15em] text-white/45">Adresse e-mail</span><input name="email" type="email" autoComplete="email" required className="h-12 w-full rounded-2xl border border-white/10 bg-black/25 px-4 text-base outline-none transition focus:border-white/45" placeholder="vous@exemple.com" /></label>
          <label className="block"><span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.15em] text-white/45">Mot de passe</span><input name="password" type="password" autoComplete="current-password" required className="h-12 w-full rounded-2xl border border-white/10 bg-black/25 px-4 text-base outline-none transition focus:border-white/45" placeholder="••••••••" /></label>
          {error ? <p role="alert" className="rounded-2xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">{error}</p> : null}
          <button type="submit" disabled={isLoading} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#f2f2f2] text-[11px] font-bold uppercase tracking-[0.14em] text-[#111315] transition hover:bg-white disabled:opacity-55">
            {isLoading ? <><Loader2 size={16} className="animate-spin" /> Connexion…</> : <>Accéder à mon espace <ArrowRight size={16} /></>}
          </button>
        </form>
      </section>
    </main>
  )
}

function SalesLoginFallback() {
  return <main className="min-h-dvh bg-[#121212]" aria-busy="true" />
}
