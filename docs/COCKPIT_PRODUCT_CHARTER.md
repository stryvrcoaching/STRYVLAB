# Charte produit — Cockpit client (coach)

**Statut :** canonique
**Surface :** panneau flottant top bar coach sur `/coach/clients/[clientId]/*`
**Skill agent :** `.agents/skills/cockpit-product/SKILL.md`
**Code de référence :**
- UI : `components/layout/ClientPulseDashboard.tsx`
- Directions : `lib/coach/cockpit-directions.ts`
- Cycle : `lib/coach/cycle-cockpit.ts`

---

## 1. Vision en une phrase

> Comparer en continu la **réalité vécue du client** au **plan du coach**, pour décider le **prochain bon geste** — sans quitter le flux de travail.

Le Cockpit n’est pas un dashboard.
C’est le **siège de décision** pendant que le coach travaille sur un client.

---

## 2. Job to be done

| Question | Réponse attendue du Cockpit |
|----------|-----------------------------|
| Que se passe-t-il *maintenant* ? | Signaux terrain vs plan |
| Est-ce que le plan tient ? | État global + écarts |
| Que faire *ensuite* ? | 1 direction prioritaire + CTA |
| Où agir ? | Lien direct vers studio / profil |

Si une feature n’aide pas à répondre à **au moins une** de ces questions, elle n’entre pas dans le Cockpit.

---

## 3. Place dans l’écosystème

```
Profil (Pilotage)  →  Qui est ce client ? Quelle phase ? Quel cadre ?
Cockpit            →  Que se passe-t-il maintenant ? Que faire ensuite ?
Studios            →  J’exécute l’ajustement
STRYVR (client)    →  Il vit le plan
        └──────── données terrain ────────┘
```

| Surface | Job | Ne doit pas |
|---------|-----|-------------|
| **Cockpit** | Observer l’écart → décider | Paramétrer le client, lister tout l’historique |
| **Profil → Pilotage** | Cadrage stratégique (phase, score) | Dupliquer le pulse live en double |
| **Studios** | Construire / ajuster le plan | Remplacer le jugement terrain |
| **Organisation (RDV)** | Planifier la relation | Diagnostiquer l’adhérence |

---

## 4. Les 3 couches obligatoires

Toute évolution du Cockpit doit respecter cet ordre de lecture :

### 1) Réalité (terrain)
Ce que le client fait / ressent vraiment
(apports, pas / NEAT, séances loguées / EAT, sommeil, énergie, cycle, charge observée)

### 2) Plan / intention coach
Ce qui a été prescrit
(target kcal, objectif pas + EAT prescrit, charge, phase, brouillon studio)

### 3) Direction
Ce que le coach doit faire ensuite
(titre + pourquoi chiffré + action + CTA)

**Sans la couche 3, ce n’est plus un cockpit — c’est un radar.**

---

## 5. Principes non négociables

1. **Toujours contextualisé au client ouvert**
   Pas de vue multi-clients dans le panneau.

2. **Réalité vs prescription, jamais un KPI isolé**
   Un chiffre sans plan de référence = “à compléter”, pas un jugement.

3. **Décision avant détail**
   La direction prioritaire est au-dessus des jauges, pas en bas.

4. **Une priorité claire**
   Max 3 directions. La première est *la* décision du moment.

5. **Actionnable**
   Chaque direction urgente/importante a un CTA vers un outil réel.

6. **Live draft = simulateur**
   Les brouillons Nutrition/Workout se reflètent avant partage.
   Ils ne modifient pas le plan client tant qu’ils ne sont pas publiés.

7. **Aide à la décision, pas diagnostic**
   Ton prudent, méthode visible, pas de promesse médicale ni de score vanity.

8. **Données manquantes > faux signal**
   Mieux vaut “compléter le terrain” que recommander un ajustement à l’aveugle.

---

## 6. Règles de priorité des directions (ordre fixe)

Implémentées dans `buildCockpitDirections` — ne pas réordonner sans revue produit.

| Rang | Condition | Direction type |
|------|-----------|----------------|
| 1 | ≥ 2 signaux “à compléter” | Compléter le terrain |
| 2 | Récupération “à corriger” | Protéger la récupération (pas + déficit / + volume) |
| 3 | Adhérence “à corriger” | Remettre l’exécution **avant** de bouger le plan |
| 4 | Énergie “à corriger” *et* adhérence + récup OK | Réaligner énergie réelle et plan |
| 5 | Activité “à corriger” | Budget NEAT+EAT (pas + séances) : recalibrer plan ou lever un frein ; CTA Workout Studio si sous-exécution training |
| 6 | Brouillon studio actif | Valider / partager / annuler le brouillon |
| 7 | Tout sous contrôle | Maintenir le cap |

### Combinaisons interdites (logique métier)

- **Ne jamais** proposer d’augmenter le déficit si récupération critique.
- **Ne jamais** retarget les calories en priorité si adhérence est “à corriger”.
- **Ne jamais** empiler plus de 3 directions.
- **Ne jamais** afficher une direction “urgent” sans CTA.

---

## 7. Contenu autorisé dans le panneau

### Do

- Direction coach (prioritaire)
- État global (aligné / à surveiller / à corriger / à compléter)
- Contexte cycle (secondaire, non bloquant seul)
- Jauges réalité vs plan (énergie, adhérence, activité, récupération)
- Impact brouillon studio
- Légende courte des marqueurs
- Lien “méthode” repliable par jauge

### Don’t

- Formulaire de paramétrage client (CRM, tags, accès)
- Historique long / tableaux de bilans
- Liste de notifications
- Prix, business, formules
- Graphiques multi-semaines denses
- Plus de 4 jauges principales sans refonte produit
- Textes de scoring décoratives sans lien décisionnel
- Scroll hijack ou animations qui retardent la lecture de la direction

---

## 8. Langage

| Do | Don’t |
|----|--------|
| “Déficit plus fort que prévu” | “Score énergétique 42” |
| “Remettre l’exécution avant le plan” | “Optimize adherence engine” |
| “Protéger la récupération” | “Overreaching detected — critical” |
| Chiffres dans le *pourquoi* | Jargon technique seul |

Langue : **français coach**, expert métier, pas data-scientist.

---

## 9. Structure UI canonique (ordre)

1. **Header** client + fermer
2. **Direction coach** (1 principale + 0–2 secondaires)
3. **Légende + pastille globale**
4. **Contexte cycle** (si applicable)
5. **Jauges** (énergie → adhérence → activité → récupération)
6. **Impact coach** (brouillon)
7. **Footer source** (temps réel / bilan)

Toute nouvelle carte s’insère **après** la direction, jamais avant.

---

## 10. Critères d’acceptation (définition of done)

Une évolution Cockpit est prête si :

- [ ] Un coach comprend la **priorité** en < 10 secondes
- [ ] La direction cite au moins un **chiffre terrain** quand disponible
- [ ] Le CTA mène au **bon outil** (pas une page générique)
- [ ] Les règles de priorité §6 sont respectées
- [ ] Aucun faux positif “à corriger” sur données absentes (→ “à compléter”)
- [ ] `prefers-reduced-motion` respecté sur les jauges
- [ ] Tests unitaires des nouvelles règles de direction
- [ ] Pas de régression live draft

---

## 11. Anti-patterns connus

| Anti-pattern | Pourquoi c’est faux |
|--------------|---------------------|
| Ajouter une 5ᵉ jauge “parce qu’on a la data” | Dilue la décision |
| Mettre les graphiques en premier | Inverse décision / détail |
| Recommander un cut calories sur récup basse | Danger métier |
| Dupliquer le score de transformation ici | Job du Profil Pilotage |
| Directions génériques sans chiffre | Perte de confiance |
| Ouvrir Stripe / business depuis le cockpit | Mauvais job |

---

## 12. Roadmap produit

### Livré (Phase 1 amplification)

1. ~~Message client pré-rempli depuis une direction~~
2. ~~“Marquer traité” / snooze 7 j~~
3. ~~Miroir compact sur **Profil → Pilotage**~~
4. ~~Mode compact bouton fermé : titre de direction visible (lg+)~~

### Suite

5. Instrumenter ouverture / clics CTA / traité
6. Enrichir le cycle en *contexte actionnable* (pas en 5ᵉ jauge)
7. Pastille mobile avec titre court (si espace)

Toute item roadmap doit passer les §5–7 avant d’être codée.

---

## 13. Checklist PR (reviewer)

- [ ] Est-ce de la **décision** ou du **reporting** ?
- [ ] La direction est-elle **au-dessus** du détail ?
- [ ] Y a-t-il un **CTA** pour l’urgent ?
- [ ] Les règles §6 sont-elles intactes ?
- [ ] Ton / langage coach FR respecté ?
- [ ] Tests directions à jour ?

---

*Document vivant. Toute déviation majeure = mise à jour de cette charte avant merge.*
