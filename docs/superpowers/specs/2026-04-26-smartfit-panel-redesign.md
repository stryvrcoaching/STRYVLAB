# SmartFit Panel Redesign — Spec Design

**Date :** 2026-04-26  
**Scope :** Fusion ProgramIntelligencePanel + LabModeSection en un panneau unique, suppression des doublons, clarté et ergonomie.

---

## Problèmes identifiés

1. **Duplication des subscores** — la grille des 9 subscores apparaît dans `ProgramIntelligencePanel` ET dans le "Debug subscores" du `LabModeSection`. Même donnée, deux fois.
2. **Alertes dupliquées** — les alertes sont dans le panneau SmartFit ET en badges inline sur chaque exercice. Redondant.
3. **Heatmap fatigue inutile** — les 4 colonnes S1/S2/S3/S4 sont identiques car c'est le même programme répété. Donne l'impression d'une simulation progressive sans en être une. Aucune légende, aucune explication.
4. **"Règles actives" opaques** — accordéon de descriptions découplées des subscores qu'elles expliquent. Pas de lien visuel entre une règle et son score.
5. **Overrides sans contexte** — les sliders n'expliquent pas ce qu'ils font ni pourquoi les toucher.
6. **Score global absent du Lab Mode** — le Lab Mode ne montre pas le score global, donc l'utilisateur doit faire le lien entre les deux panneaux mentalement.

---

## Décisions design

- **Un seul panneau** : `ProgramIntelligencePanel` absorbe `LabModeSection`. Un composant, un scrollable.
- **Supprimer** : grille subscores dans le panneau principal, donut "Patterns de mouvement", alertes du panneau (restent uniquement en badges inline sur chaque exercice).
- **Garder** : score global, barre segmentée, narrative, KPIs, radar distribution musculaire, volume MEV/MRV par groupe, volume par faisceau/séance.
- **Heatmap** : restructurée visuellement pour accueillir une vraie simulation progressive (placeholder — calcul réel en phase suivante).
- **Lab Mode** : section accordéon en bas du panneau, fermée par défaut. Contient score global (anchor), subscores avec tooltips explicatifs inline, heatmap restructurée, overrides coefficients avec tooltips.

---

## Architecture du panneau unifié

```
ProgramIntelligencePanel (composant unique)
│
├── EN-TÊTE (toujours visible)
│   ├── Label "SMART FIT" + icône + bouton collapse
│   ├── Score global (grand chiffre animé)
│   ├── Barre segmentée (1 segment par subscore, coloré)
│   └── Narrative (phrase explicative du score)
│
├── SECTION ANALYSE (déployée par défaut)
│   ├── KPIs — 4 stats (Séries/sem., Reps est., Exercices, Exos/séance)
│   ├── Volume MEV/MRV par groupe musculaire (barres segmentées)
│   ├── Radar distribution musculaire
│   └── Volume par faisceau/séance (barres horizontales par séance)
│
└── SECTION LAB (accordéon, fermée par défaut)
    ├── Score global (re-affiché comme anchor contextuel)
    ├── 9 Subscores en grille 2 colonnes
    │   └── Chaque subscore : valeur + label + icône "?" → tooltip inline avec explication de la règle
    ├── Heatmap fatigue restructurée
    │   ├── Titre : "Charge musculaire simulée"
    │   ├── Note : "Basé sur le programme actuel — simulation progressive à venir"
    │   ├── Tableau muscle × semaine avec cellules colorées (sans chiffres, juste couleur)
    │   └── Légende inline : vert = optimal, amber = élevé, rouge = critique
    ├── Overrides coefficients
    │   ├── Un slider par pattern présent (0.5–1.5)
    │   ├── Tooltip par slider : "Multiplie le coefficient stimulus de tous les exercices [pattern]"
    │   └── Bouton Reset (visible seulement si au moins un override ≠ 1.0)
    └── Badge Morpho (connecté / non connecté)
```

---

## Détail des subscores avec tooltips

Chaque case de la grille subscores dans le Lab affiche un "?" cliquable qui ouvre un tooltip :

| Subscore | Tooltip |
|---|---|
| Équilibre | "Ratio push/pull. Cible : équilibré selon l'objectif. Un déséquilibre chronique → risque posture et blessure." |
| Récupération | "Fenêtre SRA : temps minimum entre deux sollicitations du même muscle. Trop fréquent → fatigue cumulée." |
| Cohérence obj. | "Les exercices correspondent-ils à l'objectif ? Hypertrophie = 6–15 reps, RIR 1–3, exercices polyarticulaires." |
| Progression | "RIR semaine 1 ≥ 1 requis pour laisser une marge. RIR = 0 dès semaine 1 = stagnation rapide." |
| Couverture | "Patterns requis par l'objectif tous présents ? Hypertrophie = push + pull + jambes + core minimum." |
| Diversité | "Exercices en doublon (même pattern + mêmes muscles) diluent le stimulus sans apport nouveau." |
| Charge articulaire | "Stress cumulé sur épaule, genou, rachis. Croise avec les restrictions du profil client." |
| Coordination | "Complexité motrice adaptée au niveau. Un débutant avec des exercices très techniques = risque d'exécution." |
| Volume MEV/MRV | "Volume hebdomadaire par groupe musculaire vs. seuils Israetel/RP (MEV = minimum, MAV = optimal, MRV = maximum)." |

---

## Heatmap — structure placeholder

La heatmap conserve la structure tableau (muscle × semaine) mais :

- **Les chiffres bruts sont retirés** — remplacés par des cellules colorées pleine largeur
- **Couleurs** : vert (#1f8a65) = optimal (<30%), amber (#f59e0b) = élevé (30–60%), rouge (#ef4444) = critique (>60%)
- **Légende** : bande horizontale sous le titre avec 3 pastilles colorées + label
- **Note explicative** : texte gris sous le titre — "Simulation statique (programme actuel × 4 sem.) — surcharge progressive à venir"
- **Les 4 colonnes restent identiques** mais c'est maintenant explicite et attendu

---

## Overrides — tooltips par pattern

| Pattern | Tooltip |
|---|---|
| horizontal_push | "Multiplie le poids des exercices de poussée horizontale (développé couché, dips…)" |
| vertical_push | "Multiplie le poids des exercices de poussée verticale (développé militaire, push press…)" |
| horizontal_pull | "Multiplie le poids des tirages horizontaux (rowing, tirage câble buste penché…)" |
| vertical_pull | "Multiplie le poids des tirages verticaux (traction, tirage poulie haute…)" |
| elbow_flexion | "Multiplie le poids des exercices de flexion coude (curl biceps…)" |
| elbow_extension | "Multiplie le poids des exercices de triceps (extensions, pushdown…)" |
| squat_pattern | "Multiplie le poids des exercices de squat (squat barre, goblet squat…)" |
| hip_hinge | "Multiplie le poids des exercices de charnière hanche (soulevé de terre, hip thrust…)" |
| core_flex / core_anti_flex | "Multiplie le poids des exercices de gainage et flexion abdominale" |

---

## Fichiers impactés

| Fichier | Action |
|---|---|
| `components/programs/ProgramIntelligencePanel.tsx` | Refactor majeur — absorbe LabModeSection, supprime grille subscores, alertes, donut |
| `components/programs/studio/LabModeSection.tsx` | Supprimé — contenu migré dans ProgramIntelligencePanel |
| `components/programs/studio/IntelligencePanelShell.tsx` | Retirer le prop forwarding vers LabModeSection |
| `components/programs/studio/EditorPane.tsx` | Retirer l'import et le rendu de LabModeSection |
| `components/programs/ProgramTemplateBuilder.tsx` | Nettoyer le wiring LabModeSection (presentPatterns, labOverrides, onOverrideChange, onOverrideReset) → passer directement à ProgramIntelligencePanel |

---

## Props du nouveau ProgramIntelligencePanel

```typescript
interface Props {
  result: IntelligenceResult
  meta: TemplateMeta
  morphoConnected: boolean
  morphoDate?: string
  sraHeatmap?: SRAHeatmapWeek[]
  labOverrides?: Record<string, number>
  presentPatterns?: string[]
  onOverrideChange?: (pattern: string, value: number) => void
  onOverrideReset?: () => void
  onAlertClick?: (sessionIndex: number, exerciseIndex: number) => void  // conservé pour les badges inline
}
```

---

## Ce qui ne change PAS

- `IntelligenceAlertBadge.tsx` — badges alertes inline sur chaque exercice, inchangés
- `ExerciseAlternativesDrawer.tsx` — inchangé
- `lib/programs/intelligence/*` — aucun changement moteur
- `IntelligencePanelShell.tsx` — modes dock/float/minimize conservés, juste nettoyage du prop LabMode

---

## Hors scope (phase suivante)

- Simulation progressive réelle de la heatmap (calcul semaine par semaine avec surcharge +1 série)
- Persistance des overrides en base
- Mode "expert" vs "débutant" pour masquer le Lab

---

## Critères de succès

- Aucun subscore affiché deux fois dans le même état du panneau
- Aucune alerte dans le panneau (uniquement badges inline exercice)
- Le Lab Mode est fermé par défaut et s'ouvre en accordéon
- Chaque subscore dans le Lab a un tooltip explicatif accessible
- La heatmap a une légende et une note explicative
- Chaque slider override a un tooltip contextuel
- 0 erreur TypeScript après refactor
