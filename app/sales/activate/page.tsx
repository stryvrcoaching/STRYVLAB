'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, CheckCircle2, Loader2 } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

export default function SalesActivatePage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [email, setEmail] = useState('')
  const [checkingSession, setCheckingSession] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [complete, setComplete] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    let fallbackTimeout: number | undefined

    async function checkInvitation() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email) {
        setEmail(user.email)
        setCheckingSession(false)
      } else {
        fallbackTimeout = window.setTimeout(() => setCheckingSession(false), 900)
      }
    }

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user.email) setEmail(session.user.email)
      setCheckingSession(false)
    })

    void checkInvitation()
    return () => {
      listener.subscription.unsubscribe()
      if (fallbackTimeout) window.clearTimeout(fallbackTimeout)
    }
  }, [])

  async function activate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Choisissez un mot de passe d’au moins 8 caractères.')
      return
    }
    if (password !== passwordConfirmation) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }

    setSubmitting(true)
    const { error: updateError } = await createClient().auth.updateUser({ password })
    setSubmitting(false)

    if (updateError) {
      setError('Le lien est expiré ou la création du mot de passe a échoué. Demandez une nouvelle invitation.')
      return
    }

    setComplete(true)
    window.setTimeout(() => {
      router.replace('/sales')
      router.refresh()
    }, 1200)
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#121212] px-5 py-10 text-white">
      <section className="w-full max-w-[460px] rounded-[28px] border border-white/[0.08] bg-[linear-gradient(135deg,rgba(255,255,255,0.10)_0%,rgba(255,255,255,0.04)_45%,rgba(92,98,104,0.16)_100%)] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_26px_80px_rgba(0,0,0,0.42)] sm:p-9">
        <div className="flex items-center gap-3">
          <Image src="/images/logo.png" alt="STRYV lab" width={102} height={32} className="h-7 w-auto brightness-0 invert" priority />
          <span className="border-l border-white/[0.12] pl-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/42">STRYV Connect</span>
        </div>

        {complete ? (
          <div className="py-16 text-center">
            <CheckCircle2 size={38} className="mx-auto text-white" />
            <h1 className="mt-5 font-barlow text-4xl font-semibold uppercase leading-none tracking-[-0.04em]">Accès activé.</h1>
            <p className="mt-4 text-sm leading-6 text-white/55">Bienvenue dans STRYV Connect. Ouverture de votre espace partenaire…</p>
          </div>
        ) : (
          <>
            <div className="mt-12">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/42">Invitation partenaire</p>
              <h1 className="mt-3 font-barlow text-5xl font-semibold uppercase leading-[0.88] tracking-[-0.045em]">Activez votre<br /><span className="text-white/35">espace Connect.</span></h1>
              <p className="mt-5 text-sm leading-6 text-white/55">Créez votre mot de passe pour accéder à vos prospects, vos actions et vos commissions.</p>
            </div>

            {checkingSession ? (
              <div className="mt-8 flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-black/20 px-4 py-4 text-sm text-white/55"><Loader2 size={16} className="animate-spin" /> Vérification de votre invitation…</div>
            ) : !email ? (
              <div className="mt-8 rounded-2xl border border-red-300/15 bg-red-400/[0.07] px-4 py-4 text-sm leading-6 text-red-100">Ce lien n’est plus valide ou a expiré. Demandez une nouvelle invitation à votre contact STRYV.</div>
            ) : (
              <form className="mt-8 space-y-4" onSubmit={activate}>
                <p className="rounded-2xl border border-white/[0.08] bg-black/20 px-4 py-3 text-[12px] text-white/55">Invitation pour <span className="font-semibold text-white">{email}</span></p>
                <label className="block"><span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.15em] text-white/45">Créer un mot de passe</span><input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="new-password" required className="h-12 w-full rounded-2xl border border-white/10 bg-black/25 px-4 text-base outline-none transition focus:border-white/45" placeholder="8 caractères minimum" /></label>
                <label className="block"><span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.15em] text-white/45">Confirmer le mot de passe</span><input value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} type="password" autoComplete="new-password" required className="h-12 w-full rounded-2xl border border-white/10 bg-black/25 px-4 text-base outline-none transition focus:border-white/45" placeholder="Répétez votre mot de passe" /></label>
                {error ? <p role="alert" className="rounded-2xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">{error}</p> : null}
                <button type="submit" disabled={submitting} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#f2f2f2] text-[11px] font-bold uppercase tracking-[0.14em] text-[#111315] transition hover:bg-white disabled:opacity-55">
                  {submitting ? <><Loader2 size={16} className="animate-spin" /> Activation…</> : <>Activer mon accès <ArrowRight size={16} /></>}
                </button>
              </form>
            )}
          </>
        )}
      </section>
    </main>
  )
}
