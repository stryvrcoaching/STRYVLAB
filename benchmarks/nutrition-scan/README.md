# Benchmark du scan nutritionnel

Ce dossier mesure le système réellement utilisé par l'application : mêmes photos fusionnées, même texte utilisateur, même analyse multimodale, mêmes clarifications et même finalisation. Il sert à détecter les régressions et à guider les corrections. Il ne constitue ni un entraînement automatique du modèle ni une validation clinique.

## Composition cible des 100 cas

| Famille | Cible | Exemples |
| --- | ---: | --- |
| Cas privés réels | 61 | 141 photos regroupées en repas, pesées, emballages et restes |
| Nutrition5k | 15 | assiettes avec masses et nutriments mesurés |
| Open Food Facts | 10 | face produit, tableau nutritionnel, code-barres |
| Restaurant documenté | 10 | ticket + plateau + valeurs officielles de l'enseigne |
| Cas adversariaux documentés | 4 | contradiction texte/photo, faible lumière, doublons et cadrages difficiles |

Les 61 cas privés sont répartis en 46 cas `development` et 15 cas `holdout`. Les 39 cas complémentaires devront porter le total à environ 70 cas de développement et 30 cas de holdout. Le holdout ne doit pas être utilisé pour ajuster les prompts au quotidien.

## Niveaux de vérité terrain

- **A** : poids mesuré et nutrition issue d'une étiquette, d'une enseigne officielle ou d'un jeu de données mesuré.
- **B** : aliments et quantités mesurées vérifiés; la nutrition peut être calculée depuis une source documentée ou rester partiellement inconnue si la recette exacte manque.
- **C** : identité, répartition ou quantité encore ambiguë. Utile pour la reconnaissance et les clarifications, mais pas pour juger précisément les calories.

Le rapport sépare les résultats par niveau afin de ne pas présenter une estimation humaine comme une mesure exacte.

Le `scenario` décrit le workflow capturé (`separate_weighing`, `leftovers`, etc.). Le `analysis_mode` décrit la branche fonctionnelle finale du moteur : plusieurs photos de pesée d'une assiette restent en mode `plate`; `hybrid` est réservé au croisement de sources différentes, par exemple emballage + portion pesée ou ticket + plateau.

## Importer les photos privées

Pour plusieurs photos d'une même session, placer les images dans un même sous-dossier. Un dossier plat crée un cas par image.

```bash
npm run benchmark:nutrition:import -- --source /chemin/vers/mes-cas
```

Pour traiter toutes les images d'un dossier plat comme une seule session :

```bash
npm run benchmark:nutrition:import -- --source /chemin/vers/une-session --single-session
```

Pour un dossier plat contenant plusieurs sessions et des HEIC, utiliser un manifeste de regroupement :

```bash
npm run benchmark:nutrition:import -- --source /chemin/vers/photos --manifest benchmarks/nutrition-scan/sources/private-sessions.json
```

Sur macOS, les HEIC sont convertis automatiquement en JPEG, limités à 2 800 px et recompressés comme dans le parcours réel de l'application. Les originaux ne sont jamais modifiés.

L'import crée des cas `needs_truth`. Compléter leur scénario, le texte utilisateur réel et la section `truth`, puis passer le statut à `ready`. Le modèle complet se trouve dans `templates/case.example.json`.

## Pré-annoter sans créer de fausse vérité

Le pré-annotateur indépendant extrait uniquement les preuves visibles. Il laisse les quantités et nutriments à `null` lorsqu'ils ne sont ni mesurés ni lisibles, et ne modifie jamais automatiquement le statut du cas.

```bash
npm run benchmark:nutrition:preannotate -- --limit 10
```

Chaque brouillon est écrit dans `preannotation.json` à côté du cas. Une validation humaine ou documentaire reste obligatoire avant de recopier les données dans `truth` et de passer le cas à `ready`.

La politique de normalisation empêche notamment de confondre le poids net d'un paquet avec la quantité consommée. Pour remettre d'anciens brouillons en conformité :

```bash
npm run benchmark:nutrition:normalize
```

Générer ensuite la file de revue priorisée :

```bash
npm run benchmark:nutrition:review
```

Le dossier `reports/preannotation-review/` contient une checklist Markdown, un CSV et le détail JSON.

Les profils nutritionnels génériques effectivement utilisés sont recensés dans `sources/nutrition-reference-sources.json` avec leur identifiant officiel, leur version et les cas concernés. Une recette inconnue, un morceau avec os ou une marque non documentée doit conserver des nutriments à `null` plutôt que recevoir une moyenne trompeuse.

## Collecter des images publiques

Le collecteur n'effectue aucune recherche aveugle. Il télécharge uniquement les URL HTTPS explicitement inscrites dans un manifeste avec source, licence et attribution.

```bash
npm run benchmark:nutrition:collect -- --manifest benchmarks/nutrition-scan/sources/mon-manifeste.json
```

Ne pas scraper des images trouvées au hasard. Pour Open Food Facts, respecter les limites d'API et utiliser le jeu AWS officiel si le volume devient important. Pour Nutrition5k, sélectionner seulement les cas nécessaires plutôt que télécharger le jeu complet.

## Valider et exécuter

Validation sans appel IA et sans coût :

```bash
npm run benchmark:nutrition:validate
```

Exécution réelle avec `OPENAI_API_KEY` dans `.env.local` :

```bash
npm run benchmark:nutrition
```

Options utiles :

```bash
npm run benchmark:nutrition -- --split holdout --runs 3
npm run benchmark:nutrition -- --ids private-001-repas,public-004-cereales
```

Chaque exécution produit `report.html`, `summary.json`, `results.json` et `results.csv` sous `reports/`. `results.json` conserve aussi l'analyse brute afin de comprendre précisément chaque erreur.

Après une correction de vérité terrain, recalculer le score d'un rapport existant sans refaire d'appel IA :

```bash
npm run benchmark:nutrition:rescore -- --report benchmarks/nutrition-scan/reports/2026-01-01T00-00-00Z
```

Le rapport recalculé est écrit dans le sous-dossier `rescored/`; l'analyse brute et la latence d'origine sont conservées.

Après une correction du finaliseur déterministe, ajouter `--refinalize` pour reconstruire aussi le résultat final depuis l'analyse brute stockée, toujours sans nouvel appel IA.

## Critères de passage recommandés

- Succès technique : au moins 98 % des sessions produisent un résultat exploitable.
- Cas de vérité A : score moyen au moins 85/100 et aucun scénario critique sous 75/100.
- Quantités : précision moyenne au moins 85 % sur les cas pesés.
- Calories : précision moyenne au moins 85 % sur les cas de vérité A.
- Fusion : aucun double comptage sur ticket + plateau ou emballage + aliment pesé.
- Stabilité : sur trois exécutions, écart-type du score inférieur à 5 points par cas.

Ces seuils sont des objectifs internes de produit. Ils doivent être affinés après le premier lot annoté, sans les présenter comme une promesse médicale.
