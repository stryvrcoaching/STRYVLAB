# Dashboard Client v2 — Adherence Score + Action System

**Date:** 2026-05-20  
**Scope:** `app/client/page.tsx` + nouveaux composants dashboard  
**Remplace:** `DashboardHeroSnapshot`, `DashboardAlertsFeed`, `SmartWorkoutWidget` (sur home), `SmartNutritionWidget` (sur home)

---

## Vision

Dashboard = cockpit. Répond à deux questions dans l'ordre :
1. **"Où j'en suis ?"** — score global + 4 dimensions, comparaison avec hier
2. **"Qu'est-ce que je fais maintenant ?"** — action prioritaire + liste du jour

Tout est cliquable. Chaque card mène vers l'action ou la page correspondante.

---

## Layout — 4 blocs full-width

```
HEADER : "Aujourd'hui — Mardi 19 mai"  (jamais abréger, jamais tronquer)

[1] AdherenceScoreCard     hero — fond coloré selon score
[2] PriorityActionCard     action urgente contextuelle
[3] DayChecklist           liste actions du jour cliquables
[4] SmartAgendaTimeline    timeline logs (inchangé)
```

Supprimés du home : `DashboardHeroSnapshot`, `DashboardAlertsFeed`, `SmartWorkoutWidget`, `SmartNutritionWidget`

---

## Bloc 1 — AdherenceScoreCard

**Fichier :** `components/client/smart/AdherenceScoreCard.tsx`

### Score global

Calculé côté serveur dans `page.tsx`. Agrège 4 dimensions :

| Dimension | Données source | Score /25 |
|-----------|---------------|-----------|
| Sport | sessions complétées / sessions planifiées (7j) | 0–25 |
| Nutrition | jours avec kcal loggées / 7 | 0–25 |
| Hydratation | jours avec eau ≥ 80% cible / 7 | 0–25 |
| Check-ins | check-ins réalisés / 7 | 0–25 |

Score global = somme des 4 (0–100).

Delta vs hier : recalculer sur J-1 → afficher `+3` ou `-2` en petit.

### Couleur fond card selon score

| Score | Fond | Accent |
|-------|------|--------|
| ≥ 75 | `#0d1a0d` (vert très sombre) | `#4ade80` |
| 50–74 | `#1a1500` (jaune très sombre) | `#ffe01e` |
| < 50 | `#1a0a0a` (rouge très sombre) | `#ef4444` |

### Label qualitatif

| Score | Label |
|-------|-------|
| ≥ 85 | "Élite" |
| ≥ 75 | "En forme" |
| ≥ 60 | "Bon rythme" |
| ≥ 45 | "À améliorer" |
| < 45 | "Reprends le fil" |

### Anneau SVG

- Demi-cercle (180°), `r=70`, `strokeWidth=14`
- Couleur = accent dynamique
- Fond anneau : `rgba(255,255,255,0.06)`
- Score centré : `font-black font-mono text-[48px]`
- Label sous le score : `text-[11px] uppercase tracking-[0.18em]`

### 4 pills dimensions

Ligne horizontale sous l'anneau. Chaque pill :
- Icône 12px + valeur + label court
- Couleur propre : Sport=`#3b82f6`, Nutrition=`#ffe01e`, Hydra=`#22d3ee`, Check-in=`#a78bfa`
- Fond : `bg-[couleur]/10`, texte : `text-[couleur]`

### Delta

Petit badge top-right : `+3 vs hier` en vert / `-2 vs hier` en rouge. Masqué si delta = 0.

### Props

```ts
type AdherenceScoreCardProps = {
  score: number           // 0–100
  scoreDelta: number      // vs hier (peut être négatif)
  dimensions: {
    sport: number         // 0–25
    nutrition: number     // 0–25
    hydration: number     // 0–25
    checkins: number      // 0–25
  }
}
```

---

## Bloc 2 — PriorityActionCard

**Fichier :** `components/client/smart/PriorityActionCard.tsx`

Card contextuelle — affiche l'action la plus urgente selon heure + données manquantes.

### Règles de priorité (ordre décroissant)

1. **Check-in manquant** : si heure < 12h ET pas de check-in matin → "Démarre ta journée — check-in matin"
2. **Séance planifiée non faite** : si séance aujourd'hui ET pas complétée → "Séance prévue — [nom]"
3. **Repas non loggé** : si heure > 12h ET < 3 repas loggés → "Tu n'as pas encore loggé ton [repas]"
4. **Hydratation faible** : si heure > 15h ET eau < 50% cible → "Hydratation — [X]L / [Y]L"
5. **Protéines en retard** : si heure > 14h ET protéines < 50% cible → "Protéines en retard — [X]g / [Y]g"

Si aucune action urgente → composant non rendu.

### Style

- Border-left 3px coloré selon type (jaune=séance, bleu=check-in, cyan=eau, amber=protéines)
- `bg-[#161616] rounded-2xl px-4 py-4`
- Titre `text-[13px] font-bold text-white`
- Sous-titre `text-[11px] text-white/50`
- Bouton CTA inline right : `bg-[#ffe01e] text-[#0d0d0d] text-[10px] font-bold uppercase px-3 py-1.5 rounded-xl`

### Props

```ts
type PriorityActionCardProps = {
  type: 'checkin' | 'session' | 'meal' | 'water' | 'protein'
  title: string
  subtitle: string
  href: string       // navigation au clic
  ctaLabel: string   // texte bouton
}
```

---

## Bloc 3 — DayChecklist

**Fichier :** `components/client/smart/DayChecklist.tsx`

Liste des actions du jour avec état (fait / à faire). Tout cliquable.

### Items (ordre fixe)

| Item | Icône | État ✓ | Href |
|------|-------|--------|------|
| Check-in matin | `CheckCircle` | si check-in matin présent | `/client/checkin/morning` |
| Séance [nom] | `Barbell` | si session complétée aujourd'hui | `/client/programme` |
| Nutrition — [X] kcal | `ForkKnife` | si ≥ 1 repas loggé | `/client/nutrition` |
| Hydratation — [X]L / [Y]L | `Drop` | si eau ≥ 80% cible | action log eau (ouvre QuickWaterModal) |
| Check-in soir | `Moon` | si check-in soir présent | `/client/checkin/evening` |

### Style

- Card `bg-[#161616] rounded-2xl border border-white/[0.08] overflow-hidden`
- Header `px-4 py-3 border-b border-white/[0.06]` : label "AUJOURD'HUI" + nb items complétés
- Chaque item : `flex items-center gap-3 px-4 py-3 border-b border-white/[0.04] active:bg-white/[0.02]`
- Icône dans cercle 32px coloré si fait, `bg-white/[0.06]` si pas fait
- Texte : `text-[12px] font-semibold` blanc si à faire, `text-white/40 line-through` si fait
- Flèche `ChevronRight` right si à faire, checkmark `#4ade80` si fait

### Props

```ts
type DayChecklistProps = {
  morningCheckin: boolean
  eveningCheckin: boolean
  sessionCompleted: boolean
  sessionName: string | null
  mealsLogged: number
  waterMl: number
  waterTargetMl: number
  onOpenWater: () => void
}
```

---

## Bloc 4 — SmartAgendaTimeline

Inchangé. Reste en bas.

---

## Header

Règle stricte : **jamais abréger le jour de la semaine**. Toujours `"Mardi 19 mai"`, jamais `"MAR. 19 MAI"`.

```ts
const todayLabel = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",   // ← "long" pas "short"
  day: "numeric",
  month: "long",
}).format(new Date())
// → "mardi 20 mai"
```

TopBar section = `"AUJOURD'HUI"`, title = `todayLabel` avec première lettre capitalisée.

---

## Calcul du score — côté serveur (`page.tsx`)

### Queries supplémentaires nécessaires

```ts
// Check-ins 7 derniers jours
svc().from("client_checkins")
  .select("date, moment")
  .eq("client_id", clientId)
  .gte("date", sevenDaysAgo)

// Meals par date 7j (déjà fetchées partiellement — étendre)
// Sessions planifiées du programme actif (déjà disponibles)
// Sessions complétées 7j (déjà fetchées via streakResult — étendre avec count)
// Water logs par date 7j (étendre query existante)
```

### Fonction pure `computeAdherenceScore`

**Fichier :** `lib/client/smart/adherenceScore.ts`

```ts
export function computeAdherenceScore(input: AdherenceInput): AdherenceResult

type AdherenceInput = {
  // 7 derniers jours
  sessionDates: string[]           // dates des séances complétées
  plannedDaysOfWeek: number[]      // jours du programme (1=lun, 7=dim)
  mealDates: string[]              // dates avec ≥1 repas loggé
  waterByDate: Record<string, number>   // date → ml
  waterTargetMl: number
  checkinDates: string[]           // dates avec check-in (matin ou soir)
  referenceDate: string            // aujourd'hui (YYYY-MM-DD)
}

type AdherenceResult = {
  score: number          // 0–100
  scoreDelta: number     // vs J-1 (recalculé sur J-2→J-8)
  dimensions: {
    sport: number        // 0–25
    nutrition: number    // 0–25
    hydration: number    // 0–25
    checkins: number     // 0–25
  }
}
```

---

## Fichiers touchés

| Action | Fichier |
|--------|---------|
| Create | `lib/client/smart/adherenceScore.ts` |
| Create | `components/client/smart/AdherenceScoreCard.tsx` |
| Create | `components/client/smart/PriorityActionCard.tsx` |
| Create | `components/client/smart/DayChecklist.tsx` |
| Delete | `components/client/smart/DashboardHeroSnapshot.tsx` |
| Delete | `components/client/smart/DashboardAlertsFeed.tsx` |
| Modify | `app/client/page.tsx` — nouvelles queries, calcul score, nouveau layout |

`SmartWorkoutWidget` et `SmartNutritionWidget` : retirés du home (conservés dans leurs pages respectives).
