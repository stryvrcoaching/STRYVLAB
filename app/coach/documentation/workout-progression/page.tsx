import { DocsArticle, DocsCard, DocsSection } from '@/components/docs/DocsArticle'
import { requireCoachDocsAccess } from '@/lib/docs/server'

export default async function CoachWorkoutProgressionDocumentationPage() {
  await requireCoachDocsAccess()

  return (
    <DocsArticle
      eyebrow="Workout Studio"
      title="Comment fonctionne la logique de progression"
      intro="Cette documentation explique ce que le moteur recommande pendant la séance, ce qui modifie réellement le programme pour la prochaine fois et comment paramétrer correctement les séries pour éviter les lectures incohérentes."
      backHref="/coach/documentation"
      backLabel="Documentation coach"
    >
      <DocsSection title="Vue d’ensemble">
        <p>
          Il existe actuellement deux niveaux de progression dans le produit : une progression de séance, utilisée pour proposer la série suivante, et une progression de programme, utilisée pour décider si la charge de référence doit augmenter pour la prochaine séance.
        </p>
        <p>
          Ces deux logiques ne servent pas le même objectif. La première aide le client à mieux exécuter la séance en cours. La seconde détermine si l’exercice a validé une vraie surcharge exploitable pour la suite.
        </p>
      </DocsSection>

      <DocsSection title="Schéma de fonctionnement">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 text-sm leading-7 text-white/68">
          <pre className="whitespace-pre-wrap font-mono text-[12px] leading-6 text-white/72">{`Coach paramètre l'exercice
  -> reps / plage de reps / RIR / tempo / séries par série
  -> Client exécute une série
    -> App lit poids + reps + RIR saisis
    -> Moteur de reco calcule la série suivante (in-session)
      -> Pré-remplit poids / reps suggérés
  -> Client termine la séance
    -> Moteur de progression évalue l'exercice complet
      -> si toutes les conditions sont validées
         -> current_weight_kg augmente
      -> sinon
         -> charge de référence maintenue`}</pre>
        </div>
      </DocsSection>

      <DocsSection title="1. Progression active pendant la séance">
        <p>
          Quand le client valide une série, l’application peut recommander automatiquement la suivante. Cette recommandation se base sur la série qui vient d’être réalisée, la cible de la série suivante, et un historique comparable si disponible.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <DocsCard title="Cas standard">
            <p>
              Si l’effort reste dans la bonne zone, l’app tend à maintenir la charge et à pousser légèrement la progression en reps.
            </p>
          </DocsCard>
          <DocsCard title="Cas trop facile">
            <p>
              Si la série est clairement trop facile au regard du RIR cible, l’app peut monter la charge d’un incrément, voire deux incréments dans les cas très évidents.
            </p>
          </DocsCard>
          <DocsCard title="Cas échec">
            <p>
              Si le client atteint l’échec alors que ce n’était pas la cible, l’app entre en logique de récupération et baisse la charge recommandée pour la série suivante.
            </p>
          </DocsCard>
          <DocsCard title="Protection intra-séance">
            <p>
              La recommandation ne descend pas sous la charge de la série précédente dans la même séance, sauf logique explicite de récupération après échec.
            </p>
          </DocsCard>
        </div>
      </DocsSection>

      <DocsSection title="2. Progression active après la séance">
        <p>
          À la finalisation de la séance, le moteur n’augmente pas automatiquement la charge parce qu’une seule série s’est bien passée. Il vérifie l’exercice dans son ensemble.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <DocsCard title="Trigger d’overload">
            <p>
              La charge de référence du programme augmente seulement si toutes les séries complétées atteignent le haut de la plage de reps et si les RIR saisis sont conformes à la cible.
            </p>
          </DocsCard>
          <DocsCard title="Sinon maintien">
            <p>
              Si la condition n’est pas remplie, la charge de référence reste stable. Le système considère qu’il faut encore consolider l’exercice avant de surcharger.
            </p>
          </DocsCard>
        </div>
      </DocsSection>

      <DocsSection title="3. Paramétrage coach à respecter">
        <div className="grid gap-4 md:grid-cols-2">
          <DocsCard title="Séries hétérogènes">
            <p>
              Si tu utilises des paramètres différents par série, il faut penser chaque série comme une cible distincte. Le client doit voir le bon RIR, le bon tempo et le bon nombre de reps pour chaque ligne.
            </p>
          </DocsCard>
          <DocsCard title="Plage de reps">
            <p>
              Une plage claire comme 8–12 rend la double progression lisible. Les formats flous ou non parseables limitent la capacité du moteur à déclencher une surcharge automatique propre.
            </p>
          </DocsCard>
          <DocsCard title="RIR cible">
            <p>
              Le RIR sert à distinguer une progression propre d’un effort non contrôlé. Un `RIR` mal paramétré ou incohérent entre séries rend la lecture de progression moins fiable.
            </p>
          </DocsCard>
          <DocsCard title="Tempo">
            <p>
              Le tempo n’est pas décoratif. Quand il est défini série par série, le guide tempo doit suivre la série active et non un réglage global d’exercice.
            </p>
          </DocsCard>
        </div>
      </DocsSection>

      <DocsSection title="4. Interprétation correcte pour le coach">
        <p>
          Une recommandation in-session n’est pas une validation de surcharge programme. C’est une aide d’exécution. L’augmentation durable de la charge dépend de l’évaluation post-séance.
        </p>
        <p>
          À l’inverse, si le programme ne surcharge pas, cela ne veut pas dire que la séance était mauvaise. Cela veut simplement dire que le seuil défini pour une progression stable n’a pas encore été atteint.
        </p>
      </DocsSection>

      <DocsSection title="5. Erreurs fréquentes à éviter">
        <div className="grid gap-4 md:grid-cols-2">
          <DocsCard title="Confondre reco de séance et progression programme">
            <p>
              La première règle la séance en cours. La seconde décide de la charge de référence future.
            </p>
          </DocsCard>
          <DocsCard title="Paramétrer la première série puis généraliser mentalement">
            <p>
              Dès que tu actives un paramétrage par série, il faut raisonner ligne par ligne. Le système doit refléter cette granularité.
            </p>
          </DocsCard>
          <DocsCard title="Ignorer les RIR saisis">
            <p>
              Sans RIR exploitable, la qualité de décision baisse. Le moteur devient plus prudent et déclenche moins facilement une surcharge fiable.
            </p>
          </DocsCard>
          <DocsCard title="Utiliser des prescriptions ambiguës">
            <p>
              Les notations non structurées réduisent la capacité du moteur à produire des recommandations propres et cohérentes.
            </p>
          </DocsCard>
        </div>
      </DocsSection>
    </DocsArticle>
  )
}
