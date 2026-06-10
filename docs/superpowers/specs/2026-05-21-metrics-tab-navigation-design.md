# Metrics Tab Navigation — Design Spec

**Date:** 2026-05-21
**Status:** Approved
**Scope:** Refonte complète de `/client/metrics` — 3 onglets, charts expand-inline, body silhouette SVG, vitalité check-ins

---

## Contexte

Page actuelle `MetricsPage.tsx` : TopBar fixe + hero avatar + `BodyDataSection` (sparkline poids minimaliste, 2 cards composition, liste mensurations). Source de données : `assessment_submissions` + `assessment_responses`.

L'objectif est d'aligner la structure de cette page sur le pattern NutritionClientPage et ProgrammeClientPage : tab bar + contenu par onglet + charts interactifs.

---

## Structure de navigation

3 onglets identiques au pattern DS v4.0 :

| ID | Label | Source données |
|----|-------|----------------|
| `corps` | Données corporelles | `assessment_submissions` → `assessment_responses` |
| `mensurations` | Mensurations | `assessment_submissions` → `assessment_responses` |
| `vitalite` | Vitalité | `client_daily_checkins` (30 derniers jours) |

Tab bar : pills scrollables horizontales, actif `bg-[#f2f2f2] text-[#080808]`, inactif `text-[#5a5a5a]`, `rounded-full`, `text-[11px] font-barlow-condensed font-bold uppercase tracking-[0.12em]`.

---

## Architecture des composants

```
app/client/metrics/page.tsx                       (Server Component — auth + resolveClient)
  └─ components/client/MetricsClientPage.tsx       (Client Component — fetch + tabs)
       ├─ components/client/metrics/BodyDataTab.tsx
       │    └─ MetricCard.tsx × 3 (Poids, MG%, Masse maigre)
       │         └─ MetricExpandedChart.tsx (expand inline)
       │
       ├─ components/client/metrics/MesurationsTab.tsx
       │    ├─ BodySilhouette.tsx            (SVG frontale + sélecteur bilan)
       │    └─ MetricCard.tsx × 4 (Taille, Hanches, Bras, Poitrine)
       │
       └─ components/client/metrics/VitalityTab.tsx
            ├─ VitalityScoreHero.tsx          (score agrégé + mini courbe 7j)
            └─ MetricCard.tsx × 4 (Énergie, Sommeil, Stress, Courbatures)
```

---

## Approche data (A — single fetch au mount)

`MetricsClientPage` déclenche `Promise.all` au mount :

```ts
const [bodyData, vitalityData] = await Promise.all([
  fetch('/api/client/body-data'),
  fetch('/api/client/vitality'),
])
```

Tabs = switching client-side pur, zéro latence post-chargement.

---

## API — `/api/client/body-data` (extension)

Retour actuel étendu avec :

```ts
{
  // existant
  weightSeries:   { date: string; value: number }[]
  composition:    { body_fat_pct, lean_mass_kg, muscle_mass_kg }
  measures:       { waist_cm, hips_cm, arm_cm, chest_cm }
  latestWeight:   number | null

  // nouveau
  bodyFatSeries:  { date: string; value: number; bilanIndex: number }[]
  leanMassSeries: { date: string; value: number; bilanIndex: number }[]

  measuresByBilan: {
    bilanIndex: number   // 1, 2, 3… (ordre chronologique)
    date: string
    waist_cm:  number | null
    hips_cm:   number | null
    arm_cm:    number | null
    chest_cm:  number | null
  }[]

  annotations: {
    date: string
    label: string
  }[]
}
```

`bilanIndex` = ordre chronologique 1-based. Calculé server-side depuis l'ordre `bilan_date ASC`.
`annotations` = fetch depuis `metric_annotations` (`event_type != 'injury'`, `label IS NOT NULL`).

---

## API — `/api/client/vitality` (nouvelle route)

```ts
// GET /api/client/vitality
{
  score: number   // 0–100 agrégé
  trend: {
    date: string
    energy:   number | null   // 1–5
    sleep:    number | null   // 1–5
    stress:   number | null   // 1–5
    soreness: number | null   // 1–5
    hunger:   number | null   // 1–5
  }[]
}
```

Formule score : `(energy * 1.5 + sleep * 1.5 − stress − soreness * 0.5) / 4.5 × 100`, clampé 0–100.
Calculé sur les 7 derniers jours avec check-in. Si 0 check-ins → score `null`.

Labels qualitatifs :
- ≥ 90 → "Excellent"
- ≥ 70 → "Bonne forme"
- ≥ 50 → "Attention"
- < 50 → "À surveiller"

---

## Composant `MetricCard` (générique, réutilisé 11×)

Props :

```ts
interface MetricCardProps {
  label: string
  value: string            // "82.4 kg", "18.2%", "4.2 / 5"
  delta?: string           // "−1.2 kg", "+0.3%"
  deltaPositive?: boolean  // true = couleur neutre (#a0a0a0), false = rouge
  series: { date: string; value: number; bilanIndex?: number }[]
  unit: string
  annotations?: { date: string; label: string }[]
}
```

**État fermé :**
```
┌─────────────────────────────────────────┐
│  POIDS                        82.4 kg   │
│                              ↓ −1.2 kg  │
│  ▁▂▃▄▅▆▇  (sparkline 48px)             │
└─────────────────────────────────────────┘
```
`bg-[#161616] rounded-2xl p-4`
Valeur : `text-[22px] font-black text-[#f2f2f2]`
Delta : `text-[11px] text-[#a0a0a0]` si positif (perte poids = bon), `text-red-400` si négatif

**État expand (inline, `transition-all duration-300`) :**
```
┌─────────────────────────────────────────┐
│  POIDS                        82.4 kg   │
│                              ↓ −1.2 kg  │
│  ┌───────────────────────────────────┐  │
│  │  ●───●──────●────────●            │  │
│  │  B1  B2     B3       B4           │  │
│  │  15 fév  12 avr  8 mai  3 juil    │  │
│  └───────────────────────────────────┘  │
│  MIN 79.1    MOY 81.3    MAX 84.0       │
└─────────────────────────────────────────┘
```
Courbe SVG plein largeur (hauteur 120px).
Repères bilans : `Bx` au-dessus du point + date en `text-[9px] text-[#5a5a5a]` en dessous.
Annotations coach : ligne verticale `stroke-dasharray="2,2"` `stroke="#5a5a5a"` + label flottant au-dessus.
MIN / MOY / MAX : 3 stats en bas, `text-[10px] font-barlow-condensed font-bold uppercase text-[#5a5a5a]`.

État géré localement : `const [expanded, setExpanded] = useState(false)` dans `MetricCard`. Tap sur card → toggle.

---

## Onglet "Données corporelles"

3 cards empilées :
1. **Poids** — `weightSeries`, unité `kg`, delta vs premier bilan
2. **Masse grasse** — `bodyFatSeries`, unité `%`, delta en %
3. **Masse maigre** — `leanMassSeries`, unité `kg`, delta en kg

Cards masquées si série vide (pas de données). Si aucune carte affichable → empty state `"Aucune donnée corporelle enregistrée. Votre coach doit compléter un bilan."`.

---

## Onglet "Mensurations"

### Section 1 — BodySilhouette

**Sélecteur de bilan :** pills horizontales scrollables en haut.
- Format : `Bilan 1 · 15 fév`, `Bilan 2 · 12 avr`…
- Actif : `bg-[#f2f2f2] text-[#080808]`
- Si 1 seul bilan → sélecteur masqué (pas de navigation)
- Bilan sélectionné par défaut : le plus récent

**SVG silhouette :**
- viewBox réutilisant la géométrie du BodyMap existant (`42 42 616 1308`)
- Rendu à `w-[120px]` (légèrement plus large que le BodyMap à 88px)
- Contours uniquement : tête, cou, torse, bras, hanches, jambes — paths simplifiés sans subdivisions musculaires
- `fill="rgba(255,255,255,0.05)"` `stroke="rgba(255,255,255,0.15)"` `strokeWidth="1"`

**Lignes de mesure (points d'ancrage dans le viewBox) :**

| Mesure | y dans viewBox | Côté |
|--------|---------------|------|
| Poitrine | ~422 | gauche + droite |
| Taille | ~530 | gauche + droite |
| Hanches | ~647 | gauche + droite |
| Bras | ~492 | gauche uniquement |

Chaque ancrage :
- Ligne pointillée horizontale `stroke-dasharray="3,3" stroke="rgba(255,255,255,0.2)"`
- Valeur numérique `text-[11px] font-barlow font-bold text-[#f2f2f2]` + `cm`
- Delta vs bilan précédent `text-[9px] text-[#5a5a5a]` (ex: `↓2cm`, `↑1cm`)
- Si mesure absente pour le bilan sélectionné → `—` à la place

**Comportement :** changement de bilan sélectionné → mise à jour instantanée des valeurs (state React, pas de fetch supplémentaire — toutes les données sont dans `measuresByBilan`).

### Section 2 — Cards mensurations

4 cards `MetricCard` avec série temporelle par bilan :
1. Tour de taille (`waist_cm`)
2. Hanches (`hips_cm`)
3. Bras (`arm_cm`)
4. Poitrine (`chest_cm`)

Même logique expand-inline. Repères bilans numérotés sur la courbe.

---

## Onglet "Vitalité"

### VitalityScoreHero

```
┌─────────────────────────────────────────┐
│  SCORE FORME              78 / 100      │
│  ████████████░░░░░░░░                   │
│  Bonne forme · 12 check-ins ce mois     │
└─────────────────────────────────────────┘
```
`bg-[#161616] rounded-2xl p-4`
Barre de progression : `bg-[#f2f2f2]` sur `bg-[#222222]` `rounded-full h-1.5`
Si 0 check-ins → card masquée + message "Complétez vos check-ins quotidiens pour voir votre score de forme."

### Cards vitalité

4 cards `MetricCard` réutilisé :
1. **Énergie** — série daily, unité `/ 5`, delta moyenne 7j vs 7j précédents
2. **Sommeil** — même structure
3. **Stress** — delta inversé (stress en baisse = positif)
4. **Courbatures** — même structure

Courbe = 30 derniers jours (x = date, y = valeur 1–5). Pas de repères bilans sur ces courbes (données quotidiennes, pas de bilan). Sélecteur de période `7j / 14j / 30j` dans l'en-tête expand.

---

## Tokens DS v4.0 appliqués

| Élément | Token |
|---------|-------|
| Background page | `#080808` |
| Surface cards | `#161616` |
| Barre progress inactive | `#222222` |
| Texte principal | `#f2f2f2` |
| Texte secondaire | `#5a5a5a` |
| Tab actif bg | `#f2f2f2` |
| Tab actif text | `#080808` |
| Delta neutre (positif) | `#a0a0a0` |
| Delta négatif | `text-red-400` |
| Radius cards | `rounded-2xl` |
| Radius pills | `rounded-full` |

Aucun `shadow-*`, aucun gradient coloré, aucun `rounded-[2px]`.

---

## Gestion des états vides

| Situation | Comportement |
|-----------|-------------|
| 0 bilans | Tab "Corps" + "Mensurations" → empty state explicatif |
| 1 bilan | BodySilhouette sans sélecteur, courbes avec 1 seul point (pas de sparkline) |
| 0 check-ins | Tab "Vitalité" → message "Complétez vos check-ins" |
| Métrique absente d'un bilan | Card masquée ou `—` dans silhouette |

---

## Fichiers à créer / modifier

### Nouveaux fichiers
- `components/client/metrics/BodyDataTab.tsx`
- `components/client/metrics/MesurationsTab.tsx`
- `components/client/metrics/VitalityTab.tsx`
- `components/client/metrics/MetricCard.tsx`
- `components/client/metrics/MetricExpandedChart.tsx`
- `components/client/metrics/BodySilhouette.tsx`
- `components/client/metrics/VitalityScoreHero.tsx`
- `app/api/client/vitality/route.ts`

### Fichiers modifiés
- `app/api/client/body-data/route.ts` — extension avec `bodyFatSeries`, `leanMassSeries`, `measuresByBilan`, `annotations`
- `components/client/MetricsClientPage.tsx` — remplace `MetricsPage.tsx`, ajoute tab bar + fetch vitality
- `app/client/metrics/page.tsx` — minor (import MetricsClientPage si renommage)
- `components/client/profile/BodyDataSection.tsx` — conservé pour compatibilité profil existant (non supprimé)

---

## Contraintes techniques

- `BodySilhouette` paths SVG basés sur la géométrie du `BodyMap.tsx` existant — réutiliser les coordonnées des contours externes uniquement
- `MetricExpandedChart` : SVG pur (pas Recharts) pour cohérence avec sparklines existantes
- Sélecteur période vitalité (7j/14j/30j) : filtre client-side sur `trend[]`, pas de re-fetch
- Animations expand : `transition-all duration-300 ease-in-out` sur `max-height` + `opacity`
- iOS Safari : pas de `input[type=range]` dans cette feature, pas de contrainte slider
