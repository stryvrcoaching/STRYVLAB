import { DocsArticle, DocsCard, DocsSection } from '@/components/docs/DocsArticle'
import { requireCoachDocsAccess } from '@/lib/docs/server'

export default async function CoachNutritionSmoothingDocumentationPage() {
  await requireCoachDocsAccess()

  return (
    <DocsArticle
      eyebrow="Nutrition Studio"
      title="Comment fonctionne le lissage calorique coach"
      intro="Cette documentation explique quand le système recommande un lissage, comment l’écart est calculé, comment il est réparti sur les jours futurs et ce qui est réellement modifié dans le plan alimentaire du client."
      backHref="/coach/documentation"
      backLabel="Documentation coach"
    >
      <DocsSection title="À quoi sert cet outil">
        <p>
          Le lissage calorique coach sert à absorber intelligemment un écart significatif entre l’objectif calorique prévu et la consommation réelle d’une journée.
        </p>
        <p>
          Son objectif n’est pas de retoucher le passé. Il sert à ajuster proprement les jours à venir quand un client a mangé sensiblement plus ou moins que prévu, sans obliger le coach à recalculer manuellement chaque repas du plan.
        </p>
      </DocsSection>

      <DocsSection title="Quand une recommandation apparaît">
        <p>
          Le moteur compare la cible calorique du jour et les calories réellement consommées. Une recommandation n’apparaît pas au moindre écart. Il faut d’abord que la journée soit suffisamment renseignée, puis que l’écart soit assez significatif pour justifier une action.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <DocsCard title="Conditions minimales">
            <p>
              Le système attend une journée exploitable. En pratique, il faut assez de repas loggés ou une couverture calorique suffisante pour que la lecture ne soit pas trop fragile.
            </p>
          </DocsCard>
          <DocsCard title="Seuil d’utilité">
            <p>
              Un lissage n’est proposé que si l’écart dépasse un seuil utile. L’idée est d’éviter de créer du bruit pour des micro-écarts qui ne justifient pas une intervention coach.
            </p>
          </DocsCard>
        </div>
      </DocsSection>

      <DocsSection title="Ce que signifient surplus et déficit">
        <div className="grid gap-4 md:grid-cols-2">
          <DocsCard title="Surplus">
            <p>
              Le client a consommé plus que la cible du jour. Le système peut alors recommander une réduction répartie sur les jours suivants.
            </p>
          </DocsCard>
          <DocsCard title="Déficit">
            <p>
              Le client a consommé moins que la cible du jour. Le système peut alors recommander une réinjection sur les jours suivants.
            </p>
          </DocsCard>
        </div>
      </DocsSection>

      <DocsSection title="Comment la répartition est calculée">
        <p>
          Le coach choisit une durée de répartition, par exemple `3`, `4`, `5`, `7` ou `10` jours. Le moteur répartit ensuite l’écart sur ces jours futurs uniquement.
        </p>
        <p>
          Le passé ne change jamais. La journée source reste un constat. Le lissage agit ensuite comme une correction prospective appliquée au protocole actif du client.
        </p>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 text-sm leading-7 text-white/68">
          <pre className="whitespace-pre-wrap font-mono text-[12px] leading-6 text-white/72">{`Exemple 1
Objectif du jour : 2000 kcal
Consommé : 2400 kcal
Écart : +400 kcal

Si le coach choisit 4 jours :
  Jour +1 : -100 kcal
  Jour +2 : -100 kcal
  Jour +3 : -100 kcal
  Jour +4 : -100 kcal

Exemple 2
Objectif du jour : 2100 kcal
Consommé : 1800 kcal
Écart : -300 kcal

Si le coach choisit 3 jours :
  Jour +1 : +100 kcal
  Jour +2 : +100 kcal
  Jour +3 : +100 kcal`}
          </pre>
        </div>
      </DocsSection>

      <DocsSection title="Ce que le système modifie réellement">
        <div className="grid gap-4 md:grid-cols-2">
          <DocsCard title="Sans plan alimentaire coach">
            <p>
              Le lissage agit sur les cibles futures, mais il n’y a pas de repas coach à recalibrer automatiquement. Le coach garde donc une lecture de l’ajustement sans structure repas détaillée à propager.
            </p>
          </DocsCard>
          <DocsCard title="Avec plan alimentaire coach">
            <p>
              Si un plan alimentaire existe sur les jours futurs concernés, le système recalibre automatiquement les repas à partir du protocole partagé. Les quantités sont ajustées pour refléter la nouvelle cible du jour.
            </p>
          </DocsCard>
          <DocsCard title="Ce qui ne change pas">
            <p>
              Le protocole historique de base n’est pas réécrit rétroactivement. Le système applique des ajustements datés sur les prépas futures plutôt que de casser la structure source.
            </p>
          </DocsCard>
          <DocsCard title="Ce que voit le client">
            <p>
              Le client ne voit pas l’outil de lissage. Il voit uniquement le plan résultant, déjà ajusté par le coach.
            </p>
          </DocsCard>
        </div>
      </DocsSection>

      <DocsSection title="Logique exacte d’impact sur le plan alimentaire">
        <p>
          Le moteur ne réécrit pas brutalement le protocole source. Il part du jour nutritionnel partagé, calcule la nouvelle cible calorique du jour ajusté, puis applique un coefficient de recalibrage à tous les repas coach de ce jour.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <DocsCard title="1. Calcul du coefficient">
            <p>
              Le coefficient est calculé ainsi : cible ajustée du jour ÷ cible de base du jour. Si un jour devait passer de `2000 kcal` à `1800 kcal`, le coefficient devient `0,90`.
            </p>
          </DocsCard>
          <DocsCard title="2. Effet sur les quantités">
            <p>
              Chaque quantité en grammes du repas source est multipliée par ce coefficient. Le système fait la même chose pour les alternatives enregistrées sur ce repas.
            </p>
          </DocsCard>
          <DocsCard title="3. Effet sur les calories et macros">
            <p>
              Les calories et les macros sont ensuite recalculées à partir des nouvelles quantités. Ce n’est donc pas un simple badge visuel : le contenu nutritionnel réel du repas préparé change.
            </p>
          </DocsCard>
          <DocsCard title="4. Ce qui est protégé">
            <p>
              Si un repas futur a déjà été loggé, il n’est pas écrasé. Et si un prep coach existait déjà sur ce créneau, le système garde un snapshot pour pouvoir restaurer l’état précédent en cas d’annulation du lissage.
            </p>
          </DocsCard>
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 text-sm leading-7 text-white/68">
          <pre className="whitespace-pre-wrap font-mono text-[12px] leading-6 text-white/72">{`Exemple
Jour de base : 2000 kcal
Jour ajusté : 1800 kcal
Coefficient : 1800 / 2000 = 0,90

Repas source
  Riz 150 g
  Poulet 180 g
  Huile 10 g

Repas ajusté
  Riz 135 g
  Poulet 162 g
  Huile 9 g

Le repas final est donc réellement plus léger, et ses calories/macros sont recalculées à partir de ces nouvelles quantités.`}
          </pre>
        </div>
      </DocsSection>

      <DocsSection title="Comment lire la prévisualisation">
        <p>
          Avant application, le coach voit les jours impactés, la cible calorique de base, la cible ajustée, et le nombre de repas coach recalibrés sur chaque journée.
        </p>
        <p>
          Cette prévisualisation sert à répondre à une question simple : est-ce que la redistribution proposée reste cohérente avec l’intention nutritionnelle du protocole ?
        </p>
      </DocsSection>

      <DocsSection title="Quand il vaut mieux appliquer un lissage">
        <div className="grid gap-4 md:grid-cols-2">
          <DocsCard title="Cas pertinent">
            <p>
              Un écart clair, ponctuel, sur un client adhérent au protocole, quand on veut lisser proprement sans tout reconstruire à la main.
            </p>
          </DocsCard>
          <DocsCard title="Cas moins pertinent">
            <p>
              Des logs incomplets, une journée ambiguë, ou un problème structurel du protocole lui-même. Dans ce cas, mieux vaut corriger le protocole ou la structure des repas plutôt que lisser un signal peu fiable.
            </p>
          </DocsCard>
        </div>
      </DocsSection>

      <DocsSection title="Erreurs d’interprétation à éviter">
        <div className="grid gap-4 md:grid-cols-2">
          <DocsCard title="Croire que le lissage corrige une mauvaise stratégie">
            <p>
              Le lissage corrige un écart ponctuel. Il ne remplace pas une refonte de protocole si la structure nutritionnelle est elle-même inadaptée.
            </p>
          </DocsCard>
          <DocsCard title="Lisser sur trop de jours sans intention">
            <p>
              Plus la répartition est longue, plus l’impact journalier est discret. Cela peut être utile, mais il faut que ce choix reste cohérent avec le contexte du client et le rythme du protocole.
            </p>
          </DocsCard>
          <DocsCard title="Appliquer un lissage sur une journée mal loggée">
            <p>
              Si la journée source est pauvrement renseignée, la recommandation perd en qualité. Le coach doit alors investiguer avant d’agir.
            </p>
          </DocsCard>
          <DocsCard title="Confondre invisibilité client et absence d’impact">
            <p>
              Le client ne voit pas l’outil, mais le plan futur change réellement si le coach applique l’ajustement.
            </p>
          </DocsCard>
        </div>
      </DocsSection>
    </DocsArticle>
  )
}
