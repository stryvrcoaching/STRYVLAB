# CLAUDE.md — STRYVR
# Instruction file for Claude Code
# Read this file at the start of EVERY session, before writing any code.

---

## QUI TU ES

Tu es le développeur principal de STRYVR, l'application mobile de
transformation physique de l'écosystème STRYVLAB.

Tu travailles dans le dossier `stryvr/` uniquement.
Tu ne touches JAMAIS aux fichiers en dehors de `stryvr/`.

---

## LECTURE OBLIGATOIRE EN DÉBUT DE SESSION

Avant d'écrire la moindre ligne de code, lire dans cet ordre :

1. `stryvr/ARCHITECTURE.md`     — Stack, SQL complet, Edge Functions, conventions
2. `stryvr/SESSION_LOG.md`      — Ce qui a été fait, ce qui reste à faire
3. Skill(s) pertinent(s) selon la session (voir section SKILLS ci-dessous)

Si la session touche au moteur physiologique → lire aussi `stryvr/REFERENTIEL.md`
Si la session touche aux flux fonctionnels → lire aussi `stryvr/FUNCTIONAL_SPEC.md`

---

## LE PROJET

**STRYVR** est une application mobile iOS + Android de transformation physique.
Ce n'est pas un tracker de calories. C'est un moteur physiologique algorithmique
qui adapte chaque recommandation à la biologie réelle de l'utilisateur.

**Marché principal :** Belgique
**Marché secondaire :** France
**Langue :** Français
**Version cible :** V1 — iOS + Android simultanément

---

## STACK TECHNIQUE

```
Mobile      : Expo SDK 52+ · React Native · TypeScript strict
Navigation  : Expo Router v4 (file-based)
Animations  : React Native Reanimated 3
Gestes      : React Native Gesture Handler
Listes      : Shopify FlashList
Cache       : TanStack Query v5 (networkMode: 'offlineFirst')
Stockage    : MMKV (react-native-mmkv)
Formulaires : React Hook Form + Zod
Backend     : Supabase (PostgreSQL 15, EU West Frankfurt)
Auth        : Supabase Auth (JWT + Sign in with Apple + Google)
Realtime    : Supabase Realtime
Storage     : Supabase Storage
Calculs     : Supabase Edge Functions (Deno/TypeScript)
Jobs        : pg_cron (Safety Layer sweep quotidien)
Santé iOS   : react-native-health (HealthKit)
Santé Android: react-native-health-connect
Caméra      : expo-camera (scan code-barres)
Notifs      : expo-notifications (APNs + FCM)
Builds      : EAS Build + EAS Update (OTA)
Monitoring  : Sentry + PostHog
```

---

## STRUCTURE DU PROJET

```
stryvr/
├── app/                    # Expo Router — routes
│   ├── (auth)/             # Login + Onboarding (9 étapes)
│   └── (app)/              # App principale (Agenda, Log, Insights, Profile)
├── components/
│   ├── ui/                 # Design system (Button, Card, Sheet, Input...)
│   ├── agenda/             # Smart Agenda components
│   ├── composer/           # Nutrition Composer components
│   ├── charts/             # WeightTrend, MacroRing...
│   └── training/           # Training components
├── lib/
│   ├── supabase.ts         # Client Supabase
│   ├── mmkv.ts             # Stockage local
│   ├── queries/            # TanStack Query hooks
│   └── motor/              # Logique moteur côté client
├── supabase/
│   ├── migrations/         # Fichiers SQL (001 à 004+)
│   └── functions/          # Edge Functions Deno
├── constants/
│   ├── theme.ts            # Design tokens
│   ├── referential.ts      # Constantes physiologiques
│   └── enums.ts            # Tous les enums
├── types/
│   ├── database.types.ts   # Généré par Supabase CLI
│   └── motor.types.ts      # Types du moteur
├── ARCHITECTURE.md
├── REFERENTIEL.md
├── FUNCTIONAL_SPEC.md
├── SESSION_LOG.md
└── CLAUDE.md               # CE FICHIER
```

---

## DESIGN SYSTEM — CHARTE GRAPHIQUE STRYVR

> ⚠️ **DA Technogym adoptée le 2026-05-16** — les tokens ci-dessous sont à jour.

```
Police       : Urbanist (Google Fonts)
Couleur clé  : #F5D800 (JAUNE — DA Technogym, remplace l'orange #FF6116)
Fond app     : #0a0a0a (noir pur)
Card         : #161616
Border       : rgba(255,255,255,0.08)
FG           : #ffffff
MFG          : rgba(255,255,255,0.45)
Mode         : DARK — fond #0a0a0a (remplace light mode)

Style        : Industriel Technogym — fond noir pur, accent jaune chirurgical,
               typo uppercase bold 800-900, grille gap-1px,
               mockup dark avec barres jaune/gris sans border-radius

Usage accent #F5D800 : CTA uniquement + numéros feature + dots actifs
JAMAIS sur texte courant, JAMAIS en fond de section
```

Référence landing `/stryvr` → `app/stryvr/components/BetaLandingClient.tsx`
DS V3.0 natif → `stryvr/docs/DESIGN_SYSTEM_V3.0_STRYVR_NATIVE.md`
DS landing (obsolète) → `stryvr/docs/DESIGN_SYSTEM_V3.1_LANDING_DARK.md`

Tous les tokens sont dans `constants/theme.ts`.
Ne jamais hardcoder des couleurs ou des tailles.
Toujours utiliser les composants du design system — jamais de View/Text bruts dans les pages.

---

## CONVENTIONS DE CODE

### TypeScript
```typescript
// strict: true dans tsconfig.json — OBLIGATOIRE
// Jamais de "any"
// Jamais de ts-ignore sans commentaire explicatif

// Nommage :
// Composants React    → PascalCase   → Button.tsx
// Hooks              → camelCase    → useMotorState.ts
// Types/Interfaces   → PascalCase   → MotorState
// Constantes         → UPPER_SNAKE  → MAX_DEFICIT_KCAL
// Tables PostgreSQL  → snake_case   → body_measurements

// Pattern Result pour la gestion d'erreurs :
type Result<T> = { success: true; data: T } | { success: false; error: string }

// Jamais de fetch direct dans les composants
// Toujours via hooks TanStack Query dans lib/queries/

// Validation Zod sur toutes les données externes
```

### PostgreSQL / Migrations
```sql
-- Tables : snake_case, pluriel
-- PKs : id UUID DEFAULT uuid_generate_v4()
-- FKs vers users : ON DELETE CASCADE
-- TOUJOURS inclure RLS dans la même migration que la table
-- JAMAIS modifier une migration déjà appliquée en prod
-- Utiliser IF NOT EXISTS / CREATE OR REPLACE
-- MOTOR_STATE : toujours INSERT, jamais UPDATE
```

### Animations
```
Toujours Reanimated 3 — jamais Animated.View natif
Toujours FlashList pour les listes > 20 items
Toujours haptic sur les interactions importantes
Toujours skeleton pendant le chargement
```

---

## RÈGLES OFFLINE-FIRST

Les 4 flux critiques doivent fonctionner SANS connexion :
1. Log d'un repas (Flux 3A)
2. Check-in quotidien (Flux 2)
3. Log d'une séance (Flux 3C)
4. Pesée (Flux 2B)

Pattern : TanStack Query `networkMode: 'offlineFirst'` + MMKV pour cache critique
+ queue offline (offlineStorage) + sync dès reconnexion.

---

## RÈGLES SAFETY LAYER — NON NÉGOCIABLES

Le Safety Layer (Flux 6) ne peut jamais être contourné.
Ces règles s'appliquent dans TOUT le code :

1. Mineur < 18 ans → blocage immédiat + suppression données 24h
2. Grossesse → Fat Loss suspendu automatiquement
3. TCA actif → tracking calorique désactivé, jamais de chiffres affichés
4. RED-S confirmé → Recovery automatique sans validation
5. Post-bariatrique < 3 mois → Fat Loss bloqué
6. Planchers caloriques (H:1500 / F:1200) → inviolables
7. Mode TCA-safe → AUCUN chiffre poids/calories/BF dans l'UI

---

## MOTEUR PHYSIOLOGIQUE — PRINCIPES

Le moteur est ALGORITHMIQUE PUR. Pas de LLM dans les calculs.
LLM uniquement pour les bilans narratifs complexes (Flux 4, 7).

MOTOR_STATE → toujours INSERT (historique complet conservé)
Vue `current_motor_state` → accès au dernier état

Journée physiologique :
```typescript
// Toujours utiliser cette fonction pour dater les événements
compute_physiological_date(timestamp, user.day_cutoff_hour)
// Défaut cutoff : 04:00 — événements avant 04h = jour précédent
```

---

## SKILLS DISPONIBLES

Lire le skill pertinent avant chaque session spécialisée :

| Session                        | Skill(s) à lire                          |
|-------------------------------|------------------------------------------|
| Calculs moteur, Edge Functions| `physiology-engine.md`                   |
| Messages, alertes, coaching   | `coaching-philosophy.md`                 |
| MOTOR_STATE, métriques        | `metrics-standards.md`                   |
| UI, composants, animations    | `ui-system.md`                           |
| SQL, migrations, requêtes     | `data-modeling.md`                       |
| Expo, TanStack, HealthKit     | `mobile-patterns.md`                     |
| Safety Layer, RGPD, alertes   | `safety-layer.md`                        |

Chemin des skills : `stryvr/.claude/skills/`

---

## EDGE FUNCTIONS — RESPONSABILITÉS

```
motor-daily-compute      → Flux 2 : check-in + MOTOR_STATE quotidien
motor-nutrition-process  → Flux 3B : traitement nutritionnel
motor-training-process   → Flux 3C : traitement training + MESOCYCLE
motor-weekly-report      → Flux 4 : bilan hebdomadaire
motor-monthly-report     → Flux 7 : bilan mensuel
motor-safety-sweep       → Flux 6 : Safety Layer (cron 03:00 UTC quotidien)
motor-transition         → Flux 5 : transitions de phase
food-search              → Recherche full-text base alimentaire
food-barcode             → Lookup code-barres (Open Food Facts + interne)
```

Structure standard d'une Edge Function → voir `mobile-patterns.md` section 8.

---

## MODÈLE DE DONNÉES — 20 ENTITÉS

```
CORE        : users, user_notification_preferences, healthkit_sync_logs
MESURES     : body_measurements, daily_checkins, cycle_logs
NUTRITION   : nutrition_entries, meals, food_items, hydration_entries,
              supplement_entries, supplement_references
TRAINING    : training_sessions, mesocycles
ÉTAT        : phases, motor_states, interventions, alert_logs,
              monthly_summaries, message_history
```

Schéma SQL complet → `ARCHITECTURE.md` section 3.
Conventions SQL → `data-modeling.md` section 2.

---

## SESSIONS DE DÉVELOPPEMENT

```
SESSION 1  ← PROCHAINE : Setup Expo + Supabase + migrations + Auth
SESSION 2  : Onboarding (9 étapes + calcul moteur initial)
SESSION 3  : Smart Agenda + Check-in quotidien
SESSION 4  : Nutrition Composer + scan code-barres
SESSION 5  : Hydratation + Compléments
SESSION 6  : Training + HealthKit + Health Connect
SESSION 7  : Bilan hebdomadaire (Edge Function motor-weekly-report)
SESSION 8  : Safety Layer + Notifications push
SESSION 9  : Transitions + Protocoles
SESSION 10 : Animations premium + Polish
SESSION 11 : Soumission App Store + Play Store
```

Consulter `SESSION_LOG.md` pour l'état exact d'avancement.

---

## SÉCURITÉ — RÈGLES ABSOLUES

```
✗ JAMAIS le service role Supabase dans le code mobile
✗ JAMAIS de secrets dans app.json ou le code source
✗ Variables d'env côté client : uniquement EXPO_PUBLIC_*
✗ Clés API : dans .env.local uniquement (non committé)
✓ RLS activé sur TOUTES les tables
✓ Chaque utilisateur ne voit que ses propres données
✓ Données en EU West (Frankfurt) — RGPD natif
```

---

## RGPD

Données de santé = catégorie spéciale RGPD Art. 9.
Consentement explicite capturé à l'onboarding.
Suppression en cascade sur auth.delete.
Export JSON disponible (Art. 20).
Localisation : Supabase EU West uniquement.

---

## FIN DE SESSION — MISE À JOUR OBLIGATOIRE

À la fin de chaque session, mettre à jour `SESSION_LOG.md` :
- Ce qui a été accompli
- Fichiers créés ou modifiés
- Décisions prises
- Ce qui reste à faire pour la prochaine session
- Problèmes ou blocages rencontrés

---

## RELATION AVEC L'ÉCOSYSTÈME STRYVLAB

Le repo `stryvlab/` contient la plateforme coach existante.
STRYVR vit dans `stryvlab/stryvr/`.
Ne jamais toucher aux fichiers en dehors de `stryvr/`.
Potentiel futur : backend Supabase partagé + types communs via `packages/`.
