# Progression et récompenses client — design validé

## Objectif

Transformer la gamification client en un système qui récompense l'adhérence au coaching réellement prescrit, plutôt que le nombre brut d'actions enregistrées.

Le système doit :

- donner des premiers retours positifs rapidement ;
- valoriser autant l'entraînement que la nutrition ;
- rester juste pour des clients qui n'ont pas les mêmes modules activés ;
- faire des rangs élevés une preuve de constance dans le temps ;
- laisser au coach un contrôle encadré sur la cadence de sa boutique ;
- ne jamais créer de culpabilité ou retirer des acquis à cause d'un écart ponctuel.

## Principes produits

### Progression personnelle

Les points de progression, les trophées et le rang appartiennent au client. Ils sont cumulés sur son compte STRYV lab et restent acquis lorsqu'il change de coach STRYV lab.

Les points dépensés dans une boutique ne font jamais baisser le rang ou le total de progression.

### Solde de récompenses lié au coach

Le solde utilisable dans la boutique est distinct des points de progression. Il est lié à la relation coach-client qui l'a généré.

Lorsqu'un client change de coach :

- son rang, ses trophées et son total de progression sont conservés ;
- son nouveau solde boutique démarre séparément ;
- l'ancien solde boutique devient immédiatement indisponible et n'est pas transféré ;
- le nouveau coach voit le rang et l'historique de progression du client, sans reprendre la dette de récompenses de l'ancien coach.

## Échelle des rangs

| Statut | Seuil de progression | Trajectoire indicative au rythme Équilibré |
| --- | ---: | --- |
| Départ | 0 | — |
| Métal | 25 | Premiers jours d'engagement |
| Bronze | 150 | 1 à 2 semaines |
| Argent | 350 | 3 à 4 semaines |
| Or | 700 | 6 à 7 semaines |
| Platine | 1 500 | 3 à 4 mois |
| Diamant | 3 000 | 6 à 7 mois |
| Maître | 4 500 | 9 à 12 mois |
| Olympien | 6 500 | 12 à 18 mois |

Métal est un premier trophée à gagner ; il ne doit pas être attribué automatiquement à zéro point.

Les durées sont des repères pour une personne engagée. Elles ne sont pas une promesse et varient selon les modules réellement prescrits, la cadence coach et la qualité d'adhérence.

## Cadence définie par le coach

Dans les paramètres de récompenses, le coach choisit une cadence globale. L'interface peut être présentée comme un curseur à trois positions sécurisées :

| Cadence | Coefficient | Intention |
| --- | ---: | --- |
| Rapide | × 1,15 | Récompenses plus fréquentes, expérience plus ludique |
| Équilibré | × 1,00 | Réglage recommandé et valeur par défaut |
| Exigeant | × 0,85 | Accompagnement long, cadeaux plus rares |

Le coefficient s'applique seulement aux futurs gains issus de l'adhérence. Il ne modifie ni les points déjà gagnés, ni les rangs déjà atteints. Une modification de cadence doit être limitée à une fois toutes les quatre semaines et enregistrée dans un journal d'audit.

Le coach ne configure pas la valeur unitaire d'une séance ou d'un repas : il choisit seulement le rythme global de sa boutique.

## Base de calcul hebdomadaire

Au rythme Équilibré, un client engagé peut atteindre environ 100 points par semaine. Cette enveloppe est calculée à partir des opportunités réellement actives pour ce client.

| Domaine | Part de référence | Règle |
| --- | ---: | --- |
| Entraînement | 45 % | Basé sur les séances prescrites et leur réalisation |
| Nutrition | 45 % | Basé sur la cohérence quotidienne avec le plan ou les objectifs |
| Check-ins | 10 % | Présents seulement si le coach les active |
| Bilan | +25 pts | Bonus ponctuel lorsqu'il est demandé et complété |

Une part associée à un module non activé est redistribuée entre les autres opportunités prescrites. Un client sans check-ins ou sans plan nutritionnel ne perd donc pas de potentiel de progression.

## Règles d'attribution

### Entraînement

La part entraînement de la semaine est répartie entre les séances prévues. Une séance reçoit des points selon sa complétion réelle :

- complétion significative requise avant toute attribution ;
- séance complète : totalité de sa part ;
- séance partielle : attribution proportionnelle ;
- séance sautée : zéro point, sans retrait de points acquis ;
- séance reportée dans le planning : sa valeur suit la séance reportée ;
- séance modifiée, allégée ou adaptée par le coach : valide si elle est réalisée.

Le seuil exact de complétion significative doit être calibré pendant l'implémentation avec les données de séance disponibles.

### Nutrition

La nutrition est évaluée une fois par journée, jamais par repas individuel.

- avec un plan alimentaire : cohérence globale avec les repas, quantités et repères prévus ;
- sans plan détaillé : proximité avec les objectifs prioritaires définis par le coach ;
- des zones de tolérance sont utilisées ; le système ne demande pas une conformité mathématique absolue ;
- une journée éloignée de l'objectif rapporte peu ou pas de points ; elle ne retire jamais de points déjà acquis ;
- une journée peut être recalculée si le client corrige ou ajoute un repas, sans créer de doublon de gain.

La sélection des indicateurs nutritionnels doit dépendre de la phase et des priorités coach. Le système ne doit pas imposer une note nutritionnelle universelle.

### Check-ins et séries

Les check-ins occupent seulement leur part active de l'enveloppe hebdomadaire. Un check-in fait dans la fenêtre de tolérance peut recevoir une attribution réduite. Les doublons ne rapportent pas de points.

La série active reste une information motivante. Les bonus de série doivent être rares et modestes, afin de ne pas déformer la cadence globale. Les anciens bonus massifs et récurrents sont supprimés.

### Bilans

Un bilan assigné par le coach et complété par le client rapporte 25 points. Il continue à rapporter ses points s'il est terminé en retard : le délai sert au suivi coach, pas à retirer la valeur de la participation.

### Quêtes

Les quêtes hebdomadaires automatiques basées sur le nombre de séances ou de check-ins sont supprimées. Elles doublonnent les comportements déjà récompensés et accélèrent artificiellement les rangs.

Des jalons rares et contextuels pourront être ajoutés ultérieurement, par exemple à la fin d'une phase de coaching. Ils ne font pas partie de l'économie de base.

## Expérience client

### Boutique et information

La boutique affiche le solde disponible pour la relation coach-client, les récompenses configurées par le coach et les trophées de progression personnels.

Un bouton Information ouvre une modale qui explique, en langage simple :

- que les points viennent du respect du programme personnel ;
- que les gains sont conditionnels à la réalisation et à la cohérence ;
- que les check-ins et bilans ne sont pris en compte que lorsqu'ils sont prévus ;
- que les achats boutique ne retirent pas les rangs ;
- que les rangs représentent la régularité et la durée.

### Feedback et motion

- séance, check-in, journée nutritionnelle validée et bilan : animation de gain de points ;
- série ou bilan de semaine : retour calme dans l'application ;
- nouveau rang : animation dédiée de montée de niveau ;
- tous les retours respectent `prefers-reduced-motion` et restent accessibles.

## Expérience coach

Lors de la création d'une récompense, le coach conserve le choix du coût en points. L'interface affiche une estimation d'effort, par exemple « environ deux semaines » ou « environ trois mois » pour un client engagé, selon la cadence choisie.

Le coach ne voit pas une compétition entre clients. Il voit les informations nécessaires pour gérer sa boutique : cadence, coûts, demandes, solde lié à sa relation avec le client et trajectoire indicative.

## Fiabilité, équité et sécurité

- Les calculs sont réalisés côté serveur, jamais à partir d'un montant fourni par le client.
- Chaque événement de progression est traçable : source, période, opportunité, score d'adhérence, points accordés et configuration de cadence appliquée.
- Les écritures sont idempotentes afin qu'une correction ou une relance ne crée jamais de double gain.
- Les changements de programme, pauses, blessures, vacances, déloads ou changements de phase excluent les opportunités concernées du dénominateur ; ils ne pénalisent pas le client.
- Les données de progression ne sont jamais utilisées pour un classement public ou entre clients.
- Les messages et règles nutritionnels évitent toute logique punitive et toute présentation culpabilisante.

## État actuel à remplacer

L'implémentation actuelle attribue des montants fixes par action, des bonus de série importants et des quêtes hebdomadaires automatiques. Elle calcule les rangs depuis un total de points unique et utilise ce même total, moins les dépenses, pour la boutique.

La nouvelle conception sépare explicitement :

1. la progression personnelle et portable ;
2. le solde de récompenses propre au coach ;
3. le calcul conditionnel d'adhérence ;
4. le rythme global configuré par le coach.

## Journal de décision

| Décision | Alternatives écartées | Motif |
| --- | --- | --- |
| Récompenser l'adhérence au plan plutôt que les clics | Points fixes par action | Équité entre des clients avec des prescriptions différentes |
| Égalité entraînement / nutrition : 45 % / 45 % | Entraînement dominant à 60 % | La nutrition demande une constance quotidienne comparable |
| Check-ins limités à 10 % et redistribués s'ils sont inactifs | Check-ins obligatoires ou bonus massifs | Ne pas pénaliser un client dont le coach ne les utilise pas |
| Aucune perte de points cumulés pour un écart | Retrait de points en cas de dépassement nutritionnel | Préserver une expérience de soutien, non punitive |
| Quêtes hebdomadaires automatiques supprimées | Conserver +100 / +50 par semaine | Éviter les doublons et l'accélération artificielle |
| Cadence coach à trois positions | Slider libre ou aucun réglage | Contrôle utile, cohérent et maîtrisable |
| Rang Olympien à 6 500 points | 10 000 points | Trajectoire atteignable en 12 à 18 mois |
| Rangs et progression portables | Réinitialisation au changement de coach | Le parcours appartient au client |
| Solde boutique non transférable | Solde universel ou transférable | Chaque coach maîtrise le coût de ses cadeaux |
| Solde précédent indisponible immédiatement | Fenêtre de réclamation après départ | Décision produit validée |
