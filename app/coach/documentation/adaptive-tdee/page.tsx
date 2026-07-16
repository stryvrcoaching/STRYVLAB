import { DocsArticle, DocsCard, DocsSection } from '@/components/docs/DocsArticle'
import { requireCoachDocsAccess } from '@/lib/docs/server'

export default async function CoachAdaptiveTdeeDocumentationPage() {
  await requireCoachDocsAccess()

  return (
    <DocsArticle
      eyebrow="Nutrition Studio"
      title="Comment fonctionne le TDEE adaptatif"
      intro="Cette documentation détaille le fonctionnement du moteur de régression métabolique, la période de calibrage de 14 jours indispensable en début de protocole, et comment analyser les fluctuations du client sans sur-réagir aux bruits physiologiques."
      backHref="/coach/documentation"
      backLabel="Documentation coach"
    >
      <DocsSection title="À quoi sert le TDEE adaptatif">
        <p>
          Le TDEE adaptatif (Total Daily Energy Expenditure) estime la dépense énergétique réelle de maintien de votre client en temps réel.
        </p>
        <p>
          Contrairement aux formules statiques (Harris-Benedict, Katch-McArdle) qui ne se basent que sur la taille, le poids et un coefficient d'activité estimatif, le TDEE adaptatif analyse continuellement le rapport mathématique entre les calories ingérées par le client et l'évolution réelle de son poids sur la balance.
        </p>
      </DocsSection>

      <DocsSection title="L'importance de la période de calibrage (14 jours)">
        <p>
          Lorsqu'un client démarre un nouveau protocole (en particulier une sèche ou un rebond glucidique), son corps subit des variations de poids brutales liées à l'eau intramusculaire, aux stocks de glycogène et au contenu intestinal.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <DocsCard title="Les 14 premiers jours">
            <p>
              Le système nécessite <strong>au moins 14 jours de données consécutives</strong> après le partage du protocole pour pouvoir s'ancrer statistiquement dessus. Durant cette phase, l'algorithme est en phase de calibrage. Les variations d'eau initiales peuvent temporairement gonfler ou sous-évaluer la dépense brute calculée.
            </p>
          </DocsCard>
          <DocsCard title="La bascule automatique">
            <p>
              Si le protocole a moins de 14 jours, le moteur bascule par défaut sur une fenêtre glissante de 14 jours (incluant les logs et pesées précédant la création du protocole) pour maintenir une taille d'échantillon statistiquement robuste.
            </p>
          </DocsCard>
        </div>
      </DocsSection>

      <DocsSection title="Le fonctionnement du moteur mathématique">
        <p>
          Le moteur calcule le TDEE observé à l'aide d'une régression linéaire lissée et de filtres physiologiques.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <DocsCard title="1. Lissage du poids sur 3 jours">
            <p>
              Pour éliminer le bruit des pesées journalières (liées au sommeil, au stress ou au sodium), le système applique d'abord une moyenne mobile sur le poids avant de calculer la pente d'évolution.
            </p>
          </DocsCard>
          <DocsCard title="2. Correction de phase lutéale">
            <p>
              Chez les clientes, si la synchronisation du cycle menstruel est activée, le moteur applique une soustraction automatique de <code>0,8 kg</code> sur les pesées durant la phase lutéale pour éviter de confondre la rétention d'eau cyclique avec un ralentissement métabolique.
            </p>
          </DocsCard>
          <DocsCard title="3. Formule de base">
            <p>
              <code>TDEE = Apport Moyen − (Pente du Poids × 7700)</code>
              <br />
              Une pente négative (perte de poids) augmente le TDEE par rapport aux calories consommées, tandis qu'une pente positive (prise de poids) le diminue.
            </p>
          </DocsCard>
          <DocsCard title="4. Indice de confiance">
            <p>
              La confiance (Haute, Moyenne, Basse) dépend de la fréquence des pesées (idéalement ≥ 4 par semaine) et de la précision des journaux de repas enregistrés (logs réels vs protocole théorique).
            </p>
          </DocsCard>
        </div>
      </DocsSection>

      <DocsSection title="Les règles anti-bruit et la transition stable">
        <p>
          Le moteur applique un système de filtres rigoureux pour éviter que le TDEE du client ne fluctue de manière anarchique au jour le jour.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <DocsCard title="Écart < 50 kcal">
            <p>
              Considéré comme du bruit pur. Le TDEE stable du client reste inchangé.
            </p>
          </DocsCard>
          <DocsCard title="Écart entre 50 et 99 kcal">
            <p>
              Le système place la valeur sous surveillance (statut <code>watch</code>) sans modifier immédiatement la base client.
            </p>
          </DocsCard>
          <DocsCard title="Écart ≥ 100 kcal cohérents">
            <p>
              Si l'écart persiste sur au moins 2 calculs consécutifs, le système favorise une mise à jour lissée (statut <code>action</code>).
            </p>
          </DocsCard>
          <DocsCard title="Écart ≥ 150 kcal (Forte confiance)">
            <p>
              La promotion vers la nouvelle valeur stable est accélérée pour réagir rapidement à un changement métabolique franc.
            </p>
          </DocsCard>
        </div>
      </DocsSection>

      <DocsSection title="Bonnes pratiques coach">
        <div className="grid gap-4 md:grid-cols-2">
          <DocsCard title="Ce qu'il faut faire">
            <p>
              • Laisser passer les 14 premiers jours d'un nouveau protocole avant de prendre des décisions basées sur le TDEE adaptatif.<br />
              • Encourager le client à se peser régulièrement (au moins 4 fois par semaine) pour optimiser l'indice de confiance.<br />
              • Utiliser le lissage calorique pour compenser les écarts journaliers isolés plutôt que de recalculer le TDEE.
            </p>
          </DocsCard>
          <DocsCard title="Ce qu'il faut éviter">
            <p>
              • Recalculer ou réajuster les calories du protocole à chaque petite variation du TDEE.<br />
              • Appliquer le TDEE adaptatif sur un client qui logue ses repas de façon très irrégulière ou incomplète.<br />
              • Confondre la valeur brute du TDEE calculé avec l'objectif calorique quotidien ciblé.
            </p>
          </DocsCard>
        </div>
      </DocsSection>
    </DocsArticle>
  )
}
