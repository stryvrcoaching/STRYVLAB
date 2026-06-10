# Phase Optimization v2 — Multi-Signal Engine Implementation Plan

**Goal:** Étendre `Phase Optimization` en moteur de cohérence de phase multi-signal, tolérant aux données manquantes, avec score de phase + direction + confiance.

**Spec:** `docs/superpowers/specs/2026-05-31-phase-optimization-v2-multisignal-design.md`

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Modify | `lib/coach/phaseEngine/types.ts` | Ajouter nutrition input + nouveaux signaux dérivés |
| Modify | `lib/coach/phaseEngine/signals.ts` | Calculer trainingTolerance, nutritionAdherence, bodyResponseMatch, phaseCompatibility |
| Modify | `lib/coach/phaseEngine/engine.ts` | Nouveau `phaseFitScore`, dynamic weights, veto rules |
| Modify | `lib/coach/phaseEngine/confidenceModel.ts` | Couverture nutrition + steps + training density |
| Modify | `lib/coach/phaseEngine/footerMetrics.ts` | Exposer nouvelles cartes utiles |
| Modify | `lib/coach/phaseEngine/coachDecision.ts` | Nouveau wording coach + why + target direction |
| Modify | `app/api/clients/[clientId]/phase-optimization/route.ts` | Construire input nutrition + steps + adherence |
| Modify | `components/coach/PhaseOptimizationWidget.tsx` | Afficher score de phase, confiance, direction, signaux dominants |
| Create | `tests/lib/phaseEngine/signals.multisignal.test.ts` | Cas nutrition / steps / performance partielle |
| Create | `tests/lib/phaseEngine/engine.multisignal.test.ts` | Cas cut/bulk/maintenance + veto rules |

---

## Phase 1 — Contract Extension

- [ ] Étendre `RawSignalInput` avec `nutrition`
- [ ] Ajouter nouveaux `DerivedSignals`
- [ ] Ajouter structure `phaseFitScore` si distincte de `confidence`
- [ ] Garder compat rétro avec appels existants

### Acceptance

- Le moteur compile sans casser la v1
- Les nouveaux champs sont optionnels

---

## Phase 2 — New Derived Signals

- [ ] Ajouter `trainingTolerance`
- [ ] Ajouter `nutritionAdherence`
- [ ] Ajouter `calorieCompliance`
- [ ] Ajouter `proteinCompliance`
- [ ] Ajouter `hydrationCompliance`
- [ ] Ajouter `bodyResponseMatch`
- [ ] Ajouter `phaseCompatibility`
- [ ] Ajouter `stepLoadStability`

### Acceptance

- Chaque signal a :
  - `value`
  - `observed`
  - `confidence`
- Les signaux absents n'explosent pas le moteur

---

## Phase 3 — Dynamic Phase Fit Score

- [ ] Introduire weights par objectif
- [ ] Ajouter redistribution si dimensions absentes
- [ ] Calculer `phaseFitScore` séparément de `confidence`
- [ ] Ajouter `phaseFitBand` (`optimal`, `workable`, `fragile`, `incoherent`)

### Acceptance

- Un client très partiel a un score prudent et une confiance basse
- Un client riche en données a un score plus discriminant

---

## Phase 4 — Veto Rules

- [ ] Veto déficit agressif si surcharge récupération
- [ ] Veto bulk si faible adhérence + dérive taille
- [ ] Veto progression si catabolic risk
- [ ] Transformer les veto en `constraintFlags` + `reasons`

### Acceptance

- Une direction interdite n'est jamais recommandée même si le score moyen est bon

---

## Phase 5 — Route Input Assembly

- [ ] Lire la cible protocole nutritionnel active
- [ ] Lire l'apport réel depuis meal logs
- [ ] Calculer moyennes calories / protéines / hydratation
- [ ] Estimer la couverture de logs nutrition
- [ ] Injecter `steps` si disponibles

### Acceptance

- Si logs absents : `nutrition.source = protocol_only | none`
- Si logs présents : `nutrition.source = logs | mixed`

---

## Phase 6 — Coach UI

- [ ] Hero card : `Phase Fit Score`
- [ ] Afficher `Current State`
- [ ] Afficher `Recommended Direction`
- [ ] Afficher `Confidence`
- [ ] Afficher `Why`
- [ ] Afficher 2–3 signaux dominants max

### Acceptance

- En un coup d'oeil, le coach comprend :
  - si la phase tient
  - ce qu'il faut faire
  - pourquoi
  - avec quel niveau de certitude

---

## Phase 7 — Tests

- [ ] Cas minimal sans nutrition
- [ ] Cas cut cohérent
- [ ] Cas cut incohérent
- [ ] Cas lean bulk mal toléré
- [ ] Cas bonne perf mais récupération dégradée
- [ ] Cas nutrition faible mais body response bonne
- [ ] Cas données contradictoires

---

## Recommended Delivery Order

1. Types
2. Route input nutrition
3. Derived signals
4. Phase fit scoring
5. Veto rules
6. UI
7. Tests

---

## Out of Scope

- `HRV` obligatoire
- imports wearables complexes
- coach custom weights UI
- refonte complète de toutes les sections détaillées

---

## Success Criteria

- Le moteur reste stable avec données partielles
- Le score devient plus précis avec données riches
- La direction recommandée tient compte de :
  - récupération
  - entraînement
  - nutrition
  - réponse corporelle
  - protocole actif
- Le coach peut décider en un coup d'oeil

