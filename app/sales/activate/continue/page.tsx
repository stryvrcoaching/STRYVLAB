import type { Metadata } from 'next'
import Image from 'next/image'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

type Props = {
  searchParams: Promise<{ target?: string | string[] }>
}

export default async function ContinueSalesActivationPage({ searchParams }: Props) {
  const { target } = await searchParams
  const actionUrl = typeof target === 'string' ? target : null

  if (!actionUrl) redirect('/sales/login?access=denied')

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#121212] px-5 py-10 text-white">
      <section className="w-full max-w-[440px] rounded-[28px] border border-white/[0.08] bg-[linear-gradient(135deg,rgba(255,255,255,0.10)_0%,rgba(255,255,255,0.04)_45%,rgba(92,98,104,0.16)_100%)] p-6 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_26px_80px_rgba(0,0,0,0.42)] sm:p-9">
        <Image src="/images/logo.png" alt="STRYV lab" width={102} height={32} className="mx-auto h-7 w-auto brightness-0 invert" priority />
        <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/42">STRYV Connect</p>
        <h1 className="mt-3 font-barlow text-4xl font-semibold uppercase leading-none tracking-[-0.04em]">Prêt à activer<br />votre accès ?</h1>
        <p className="mt-4 text-sm leading-6 text-white/55">Confirmez pour créer votre mot de passe et rejoindre votre espace partenaire sécurisé.</p>
        <form action="/sales/activate/continue/verify" method="post" className="mt-8">
          <input type="hidden" name="target" value={actionUrl} />
          <button type="submit" className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-[#f2f2f2] px-5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#111315] transition hover:bg-white">Continuer</button>
        </form>
      </section>
    </main>
  )
}
