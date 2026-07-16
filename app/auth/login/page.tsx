"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { login } from "./actions";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    const result = await login(new FormData(event.currentTarget));
    if (result?.error) {
      setError(result.error);
      setIsLoading(false);
      return;
    }

    const requestedPath = searchParams.get("next");
    const destination = requestedPath?.startsWith("/") && !requestedPath.startsWith("//")
      ? requestedPath
      : "/dashboard";
    router.replace(destination);
    router.refresh();
  }

  return (
    <section aria-labelledby="login-title" className="w-full border border-white/[0.08] bg-[#181818] p-6 sm:p-8">
      <div className="flex items-center gap-3 border-b border-white/[0.07] pb-5">
        <div className="relative h-9 w-9 rounded-lg border border-white/[0.10] bg-[#121212]">
          <Image src="/images/logo.png" alt="" fill sizes="36px" className="object-contain p-1.5 brightness-0 invert" />
        </div>
        <div><p className="font-barlow-condensed text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">STRYV lab</p><p className="mt-0.5 text-[13px] font-semibold text-white">Connexion coach</p></div>
      </div>
      <div className="mt-8"><p className="font-barlow-condensed text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">Bon retour</p><h2 id="login-title" className="mt-3 font-barlow text-4xl font-semibold uppercase leading-[0.9] tracking-[-0.04em]">Ouvrir votre<br /><span className="text-white/42">espace coach.</span></h2><p className="mt-4 text-sm leading-6 text-white/50">Connectez-vous pour reprendre votre suivi là où vous l'avez laissé.</p></div>
      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div><label htmlFor="email" className="mb-2 block font-barlow-condensed text-[11px] font-semibold uppercase tracking-[0.15em] text-white/45">Adresse e-mail</label><input id="email" name="email" type="email" autoComplete="email" required className="h-12 w-full rounded-lg border border-white/[0.08] bg-[#0a0a0a] px-4 text-base text-white outline-none transition-colors placeholder:text-white/25 focus:border-[#1f8a65] focus:ring-1 focus:ring-[#1f8a65]" placeholder="vous@exemple.com" /></div>
        <div><div className="mb-2 flex items-center justify-between"><label htmlFor="password" className="font-barlow-condensed text-[11px] font-semibold uppercase tracking-[0.15em] text-white/45">Mot de passe</label><Link href="/auth/reset-password" className="text-[11px] font-medium text-[#69d0ac] transition-colors hover:text-white">Mot de passe oublié ?</Link></div><input id="password" name="password" type="password" autoComplete="current-password" required className="h-12 w-full rounded-lg border border-white/[0.08] bg-[#0a0a0a] px-4 text-base text-white outline-none transition-colors placeholder:text-white/25 focus:border-[#1f8a65] focus:ring-1 focus:ring-[#1f8a65]" placeholder="••••••••" /></div>
        {error && <p role="alert" className="rounded-2xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm leading-5 text-red-100">{error}</p>}
        <button type="submit" disabled={isLoading} className="group inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#1f8a65] font-barlow-condensed text-[12px] font-bold uppercase tracking-[0.14em] text-white transition-colors hover:bg-[#217356] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#dbe4df] disabled:cursor-wait disabled:opacity-60">{isLoading ? <><Loader2 size={16} className="animate-spin" /> Connexion...</> : <>Se connecter <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" /></>}</button>
      </form>
      <div className="mt-7 border-t border-white/[0.07] pt-5 text-center text-sm text-white/45">Pas encore de compte ? <Link href="/" className="text-[#69d0ac] transition-colors hover:text-white">Créer votre espace coach</Link></div>
    </section>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-dvh bg-[#121212] px-5 py-6 text-white sm:px-8 sm:py-8">
      <header className="mx-auto flex max-w-[1180px] items-center justify-between border-b border-white/[0.06] pb-5">
        <Link href="/" aria-label="Retour à STRYV lab" className="flex items-center gap-2.5">
          <div className="relative h-8 w-8 rounded-lg border border-white/[0.10] bg-[#181818]">
            <Image src="/images/logo.png" alt="" fill sizes="32px" className="object-contain p-1.5 brightness-0 invert" />
          </div>
          <span className="font-unbounded text-[13px] font-semibold tracking-[-0.08em]">STRYV <span className="font-normal text-white/45">lab</span></span>
        </Link>
        <Link href="/" className="inline-flex min-h-10 items-center gap-2 font-barlow-condensed text-[12px] font-semibold uppercase tracking-[0.14em] text-white/45 transition-colors hover:text-white">
          <ArrowLeft size={14} /> Retour au site
        </Link>
      </header>

      <div className="mx-auto grid min-h-[calc(100dvh-112px)] max-w-[1180px] items-center gap-12 py-12 lg:grid-cols-[minmax(0,1fr)_420px] lg:py-16">
        <section className="hidden max-w-[540px] lg:block">
          <p className="font-barlow-condensed text-[12px] font-semibold uppercase tracking-[0.18em] text-white/45">Espace coach</p>
          <h1 className="mt-5 font-barlow text-6xl font-semibold uppercase leading-[0.86] tracking-[-0.045em]">Votre méthode.<br /><span className="text-white/35">En système.</span></h1>
          <p className="mt-7 max-w-[440px] text-[16px] leading-7 text-white/55">Retrouvez vos clients, vos bilans, vos studios et les prochaines décisions à prendre.</p>
          <div className="mt-12 flex max-w-[440px] border-y border-white/[0.08] py-5 font-barlow-condensed text-[11px] font-semibold uppercase tracking-[0.15em] text-white/38">
            <span className="flex-1">Profils</span><span className="flex-1">Prescriptions</span><span className="flex-1 text-right">Données</span>
          </div>
        </section>

        <Suspense fallback={
          <div className="w-full border border-white/[0.08] bg-[#181818] p-6 sm:p-8">
            <div className="h-12 w-full animate-pulse rounded-lg bg-white/[0.05]" />
          </div>
        }>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
