import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Conditions d’abonnement B2B',
  description: 'Conditions préparatoires des abonnements professionnels STRYV lab.',
}

const plans = [
  ['Solo', '29 € / mois', '5 clients', 'Plateforme coach, programmes, nutrition, bilans et exports PDF. STRYVR non inclus.'],
  ['Pro', '79 € / mois', '30 clients', 'Fonctions Solo, application STRYVR, check-ins, routines et suivi client actif.'],
  ['Studio', '129 € / mois', 'Sans limite prédéfinie', 'Fonctions Pro et capacité étendue. Les fonctions multi-coachs annoncées comme futures ne sont pas incluses tant qu’elles ne sont pas livrées.'],
]

const sections = [
  {
    title: '1. Client professionnel',
    body: 'Les abonnements STRYV lab sont destinés aux coachs indépendants, studios et organisations agissant à titre professionnel. Aucun parcours de vente directe aux consommateurs n’est actuellement proposé. Le professionnel garantit l’exactitude de ses informations d’entreprise et l’usage du service dans le cadre de son activité.',
  },
  {
    title: '2. Essai et souscription',
    body: 'Le premier abonnement peut inclure un essai unique de 14 jours. Un moyen de paiement est demandé par Stripe lors de la souscription. Sauf annulation avant la date affichée, le premier prélèvement intervient à la fin de l’essai. Une promotion éventuelle est indiquée dans le checkout Stripe avant validation.',
  },
  {
    title: '3. Facturation et renouvellement',
    body: 'Les abonnements sont mensuels et se renouvellent automatiquement. Le prix, la devise, les taxes applicables et la prochaine échéance affichés dans le checkout ou le portail Stripe prévalent avant engagement. Les incidents de paiement peuvent suspendre les fonctions payantes sans effacer immédiatement les données.',
  },
  {
    title: '4. Résiliation',
    body: 'Le coach peut gérer ou résilier son abonnement à tout moment depuis les réglages, via le portail Stripe. La date effective et le dernier jour facturé sont ceux affichés dans ce portail. Le produit applique ensuite une période cible de 90 jours limitée à la lecture et à l’export. La purge complète, les sauvegardes et les exceptions de conservation légale doivent encore être validées avant que la suppression à l’issue de ce délai soit garantie dans le contrat définitif.',
  },
  {
    title: '5. Clients coachés et mineurs',
    body: 'Le coach reste responsable de la finalité de son accompagnement, de l’information de ses clients et de la licéité des données importées. S’il suit un mineur, il vérifie sa capacité à agir, l’autorité du représentant légal lorsqu’elle est requise, fournit une information adaptée à l’âge et conserve une preuve proportionnée. STRYV lab ne contracte pas directement avec le mineur dans ce parcours B2B.',
  },
  {
    title: '6. Données sensibles et santé',
    body: 'Le coach documente la base juridique et la condition applicable aux données de santé avant leur collecte. STRYV lab traite ces données selon le contrat et le DPA, applique les contrôles techniques disponibles et assiste le coach pour les demandes de droits, incidents et analyses d’impact. La plateforme ne pose pas de diagnostic médical.',
  },
  {
    title: '7. Usage autorisé',
    body: 'Le coach protège ses accès, limite les comptes aux personnes habilitées, n’importe que les données nécessaires et n’utilise pas la plateforme à des fins illicites, discriminatoires ou étrangères au coaching déclaré. Il conserve la responsabilité professionnelle de ses prescriptions et décisions.',
  },
  {
    title: '8. Disponibilité et évolution',
    body: 'STRYV lab peut corriger, maintenir et faire évoluer le service. Aucun SLA, résultat métier ou disponibilité chiffrée n’est garanti en l’absence d’un engagement écrit distinct. Une modification substantielle du prix ou du contrat doit être portée à la connaissance du client avant sa prise d’effet conformément au droit applicable.',
  },
]

export default function BusinessTermsPage() {
  return (
    <main className="min-h-screen bg-[#121212] text-white">
      <header className="border-b border-white/10 px-5 py-5 sm:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/" className="font-unbounded text-sm tracking-[-0.04em]">STRYV lab</Link>
          <Link href="/" className="font-barlow-condensed text-xs uppercase tracking-[0.16em] text-white/55 hover:text-white">Retour au site</Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-16 sm:px-8 sm:py-24">
        <p className="font-barlow-condensed text-xs uppercase tracking-[0.2em] text-[#1f8a65]">Abonnements professionnels</p>
        <h1 className="mt-5 max-w-4xl font-barlow text-5xl font-semibold uppercase leading-[0.9] tracking-[-0.045em] sm:text-7xl">Conditions B2B</h1>
        <p className="mt-7 max-w-3xl text-base leading-7 text-white/60">
          Conditions préparatoires alignées sur les offres et parcours Stripe présents dans le produit au
          15 juillet 2026. Une validation juridique belge reste requise avant de rendre l’acceptation
          contractuelle obligatoire dans le checkout.
        </p>

        <section className="mt-12 grid gap-4 lg:grid-cols-3">
          {plans.map(([name, price, capacity, description]) => (
            <article key={name} className="rounded-3xl border border-white/10 bg-white/[0.025] p-6">
              <p className="font-barlow-condensed text-[10px] uppercase tracking-[0.16em] text-[#1f8a65]">Plan</p>
              <h2 className="mt-3 font-barlow text-3xl font-semibold">{name}</h2>
              <p className="mt-2 text-lg font-semibold text-white/85">{price}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.1em] text-white/35">{capacity}</p>
              <p className="mt-5 text-sm leading-6 text-white/58">{description}</p>
            </article>
          ))}
        </section>

        <div className="mt-12 grid gap-5">
          {sections.map((section) => (
            <section key={section.title} className="rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-8">
              <h2 className="font-barlow text-2xl font-semibold tracking-[-0.025em]">{section.title}</h2>
              <p className="mt-4 text-[15px] leading-7 text-white/62">{section.body}</p>
            </section>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-[#1f8a65]/25 bg-[#1f8a65]/[0.06] p-5 text-sm leading-6 text-white/70">
          Le contrat final doit inclure le DPA, la version acceptée, l’horodatage de l’acceptation et la
          preuve des informations présentées avant la souscription.
        </div>

        <div className="mt-12 flex flex-wrap gap-5 border-t border-white/10 pt-8 font-barlow-condensed text-xs uppercase tracking-[0.14em] text-white/45">
          <Link href="/confidentialite" className="hover:text-white">Confidentialité</Link>
          <Link href="/sous-traitants" className="hover:text-white">Sous-traitants</Link>
          <Link href="/cookies" className="hover:text-white">Cookies</Link>
          <Link href="/mentions-legales" className="hover:text-white">Mentions légales</Link>
          <a href="mailto:contact@stryvlab.com" className="hover:text-white">Contact contractuel</a>
        </div>
      </div>
    </main>
  )
}
