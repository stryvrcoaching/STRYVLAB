# STRYVR — Application Mobile de Transformation Physique

## Écosystème STRYVLAB

---

## Vision

STRYVR est le coach physiologique intelligent dans ta poche.
Pas un tracker de calories. Pas un générateur de programmes.
Un moteur qui comprend ta physiologie, s'adapte à ton rythme,
et prend des décisions coaching fondées sur la science.

Marché principal : Belgique
Marché secondaire : France
Langue : Français

---

## Ce que STRYVR fait différemment

- Moteur physiologique basé sur un Référentiel Scientifique propriétaire
- Adaptation au cycle féminin (modulations nutritionnelles et training)
- Détection des phénomènes physiologiques (adaptation métabolique,
  memory effect, rebond post-cut, sensibilité insuline)
- Safety Layer intégré (RED-S, overreaching, TCA, conditions médicales)
- Nutrition Composer propriétaire (saisie guidée 4 couches)
- Smart Agenda comme surface d'interaction centrale
- iOS + Android simultanément dès la V1

---

## Stack technique

Mobile : Expo SDK 52+ (React Native + TypeScript)
Backend : Supabase (PostgreSQL EU West — Frankfurt)
Cache : TanStack Query v5
Animations : React Native Reanimated 3
Santé : react-native-health (HealthKit) +
react-native-health-connect (Android)
Builds : EAS Build + EAS Update (OTA)

---

## Structure du repo

stryvlab/
├── [plateforme coach existante]
└── stryvr/ ← App mobile
├── app/ ← Expo Router (routes)
├── components/ ← Design system + composants
├── lib/ ← Logique métier + queries
├── supabase/ ← Migrations SQL + Edge Functions
├── constants/ ← Tokens design + enums
├── types/ ← Types TypeScript
├── ARCHITECTURE.md ← Stack + SQL + conventions
├── REFERENTIEL.md ← Référentiel Scientifique V1.0.0
├── FUNCTIONAL_SPEC.md ← Cahier Fonctionnel V1.0.1
└── SESSION_LOG.md ← Journal des sessions Claude Code

---

## Documentation

| Document           | Contenu                                                     | Lignes   |
| ------------------ | ----------------------------------------------------------- | -------- |
| ARCHITECTURE.md    | Stack, SQL complet (20 tables), Edge Functions, conventions | ~600     |
| REFERENTIEL.md     | Référentiel Scientifique V1.0.0 (5 modules, 68 refs)        | ~1200    |
| FUNCTIONAL_SPEC.md | Cahier Fonctionnel V1.0.1 (20 entités, 8 flux, outputs)     | ~2000    |
| SESSION_LOG.md     | Journal des sessions de développement                       | évolutif |

---

## Modèle de données — 20 entités PostgreSQL

CORE : users, user_notification_preferences, healthkit_sync_logs
MESURES : body_measurements, daily_checkins, cycle_logs
NUTRITION : nutrition_entries, meals, food_items,
hydration_entries, supplement_entries, supplement_references
TRAINING : training_sessions, mesocycles
ÉTAT : phases, motor_states, interventions,
alert_logs, monthly_summaries, message_history

---

## Flux fonctionnels — 8 flux

Flux 1 : Onboarding
Flux 2 : Check-in quotidien
Flux 3A : Capture nutritionnelle (Nutrition Composer)
Flux 3B : Traitement nutritionnel
Flux 3C : Tracking training
Flux 4 : Bilan hebdomadaire
Flux 5 : Transitions et événements ponctuels
Flux 6 : Safety Layer continu
Flux 7 : Bilan mensuel

---

## Plan de développement

SESSION 1 : Setup Expo + Supabase + migrations + Auth
SESSION 2 : Onboarding (9 étapes + calcul moteur)
SESSION 3 : Smart Agenda + Check-in
SESSION 4 : Nutrition Composer + scan
SESSION 5 : Hydratation + Compléments
SESSION 6 : Training + HealthKit + Health Connect
SESSION 7 : Bilan hebdomadaire
SESSION 8 : Safety Layer + Notifications
SESSION 9 : Transitions + Protocoles
SESSION 10 : Animations premium + Polish
SESSION 11 : Soumission App Store + Google Play

---

## Relation avec l'écosystème STRYVLAB

La plateforme coach (stryvlab/) et l'app mobile (stryvr/)
partagent potentiellement le même backend Supabase.
Authentification unifiée via Supabase Auth.
Types TypeScript partagés via packages/ commun (V2).

---

## Conformité

RGPD : données stockées EU West (Frankfurt)
RLS : Row Level Security activé sur toutes les tables
Données de santé : catégorie spéciale RGPD Art. 9
consentement explicite à l'onboarding

---

## Instructions Claude Code

Au début de chaque session, lire dans l'ordre : 1. stryvr/ARCHITECTURE.md 2. stryvr/SESSION_LOG.md

Tout le code vit dans stryvr/
Ne jamais toucher aux fichiers en dehors de stryvr/
Mettre à jour SESSION_LOG.md à la fin de chaque session
