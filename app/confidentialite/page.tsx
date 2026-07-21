import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Politique de confidentialité',
  description: 'Information sur les traitements de données du site et de la plateforme STRYV lab.',
}

const sections = [
  {
    title: '1. Qui traite vos données ?',
    content: (
      <>
        <p>
          STRYV lab est exploité par <strong>HB Solution — Boukelmoune Kévin</strong>, entreprise
          individuelle belge enregistrée sous le numéro BCE <strong>0745.797.168</strong> et le numéro
          de TVA <strong>BE0745797168</strong>. Contact :{' '}
          <a href="mailto:contact@stryvlab.com">contact@stryvlab.com</a>. Adresse : Boulevard Président
          Kennedy 69, 7000 Mons, Belgique. Téléphone : <a href="tel:+32472238612">+32 472 23 86 12</a>.
        </p>
        <p>
          Pour le compte coach, l’abonnement, la sécurité, le support et le site public, STRYV lab
          détermine directement les finalités du traitement. Pour le dossier d’un client suivi par un
          coach ou une organisation, ce coach ou cette organisation détermine en principe la finalité
          du coaching ; STRYV lab fournit alors la plateforme technique et agit selon les instructions
          contractuelles applicables.
        </p>
      </>
    ),
  },
  {
    title: '2. Données concernées',
    content: (
      <ul>
        <li>Identité, coordonnées, compte, organisation et préférences.</li>
        <li>Données contractuelles, factures, montants, statuts et références Stripe.</li>
        <li>Données techniques et de sécurité : session, appareil, IP, événements et tentatives.</li>
        <li>Données de coaching : objectifs, programmes, séances, performances et échanges.</li>
        <li>Données sensibles : santé, blessures, sommeil, cycle, nutrition, poids et mensurations.</li>
        <li>Photos de profil, repas, bilans ou morphologie, et fichiers transmis au coach.</li>
        <li>Données vocales ou textuelles envoyées volontairement aux fonctions d’assistance.</li>
        <li>Mesure d’audience interne, uniquement après accord, décrite dans la politique cookies.</li>
      </ul>
    ),
  },
  {
    title: '3. Pourquoi et sur quelle base ?',
    content: (
      <ul>
        <li>Créer et fournir le compte ou le service demandé : exécution du contrat.</li>
        <li>Gérer les paiements et justificatifs : contrat et obligations légales applicables.</li>
        <li>Prévenir les abus et sécuriser la plateforme : intérêt légitime et obligations de sécurité.</li>
        <li>Répondre aux demandes RGPD : obligation légale.</li>
        <li>Mesurer l’audience publique : consentement préalable, libre et révocable.</li>
        <li>
          Traiter les données de santé dans le coaching : la base de l’article 6 et la condition de
          l’article 9 du RGPD doivent être définies et documentées par le responsable du traitement
          pour le contexte concerné.
        </li>
      </ul>
    ),
  },
  {
    title: '4. IA et assistance automatisée',
    content: (
      <>
        <p>
          Certaines fonctions peuvent transmettre à un fournisseur d’IA le texte, l’audio, une photo
          ou le contexte strictement nécessaire à l’analyse demandée. Les fournisseurs effectivement
          activés, leurs régions, durées de conservation et garanties doivent être tenus à jour dans le
          registre des sous-traitants.
        </p>
        <p>
          Ces analyses assistent le coach ou l’utilisateur. Elles ne remplacent pas un professionnel de
          santé et ne doivent pas produire seules une décision juridique ou un effet significatif sur la
          personne. Une sortie peut être inexacte et doit rester contestable et contrôlée humainement.
        </p>
      </>
    ),
  },
  {
    title: '5. Destinataires et transferts',
    content: (
      <>
        <p>
          Les données sont accessibles uniquement aux utilisateurs autorisés, au personnel habilité
          lorsque cela est nécessaire et aux prestataires techniques configurés pour l’hébergement,
          l’authentification, le paiement, l’e-mail, l’automatisation ou l’IA. La liste des services
          confirmés est publiée sur la page <Link href="/sous-traitants">Sous-traitants</Link>.
        </p>
        <p>
          Certains prestataires peuvent impliquer un traitement hors de l’Espace économique européen.
          Dans ce cas, le mécanisme de transfert et les garanties doivent être documentés avant
          l’activation du traitement concerné. STRYV lab ne vend pas les données personnelles.
        </p>
      </>
    ),
  },
  {
    title: '6. Conservation',
    content: (
      <>
        <p>
          Les données sont conservées pendant la durée nécessaire au service, à la restitution au client,
          à la sécurité et aux obligations légales. Les pièces comptables peuvent être isolées de la
          plateforme active lorsqu’une conservation légale reste nécessaire.
        </p>
        <p>
          Après la fenêtre de restitution, une file technique traite la suppression du compte, des données
          métier et des fichiers applicatifs connus. Les données financières nécessitant une conservation
          passent en revue séparée. Les délais propres aux sauvegardes et fournisseurs restent soumis à leurs
          procédures et aux obligations légales applicables.
        </p>
      </>
    ),
  },
  {
    title: '7. Sécurité',
    content: (
      <p>
        Les mesures observées comprennent l’authentification serveur, l’isolation par coach, des politiques
        d’accès en base, des stockages privés, des liens temporaires, la validation des fichiers, la
        limitation des requêtes sensibles, la signature des webhooks et des événements de sécurité.
        Aucun système ne pouvant garantir un risque nul, ces contrôles font l’objet de revues et de tests.
      </p>
    ),
  },
  {
    title: '8. Vos droits',
    content: (
      <>
        <p>
          Selon le contexte, vous pouvez demander l’accès, la rectification, l’effacement, la limitation,
          l’opposition, la portabilité et des informations sur une décision automatisée. Une demande est
          gratuite sauf abus manifeste et reçoit en principe une réponse dans un délai d’un mois. Une
          prolongation motivée peut être appliquée aux demandes complexes dans les limites du RGPD.
        </p>
        <p>
          Depuis un compte coach, la demande de suppression est disponible dans les paramètres et crée
          une demande datée. Vous pouvez aussi écrire à{' '}
          <a href="mailto:contact@stryvlab.com?subject=Demande%20RGPD">contact@stryvlab.com</a> avec
          l’objet « Demande RGPD ». Une preuve d’identité proportionnée peut être demandée en cas de doute.
        </p>
        <p>
          Vous pouvez introduire une réclamation auprès de l’
          <a href="https://www.autoriteprotectiondonnees.be/" target="_blank" rel="noreferrer">
            Autorité de protection des données belge
          </a>.
        </p>
      </>
    ),
  },
]

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#121212] text-white">
      <header className="border-b border-white/10 px-5 py-5 sm:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/" className="font-unbounded text-sm tracking-[-0.04em]">STRYV lab</Link>
          <Link href="/" className="font-barlow-condensed text-xs uppercase tracking-[0.16em] text-white/55 hover:text-white">
            Retour au site
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-16 sm:px-8 sm:py-24">
        <p className="font-barlow-condensed text-xs uppercase tracking-[0.2em] text-[#1f8a65]">
          Données & transparence
        </p>
        <h1 className="mt-5 max-w-4xl font-barlow text-5xl font-semibold uppercase leading-[0.9] tracking-[-0.045em] sm:text-7xl">
          Politique de confidentialité
        </h1>
        <p className="mt-7 max-w-3xl text-base leading-7 text-white/60">
          Cette notice distingue le site public, le compte coach et les données traitées pour le compte
          des coachs. Dernière mise à jour technique : 15 juillet 2026.
        </p>
        <div className="mt-7 rounded-2xl border border-[#1f8a65]/25 bg-[#1f8a65]/[0.06] p-5 text-sm leading-6 text-white/70">
          Version de transparence préparatoire. La qualification contractuelle des rôles, la condition
          applicable aux données de santé, les durées légales et les transferts doivent recevoir une
          validation juridique finale avant le lancement commercial.
        </div>

        <div className="mt-14 grid gap-5">
          {sections.map((section) => (
            <section key={section.title} className="rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-8">
              <h2 className="font-barlow text-2xl font-semibold tracking-[-0.025em]">{section.title}</h2>
              <div className="mt-4 space-y-4 text-[15px] leading-7 text-white/62 [&_a]:text-[#1f8a65] [&_a]:underline [&_a]:underline-offset-4 [&_strong]:font-semibold [&_strong]:text-white/85 [&_ul]:space-y-2 [&_ul]:pl-5 [&_li]:list-disc">
                {section.content}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap gap-5 border-t border-white/10 pt-8 font-barlow-condensed text-xs uppercase tracking-[0.14em] text-white/45">
          <Link href="/cookies" className="hover:text-white">Politique cookies</Link>
          <Link href="/mentions-legales" className="hover:text-white">Mentions légales</Link>
          <a href="mailto:contact@stryvlab.com" className="hover:text-white">Contact</a>
        </div>
      </div>
    </main>
  )
}
