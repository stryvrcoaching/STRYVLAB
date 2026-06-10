# Check-in Hub Refonte — Implementation Plan

> Validé 2026-06-02. Config = profil (fait). Cette refonte = analytics.

**Goal:** Page check-in coach au niveau Data Performance : skeleton, design soigné, données riches. + mini-aperçu dans le profil + suppression de la page orpheline.

**Architecture:**
- `components/clients/CheckinHub.tsx` — dashboard analytics (skeleton, header, stat tiles, heatmap période, historique drill-down). Consomme `checkin-summary` + `checkin-history`. Design calqué sur `PerformanceHub` (SectionHeader, StatTile, toneClasses, sélecteur période 30/60/90).
- `app/coach/clients/[clientId]/data/checkins/page.tsx` — refait : `useClientTopBar("Check-ins")` + `<CheckinHub clientId/>`. **Plus d'éditeur de config** (config = profil).
- `components/coach/CheckinConfigWidget.tsx` (profil) — ajouter un **mini-aperçu** (adhérence 7j + streak + dernier check-in) + bouton "Voir le détail →" vers `/coach/clients/[id]/data/checkins`.
- **Supprimer** `app/coach/clients/[clientId]/check-ins/page.tsx` (orpheline, non liée).

**Tech:** Next client components, DS v2.0 coach (#121212, bg-white/[0.02], rounded-2xl, border-[0.3px] white/[0.06], accent #1f8a65). Skeleton from `@/components/ui/skeleton`.

---

## APIs (existantes, réutilisées)
- `GET /api/clients/[id]/checkin-summary?days=N` → `{ field_averages, response_rate, configured_days_count, streak, config, heatmap: {date:{morning,evening,late}}, responses_by_date }`
- `GET /api/clients/[id]/checkin-history?limit=N&page=P` → `{ data: [{moment, responses, responded_at}], total, page, limit }`

---

## Task 1 — CheckinHub (analytics)
**Files:** Create `components/clients/CheckinHub.tsx`
- [ ] Skeleton state (no "Chargement…" text).
- [ ] Header: titre + sélecteur période (30/60/90j) façon PerformanceHub.
- [ ] StatTiles: taux de réponse %, streak courant, jours configurés, moyenne énergie/sommeil/stress (depuis field_averages).
- [ ] Heatmap période (grille jours, dot matin/soir, late) — lift de l'ancienne `check-ins/page.tsx` (lignes heatmap) + design soigné.
- [ ] Historique: liste des check-ins (history API) avec valeurs par champ, drill-down jour.
- [ ] Empty states soignés (pas de config / pas de données).
- [ ] tsc 0 erreur.

## Task 2 — Refactor data/checkins page
**Files:** Modify `app/coach/clients/[clientId]/data/checkins/page.tsx`
- [ ] Remplacer le contenu par `useClientTopBar("Check-ins")` + `<main bg-[#121212]>` + `<CheckinHub clientId={clientId} />`.
- [ ] Retirer tout l'éditeur de config (toggles moments/fields) — config = profil.
- [ ] Garde `<Skeleton>` pendant le chargement (dans CheckinHub).

## Task 3 — Mini-aperçu profil
**Files:** Modify `components/coach/CheckinConfigWidget.tsx`
- [ ] Sous les toggles config, ajouter un bloc "Aperçu" : fetch `checkin-summary?days=7` → mini-strip 7 jours (dots matin/soir) + streak + taux 7j.
- [ ] Bouton "Voir le détail →" → `router.push('/coach/clients/${clientId}/data/checkins')`.
- [ ] Skeleton léger pour l'aperçu.

## Task 4 — Supprimer l'orpheline
- [ ] `git rm app/coach/clients/[clientId]/check-ins/page.tsx` (vérifier 0 lien — confirmé : nav pointe `data/checkins`).
- [ ] tsc + grep `/check-ins` résiduels.

## Task 5 — Docs
- [ ] CHANGELOG + project-state.

## Self-review
- Config single-source (profil) ✔ ; analytics dédiées ✔ ; orpheline supprimée ✔ ; skeleton partout ✔.
- Clés canoniques : APIs renvoient déjà colonnes DB canoniques ; CheckinHub mappe via fieldRegistry labels si besoin.
