import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Sous-traitants techniques',
  description: 'Services techniques confirmés dans le fonctionnement de STRYV lab.',
}

const providers = [
  ['Vercel', 'Hébergement web et fonctions serveur', 'Requêtes et journaux techniques'],
  ['Supabase', 'Authentification, base PostgreSQL et stockage', 'Comptes et données produit'],
  ['Stripe', 'Abonnements, paiements et Connect', 'Identité, facturation et références de paiement'],
  ['OpenAI', 'Fonctions IA, vision et transcription', 'Texte, audio, images et contexte nécessaire'],
  ['Anthropic', 'Fonctions conversationnelles confirmées', 'Texte et contexte nécessaire'],
  ['Resend', 'E-mails transactionnels et de sécurité', 'Adresse e-mail et contenu du message'],
  ['Inngest', 'Orchestration de tâches asynchrones', 'Identifiants et charges de tâches minimisées'],
  ['Cal.com', 'Réservation de démonstrations', 'Coordonnées et rendez-vous'],
  ['Calendly', 'Réservation sur certains parcours', 'Coordonnées et rendez-vous'],
]

export default function SubprocessorsPage() {
  return (
    <main className="min-h-screen bg-[#121212] text-white">
      <header className="border-b border-white/10 px-5 py-5 sm:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/" className="font-unbounded text-sm tracking-[-0.04em]">STRYV lab</Link>
          <Link href="/confidentialite" className="font-barlow-condensed text-xs uppercase tracking-[0.16em] text-white/55 hover:text-white">Confidentialité</Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-16 sm:px-8 sm:py-24">
        <p className="font-barlow-condensed text-xs uppercase tracking-[0.2em] text-[#1f8a65]">Transparence fournisseurs</p>
        <h1 className="mt-5 font-barlow text-5xl font-semibold uppercase leading-[0.9] tracking-[-0.045em] sm:text-7xl">Sous-traitants techniques</h1>
        <p className="mt-7 max-w-3xl text-base leading-7 text-white/60">
          Services confirmés comme actifs par l’exploitant au 15 juillet 2026. n8n n’est pas actif et ne
          doit recevoir aucune donnée. Les régions, garanties de transfert et durées fournisseurs restent
          soumises à la revue contractuelle finale.
        </p>

        <div className="mt-12 grid gap-4">
          {providers.map(([name, purpose, data]) => (
            <section key={name} className="grid gap-3 rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:grid-cols-[180px_1fr_1fr] sm:items-start">
              <h2 className="font-barlow text-xl font-semibold">{name}</h2>
              <div><p className="font-barlow-condensed text-[10px] uppercase tracking-[0.14em] text-white/35">Fonction</p><p className="mt-2 text-sm leading-6 text-white/62">{purpose}</p></div>
              <div><p className="font-barlow-condensed text-[10px] uppercase tracking-[0.14em] text-white/35">Données possibles</p><p className="mt-2 text-sm leading-6 text-white/62">{data}</p></div>
            </section>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap gap-5 border-t border-white/10 pt-8 font-barlow-condensed text-xs uppercase tracking-[0.14em] text-white/45">
          <Link href="/confidentialite" className="hover:text-white">Confidentialité</Link>
          <Link href="/cookies" className="hover:text-white">Cookies</Link>
          <a href="mailto:contact@stryvlab.com" className="hover:text-white">Question fournisseur</a>
        </div>
      </div>
    </main>
  )
}
