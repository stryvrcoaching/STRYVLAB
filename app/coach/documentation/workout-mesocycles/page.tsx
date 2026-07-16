import { DocsArticle, DocsCard, DocsSection } from '@/components/docs/DocsArticle'
import { requireCoachDocsAccess } from '@/lib/docs/server'

export default async function CoachWorkoutMesocyclesDocumentationPage() {
  await requireCoachDocsAccess()

  return (
    <DocsArticle
      eyebrow="Workout Studio"
      title="Comment générer et utiliser un mésocycle"
      intro="Ce guide explique comment transformer une ou plusieurs semaines déjà construites en un cycle progressif de 2 à 12 semaines, comment lire l’aperçu et ce qui est réellement modifié au moment de l’application."
      backHref="/coach/documentation"
      backLabel="Documentation coach"
    >
      <DocsSection title="À quoi sert le générateur">
        <p>
          Le générateur de mésocycle évite de dupliquer puis de modifier manuellement chaque semaine. Il part de séances déjà construites par le coach et produit une progression cohérente du nombre de séries et du RIR cible.
        </p>
        <p>
          Cette première version est déterministe et n’utilise pas d’intelligence artificielle. Deux coachs appliquant les mêmes paramètres à la même semaine source obtiennent donc exactement le même résultat.
        </p>
      </DocsSection>

      <DocsSection title="Avant de commencer">
        <div className="grid gap-4 md:grid-cols-2">
          <DocsCard title="Construire la base">
            <p>
              Crée d’abord une semaine exploitable avec les bonnes séances, les bons exercices, les séries, les répétitions, les temps de repos, les tempos et les RIR de référence.
            </p>
          </DocsCard>
          <DocsCard title="Enregistrer les dernières modifications">
            <p>
              Le bouton Mésocycle enregistre la semaine active avant d’ouvrir le générateur. Vérifie néanmoins que la structure affichée correspond bien à la base que tu veux multiplier.
            </p>
          </DocsCard>
          <DocsCard title="Choisir une source logique">
            <p>
              Une semaine source doit représenter une structure réellement utilisable. Le générateur ajuste la dose de travail, mais il ne remplace pas un mauvais choix d’exercices ou une mauvaise répartition des séances.
            </p>
          </DocsCard>
          <DocsCard title="Prévisualiser avant d’appliquer">
            <p>
              L’aperçu est sans effet sur le programme. Il doit toujours être utilisé pour vérifier les volumes, les RIR et l’alternance des semaines avant la validation finale.
            </p>
          </DocsCard>
        </div>
      </DocsSection>

      <DocsSection title="Parcours recommandé">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 text-sm leading-7 text-white/68">
          <pre className="whitespace-pre-wrap font-mono text-[12px] leading-6 text-white/72">{`1. Ouvrir le programme dans Workout Studio
2. Vérifier la ou les semaines qui serviront de base
3. Cliquer sur Mésocycle
4. Choisir les semaines sources et la durée
5. Régler la progression du volume et du RIR
6. Ajouter ou non une semaine de deload
7. Cliquer sur Prévisualiser
8. Contrôler chaque carte de semaine
9. Cliquer sur Appliquer le mésocycle uniquement si l’aperçu est correct`}</pre>
        </div>
      </DocsSection>

      <DocsSection title="1. Choisir les semaines sources">
        <div className="grid gap-4 md:grid-cols-2">
          <DocsCard title="Semaine active uniquement">
            <p>
              Toutes les semaines générées reprennent la structure de la semaine actuellement affichée. C’est le choix le plus simple pour transformer une semaine type en cycle progressif.
            </p>
          </DocsCard>
          <DocsCard title="Toutes les semaines existantes">
            <p>
              Les semaines sources sont utilisées à tour de rôle. Avec deux sources A et B, le cycle suit A, B, A, B, puis continue cette alternance jusqu’à la durée choisie.
            </p>
          </DocsCard>
        </div>
        <p>
          Le générateur conserve les séances et les exercices de la semaine source sélectionnée pour chaque position. Il ne fusionne pas les exercices de plusieurs semaines dans une seule semaine.
        </p>
      </DocsSection>

      <DocsSection title="2. Régler la durée">
        <p>
          Un mésocycle peut contenir entre `2` et `12` semaines. Si le deload final est activé, il est inclus dans cette durée. Un cycle de `6 semaines` avec deload contient donc `5 semaines de construction` et `1 semaine de décharge`.
        </p>
      </DocsSection>

      <DocsSection title="Supprimer une semaine ajoutée">
        <p>
          Dans la barre du cycle, sélectionne la semaine concernée puis clique sur `Supprimer`. La confirmation indique combien de séances vont disparaître, avec tous leurs exercices associés.
        </p>
        <p>
          Après validation, Workout Studio ouvre automatiquement une semaine voisine et renumérote les semaines standards. Les noms personnalisés sont conservés. La dernière semaine du cycle ne peut jamais être supprimée : un programme doit toujours garder une base exploitable.
        </p>
      </DocsSection>

      <DocsSection title="3. Comprendre la progression du volume">
        <div className="grid gap-4 md:grid-cols-2">
          <DocsCard title="Progression linéaire">
            <p>
              Le moteur répartit progressivement le volume entre le pourcentage de départ et le pourcentage d’arrivée. La dernière semaine de construction atteint la valeur d’arrivée.
            </p>
          </DocsCard>
          <DocsCard title="Volume stable">
            <p>
              Toutes les semaines de construction utilisent le pourcentage de départ. Ce mode est utile pour conserver une dose identique tout en faisant évoluer uniquement le RIR.
            </p>
          </DocsCard>
        </div>
        <p>
          Le pourcentage est appliqué exercice par exercice au nombre de séries de la semaine source. Le résultat est arrondi à la série entière la plus proche, puis limité par les garde-fous minimum et maximum.
        </p>
      </DocsSection>

      <DocsSection title="4. Comprendre la progression du RIR">
        <p>
          Le RIR indique le nombre estimé de répétitions encore possibles avant l’échec. Une progression de `RIR 3` vers `RIR 1` rend donc les semaines progressivement plus exigeantes.
        </p>
        <p>
          Le moteur répartit le RIR sur les semaines de construction et arrondit les valeurs par pas de `0,5`. Le RIR calculé est appliqué à l’exercice et à chacune de ses prescriptions de série.
        </p>
      </DocsSection>

      <DocsSection title="5. Utiliser le deload">
        <p>
          Quand le deload final est actif, la dernière semaine ne suit plus la progression normale. Elle utilise son propre pourcentage de volume et son propre RIR afin de réduire la fatigue accumulée.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <DocsCard title="Volume deload">
            <p>
              Une valeur de `60 %` transforme par exemple un exercice de `4 séries` en environ `2 séries`, sous réserve des règles d’arrondi et du minimum autorisé.
            </p>
          </DocsCard>
          <DocsCard title="RIR deload">
            <p>
              Un `RIR 4` garde davantage de répétitions en réserve et réduit la proximité de l’échec pendant la semaine de récupération.
            </p>
          </DocsCard>
        </div>
      </DocsSection>

      <DocsSection title="Exemple concret — une semaine type vers six semaines">
        <p>
          La semaine source contient un exercice à `4 séries`. Le coach choisit un cycle de `6 semaines`, un volume linéaire de `100 %` à `120 %`, un RIR de `3` à `1`, puis un deload final à `60 %` et `RIR 4`.
        </p>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 text-sm leading-7 text-white/68">
          <pre className="whitespace-pre-wrap font-mono text-[12px] leading-6 text-white/72">{`Semaine 1 · Base         · 100 % · RIR 3   · 4 séries
Semaine 2 · Construction · 105 % · RIR 2,5 · 4 séries
Semaine 3 · Construction · 110 % · RIR 2   · 4 séries
Semaine 4 · Construction · 115 % · RIR 1,5 · 5 séries
Semaine 5 · Surcharge    · 120 % · RIR 1   · 5 séries
Semaine 6 · Deload       ·  60 % · RIR 4   · 2 séries`}</pre>
        </div>
        <p>
          Les pourcentages décrivent la courbe souhaitée. Le nombre final de séries dépend de l’arrondi effectué séparément sur chaque exercice. Le total affiché dans l’aperçu reste donc une estimation globale utile pour contrôler la tendance.
        </p>
      </DocsSection>

      <DocsSection title="Exemple concret — alterner deux semaines">
        <p>
          Le coach possède une semaine A orientée haut du corps et une semaine B orientée bas du corps. Il choisit “Toutes les semaines existantes” et génère cinq semaines sans deload.
        </p>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 text-sm leading-7 text-white/68">
          <pre className="whitespace-pre-wrap font-mono text-[12px] leading-6 text-white/72">{`Semaine 1 reprend la source A
Semaine 2 reprend la source B
Semaine 3 reprend la source A
Semaine 4 reprend la source B
Semaine 5 reprend la source A

Chaque semaine reçoit ensuite son propre volume et son propre RIR.`}</pre>
        </div>
      </DocsSection>

      <DocsSection title="Ce que l’aperçu permet de contrôler">
        <div className="grid gap-4 md:grid-cols-2">
          <DocsCard title="Source">
            <p>La semaine d’origine utilisée pour construire chaque semaine du futur cycle.</p>
          </DocsCard>
          <DocsCard title="Type de semaine">
            <p>Base, construction, surcharge ou deload selon sa position dans la progression.</p>
          </DocsCard>
          <DocsCard title="Volume et RIR">
            <p>Le pourcentage de volume et la cible d’effort qui seront appliqués à la semaine.</p>
          </DocsCard>
          <DocsCard title="Projection globale">
            <p>Le passage estimé du total de séries source vers le total de séries projeté.</p>
          </DocsCard>
        </div>
      </DocsSection>

      <DocsSection title="Ce qui se passe quand le coach clique sur Appliquer">
        <p>
          L’application remplace les semaines actuelles du programme par les semaines visibles dans l’aperçu. Cette opération porte sur la structure du cycle entier, pas uniquement sur la semaine affichée.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <DocsCard title="Structure remplacée">
            <p>
              Les nouvelles semaines, séances et prescriptions deviennent la structure active utilisée par Workout Studio et par l’application client.
            </p>
          </DocsCard>
          <DocsCard title="Historique conservé">
            <p>
              Les identifiants de lignée relient les éléments générés à leurs sources afin de préserver la continuité des historiques d’entraînement.
            </p>
          </DocsCard>
          <DocsCard title="Application sécurisée">
            <p>
              Le nouveau cycle est préparé avant le remplacement. Si la finalisation échoue, l’ancien cycle reste en place au lieu de laisser un programme partiellement généré.
            </p>
          </DocsCard>
          <DocsCard title="Cycle visible côté client">
            <p>
              Les séances proposées au client suivent ensuite l’ordre des semaines et le comportement choisi à la fin du cycle : recommencer, conserver la dernière semaine ou terminer.
            </p>
          </DocsCard>
        </div>
      </DocsSection>

      <DocsSection title="Garde-fous et exceptions">
        <div className="grid gap-4 md:grid-cols-2">
          <DocsCard title="Maximum de séries">
            <p>
              La limite empêche un pourcentage élevé de produire un nombre excessif de séries sur un exercice. La valeur par défaut est `8 séries` par exercice.
            </p>
          </DocsCard>
          <DocsCard title="Minimum de séries">
            <p>
              Un exercice de musculation qui possédait des séries conserve au moins le minimum de sécurité prévu par le moteur.
            </p>
          </DocsCard>
          <DocsCard title="Cardio, temps et distance">
            <p>
              Les exercices dont l’exécution est basée sur le temps, la distance ou un format différent de séries-répétitions-RIR ne sont pas modifiés par cette version.
            </p>
          </DocsCard>
          <DocsCard title="Limites du moteur">
            <p>
              Le système dose une structure existante. Il ne juge pas encore automatiquement si la sélection d’exercices, la fréquence musculaire ou la stratégie choisie sont optimales pour ce client.
            </p>
          </DocsCard>
        </div>
      </DocsSection>

      <DocsSection title="Erreurs fréquentes à éviter">
        <div className="grid gap-4 md:grid-cols-2">
          <DocsCard title="Appliquer sans lire l’aperçu">
            <p>
              Le bouton d’application remplace le cycle actuel. Vérifie toujours les sources, le volume, le RIR et le deload avant de valider.
            </p>
          </DocsCard>
          <DocsCard title="Confondre volume global et séries exactes">
            <p>
              Une hausse de `10 %` ne garantit pas une série supplémentaire sur tous les exercices. L’arrondi est réalisé exercice par exercice.
            </p>
          </DocsCard>
          <DocsCard title="Descendre trop vite vers l’échec">
            <p>
              Une progression agressive du volume combinée à un RIR très bas peut augmenter rapidement la fatigue. La courbe doit rester cohérente avec le niveau et la récupération du client.
            </p>
          </DocsCard>
          <DocsCard title="Utiliser une mauvaise semaine source">
            <p>
              Le moteur reproduit fidèlement la structure choisie. Une erreur de séance ou de prescription dans la source sera donc répétée dans le cycle généré.
            </p>
          </DocsCard>
        </div>
      </DocsSection>

      <DocsSection title="Règle simple de décision">
        <p>
          Utilise une semaine source quand la structure est déjà bonne et que tu veux programmer la dose de travail. Utilise plusieurs semaines sources quand l’alternance fait partie du programme. Dans les deux cas, considère l’aperçu comme l’étape obligatoire entre le paramétrage et l’application.
        </p>
      </DocsSection>
    </DocsArticle>
  )
}
