# Tempo Preset Selector — Design Spec

**Date :** 2026-05-16  
**Feature :** Dropdown presets tempo dans le builder coach (ExerciseCard)  
**Statut :** Approuvé

---

## Objectif

Remplacer le champ texte libre `tempo` dans ExerciseCard par un select avec presets documentés + fallback manuel. La convention ECC-PB-CON-PH est affichée dans le label. Le coach comprend ce qu'il choisit sans quitter le builder.

---

## Scope

**Un seul fichier modifié :** `components/programs/studio/ExerciseCard.tsx`

Zéro nouveau fichier. Le composant `TempoSelector` est défini inline dans ExerciseCard.

---

## Presets

```typescript
const TEMPO_PRESETS = [
  {
    label: 'Hypertrophie standard',
    value: '3-1-2-0',
    note: 'ECC lent (3s) → étirement (1s) → CON contrôlé (2s) → pas de pause haut',
  },
  {
    label: 'Hypertrophie excentrique',
    value: '4-0-2-0',
    note: 'ECC très lent (4s) → CON rapide (2s) — tension excentrique maximale',
  },
  {
    label: 'Force / Puissance',
    value: '2-0-X-0',
    note: 'ECC contrôlé (2s) → CON explosif (X) — recrutement neuromusculaire max',
  },
  {
    label: 'Endurance / Cardio',
    value: '2-0-2-0',
    note: 'Tempo modéré, soutenable sur hautes répétitions',
  },
  {
    label: 'Explosif pur',
    value: 'X-0-X-0',
    note: 'Toutes phases aussi vite que possible — puissance athlétique',
  },
  {
    label: 'Manuel',
    value: '__manual__',
    note: '',
  },
] as const
```

**Valeur sentinelle `__manual__`** : jamais persistée en DB. Sert uniquement à afficher l'input texte libre.

---

## UI

### Label

```
TEMPO (ECC – PB – CON – PH)
```

Convention intégrée dans le label — pas de tooltip séparé. `ECC` = excentrique (descente/allongement), `PB` = pause basse, `CON` = concentrique (montée/contraction), `PH` = pause haute.

### Select

Même style que les autres inputs de la card :
- `bg-[#0a0a0a]` fond
- `border-[0.3px] border-white/[0.06]`
- `rounded-md text-[11px] text-white/80 px-1.5 py-1 outline-none`

Options formatées : `"Hypertrophie standard  ·  3-1-2-0"` (label + valeur sur la même ligne via `option` text).

### Note dynamique

Ligne sous le select : `text-[9px] text-white/25 leading-relaxed mt-0.5`

Contenu = `preset.note`. Vide si preset "Manuel" sélectionné.

### Champ Manuel

Apparaît uniquement si `selectedPreset === '__manual__'` :

- `<input type="text">` style identique aux autres inputs mono de la card
- Placeholder : `"ex: 3-1-2-0"`
- Validation au `onBlur` : regex `/^[0-9X]-[0-9X]-[0-9X]-[0-9X]$/i`
- Invalide → `border-red-500/40` + texte `text-[9px] text-red-400/60 mt-0.5` : `"Format attendu : 3-1-2-0"`
- Valide → `onUpdate({ tempo: inputValue })`

---

## Logique de détection au chargement

```typescript
function detectPreset(tempo: string | null): string {
  if (!tempo) return '3-1-2-0'          // défaut hypertrophie standard
  const match = TEMPO_PRESETS.find(p => p.value === tempo && p.value !== '__manual__')
  return match ? match.value : '__manual__'
}
```

- `exercise.tempo === null` → select positionné sur "Hypertrophie standard" (3-1-2-0), mais `onUpdate` pas appelé (valeur DB reste null → auto-défaut calculé à runtime)
- `exercise.tempo` correspond à un preset → select positionné sur ce preset
- `exercise.tempo` est une valeur manuelle → select sur "Manuel", input prérempli

---

## Comportement `onUpdate`

| Action coach | Valeur DB |
|-------------|-----------|
| Sélectionne un preset | `tempo = preset.value` (ex: "3-1-2-0") |
| Saisit Manuel valide | `tempo = inputValue` |
| Manuel invalide (blur sans correction) | Pas d'update |
| Revient à preset après Manuel | `tempo = preset.value` |

**Important :** quand `exercise.tempo === null` au chargement et que le coach ne touche rien, `onUpdate` n'est jamais appelé — DB reste `null` (tempo auto-calculé à runtime par `getDefaultTempo`). Si le coach sélectionne "Hypertrophie standard" explicitement, `tempo = "3-1-2-0"` est persisté.

---

## Fichier modifié

| Fichier | Changement |
|---------|------------|
| `components/programs/studio/ExerciseCard.tsx` | Remplacer le bloc `{/* Tempo d'exécution */}` (champ texte) par le select + note + input conditionnel |

---

## Invariants

- `__manual__` jamais persisté en DB — toujours intercepté avant `onUpdate`
- Validation uniquement au blur (pas en live — évite les erreurs pendant la frappe)
- `parseTempo` de `lib/training/tempo.ts` réutilisé pour la validation Manuel (pas de regex dupliquée)
- Si `parseTempo(inputValue) === null` → invalide

---

## Non-inclus

- Presets côté client (SessionLogger) — Phase 2 si besoin
- Preset "Isométrique" (temps de pause dominant) — pas de demande actuelle
- Custom presets sauvegardables par coach — YAGNI
