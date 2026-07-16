import {
  CoachDocsArticle,
  DocCard,
  DocSection,
} from "@/components/coach/docs/CoachDocsArticle";
import { requireCoachDocsAccess } from "@/lib/docs/server";

export default async function PhaseOptimizationDocumentationPage() {
  await requireCoachDocsAccess()

  return (
    <CoachDocsArticle
      eyebrow="Optimisation de phase"
      title="Comment fonctionne Optimisation de phase"
      intro="Optimisation de phase est l’outil tactique de la page Profil. Son rôle n’est pas de dire si le client “progresse un peu” au sens large, mais de juger si la phase actuelle est réellement adaptée maintenant, à quel niveau de cohérence, et dans quelle direction un coach devrait se diriger à court ou moyen terme."
    >
      <DocSection title="À quoi sert cet outil">
        <p>
          L’outil répond à trois questions simples. Premièrement : la phase actuelle est-elle adaptée ou non ? Deuxièmement : le client la tolère-t-il réellement dans la pratique, pas seulement sur le papier ? Troisièmement : faut-il maintenir, surveiller, ralentir ou réorienter la phase ?
        </p>
        <p>
          Il s’agit donc d’un moteur de décision coach. Il ne remplace pas le jugement humain, mais il aide à faire ressortir rapidement les signaux qui justifient une action.
        </p>
      </DocSection>

      <DocSection title="Ce que vous voyez dans la carte">
        <div className="grid gap-4 md:grid-cols-2">
          <DocCard title="Niveau d’optimisation">
            <p>
              Le score principal est un score de cohérence de phase sur 100. Plus il est élevé, plus la phase actuelle semble alignée avec la réalité du client.
            </p>
          </DocCard>
          <DocCard title="Verdict">
            <p>
              Le verdict simplifie la lecture en trois états : phase adaptée, phase partiellement adaptée, ou phase non adaptée.
            </p>
          </DocCard>
          <DocCard title="Direction recommandée">
            <p>
              La direction résume ce que le moteur recommande maintenant : maintenir, surveiller, reconditionner, consolider ou ajuster.
            </p>
          </DocCard>
          <DocCard title="Confiance">
            <p>
              La confiance ne mesure pas l’état du client. Elle mesure la fiabilité de la lecture en fonction de la couverture, de la fraîcheur et de la cohérence des données.
            </p>
          </DocCard>
        </div>
      </DocSection>

      <DocSection title="Les grands signaux utilisés">
        <p>
          Le moteur croise plusieurs familles de données. Il ne repose pas sur un signal magique unique.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <DocCard title="1. Récupération et stress">
            <p>
              Énergie, qualité de sommeil, durée de sommeil, stress perçu, courbatures et rythme cardiaque au repos le matin quand il est disponible.
            </p>
          </DocCard>
          <DocCard title="2. Tolérance à l’entraînement">
            <p>
              Complétion des séances, tendance de performance, stagnation, surcharge, surmenage perçu, et signaux comme le RIR moyen quand ils existent.
            </p>
          </DocCard>
          <DocCard title="3. Adhérence nutritionnelle">
            <p>
              Calories prévues vs réelles, protéines prévues vs réelles, couverture des logs nutritionnels, et plus globalement la capacité du client à tenir le protocole.
            </p>
          </DocCard>
          <DocCard title="4. Réponse corporelle">
            <p>
              Tendance du poids, masse grasse, masse maigre, tour de taille et direction réelle de la composition corporelle quand ces données sont présentes.
            </p>
          </DocCard>
        </div>
      </DocSection>

      <DocSection title="Comment le rythme cardiaque est interprété">
        <p>
          Le BPM matinal n’est pas lu comme une norme universelle. Le moteur ne dit pas qu’un chiffre absolu est “bon” ou “mauvais” pour tout le monde.
        </p>
        <p>
          Il compare surtout le RHR aigu récent à la baseline personnelle du client. En pratique, le moteur calcule une moyenne courte des dernières valeurs valides et la compare à une baseline plus longue. Si le RHR grimpe franchement au-dessus de la baseline personnelle, cela devient un signal de surcharge ou de récupération dégradée.
        </p>
        <p>
          Le RHR n’est cependant jamais utilisé seul. Il vient renforcer ou nuancer les autres signaux de récupération.
        </p>
      </DocSection>

      <DocSection title="La logique de décision">
        <p>
          L’outil calcule d’abord un score agrégé de cohérence de phase. Ensuite, il applique une matrice explicite de règles métiers pour produire un verdict lisible.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <DocCard title="Exemples de verdicts">
            <p>
              Une hausse claire du RHR, un stress physiologique élevé et une récupération basse peuvent faire sortir un verdict de surcharge de récupération.
            </p>
            <p>
              Une adhérence nutritionnelle trop faible peut faire sortir un verdict de phase non adaptée, non parce que le protocole est forcément mauvais en théorie, mais parce qu’il n’est pas réellement tenable pour le client.
            </p>
          </DocCard>
          <DocCard title="Pourquoi cette matrice existe">
            <p>
              Elle évite une lecture trop abstraite du score. Le coach ne voit pas seulement “68/100”. Il voit aussi la raison principale de ce 68, les conditions qui ont déclenché le verdict, et la direction recommandée.
            </p>
          </DocCard>
        </div>
      </DocSection>

      <DocSection title="Que signifie un bon score">
        <p>
          Un bon score signifie que la phase actuelle semble cohérente avec ce que le client arrive réellement à faire, à tolérer et à produire comme réponse corporelle.
        </p>
        <p>
          Cela ne signifie pas que tout est parfait, ni que le coach ne doit plus surveiller. Cela signifie surtout que la phase paraît tenable et alignée.
        </p>
      </DocSection>

      <DocSection title="Que signifie un score fragile ou incohérent">
        <p>
          Un score fragile veut dire que la phase est peut-être encore exploitable, mais avec davantage de prudence. En général, on peut continuer à court terme, à condition de surveiller les signaux clés.
        </p>
        <p>
          Un score incohérent veut dire qu’il existe un écart réel entre la phase voulue et la réalité du client. Cet écart peut venir de la récupération, de l’adhérence, de la performance, de la nutrition ou de la réponse corporelle.
        </p>
      </DocSection>

      <DocSection title="Comment interpréter la confiance">
        <p>
          Une confiance faible ne veut pas dire que le client va mal. Elle veut dire que l’outil manque de données, ou que les données se contredisent, ou qu’elles sont trop anciennes.
        </p>
        <p>
          Dans ce cas, il faut lire le verdict avec plus de prudence et utiliser davantage le contexte terrain du coach.
        </p>
      </DocSection>

      <DocSection title="Comment obtenir le meilleur de l’outil">
        <div className="grid gap-4 md:grid-cols-2">
          <DocCard title="Le minimum utile">
            <p>
              Des check-ins réguliers avec énergie, sommeil, stress et courbatures donnent déjà une base exploitable.
            </p>
          </DocCard>
          <DocCard title="Ce qui améliore vraiment la qualité">
            <p>
              Ajouter le BPM matinal, les logs nutritionnels, les tendances de performance, les pas quotidiens et des données corporelles régulières rend le verdict beaucoup plus fin.
            </p>
          </DocCard>
          <DocCard title="Ce qu’il faut éviter">
            <p>
              Saisir des données de manière irrégulière, très tardive ou très partielle diminue la confiance du moteur et peut brouiller la lecture.
            </p>
          </DocCard>
          <DocCard title="Bonne posture coach">
            <p>
              Utilisez l’outil comme un accélérateur de lecture et de priorisation. Si la réalité terrain contredit le widget, il faut investiguer, pas suivre aveuglément la carte.
            </p>
          </DocCard>
        </div>
      </DocSection>

      <DocSection title="Cas concrets de lecture">
        <div className="grid gap-4 md:grid-cols-2">
          <DocCard title="Cas 1 : phase adaptée et stable">
            <p>
              Le score est haut, la récupération tient, l’adhérence est correcte et la réponse corporelle suit la direction attendue.
            </p>
            <p>
              Lecture coach : on maintient la phase et on continue la surveillance normale.
            </p>
          </DocCard>
          <DocCard title="Cas 2 : score fragile mais exploitable">
            <p>
              Le client tient encore la phase, mais certains signaux commencent à dériver : récupération en baisse, stress plus haut, performance plus instable ou nutrition moins rigoureuse.
            </p>
            <p>
              Lecture coach : on ne pivote pas forcément tout de suite, mais on rapproche le suivi et on prépare un ajustement.
            </p>
          </DocCard>
          <DocCard title="Cas 3 : phase non adaptée par surcharge">
            <p>
              Le verdict remonte une surcharge de récupération avec RHR au-dessus de la baseline, fatigue élevée et stress physiologique trop haut.
            </p>
            <p>
              Lecture coach : priorité à la récupération, à la baisse de pression et à la consolidation avant de relancer.
            </p>
          </DocCard>
          <DocCard title="Cas 4 : phase non adaptée par adhérence">
            <p>
              Le protocole est peut-être pertinent en théorie, mais les données montrent que le client ne le tient pas réellement.
            </p>
            <p>
              Lecture coach : la bonne décision n’est pas de pousser plus fort, mais de rendre la phase plus tenable.
            </p>
          </DocCard>
        </div>
      </DocSection>

      <DocSection title="Erreurs d’interprétation à éviter">
        <div className="grid gap-4 md:grid-cols-2">
          <DocCard title="Erreur 1 : confondre score et certitude">
            <p>
              Un score intéressant avec une confiance basse doit être lu comme une hypothèse de travail, pas comme une vérité ferme.
            </p>
          </DocCard>
          <DocCard title="Erreur 2 : juger la phase sur un seul signal">
            <p>
              Un seul mauvais check-in ou un seul RHR plus haut ne suffit pas, à lui seul, à invalider une phase. Il faut regarder la convergence des signaux.
            </p>
          </DocCard>
          <DocCard title="Erreur 3 : croire qu’une phase théoriquement bonne est forcément tenable">
            <p>
              Une phase peut être cohérente sur le papier et rester mauvaise dans la réalité si le client ne la tolère pas ou ne la tient pas.
            </p>
          </DocCard>
          <DocCard title="Erreur 4 : ignorer le contexte terrain">
            <p>
              Déplacement, manque de sommeil, stress de vie, maladie ou semaine atypique peuvent temporairement perturber les signaux.
            </p>
          </DocCard>
        </div>
      </DocSection>

      <DocSection title="Que faire si le widget dit X">
        <div className="grid gap-4 md:grid-cols-2">
          <DocCard title="Si le verdict dit phase adaptée">
            <p>
              Maintenez la trajectoire. Le bon réflexe est surtout de protéger ce qui fonctionne et de vérifier que la cohérence se maintient.
            </p>
          </DocCard>
          <DocCard title="Si le verdict dit phase partiellement adaptée">
            <p>
              Gardez la phase seulement si vous avez une raison claire de la maintenir. Sinon, allégez ou simplifiez avant que le système ne bascule en non-adapté.
            </p>
          </DocCard>
          <DocCard title="Si le verdict dit phase non adaptée">
            <p>
              Cherchez d’abord la cause dominante : surcharge, adhérence, nutrition, performance ou réponse corporelle. C’est cette cause qu’il faut corriger, pas seulement le score affiché.
            </p>
          </DocCard>
          <DocCard title="Si la confiance est faible">
            <p>
              Commencez par améliorer la qualité des données : check-ins, RHR, logs nutritionnels, mesures corporelles et régularité générale du suivi.
            </p>
          </DocCard>
        </div>
      </DocSection>

      <DocSection title="Profils coach typiques">
        <div className="grid gap-4 md:grid-cols-2">
          <DocCard title="Client en cut">
            <p>
              Le moteur devient particulièrement sensible à la récupération, à l’adhérence nutritionnelle, au RHR et à la baisse de performance si le déficit devient trop coûteux.
            </p>
            <p>
              Le bon usage consiste à vérifier que la perte recherchée reste soutenable, pas seulement théoriquement efficace.
            </p>
          </DocCard>
          <DocCard title="Client en lean bulk">
            <p>
              Le moteur regarde davantage si la phase est réellement productive et bien tolérée, sans dérive excessive de la composition corporelle.
            </p>
            <p>
              Une hausse de poids sans vraie progression utile peut faire perdre la cohérence de phase.
            </p>
          </DocCard>
          <DocCard title="Client en recomp">
            <p>
              La lecture est souvent plus subtile. Il faut regarder de près la stabilité de la performance, la récupération et la direction corporelle dans le temps.
            </p>
          </DocCard>
          <DocCard title="Client en maintenance">
            <p>
              L’objectif principal est la stabilité utile. Si la récupération baisse, que l’adhérence se casse ou que la performance se dégrade, la maintenance peut elle aussi devenir mal adaptée.
            </p>
          </DocCard>
        </div>
      </DocSection>

      <DocSection title="Ce que l’outil ne prétend pas faire">
        <p>
          L’outil n’établit pas un diagnostic médical. Il n’infère pas directement des biomarqueurs hormonaux comme le cortisol. Il ne remplace pas non plus l’échange avec le client, le contexte de vie, ni le jugement professionnel du coach.
        </p>
      </DocSection>
    </CoachDocsArticle>
  );
}
