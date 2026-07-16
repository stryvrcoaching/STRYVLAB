import { DocsArticle, DocsCard, DocsSection } from '@/components/docs/DocsArticle'
import { requireCoachDocsAccess } from '@/lib/docs/server'

export default async function CoachCycleSyncDocumentationPage() {
  await requireCoachDocsAccess()

  return (
    <DocsArticle
      eyebrow="Nutrition Studio"
      title="Cycle Sync — guide coach"
      intro="Cycle Sync aide à faire évoluer les objectifs nutritionnels et les portions du plan alimentaire selon le cycle renseigné par une cliente. Le coach construit une base solide ; le système applique ensuite une variation quotidienne explicable, prudente et réversible."
      backHref="/coach/documentation"
      backLabel="Documentation coach"
    >
      <DocsSection title="Ce que Cycle Sync fait — et ne fait pas">
        <p>
          Cycle Sync part du protocole que tu as construit : jours d’entraînement, jours de repos, calories, macros, repas, aliments et alternatives. Il ne remplace pas ta stratégie. Il ajoute une couche d’ajustement quand le cycle est activé et suffisamment renseigné.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <DocsCard title="Ce que le système fait">
            <p>
              Il identifie la phase estimée, tient compte de la fiabilité des dates de règles, ajuste les cibles du jour et adapte les portions autorisées du plan alimentaire. Les jours hauts, bas, entraînement et repos gardent leur logique initiale.
            </p>
          </DocsCard>
          <DocsCard title="Ce qu’il ne prétend pas faire">
            <p>
              Il ne diagnostique pas, ne confirme pas une ovulation, ne remplace pas un suivi médical et ne transforme pas un signal de fatigue ou de faim en modification automatique cachée.
            </p>
          </DocsCard>
        </div>
      </DocsSection>

      <DocsSection title="Mise en route en 4 étapes">
        <ol className="list-decimal space-y-2 pl-5">
          <li>Crée le protocole nutritionnel normalement : cibles, jours types et, si souhaité, plan alimentaire détaillé.</li>
          <li>Dans Nutrition Studio, ouvre <strong>Cycle Sync</strong>, active l’ajustement automatique et choisis le profil adapté.</li>
          <li>Demande à la cliente de renseigner son contexte de cycle dans le bilan, puis de confirmer le début et la fin des règles dans l’application.</li>
          <li>Partage le protocole. Le système applique ensuite la bonne version du jour, sans que la cliente ait à recalculer quoi que ce soit.</li>
        </ol>
        <p>
          Le bilan sert de premier repère. Les dates de début et de fin de règles confirmées dans l’application deviennent la source la plus utile pour recalibrer les estimations futures.
        </p>
      </DocsSection>

      <DocsSection title="Ce que la cliente doit faire">
        <div className="grid gap-4 md:grid-cols-2">
          <DocsCard title="Au début des règles">
            <p>
              Elle ouvre le bouton <strong>+</strong> de la barre de navigation, choisit <strong>Menstruation</strong>, puis indique « aujourd’hui est mon premier jour » ou sélectionne une date passée si nécessaire.
            </p>
          </DocsCard>
          <DocsCard title="À la fin des règles">
            <p>
              Elle revient au même endroit et confirme la fin des règles, aujourd’hui ou à une date passée. Cela améliore l’estimation de la durée menstruelle, sans lui demander de suivre chaque phase au quotidien.
            </p>
          </DocsCard>
        </div>
        <p>
          Les check-ins énergie, faim, stress et récupération sont utiles pour le contexte coach. Ils ne remplacent pas l’enregistrement des dates de règles et ne modifient pas seuls l’alimentation.
        </p>
      </DocsSection>

      <DocsSection title="Parcours complet : ce que voit le coach et ce que voit la cliente">
        <p>
          Tu n’as pas besoin de posséder un compte cliente féminin pour comprendre ou utiliser Cycle Sync. Le coach active et contrôle le cadre depuis Nutrition Studio ; la cliente reçoit une expérience volontairement simple dans son application.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <DocsCard title="1. Côté coach : préparer le cadre">
            <p>
              Tu construis le protocole nutritionnel normalement, actives Cycle Sync, choisis un profil et peux verrouiller les portions qui ne doivent pas changer. Nutrition Studio te montre la phase estimée, le niveau de confiance, les ajustements réellement appliqués et les observations de check-in.
            </p>
          </DocsCard>
          <DocsCard title="2. Côté cliente : donner le minimum utile">
            <p>
              La cliente peut fournir un premier repère dans le bilan. Ensuite, son seul geste important est de confirmer le début puis la fin des règles depuis le bouton <strong>+</strong> de la barre de navigation, en choisissant <strong>Menstruation</strong>.
            </p>
          </DocsCard>
          <DocsCard title="3. Ce que l’application cliente affiche">
            <p>
              Lorsque Cycle Sync est actif, elle voit sa phase actuelle, sa progression dans le cycle et un résumé clair des objectifs ajustés. Son plan alimentaire affiche déjà les portions du jour : elle n’a ni calcul à faire ni nouveau repas à construire.
            </p>
          </DocsCard>
          <DocsCard title="4. Après une confirmation de règles">
            <p>
              Une date de début ou de fin, même renseignée après coup, recale le cycle. Les objectifs et les portions des journées à venir se mettent alors à jour automatiquement. Les repas déjà consommés restent des données historiques.
            </p>
          </DocsCard>
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 text-sm leading-7 text-white/68">
          <pre className="whitespace-pre-wrap font-mono text-[12px] leading-6 text-white/72">{`Phrase simple à envoyer à la cliente
« Ton plan est déjà adapté automatiquement. Quand tes règles
commencent, ouvre le + en bas de l’app, choisis Menstruation
et confirme le premier jour. Fais la même chose quand elles se
terminent. Tu n’as rien d’autre à calculer. »`}</pre>
        </div>
      </DocsSection>

      <DocsSection title="Comment le plan se transforme concrètement">
        <p>
          Chaque matin, le système résout d’abord la journée prévue par le coach. Il sait donc si la cliente est sur un jour d’entraînement à `1 840 kcal`, un jour de repos à `1 699 kcal`, ou une autre journée de ton cycle de quatre semaines. Cycle Sync applique ensuite sa variation uniquement à cette journée active.
        </p>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 text-sm leading-7 text-white/68">
          <pre className="whitespace-pre-wrap font-mono text-[12px] leading-6 text-white/72">{`Exemple : jour d’entraînement
Base coach : 1 840 kcal · 130 P · 190 G · 60 L
Variation effective : +7 P · +13 G · +0 L

La structure reste identique :
  Petit-déjeuner : avoine, skyr, fruit
  Déjeuner : poulet, riz, légumes, huile
  Dîner : saumon, pommes de terre, légumes

Le système augmente seulement les portions autorisées
de protéines et de glucides. Il ne remplace pas les repas
et ne change pas la logique entraînement / repos.`}</pre>
        </div>
      </DocsSection>

      <DocsSection title="Comment les portions sont calculées">
        <p>
          Le moteur additionne les apports des aliments ajustables de la journée, calcule la variation demandée, puis répartit cette variation selon les règles que tu as posées dans le plan alimentaire. Après modification, les calories et les macros sont recalculées à partir des quantités finales.
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          <DocsCard title="Ajustable">
            <p>La portion peut évoluer. C’est le comportement normal pour un aliment de la catégorie protéines, glucides, fruits ou lipides.</p>
          </DocsCard>
          <DocsCard title="Fixe">
            <p>Tu verrouilles l’aliment. Il ne bougera jamais sous l’effet de Cycle Sync, même si un delta reste à couvrir.</p>
          </DocsCard>
          <DocsCard title="Prioritaire et borné">
            <p>Tu peux demander au moteur de privilégier un aliment et définir une portion minimale ou maximale. Le moteur respecte ces limites.</p>
          </DocsCard>
        </div>
        <p>
          Les alternatives reçoivent la même logique de portion. Si aucun aliment admissible n’existe pour couvrir un delta, le système n’invente pas de nourriture : il affiche un ajustement partiel au coach.
        </p>
      </DocsSection>

      <DocsSection title="Choisir le bon profil">
        <div className="grid gap-4 md:grid-cols-3">
          <DocsCard title="Prudent — 50 %">
            <p>À utiliser au démarrage, quand la cliente découvre le suivi, quand les données sont rares ou lorsqu’elle préfère des variations très discrètes.</p>
          </DocsCard>
          <DocsCard title="Standard — 100 %">
            <p>Le choix par défaut pour un cycle correctement suivi. La fiabilité des données peut tout de même réduire l’intensité appliquée.</p>
          </DocsCard>
          <DocsCard title="Personnalisé — 25 à 125 %">
            <p>Pour un coach qui veut moduler l’amplitude. À réserver à une décision assumée, observée et régulièrement réévaluée.</p>
          </DocsCard>
        </div>
        <p>
          Le profil ne contourne jamais la prudence du moteur. Une phase estimée, un cycle encore en apprentissage ou irrégulier entraîne une réduction automatique de l’amplitude appliquée.
        </p>
      </DocsSection>

      <DocsSection title="Confiance, régularité et apprentissage">
        <div className="grid gap-4 md:grid-cols-3">
          <DocsCard title="Estimé">
            <p>Le système dispose d’un premier repère mais de peu ou pas de dates confirmées. L’automatisation reste volontairement légère.</p>
          </DocsCard>
          <DocsCard title="En apprentissage">
            <p>Une ou plusieurs règles ont été renseignées. Le système construit progressivement une moyenne de durée et de phase.</p>
          </DocsCard>
          <DocsCard title="Calibré">
            <p>Plusieurs cycles confirmés sont disponibles. Le système peut appliquer le profil choisi avec une meilleure confiance.</p>
          </DocsCard>
        </div>
        <p>
          En cas de cycles irréguliers, Cycle Sync reste utile mais limite son amplitude. La bonne action n’est pas de forcer une prédiction : il faut encourager la cliente à confirmer ses prochaines dates de règles.
        </p>
      </DocsSection>

      <DocsSection title="Lire les observations de phase">
        <p>
          Nutrition Studio affiche, lorsque des check-ins existent, les moyennes d’énergie, de faim et de stress déjà observées sur la phase actuelle. Trois check-ins ou plus donnent un premier repère lisible ; en dessous, considère le signal comme exploratoire.
        </p>
        <p>
          Ces observations servent à préparer une conversation et à décider d’une éventuelle itération coach. Elles n’augmentent ni ne réduisent automatiquement les portions, afin d’éviter de confondre corrélation, fatigue ponctuelle et causalité.
        </p>
      </DocsSection>

      <DocsSection title="Scénarios fréquents">
        <div className="grid gap-4 md:grid-cols-2">
          <DocsCard title="Plan fixe tous les jours">
            <p>Le coach crée une seule journée type. Cycle Sync conserve les mêmes repas et répartit ses variations sur les portions autorisées de cette journée.</p>
          </DocsCard>
          <DocsCard title="Jours entraînement et repos">
            <p>Le coach définit deux journées types. Le système sélectionne d’abord le bon jour, puis applique la variation de cycle. Un jour de repos ne devient jamais un jour d’entraînement.</p>
          </DocsCard>
          <DocsCard title="Cycle de quatre semaines">
            <p>Les cases de calendrier et les variations prévues par le coach restent la base. Cycle Sync est une couche quotidienne au-dessus, sans dupliquer le programme.</p>
          </DocsCard>
          <DocsCard title="Date de règles corrigée après coup">
            <p>La cliente peut saisir une date passée. Le moteur recalcule alors la phase en cours et les prochains jours visibles se réalignent sur cette information.</p>
          </DocsCard>
        </div>
      </DocsSection>

      <DocsSection title="Routine de contrôle coach">
        <ol className="list-decimal space-y-2 pl-5">
          <li>À la création : active Cycle Sync, choisis le profil et verrouille les aliments qui ne doivent jamais bouger.</li>
          <li>Au partage : explique à la cliente qu’elle n’a qu’à confirmer début et fin des règles.</li>
          <li>Au suivi : regarde la phase, la confiance, la régularité et les observations de check-in dans Nutrition Studio.</li>
          <li>À l’itération : ajuste le profil, les bornes ou le plan de base uniquement si le contexte le justifie.</li>
        </ol>
      </DocsSection>

      <DocsSection title="Limites et garde-fous importants">
        <div className="grid gap-4 md:grid-cols-2">
          <DocsCard title="Quand désactiver ou ne pas activer">
            <p>Ne l’utilise pas comme outil de diagnostic. Désactive-le si la cliente n’a pas de cycle actif, ne souhaite pas le suivre, ou lorsque le contexte nécessite un avis médical ou diététique spécialisé.</p>
          </DocsCard>
          <DocsCard title="Ce qui est protégé">
            <p>Le protocole de base du coach n’est pas écrasé. Les repas déjà loggés restent historiques. Les ajustements sont calculés à partir de la date, du protocole actif et des règles de portions du moment.</p>
          </DocsCard>
        </div>
        <p>
          Cycle Sync est un outil de soutien à la décision et à l’exécution. En cas de douleur inhabituelle, de saignements anormaux, de grossesse, de post-partum, de changement de contraception ou de préoccupation de santé, la cliente doit se tourner vers un professionnel de santé compétent.
        </p>
      </DocsSection>
    </DocsArticle>
  )
}
