import type { Metadata } from 'next'
import Link from 'next/link'
import { ResetAnalyticsConsentButton } from '@/components/analytics/ResetAnalyticsConsentButton'

export const metadata: Metadata = {
  title: 'Politique cookies et traceurs',
  description: 'Cookies, stockage local et mesure d’audience utilisés par STRYV lab.',
}

const rows = [
  ['Session Supabase', 'Cookie sécurisé', 'Authentification et maintien de la session demandée', 'Session ou durée technique du jeton', 'Nécessaire'],
  ['stryv.analytics.consent', 'Stockage local', 'Mémoriser le choix analytics', '6 mois maximum', 'Nécessaire au respect du choix'],
  ['stryv.analytics.anonymous_id', 'Stockage local', 'Distinguer les visites consenties sans compte', 'Jusqu’au retrait ou à la réinitialisation', 'Consentement'],
  ['stryv.analytics.session_id', 'Stockage de session', 'Regrouper les événements d’une visite consentie', 'Fin de session', 'Consentement'],
  ['stryv.analytics.attribution', 'Stockage local', 'Conserver les paramètres UTM après consentement', 'Jusqu’au retrait ou à la réinitialisation', 'Consentement'],
]

export default function CookiesPage() {
  return (
    <main className="min-h-screen bg-[#0d0d0d] text-white">
      <header className="border-b border-white/10 px-5 py-5 sm:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/" className="font-unbounded text-sm tracking-[-0.04em]">STRYV lab</Link>
          <Link href="/" className="font-barlow-condensed text-xs uppercase tracking-[0.16em] text-white/55 hover:text-white">Retour au site</Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-16 sm:px-8 sm:py-24">
        <p className="font-barlow-condensed text-xs uppercase tracking-[0.2em] text-[#c6b48b]">Cookies & stockage local</p>
        <h1 className="mt-5 font-barlow text-5xl font-semibold uppercase leading-[0.9] tracking-[-0.045em] sm:text-7xl">Vos choix restent vos choix.</h1>
        <p className="mt-7 max-w-3xl text-base leading-7 text-white/60">
          Les mécanismes nécessaires à la connexion fonctionnent sans consentement. La mesure d’audience
          interne et l’attribution ne démarrent qu’après votre accord. Aucun refus ne bloque l’accès au site.
        </p>

        <section className="mt-12 overflow-hidden rounded-3xl border border-white/10">
          <div className="overflow-x-auto">
            <table className="min-w-[780px] w-full border-collapse text-left text-sm">
              <thead className="bg-white/[0.05] font-barlow-condensed uppercase tracking-[0.12em] text-white/45">
                <tr>{['Nom', 'Type', 'Finalité', 'Durée', 'Base'].map((label) => <th key={label} className="px-5 py-4 font-medium">{label}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-white/10 text-white/62">
                {rows.map((row) => (
                  <tr key={row[0]}>{row.map((cell) => <td key={cell} className="px-5 py-4 align-top leading-6">{cell}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6">
            <h2 className="font-barlow text-2xl font-semibold">Mesure interne</h2>
            <p className="mt-3 text-sm leading-7 text-white/60">
              Après accord, le produit peut enregistrer la page, le CTA, le formulaire, la source, le
              référent, les paramètres UTM et un identifiant aléatoire. Le code observé n’active pas de
              pixel publicitaire tiers pour ce suivi.
            </p>
          </section>
          <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6">
            <h2 className="font-barlow text-2xl font-semibold">Retirer ou modifier</h2>
            <p className="mb-5 mt-3 text-sm leading-7 text-white/60">
              La réinitialisation efface le choix, l’identifiant analytics, l’attribution et la session de
              mesure. Le bandeau sera proposé à nouveau sur la page d’accueil.
            </p>
            <ResetAnalyticsConsentButton />
          </section>
        </div>

        <div className="mt-12 flex flex-wrap gap-5 border-t border-white/10 pt-8 font-barlow-condensed text-xs uppercase tracking-[0.14em] text-white/45">
          <Link href="/confidentialite" className="hover:text-white">Confidentialité</Link>
          <Link href="/mentions-legales" className="hover:text-white">Mentions légales</Link>
          <a href="mailto:contact@stryvlab.com" className="hover:text-white">Contact</a>
        </div>
      </div>
    </main>
  )
}
