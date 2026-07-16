import { DocsArticle, DocsCard, DocsSection } from '@/components/docs/DocsArticle'
import { requireCoachDocsAccess } from '@/lib/docs/server'

export default async function CoachNutritionCoherenceDocumentationPage() {
  await requireCoachDocsAccess()

  return (
    <DocsArticle
      eyebrow="Nutrition Studio"
      title="Score de cohérence et qualité des données"
      intro="Cette documentation explique comment l'algorithme évalue la précision et la rigueur du logging de votre client, et comment interpréter le score de cohérence avant de prendre des décisions d'ajustement du protocole."
      backHref="/coach/documentation"
      backLabel="Documentation coach"
    >
      <DocsSection title="Pourquoi la qualité des données est essentielle">
        <p>
          Toutes les recommandations intelligentes du Nutrition Studio (TDEE adaptatif, lissage calorique, ajustement des macros) reposent sur les données de logs fournies par le client (pesées et repas).
        </p>
        <p>
          Si un client logue de façon irrégulière ou incomplète, le moteur métabolique va traiter des informations partielles et risquerait de proposer des ajustements inadaptés. Le <strong>Score de Cohérence</strong> sert de filtre de sécurité pour le coach.
        </p>
      </DocsSection>

      <DocsSection title="Comment le score de cohérence est calculé">
        <p>
          L'algorithme analyse l'historique récent du client (généralement les 7 à 14 derniers jours) selon trois dimensions critiques :
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <DocsCard title="1. La régularité des pesées">
            <p>
              Pour obtenir une pente de poids biologiquement fiable, le système a besoin d'une densité de pesées régulière (idéalement 4 fois ou plus par semaine). Trop peu de pesées augmente le bruit causé par les variations d'eau quotidiennes.
            </p>
          </DocsCard>
          <DocsCard title="2. La complétude du journal nutritionnel">
            <p>
              Le système évalue si les repas saisis représentent une journée complète ou s'il y a des omissions manifestes (jours "blancs" ou repas oubliés).
            </p>
          </DocsCard>
          <DocsCard title="3. L'écart aux cibles (Adhérence)">
            <p>
              Le moteur compare la consommation réelle moyenne de calories et de protéines avec les cibles fixées par le protocole. Moins l'écart est grand, plus le comportement alimentaire du client est prévisible et stable.
            </p>
          </DocsCard>
          <DocsCard title="4. Indice de confiance final">
            <p>
              En combinant ces facteurs, le système attribue un indice de confiance au calcul (<strong>Élevé, Moyen, Faible</strong>) qui s'affiche à côté du TDEE adaptatif.
            </p>
          </DocsCard>
        </div>
      </DocsSection>

      <DocsSection title="Interpréter le score de cohérence pour l'action">
        <div className="grid gap-4 md:grid-cols-2">
          <DocsCard title="Score ≥ 80 % (Confiance Élevée)">
            <p>
              Le client est très rigoureux. Les données de poids et d'apport calorique sont extrêmement fiables. Le TDEE adaptatif calculé est physiologiquement vrai ; le coach peut l'utiliser pour réajuster le protocole ou recalibrer les objectifs en toute sécurité.
            </p>
          </DocsCard>
          <DocsCard title="Score entre 50 % et 79 % (Confiance Moyenne)">
            <p>
              Le logging présente des lacunes mineures (quelques pesées oubliées ou journées incomplètes). Le TDEE calculé donne une bonne tendance mais doit être appliqué avec précaution. Il est conseillé de surveiller la tendance sans rescaler immédiatement le plan.
            </p>
          </DocsCard>
          <DocsCard title="Score < 50 % (Confiance Faible / Alerte Proxy)">
            <p>
              Les données sont trop incomplètes. Le système désactive l'ancrage adaptatif précis et bascule sur des formules théoriques par défaut (Proxy). <strong>Le coach ne doit pas appliquer le TDEE adaptatif</strong> et doit d'abord sensibiliser le client à la régularité des logs.
            </p>
          </DocsCard>
          <DocsCard title="Jours vides (Non loggés)">
            <p>
              Les jours sans aucune donnée saisie ne sont pas évalués à 0 kcal (ce qui ruinerait la moyenne d'apports), mais sont identifiés comme manquants, ce qui dégrade proportionnellement l'indice de confiance du TDEE adaptatif.
            </p>
          </DocsCard>
        </div>
      </DocsSection>

      <DocsSection title="Bonnes pratiques coach">
        <div className="grid gap-4 md:grid-cols-2">
          <DocsCard title="Ce qu'il faut faire">
            <p>
              • Vérifier le score de cohérence avant chaque bilan ou ajustement nutritionnel.<br />
              • Expliquer au client qu'un logging rigoureux est indispensable pour que les calculs de son métabolisme s'ajustent correctement.<br />
              • Utiliser les notifications de rappel de pesées et de repas en cas de baisse de la qualité des données.
            </p>
          </DocsCard>
          <DocsCard title="Ce qu'il faut éviter">
            <p>
              • Prendre des décisions de restructuration calorique majeure si le score de cohérence est faible.<br />
              • Croire qu'un client qui consomme 1000 kcal de moins que sa cible « stagne » sans vérifier s'il a simplement arrêté de logger la seconde moitié de ses journées.<br />
              • Ignorer les avertissements de données manquantes (Proxy) affichés dans le Nutrition Studio.
            </p>
          </DocsCard>
        </div>
      </DocsSection>
    </DocsArticle>
  )
}
