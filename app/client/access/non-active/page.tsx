import Image from 'next/image'

export default function ClientAccessNonActivePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#121212] px-6 py-16 text-white">
      <div className="mx-auto flex max-w-lg flex-col items-center text-center">
        <Image src="/logo/logo-stryvr-silver.png" alt="STRYVR" width={48} height={48} className="mb-7 h-12 w-12 object-contain" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/35">
          STRYVR
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">
          Espace client indisponible
        </h1>
        <p className="mt-3 text-sm leading-6 text-white/65">
          L’espace client n’est pas actif pour ce suivi. Contactez votre coach pour activer
          l’expérience STRYVR.
        </p>
      </div>
    </main>
  )
}
