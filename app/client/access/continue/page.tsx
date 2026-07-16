import type { Metadata } from 'next'
import Image from 'next/image'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

type Props = {
  searchParams: Promise<{ target?: string | string[] }>
}

export default async function ContinueClientAccessPage({ searchParams }: Props) {
  const { target } = await searchParams
  const actionUrl = typeof target === 'string' ? target : null

  if (!actionUrl) redirect('/client/login?error=link_expired')

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#0d0d0d] p-6 text-white">
      <section className="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-white/[0.02] p-7 text-center">
        <Image
          src="/logo/logo-stryvr-silver.png"
          alt="STRYVR"
          width={48}
          height={48}
          priority
          className="mx-auto h-12 w-12 object-contain"
        />
        <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">STRYVR</p>
        <h1 className="mt-3 text-xl font-bold">Prêt à accéder à votre espace ?</h1>
        <p className="mt-3 text-sm leading-6 text-white/50">
          Confirmez pour ouvrir votre espace client sécurisé.
        </p>
        <form action="/client/access/continue/verify" method="post" className="mt-7">
          <input type="hidden" name="target" value={actionUrl} />
          <button
            type="submit"
            className="flex h-12 w-full items-center justify-center rounded-xl bg-[#f2f2f2] px-5 text-[12px] font-bold uppercase tracking-[0.12em] text-[#080808] transition hover:bg-white"
          >
            Accéder à mon espace
          </button>
        </form>
      </section>
    </main>
  )
}
