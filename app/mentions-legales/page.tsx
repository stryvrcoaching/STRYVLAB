import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Mentions légales',
  description: 'Identification de l’éditeur et informations légales de STRYV lab.',
}

export default function LegalNoticePage() {
  return (
    <main className="min-h-screen bg-[#121212] text-white">
      <header className="border-b border-white/10 px-5 py-5 sm:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/" className="font-unbounded text-sm tracking-[-0.04em]">STRYV lab</Link>
          <Link href="/" className="font-barlow-condensed text-xs uppercase tracking-[0.16em] text-white/55 hover:text-white">Retour au site</Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-16 sm:px-8 sm:py-24">
        <p className="font-barlow-condensed text-xs uppercase tracking-[0.2em] text-[#1f8a65]">Éditeur & exploitation</p>
        <h1 className="mt-5 font-barlow text-5xl font-semibold uppercase leading-[0.9] tracking-[-0.045em] sm:text-7xl">Mentions légales</h1>
        <p className="mt-7 text-base leading-7 text-white/60">Dernière mise à jour technique : 15 juillet 2026.</p>

        <div className="mt-12 grid gap-5">
          <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-7 sm:p-8">
            <h2 className="font-barlow text-2xl font-semibold">1. Éditeur</h2>
            <div className="mt-4 grid gap-2 text-sm leading-7 text-white/62 sm:grid-cols-2">
              <p><strong className="text-white/85">Exploitant :</strong> HB Solution — Boukelmoune Kévin</p>
              <p><strong className="text-white/85">Forme :</strong> entreprise individuelle belge</p>
              <p><strong className="text-white/85">Nom commercial :</strong> STRYV lab</p>
              <p><strong className="text-white/85">BCE :</strong> 0745.797.168</p>
              <p><strong className="text-white/85">TVA :</strong> BE0745797168</p>
              <p><strong className="text-white/85">Publication :</strong> Boukelmoune Kévin</p>
              <p><strong className="text-white/85">E-mail :</strong> <a className="text-[#1f8a65]" href="mailto:contact@stryvlab.com">contact@stryvlab.com</a></p>
              <p><strong className="text-white/85">Téléphone :</strong> <a className="text-[#1f8a65]" href="tel:+32472238612">+32 472 23 86 12</a></p>
              <p><strong className="text-white/85">Adresse :</strong> Boulevard Président Kennedy 69, 7000 Mons, Belgique</p>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-7 sm:p-8">
            <h2 className="font-barlow text-2xl font-semibold">2. Services techniques</h2>
            <div className="mt-4 space-y-3 text-sm leading-7 text-white/62">
              <p><strong className="text-white/85">Hébergement applicatif :</strong> Vercel.</p>
              <p><strong className="text-white/85">Base, authentification et stockage :</strong> Supabase.</p>
              <p><strong className="text-white/85">Paiement :</strong> Stripe pour les parcours actifs.</p>
              <p>
                Les régions, transferts, durées de journaux et garanties contractuelles ne sont pas déduits
                de ces noms de fournisseurs ; ils sont documentés dans le registre de traitement et la
                politique de confidentialité après vérification des comptes déployés.
              </p>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-7 sm:p-8">
            <h2 className="font-barlow text-2xl font-semibold">3. Propriété et responsabilité</h2>
            <div className="mt-4 space-y-3 text-sm leading-7 text-white/62">
              <p>
                Les contenus, interfaces, marques, textes, médias et logiciels sont protégés par les droits
                applicables. Leur reproduction ou réutilisation commerciale nécessite une autorisation,
                sauf exception prévue par la loi.
              </p>
              <p>
                STRYV lab s’efforce de maintenir les informations et services accessibles et à jour, sans
                promettre un niveau de disponibilité ou un délai d’intervention qui ne figure pas dans un
                contrat signé. Les contenus de coaching ne constituent pas un diagnostic médical.
              </p>
            </div>
          </section>
        </div>

        <div className="mt-12 flex flex-wrap gap-5 border-t border-white/10 pt-8 font-barlow-condensed text-xs uppercase tracking-[0.14em] text-white/45">
          <Link href="/confidentialite" className="hover:text-white">Confidentialité</Link>
          <Link href="/cookies" className="hover:text-white">Cookies</Link>
          <Link href="/cgv" className="hover:text-white">Conditions commerciales</Link>
          <a href="mailto:contact@stryvlab.com" className="hover:text-white">Contact</a>
        </div>
      </div>
    </main>
  )
}
