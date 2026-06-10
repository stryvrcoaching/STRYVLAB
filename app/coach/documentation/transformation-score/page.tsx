import {
  CoachDocsArticle,
  DocCard,
  DocSection,
} from "@/components/coach/docs/CoachDocsArticle";

export default function TransformationScoreDocumentationPage() {
  return (
    <CoachDocsArticle
      eyebrow="Score de transformation"
      title="Comment fonctionne Score de transformation"
      intro="Score de transformation est l’indicateur macro du profil client. Son rôle est de donner, en un coup d’œil, une lecture globale de la dynamique du client sur la fenêtre choisie, en croisant l’adhérence, la récupération, la progression corporelle et la performance."
    >
      <DocSection title="À quoi sert cet outil">
        <p>
          Cet outil répond à une question simple : le client avance-t-il globalement dans la bonne dynamique par rapport à son objectif ?
        </p>
        <p>
          Il ne sert pas à décider précisément si une phase donnée est encore adaptée jour après jour. Pour cela, il faut regarder Optimisation de phase. Ici, on parle d’une lecture plus macro.
        </p>
      </DocSection>

      <DocSection title="Comment le score est construit">
        <p>
          Le score final est calculé sur 100 à partir de quatre dimensions. Chaque dimension obtient un score propre, puis le moteur applique des poids qui varient selon l’objectif d’entraînement du client.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <DocCard title="1. Adhérence">
            <p>
              L’outil regarde principalement le taux de réponse aux check-ins et le volume de séances réellement réalisées par rapport à la fréquence prévue.
            </p>
          </DocCard>
          <DocCard title="2. Récupération">
            <p>
              Énergie, qualité du sommeil, durée de sommeil, stress et courbatures sont normalisés pour produire un score de récupération.
            </p>
          </DocCard>
          <DocCard title="3. Progression corporelle">
            <p>
              Le moteur regarde les tendances du poids, de la masse grasse et de la masse maigre en fonction de l’objectif du client.
            </p>
          </DocCard>
          <DocCard title="4. Performance">
            <p>
              La performance intègre la complétion des exercices, le RIR moyen, les signaux de stagnation et certains indices de surcharge.
            </p>
          </DocCard>
        </div>
      </DocSection>

      <DocSection title="Les poids changent selon l’objectif">
        <p>
          Le score ne pèse pas toujours les dimensions de la même manière. Par exemple, un objectif de perte de gras donne davantage d’importance à l’adhérence, à la récupération et à la progression corporelle. Un objectif de force donne davantage d’importance à la performance.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <DocCard title="Exemple cut / perte de gras">
            <p>
              Adhérence 30%, récupération 25%, progression corporelle 30%, performance 15%.
            </p>
          </DocCard>
          <DocCard title="Exemple hypertrophie">
            <p>
              Adhérence 25%, récupération 30%, progression corporelle 20%, performance 25%.
            </p>
          </DocCard>
        </div>
        <p>
          Cela permet d’éviter une lecture trop générique et de mieux refléter la logique métier du coaching.
        </p>
      </DocSection>

      <DocSection title="Que signifient les 4 pastilles">
        <p>
          Les pastilles sous le score montrent le score de chaque dimension. Elles ne remplacent pas le score global, mais elles permettent de voir rapidement où se situe le principal levier d’amélioration.
        </p>
        <p>
          En passant dessus, le coach peut comprendre ce que la dimension représente, le score obtenu, et combien de données ont réellement été utilisées.
        </p>
      </DocSection>

      <DocSection title="Que signifie un bon score global">
        <p>
          Un bon score global signifie que, sur la fenêtre observée, le client présente une dynamique favorable au regard de son objectif.
        </p>
        <p>
          Cela veut dire que, globalement, l’adhérence, la récupération, la réponse corporelle et la performance vont plutôt dans le bon sens. Cela ne veut pas forcément dire que tout est parfait dans le détail.
        </p>
      </DocSection>

      <DocSection title="Que signifie un score faible">
        <p>
          Un score faible indique qu’une ou plusieurs dimensions freinent sérieusement la dynamique. Ce n’est pas toujours la même cause. Le problème peut venir d’une mauvaise régularité, d’une récupération insuffisante, d’une progression corporelle incohérente ou d’une performance qui se dégrade.
        </p>
        <p>
          C’est précisément pour cela que les alertes et les pastilles de dimensions sont importantes.
        </p>
      </DocSection>

      <DocSection title="Comment les alertes sont générées">
        <p>
          Les alertes ne sont pas des textes décoratifs. Elles sont générées à partir des dimensions les plus faibles et des causes détectables.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <DocCard title="Exemples côté récupération">
            <p>
              Sommeil moyen trop bas, stress élevé ou qualité de récupération insuffisante.
            </p>
          </DocCard>
          <DocCard title="Exemples côté adhérence">
            <p>
              Taux de check-in trop faible ou régularité des séances en baisse.
            </p>
          </DocCard>
          <DocCard title="Exemples côté corps">
            <p>
              Progression corporelle qui ne correspond pas à la direction attendue par l’objectif.
            </p>
          </DocCard>
          <DocCard title="Exemples côté performance">
            <p>
              Performance qui stagne ou régresse sur la fenêtre observée.
            </p>
          </DocCard>
        </div>
      </DocSection>

      <DocSection title="Comment les données manquantes sont gérées">
        <p>
          Quand une dimension manque réellement de données, le moteur ne l’interprète pas comme “mauvaise” par défaut. Son poids est réduit puis redistribué vers les dimensions réellement observées.
        </p>
        <p>
          C’est ce qui permet au score de rester utile même avec une couverture incomplète, tout en signalant au coach qu’il s’agit d’une estimation plus prudente.
        </p>
      </DocSection>

      <DocSection title="Comment obtenir le meilleur du Score de transformation">
        <div className="grid gap-4 md:grid-cols-2">
          <DocCard title="Rythme de données">
            <p>
              Des check-ins réguliers, un bon suivi des séances et des données corporelles répétées donnent un score bien plus représentatif.
            </p>
          </DocCard>
          <DocCard title="Progression corporelle">
            <p>
              Plus les pesées, bilans de composition et autres mesures sont cohérents dans le temps, plus la dimension corps devient pertinente.
            </p>
          </DocCard>
          <DocCard title="Lecture coach">
            <p>
              Utilisez le score global pour savoir si la dynamique générale est bonne, puis descendez dans les 4 dimensions pour identifier le vrai levier d’action.
            </p>
          </DocCard>
          <DocCard title="Limite importante">
            <p>
              Un bon score global ne veut pas forcément dire qu’une phase spécifique est encore idéale. Pour cela, regardez Optimisation de phase.
            </p>
          </DocCard>
        </div>
      </DocSection>

      <DocSection title="Cas concrets de lecture">
        <div className="grid gap-4 md:grid-cols-2">
          <DocCard title="Cas 1 : score haut et dimensions homogènes">
            <p>
              Le score global est fort et les quatre dimensions restent solides ou cohérentes entre elles.
            </p>
            <p>
              Lecture coach : la dynamique générale est bonne. Il faut surtout protéger la constance.
            </p>
          </DocCard>
          <DocCard title="Cas 2 : score correct mais une dimension tire vers le bas">
            <p>
              Le score global semble acceptable, mais une dimension comme la récupération ou l’adhérence est nettement plus faible.
            </p>
            <p>
              Lecture coach : la trajectoire globale tient encore, mais le prochain point de rupture est souvent déjà visible.
            </p>
          </DocCard>
          <DocCard title="Cas 3 : score faible surtout à cause des données">
            <p>
              Le client répond peu, log peu, ou ne fournit pas assez de mesures pour stabiliser certaines dimensions.
            </p>
            <p>
              Lecture coach : avant de conclure à une mauvaise dynamique, il faut d’abord rétablir une meilleure qualité de suivi.
            </p>
          </DocCard>
          <DocCard title="Cas 4 : score bas avec alertes convergentes">
            <p>
              L’adhérence, la récupération ou la performance se dégradent en même temps.
            </p>
            <p>
              Lecture coach : il y a un vrai frein global et il faut identifier quel levier produit le plus de valeur immédiatement.
            </p>
          </DocCard>
        </div>
      </DocSection>

      <DocSection title="Erreurs d’interprétation à éviter">
        <div className="grid gap-4 md:grid-cols-2">
          <DocCard title="Erreur 1 : ne regarder que le score global">
            <p>
              Le score n’a de sens que si vous regardez ensuite les quatre dimensions et les alertes qui expliquent ce score.
            </p>
          </DocCard>
          <DocCard title="Erreur 2 : confondre bon score global et phase idéale">
            <p>
              Le Score de transformation parle de dynamique générale. Il ne valide pas, à lui seul, la phase tactique actuelle.
            </p>
          </DocCard>
          <DocCard title="Erreur 3 : sous-estimer les données manquantes">
            <p>
              Un score peut rester exploitable avec peu de données, mais il faut garder en tête qu’il devient alors plus prudent et moins précis.
            </p>
          </DocCard>
          <DocCard title="Erreur 4 : interpréter une dimension isolée hors contexte">
            <p>
              Une performance un peu basse ou une récupération moyenne ne suffisent pas toujours à conclure à un problème global si le reste reste solide.
            </p>
          </DocCard>
        </div>
      </DocSection>

      <DocSection title="Que faire si le widget dit X">
        <div className="grid gap-4 md:grid-cols-2">
          <DocCard title="Si le score est haut">
            <p>
              Conservez les routines qui fonctionnent. Le bon réflexe n’est pas de sur-réagir, mais de maintenir la cohérence.
            </p>
          </DocCard>
          <DocCard title="Si le score est moyen">
            <p>
              Descendez dans les dimensions. Cherchez quelle brique freine la dynamique globale : régularité, récupération, corps ou performance.
            </p>
          </DocCard>
          <DocCard title="Si le score est bas">
            <p>
              Regardez les alertes prioritaires et les dimensions les plus faibles. L’objectif est d’attaquer la cause dominante, pas de traiter tout le système en même temps.
            </p>
          </DocCard>
          <DocCard title="Si les données sont insuffisantes">
            <p>
              Augmentez la régularité des check-ins, le suivi des séances et les mesures corporelles. C’est souvent le levier le plus rapide pour améliorer la qualité de lecture.
            </p>
          </DocCard>
        </div>
      </DocSection>

      <DocSection title="Lecture par objectif">
        <div className="grid gap-4 md:grid-cols-2">
          <DocCard title="Perte de gras / cut">
            <p>
              Une bonne lecture attend surtout une adhérence solide, une récupération suffisante et une progression corporelle qui va dans le bon sens.
            </p>
          </DocCard>
          <DocCard title="Hypertrophie / lean bulk">
            <p>
              La performance et la récupération prennent davantage de poids. Une prise de masse sans vraie progression utile peut rester médiocre malgré un contexte calorique plus haut.
            </p>
          </DocCard>
          <DocCard title="Force">
            <p>
              La performance pèse plus lourd dans l’évaluation globale. Une stagnation durable ou un surmenage trop visible tirent rapidement le score vers le bas.
            </p>
          </DocCard>
          <DocCard title="Maintenance / recomp">
            <p>
              L’outil attend davantage de stabilité générale. Des dérives trop fortes d’un côté ou de l’autre montrent que la dynamique réelle ne correspond plus à la cible.
            </p>
          </DocCard>
        </div>
      </DocSection>

      <DocSection title="Lien avec Optimisation de phase">
        <p>
          Les deux outils se complètent. Score de transformation sert à lire la trajectoire globale. Optimisation de phase sert à juger si la phase actuelle est tactiquement adaptée.
        </p>
        <p>
          En pratique, un client peut avoir un bon Score de transformation tout en ayant une Optimisation de phase fragile. Ce n’est pas forcément contradictoire : cela peut simplement vouloir dire que la dynamique générale est bonne, mais que la phase actuelle commence à devenir moins soutenable.
        </p>
      </DocSection>
    </CoachDocsArticle>
  );
}
