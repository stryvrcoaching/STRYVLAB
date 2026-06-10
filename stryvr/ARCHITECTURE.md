# ARCHITECTURE TECHNIQUE — STRYVR App Mobile
## Version 1.0.0 — Mai 2026
## Partie de l'écosystème STRYVLAB

---

## CONTEXTE PROJET

STRYVR est l'application mobile de transformation physique
de l'écosystème STRYVLAB.

Marché principal : Belgique
Marché secondaire : France
Langue : Français
Disponibilité V1 : iOS + Android simultanément

Ce projet vit dans stryvlab/stryvr/
Il ne doit jamais toucher aux fichiers en dehors de stryvr/

---

## 1. STACK TECHNIQUE

MOBILE :
  Framework   : Expo SDK 52+ (React Native)
  Langage     : TypeScript strict
  Navigation  : Expo Router v4 (file-based)
  Animations  : React Native Reanimated 3
  Gestes      : React Native Gesture Handler
  Listes      : Shopify FlashList
  Cache       : TanStack Query v5
  Stockage    : MMKV (react-native-mmkv)
  Formulaires : React Hook Form + Zod

BACKEND :
  Plateforme      : Supabase (région EU West — Frankfurt)
  Base de données : PostgreSQL 15
  Auth            : Supabase Auth (JWT)
  Realtime        : Supabase Realtime (PostgreSQL subscriptions)
  Storage         : Supabase Storage (photos)
  Calculs         : Supabase Edge Functions (Deno/TypeScript)
  Jobs            : pg_cron (tâches périodiques)

SANTÉ :
  iOS     : react-native-health (HealthKit)
  Android : react-native-health-connect (Health Connect)

ALIMENTATION :
  API externe  : Open Food Facts (produits emballés)
  Base interne : Table food_items PostgreSQL

NOTIFICATIONS :
  iOS     : APNs via Expo Notifications
  Android : FCM via Expo Notifications

MONITORING :
  Erreurs   : Sentry
  Analytics : PostHog (RGPD compliant)

BUILDS :
  CI/CD       : EAS Build (Expo Application Services)
  OTA updates : EAS Update

---

## 2. STRUCTURE DU PROJET

stryvr/
├── app/
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   └── onboarding/
│   │       ├── _layout.tsx
│   │       ├── step-1-identity.tsx
│   │       ├── step-2-measurements.tsx
│   │       ├── step-3-training.tsx
│   │       ├── step-4-activity.tsx
│   │       ├── step-5-cycle.tsx
│   │       ├── step-6-medical.tsx
│   │       ├── step-7-goal.tsx
│   │       ├── step-8-preferences.tsx
│   │       └── step-9-computing.tsx
│   │
│   ├── (app)/
│   │   ├── _layout.tsx
│   │   ├── agenda/
│   │   │   ├── index.tsx
│   │   │   ├── week.tsx
│   │   │   └── month.tsx
│   │   ├── log/
│   │   │   ├── nutrition/
│   │   │   │   ├── composer.tsx
│   │   │   │   ├── barcode.tsx
│   │   │   │   ├── photo.tsx
│   │   │   │   └── favorites.tsx
│   │   │   ├── training/
│   │   │   │   └── session.tsx
│   │   │   ├── hydration/
│   │   │   │   └── quick.tsx
│   │   │   └── supplements/
│   │   │       └── log.tsx
│   │   ├── insights/
│   │   │   ├── index.tsx
│   │   │   ├── weekly.tsx
│   │   │   └── monthly.tsx
│   │   └── profile/
│   │       ├── index.tsx
│   │       ├── phase.tsx
│   │       ├── medical.tsx
│   │       └── notifications.tsx
│   │
│   └── _layout.tsx
│
├── components/
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Sheet.tsx
│   │   ├── Input.tsx
│   │   ├── Toggle.tsx
│   │   ├── Slider.tsx
│   │   ├── Badge.tsx
│   │   ├── Avatar.tsx
│   │   ├── Skeleton.tsx
│   │   └── Typography.tsx
│   ├── agenda/
│   │   ├── DayView.tsx
│   │   ├── EventBlock.tsx
│   │   ├── TargetsBar.tsx
│   │   ├── AlertBanner.tsx
│   │   └── PhaseIndicator.tsx
│   ├── composer/
│   │   ├── CategoryGrid.tsx
│   │   ├── SubtypeList.tsx
│   │   ├── ItemList.tsx
│   │   ├── QuantitySelector.tsx
│   │   └── PortionLexicon.tsx
│   ├── charts/
│   │   ├── WeightTrend.tsx
│   │   ├── MacroRing.tsx
│   │   ├── HydrationBar.tsx
│   │   └── ProgressLine.tsx
│   └── training/
│       ├── SessionCard.tsx
│       ├── RPESlider.tsx
│       └── MuscleGroupSelector.tsx
│
├── lib/
│   ├── supabase.ts
│   ├── mmkv.ts
│   ├── queries/
│   │   ├── useMotorState.ts
│   │   ├── usePhase.ts
│   │   ├── useNutrition.ts
│   │   ├── useTraining.ts
│   │   ├── useCheckin.ts
│   │   ├── useBodyMeasurement.ts
│   │   ├── useCycle.ts
│   │   ├── useAlerts.ts
│   │   └── useProfile.ts
│   ├── motor/
│   │   ├── physiologicalDate.ts
│   │   ├── weightTrend.ts
│   │   ├── nutritionTotals.ts
│   │   └── cyclePhase.ts
│   └── utils/
│       ├── formatting.ts
│       ├── validation.ts
│       └── constants.ts
│
├── supabase/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_rls_policies.sql
│   │   ├── 003_functions.sql
│   │   └── 004_cron_jobs.sql
│   └── functions/
│       ├── motor-daily-compute/
│       │   └── index.ts
│       ├── motor-nutrition-process/
│       │   └── index.ts
│       ├── motor-training-process/
│       │   └── index.ts
│       ├── motor-weekly-report/
│       │   └── index.ts
│       ├── motor-monthly-report/
│       │   └── index.ts
│       ├── motor-safety-sweep/
│       │   └── index.ts
│       ├── motor-transition/
│       │   └── index.ts
│       ├── food-search/
│       │   └── index.ts
│       └── food-barcode/
│           └── index.ts
│
├── constants/
│   ├── theme.ts
│   ├── referential.ts
│   └── enums.ts
│
├── types/
│   ├── database.types.ts
│   ├── motor.types.ts
│   └── api.types.ts
│
├── app.json
├── eas.json
├── babel.config.js
├── tsconfig.json
├── .env.local
├── ARCHITECTURE.md
├── REFERENTIEL.md
├── FUNCTIONAL_SPEC.md
└── SESSION_LOG.md

---

## 3. SCHÉMA POSTGRESQL COMPLET

-- ============================================
-- MIGRATION 001 — SCHÉMA INITIAL
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLE : users
-- ============================================
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Identité
  sex VARCHAR(1) CHECK (sex IN ('M', 'F')) NOT NULL,
  birth_date DATE NOT NULL,
  locale VARCHAR(10) DEFAULT 'fr-BE',
  country VARCHAR(5) DEFAULT 'BE',
  units_system VARCHAR(10) DEFAULT 'metric'
    CHECK (units_system IN ('metric', 'imperial')),

  -- Mesures de référence
  height_cm DECIMAL(5,1) NOT NULL,
  wrist_circ_cm DECIMAL(4,1),
  palm_width_cm DECIMAL(4,1) DEFAULT 9.0,
  hand_calibration_method VARCHAR(10) DEFAULT 'default'
    CHECK (hand_calibration_method IN ('default', 'manual', 'photo')),

  -- Training
  training_level VARCHAR(15) DEFAULT 'beginner'
    CHECK (training_level IN ('beginner', 'intermediate', 'advanced')),
  training_history_years DECIMAL(4,1) DEFAULT 0,
  training_history_pause_months DECIMAL(5,1) DEFAULT 0,
  activity_level SMALLINT DEFAULT 1
    CHECK (activity_level BETWEEN 0 AND 4),

  -- Blessures (ajout V1.0.1)
  injury_current BOOLEAN DEFAULT FALSE,
  injury_muscle_group VARCHAR(50),
  injury_status VARCHAR(15)
    CHECK (injury_status IN ('active', 'recovery')),

  -- Objectifs
  goal VARCHAR(20)
    CHECK (goal IN ('fat_loss','lean_bulk','recomp','maintenance','recovery')),
  ambition_level VARCHAR(10) DEFAULT 'standard'
    CHECK (ambition_level IN ('standard', 'advanced')),

  -- Cycle féminin
  cycle_tracking_level SMALLINT DEFAULT 0
    CHECK (cycle_tracking_level BETWEEN 0 AND 4),
  cycle_last_j1 DATE,
  cycle_avg_duration_days SMALLINT DEFAULT 28,

  -- Conditions médicales
  medical_conditions TEXT[] DEFAULT '{}',

  -- Flags de convenance (dérivés de medical_conditions)
  senior_mode BOOLEAN DEFAULT FALSE,
  athlete_mode BOOLEAN DEFAULT FALSE,
  glp1_active BOOLEAN DEFAULT FALSE,
  is_bariatric BOOLEAN DEFAULT FALSE,

  -- Bariatrique
  bariatric_surgery_type VARCHAR(20)
    CHECK (bariatric_surgery_type IN ('sleeve','bypass','band','bpd')),
  bariatric_surgery_date DATE,
  nadir_weight_kg DECIMAL(5,1),

  -- TCA
  tca_status VARCHAR(15) DEFAULT 'none'
    CHECK (tca_status IN ('active','remission','vigilance','none')),

  -- Clearance médicale (ajout V1.0.1)
  requires_medical_clearance BOOLEAN DEFAULT FALSE,
  clearance_confirmed BOOLEAN DEFAULT FALSE,
  clearance_confirmed_at TIMESTAMPTZ,
  clearance_type VARCHAR(20)
    CHECK (clearance_type IN ('cardiovascular','bariatric','other')),

  -- Préférences nutrition
  nutrition_precision_mode VARCHAR(10) DEFAULT 'standard'
    CHECK (nutrition_precision_mode IN ('precision','standard','quick')),
  weigh_frequency_pref VARCHAR(10) DEFAULT 'daily'
    CHECK (weigh_frequency_pref IN ('daily','biweekly','weekly')),

  -- Journée physiologique
  day_cutoff_hour TIME DEFAULT '04:00:00',
  cutoff_auto_suggested BOOLEAN DEFAULT FALSE,
  cutoff_last_reviewed_at TIMESTAMPTZ,

  -- Métadonnées
  onboarding_completed BOOLEAN DEFAULT FALSE,
  referential_version VARCHAR(10) DEFAULT '1.0.0',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLE : user_notification_preferences
-- ============================================
CREATE TABLE public.user_notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  notifications_enabled BOOLEAN DEFAULT TRUE,
  daily_checkin_reminder BOOLEAN DEFAULT TRUE,
  daily_checkin_time TIME DEFAULT '07:30:00',
  weekly_review_enabled BOOLEAN DEFAULT TRUE,
  weekly_review_day SMALLINT DEFAULT 0
    CHECK (weekly_review_day BETWEEN 0 AND 6),
  nutrition_reminders BOOLEAN DEFAULT TRUE,

  weight_display_mode VARCHAR(15) DEFAULT 'numeric'
    CHECK (weight_display_mode IN ('numeric','qualitative','hidden')),
  caloric_display_mode VARCHAR(15) DEFAULT 'detailed'
    CHECK (caloric_display_mode IN ('detailed','summary','hidden')),
  tone_preference VARCHAR(10) DEFAULT 'standard'
    CHECK (tone_preference IN ('standard','technical','gentle')),

  medical_resource_country VARCHAR(5) DEFAULT 'BE',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);

-- ============================================
-- TABLE : body_measurements
-- ============================================
CREATE TABLE public.body_measurements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  measured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  physiological_date DATE NOT NULL,

  weight_kg DECIMAL(5,1) NOT NULL,
  waist_cm DECIMAL(4,1),
  hip_cm DECIMAL(4,1),
  neck_cm DECIMAL(4,1),
  arm_cm DECIMAL(4,1),
  thigh_cm DECIMAL(4,1),
  chest_cm DECIMAL(4,1),

  is_first_morning BOOLEAN DEFAULT TRUE,
  had_recent_meal BOOLEAN DEFAULT FALSE,
  measurement_conditions VARCHAR(15) DEFAULT 'standard'
    CHECK (measurement_conditions IN ('standard','non_standard')),

  -- Calculés par le moteur
  bf_estimated DECIMAL(4,2),
  lean_mass_kg DECIMAL(5,1),
  ffmi DECIMAL(4,1),
  ffmi_normalized DECIMAL(4,1),
  bf_confidence DECIMAL(3,2) DEFAULT 0.70,
  is_outlier BOOLEAN DEFAULT FALSE,
  confidence_score DECIMAL(3,2) DEFAULT 0.70,

  -- Nullable si cycle_tracking_level ∉ {1,2} (correction V1.0.1)
  cycle_phase_at_measure VARCHAR(20),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLE : daily_checkins
-- ============================================
CREATE TABLE public.daily_checkins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  date DATE NOT NULL,
  physiological_date DATE NOT NULL,

  -- Scores quotidiens (1-5)
  energy_score SMALLINT CHECK (energy_score BETWEEN 1 AND 5),
  mood_score SMALLINT CHECK (mood_score BETWEEN 1 AND 5),
  sleep_quality_score SMALLINT CHECK (sleep_quality_score BETWEEN 1 AND 5),
  stress_score SMALLINT CHECK (stress_score BETWEEN 1 AND 5),
  hunger_score SMALLINT CHECK (hunger_score BETWEEN 1 AND 5),

  -- Sommeil
  sleep_duration_h DECIMAL(4,1),
  sleep_source VARCHAR(10) DEFAULT 'manual'
    CHECK (sleep_source IN ('manual','healthkit')),

  -- HealthKit passif
  hrv DECIMAL(6,1),
  resting_hr SMALLINT,
  hrv_source VARCHAR(10) DEFAULT 'healthkit',

  -- Signaux cycliques
  bloating VARCHAR(10) CHECK (bloating IN ('none','light','yes')),
  unusual_cravings VARCHAR(10)
    CHECK (unusual_cravings IN ('sweet','salty','none')),
  period_started BOOLEAN DEFAULT FALSE,
  period_ended BOOLEAN DEFAULT FALSE, -- ajout V1.0.1

  -- Maladie (ajout V1.0.1)
  sick_today BOOLEAN DEFAULT FALSE,
  sick_symptoms VARCHAR(15)
    CHECK (sick_symptoms IN ('fatigue','fever','gi','other')),

  -- Training
  training_done BOOLEAN DEFAULT FALSE,

  -- Notes libres
  notes TEXT,

  -- Métadonnées
  checkin_completed_at TIMESTAMPTZ,
  confidence_score DECIMAL(3,2) DEFAULT 0.70,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, physiological_date)
);

-- ============================================
-- TABLE : cycle_logs
-- ============================================
CREATE TABLE public.cycle_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  j1_date DATE NOT NULL,
  j1_confidence VARCHAR(10) DEFAULT 'declared'
    CHECK (j1_confidence IN ('declared','detected','estimated')),
  duration_days SMALLINT,
  period_duration_days SMALLINT,

  is_complete BOOLEAN DEFAULT FALSE,
  irregularity_flag BOOLEAN DEFAULT FALSE,

  phase_lengths_estimated JSONB,
  symptoms_observed JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLE : food_items
-- ============================================
CREATE TABLE public.food_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  name_fr VARCHAR(200) NOT NULL,
  name_en VARCHAR(200),

  -- Catégories Nutrition Composer
  category_l1 VARCHAR(20)
    CHECK (category_l1 IN
      ('proteins','carbs','vegetables','fruits','fats','extras')),
  category_l2 VARCHAR(50),
  category_l3 VARCHAR(50),

  -- Identification
  barcode VARCHAR(20),
  off_id VARCHAR(100),

  -- Macros pour 100g
  kcal_per_100g DECIMAL(6,1) NOT NULL,
  protein_per_100g DECIMAL(5,1) DEFAULT 0,
  carbs_per_100g DECIMAL(5,1) DEFAULT 0,
  fat_per_100g DECIMAL(5,1) DEFAULT 0,
  fiber_per_100g DECIMAL(5,1) DEFAULT 0,
  sugar_per_100g DECIMAL(5,1),        -- ajout V1.0.1
  sodium_per_100g DECIMAL(6,1),       -- ajout V1.0.1
  alcohol_per_100g DECIMAL(5,1),      -- ajout V1.0.1
  kcal_alcohol_per_100g DECIMAL(5,1), -- ajout V1.0.1

  -- Portions standard
  standard_portions JSONB,

  -- Qualité
  is_verified BOOLEAN DEFAULT FALSE,
  source VARCHAR(20) DEFAULT 'internal'
    CHECK (source IN
      ('open_food_facts','internal','restaurant','ugc')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_food_items_barcode ON public.food_items(barcode);
CREATE INDEX idx_food_items_category
  ON public.food_items(category_l1, category_l2);
CREATE INDEX idx_food_items_name
  ON public.food_items
  USING gin(to_tsvector('french', name_fr));

-- ============================================
-- TABLE : meals
-- ============================================
CREATE TABLE public.meals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  physiological_date DATE NOT NULL,
  meal_type VARCHAR(15)
    CHECK (meal_type IN ('breakfast','lunch','dinner','snack')),
  meal_order SMALLINT DEFAULT 1,

  is_favorite BOOLEAN DEFAULT FALSE,
  favorite_name VARCHAR(100),

  -- Totaux calculés
  total_calories DECIMAL(7,1) DEFAULT 0,
  total_protein_g DECIMAL(5,1) DEFAULT 0,
  total_carbs_g DECIMAL(5,1) DEFAULT 0,
  total_fat_g DECIMAL(5,1) DEFAULT 0,
  total_fiber_g DECIMAL(5,1) DEFAULT 0,

  logged_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_meals_user_date
  ON public.meals(user_id, physiological_date);

-- ============================================
-- TABLE : nutrition_entries
-- ============================================
CREATE TABLE public.nutrition_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  meal_id UUID NOT NULL REFERENCES public.meals(id) ON DELETE CASCADE,
  food_item_id UUID NOT NULL REFERENCES public.food_items(id),

  logged_at TIMESTAMPTZ DEFAULT NOW(),
  physiological_date DATE NOT NULL,

  -- Quantité
  quantity_raw DECIMAL(7,1) NOT NULL,
  quantity_unit VARCHAR(20) NOT NULL,
  quantity_g DECIMAL(7,1) NOT NULL,

  -- Source
  input_mode VARCHAR(15)
    CHECK (input_mode IN
      ('composer','scan','photo','favorite','lab','search')),
  confidence_score DECIMAL(3,2) DEFAULT 0.70,

  -- Macros calculés
  calories_kcal DECIMAL(7,1) NOT NULL,
  protein_g DECIMAL(5,1) DEFAULT 0,
  carbs_g DECIMAL(5,1) DEFAULT 0,
  fat_g DECIMAL(5,1) DEFAULT 0,
  fiber_g DECIMAL(5,1) DEFAULT 0,
  sugar_g DECIMAL(5,1),
  sodium_mg DECIMAL(7,1),

  -- Timing training
  meal_timing_relative_to_training VARCHAR(20)
    CHECK (meal_timing_relative_to_training IN
      ('pre','pre_immediate','post','post_delayed','other')),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_nutrition_entries_user_date
  ON public.nutrition_entries(user_id, physiological_date);

-- ============================================
-- TABLE : hydration_entries
-- ============================================
CREATE TABLE public.hydration_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  logged_at TIMESTAMPTZ DEFAULT NOW(),
  physiological_date DATE NOT NULL,

  volume_ml INT NOT NULL,
  beverage_type VARCHAR(20)
    CHECK (beverage_type IN
      ('water','tea','coffee','sports_drink','soda','alcohol','other')),
  input_mode VARCHAR(10)
    CHECK (input_mode IN ('composer','quick','voice')),

  -- Calculés
  caffeine_mg DECIMAL(5,1) DEFAULT 0,
  alcohol_g DECIMAL(4,1) DEFAULT 0,
  counts_toward_hydration_ml INT NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_hydration_entries_user_date
  ON public.hydration_entries(user_id, physiological_date);

-- ============================================
-- TABLE : supplement_references
-- (Base de connaissance — pas par utilisateur)
-- ============================================
CREATE TABLE public.supplement_references (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  name_fr VARCHAR(100) NOT NULL,
  name_en VARCHAR(100),
  aliases TEXT[],

  category VARCHAR(30)
    CHECK (category IN (
      'protein_amino','vitamins_minerals','fatty_acids',
      'performance','cognitive_stress','sleep_recovery',
      'hormonal_metabolic','digestion','anti_inflammatory',
      'cbd','other'
    )),

  evidence_level VARCHAR(1)
    CHECK (evidence_level IN ('A','B','C','D')),

  physiological_impact JSONB,
  warnings JSONB,
  typical_dose_range JSONB,
  is_pharma BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_supplement_ref_name
  ON public.supplement_references
  USING gin(to_tsvector('french', name_fr));
CREATE INDEX idx_supplement_ref_aliases
  ON public.supplement_references USING gin(aliases);

-- ============================================
-- TABLE : supplement_entries
-- ============================================
CREATE TABLE public.supplement_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  supplement_ref_id UUID REFERENCES public.supplement_references(id),

  logged_at TIMESTAMPTZ DEFAULT NOW(),
  physiological_date DATE NOT NULL,

  name_custom VARCHAR(100),
  category VARCHAR(30),

  dose_amount DECIMAL(7,1),
  dose_unit VARCHAR(15)
    CHECK (dose_unit IN ('g','mg','iu','capsule','scoop','ml')),

  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_pattern JSONB,
  is_skipped BOOLEAN DEFAULT FALSE, -- ajout V1.0.1

  is_pharma BOOLEAN DEFAULT FALSE,
  is_recognized BOOLEAN DEFAULT FALSE,
  want_recognition BOOLEAN DEFAULT FALSE,
  recognition_attempts SMALLINT DEFAULT 0,

  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_supplement_entries_user_date
  ON public.supplement_entries(user_id, physiological_date);

-- ============================================
-- TABLE : training_sessions
-- ============================================
CREATE TABLE public.training_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  physiological_date DATE NOT NULL,
  started_at TIMESTAMPTZ NOT NULL, -- ajout V1.0.1
  ended_at TIMESTAMPTZ,            -- ajout V1.0.1
  duration_min INT NOT NULL,

  session_type VARCHAR(20)
    CHECK (session_type IN
      ('resistance','cardio','hiit','mobility','sport','mixed')),

  muscle_groups TEXT[] DEFAULT '{}',
  volume_sets INT,

  intensity_rpe SMALLINT CHECK (intensity_rpe BETWEEN 1 AND 10),
  perceived_fatigue_post SMALLINT
    CHECK (perceived_fatigue_post BETWEEN 1 AND 5),
  recovery_perceived_h DECIMAL(3,1),

  energy_expenditure_kcal DECIMAL(6,1),
  energy_source VARCHAR(10) DEFAULT 'estimated'
    CHECK (energy_source IN ('healthkit','estimated')),

  is_deload BOOLEAN DEFAULT FALSE,

  healthkit_activity_id VARCHAR(100),

  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_training_sessions_user_date
  ON public.training_sessions(user_id, physiological_date);

-- ============================================
-- TABLE : phases
-- ============================================
CREATE TABLE public.phases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  phase_type VARCHAR(20)
    CHECK (phase_type IN (
      'fat_loss','lean_bulk','recomp','maintenance',
      'recovery','reverse_diet','diet_break','refeed'
    )) NOT NULL,

  started_at DATE NOT NULL,
  ended_at DATE,

  -- Cibles
  caloric_target_kcal DECIMAL(7,1) NOT NULL,
  deficit_surplus_kcal DECIMAL(6,1) NOT NULL,
  protein_target_g DECIMAL(5,1) NOT NULL,
  carbs_target_g DECIMAL(5,1) NOT NULL,
  fat_target_g DECIMAL(5,1) NOT NULL,
  fiber_target_g DECIMAL(5,1) NOT NULL,       -- ajout V1.0.1
  hydration_target_ml INT NOT NULL,

  -- Progression cible
  target_weekly_change_kg DECIMAL(4,2),
  max_phase_duration_weeks SMALLINT,           -- ajout V1.0.1

  -- Snapshot au démarrage
  weight_at_start DECIMAL(5,1),
  bf_at_start DECIMAL(4,2),
  lean_mass_at_start DECIMAL(5,1),
  tdee_at_start DECIMAL(7,1),

  -- Contexte
  triggered_by VARCHAR(20)
    CHECK (triggered_by IN ('onboarding','motor','manual','safety')),
  referential_version VARCHAR(10) DEFAULT '1.0.0',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_phases_user_active
  ON public.phases(user_id, ended_at)
  WHERE ended_at IS NULL;

-- ============================================
-- TABLE : mesocycles
-- ============================================
CREATE TABLE public.mesocycles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  phase_id UUID REFERENCES public.phases(id),

  started_at DATE NOT NULL,
  ended_at DATE,

  planned_duration_weeks SMALLINT NOT NULL,
  actual_duration_weeks SMALLINT,

  deload_planned_week SMALLINT,
  deload_completed BOOLEAN DEFAULT FALSE,

  target_volume_progression VARCHAR(15)
    CHECK (target_volume_progression IN ('linear','undulating','block'))
    DEFAULT 'linear',

  mev_baseline JSONB NOT NULL,
  mav_target JSONB NOT NULL,
  mrv_ceiling JSONB NOT NULL,

  outcome VARCHAR(20)
    CHECK (outcome IN
      ('completed_success','completed_mixed','overreaching','aborted')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLE : motor_states
-- ============================================
CREATE TABLE public.motor_states (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Références actives
  active_phase_id UUID REFERENCES public.phases(id),
  current_mesocycle_id UUID REFERENCES public.mesocycles(id),
  current_mesocycle_week SMALLINT,
  cycle_log_id UUID REFERENCES public.cycle_logs(id),

  -- Poids et tendance
  weight_trend_kg DECIMAL(5,1),
  weight_trend_direction VARCHAR(10)
    CHECK (weight_trend_direction IN ('up','stable','down')),
  weekly_change_kg DECIMAL(4,2),
  weekly_change_pct DECIMAL(5,2),
  velocity_status VARCHAR(15)
    CHECK (velocity_status IN
      ('on_target','too_slow','too_fast','aberrant')),

  -- TDEE et adaptation
  tdee_effective_kcal DECIMAL(7,1),
  adaptation_level VARCHAR(10)
    CHECK (adaptation_level IN ('none','light','moderate','marked'))
    DEFAULT 'none',

  -- Composition
  ffmi_current DECIMAL(4,1),

  -- Cycle féminin
  cycle_phase VARCHAR(20)
    CHECK (cycle_phase IN (
      'menstrual','follicular_late','ovulation',
      'luteal_early','luteal_late','unknown'
    )),

  -- Sommeil
  sleep_debt_h DECIMAL(4,1) DEFAULT 0,

  -- Nutrition
  nutrition_confidence_today DECIMAL(3,2),
  daily_kcal_gap DECIMAL(6,1),
  daily_protein_gap_pct DECIMAL(5,2),
  daily_carbs_target_modulated DECIMAL(5,1),  -- ajout V1.0.1
  daily_kcal_target_modulated DECIMAL(7,1),   -- ajout V1.0.1
  modulation_reason VARCHAR(100),              -- ajout V1.0.1

  -- Cohérence
  coherence_status VARCHAR(10)
    CHECK (coherence_status IN ('good','light','notable','major')),
  coherence_diagnosis VARCHAR(20)
    CHECK (coherence_diagnosis IN (
      'metabolic_adaptation','under_reporting','tdee_overestimate',
      'hydric_retention','body_recomp','unknown'
    )),

  -- Plateau
  plateau_status VARCHAR(15)
    CHECK (plateau_status IN ('none','suspected','confirmed'))
    DEFAULT 'none',
  plateau_type VARCHAR(15)
    CHECK (plateau_type IN ('weight','strength','composition')),
  plateau_duration_days SMALLINT DEFAULT 0,

  -- RED-S et Safety
  red_s_signals_count SMALLINT DEFAULT 0,
  red_s_alert_active BOOLEAN DEFAULT FALSE,
  cortisol_chronic_signals_count SMALLINT DEFAULT 0,
  cortisol_chronic_alert_active BOOLEAN DEFAULT FALSE,

  -- Overreaching
  overreaching_signals_count SMALLINT DEFAULT 0,
  overreaching_level SMALLINT DEFAULT 0
    CHECK (overreaching_level BETWEEN 0 AND 4),

  -- Flags nutrition
  flag_caloric_floor_breached BOOLEAN DEFAULT FALSE,
  flag_protein_floor_breached BOOLEAN DEFAULT FALSE,
  flag_glp1_lean_mass_risk BOOLEAN DEFAULT FALSE,

  -- Fenêtres temporelles
  whoosh_window_active BOOLEAN DEFAULT FALSE,
  post_cut_window_days_remaining SMALLINT DEFAULT 0,

  -- Memory effect
  memory_effect_active BOOLEAN DEFAULT FALSE,
  memory_effect_weeks_remaining SMALLINT DEFAULT 0,

  -- Bien-être
  wellbeing_score_7j DECIMAL(3,2),
  wellbeing_score_30j DECIMAL(3,2),           -- ajout V1.0.1

  -- Athlètes
  ea_avg_7d DECIMAL(5,1),
  ea_status VARCHAR(15)
    CHECK (ea_status IN ('optimal','acceptable','suboptimal','critical')),

  -- Patterns hebdomadaires
  weekend_drift_active BOOLEAN DEFAULT FALSE,
  hydration_status VARCHAR(15)
    CHECK (hydration_status IN ('good','insufficient','critical')),
  fiber_insufficient BOOLEAN DEFAULT FALSE,
  sleep_fatigue_craving_active BOOLEAN DEFAULT FALSE,
  protein_distribution_asymmetric BOOLEAN DEFAULT FALSE,

  -- Performances
  performance_trend_3w VARCHAR(10)
    CHECK (performance_trend_3w IN ('up','stable','down','mixed')),

  -- Volume training
  weekly_sessions_count SMALLINT DEFAULT 0,
  weekly_high_intensity_sessions SMALLINT DEFAULT 0,
  weekly_total_duration_min INT DEFAULT 0,
  weekly_energy_expenditure_kcal DECIMAL(7,1) DEFAULT 0,
  weekly_volume_by_group JSONB DEFAULT '{}',
  volume_status_by_group JSONB DEFAULT '{}',
  flag_mrv_exceeded BOOLEAN DEFAULT FALSE,
  flag_deload_due BOOLEAN DEFAULT FALSE,

  -- Interventions en attente
  pending_interventions TEXT[] DEFAULT '{}',
  active_alerts UUID[] DEFAULT '{}',
  highest_active_alert_level SMALLINT DEFAULT 0,

  -- Bilan mensuel
  phase_quality_score_last DECIMAL(3,2),
  monthly_summary_id_last UUID,

  -- Post-bariatrique
  nadir_delta_alert VARCHAR(10)
    CHECK (nadir_delta_alert IN ('none','light','marked'))
    DEFAULT 'none',

  -- Semaine malade
  sick_week_flagged BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_motor_states_user
  ON public.motor_states(user_id, computed_at DESC);

-- Vue : MOTOR_STATE courant par utilisateur
CREATE OR REPLACE VIEW public.current_motor_state AS
SELECT DISTINCT ON (user_id) *
FROM public.motor_states
ORDER BY user_id, computed_at DESC;

-- ============================================
-- TABLE : interventions
-- ============================================
CREATE TABLE public.interventions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  type VARCHAR(20)
    CHECK (type IN (
      'refeed','diet_break','deload','reverse_start',
      'phase_transition','reds_alert','recovery_mode',
      'overtraining','illness','travel'
    )) NOT NULL,

  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  trigger_reasons TEXT[],
  referential_section VARCHAR(20),

  proposed_at TIMESTAMPTZ,
  user_response VARCHAR(15)
    CHECK (user_response IN
      ('accepted','refused','ignored','in_progress')),

  started_at DATE,
  ended_at DATE,

  outcome VARCHAR(15)
    CHECK (outcome IN ('completed','abandoned','modified')),

  intervention_parameters JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLE : healthkit_sync_logs
-- ============================================
CREATE TABLE public.healthkit_sync_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  synced_at TIMESTAMPTZ DEFAULT NOW(),
  data_type VARCHAR(20)
    CHECK (data_type IN
      ('sleep','hr','hrv','activity','weight','workout')),
  start_date DATE,
  end_date DATE,
  records_imported INT DEFAULT 0,
  sync_status VARCHAR(15)
    CHECK (sync_status IN ('success','partial_error','failure')),
  error_message TEXT
);

-- ============================================
-- TABLE : alert_logs
-- ============================================
CREATE TABLE public.alert_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  alert_type VARCHAR(30) NOT NULL,
  alert_level SMALLINT NOT NULL CHECK (alert_level BETWEEN 0 AND 5),

  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  trigger_reasons TEXT[],

  acknowledged_at TIMESTAMPTZ,
  user_response VARCHAR(15)
    CHECK (user_response IN
      ('acknowledged','dismissed','actioned','ignored')),

  resolved_at TIMESTAMPTZ,
  resolution_type VARCHAR(20)
    CHECK (resolution_type IN (
      'auto_resolved','user_action','medical_clearance','ignored'
    )),

  escalated_from UUID REFERENCES public.alert_logs(id),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLE : monthly_summaries
-- ============================================
CREATE TABLE public.monthly_summaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  phase_id UUID REFERENCES public.phases(id),
  mesocycle_id UUID REFERENCES public.mesocycles(id),

  weight_start_kg DECIMAL(5,1),
  weight_end_kg DECIMAL(5,1),
  delta_weight_kg DECIMAL(4,2),
  bf_start DECIMAL(4,2),
  bf_end DECIMAL(4,2),
  delta_lean_mass_kg DECIMAL(4,2),

  avg_kcal_30j DECIMAL(7,1),
  avg_protein_30j DECIMAL(5,1),
  avg_carbs_30j DECIMAL(5,1),
  avg_fat_30j DECIMAL(5,1),
  adherence_calorique DECIMAL(4,2),
  adherence_proteique DECIMAL(4,2),
  confidence_nutrition_30j DECIMAL(3,2),

  sessions_totales SMALLINT,
  performance_trend VARCHAR(10)
    CHECK (performance_trend IN ('up','stable','down','mixed')),
  mesocycle_outcome VARCHAR(20),

  phase_quality_score DECIMAL(3,2),
  wellbeing_score_30j DECIMAL(3,2),
  sleep_avg_30j DECIMAL(4,1),

  alerts_triggered SMALLINT DEFAULT 0,
  alerts_ignored SMALLINT DEFAULT 0,

  tdee_recalibree DECIMAL(7,1),
  decision_strategique VARCHAR(20)
    CHECK (decision_strategique IN ('continue','adjust','transition')),

  referential_version VARCHAR(10) DEFAULT '1.0.0',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLE : message_history
-- ============================================
CREATE TABLE public.message_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  message_type VARCHAR(50) NOT NULL,
  message_family SMALLINT CHECK (message_family BETWEEN 1 AND 7),

  delivered_at TIMESTAMPTZ DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,

  UNIQUE(user_id, message_type)
);

---

## 4. ROW LEVEL SECURITY (MIGRATION 002)

-- Activer RLS sur toutes les tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.body_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cycle_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hydration_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplement_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mesocycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.motor_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interventions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.healthkit_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplement_references ENABLE ROW LEVEL SECURITY;

-- Policy universelle : chaque utilisateur accède uniquement
-- à ses propres données
CREATE POLICY "users_own_data" ON public.users
  FOR ALL USING (auth.uid() = id);

CREATE POLICY "users_own_data" ON public.body_measurements
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users_own_data" ON public.daily_checkins
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users_own_data" ON public.cycle_logs
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users_own_data" ON public.meals
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users_own_data" ON public.nutrition_entries
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users_own_data" ON public.hydration_entries
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users_own_data" ON public.supplement_entries
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users_own_data" ON public.training_sessions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users_own_data" ON public.phases
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users_own_data" ON public.mesocycles
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users_own_data" ON public.motor_states
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users_own_data" ON public.interventions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users_own_data" ON public.healthkit_sync_logs
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users_own_data" ON public.alert_logs
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users_own_data" ON public.monthly_summaries
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users_own_data" ON public.message_history
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users_own_data" ON public.user_notification_preferences
  FOR ALL USING (auth.uid() = user_id);

-- food_items et supplement_references : lecture publique
-- pour tous les utilisateurs authentifiés
CREATE POLICY "authenticated_read" ON public.food_items
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_read" ON public.supplement_references
  FOR SELECT USING (auth.role() = 'authenticated');

---

## 5. FONCTIONS POSTGRESQL CLÉS (MIGRATION 003)

-- Journée physiologique
CREATE OR REPLACE FUNCTION compute_physiological_date(
  p_timestamp TIMESTAMPTZ,
  p_cutoff_hour TIME
) RETURNS DATE AS $$
BEGIN
  IF p_timestamp::TIME < p_cutoff_hour THEN
    RETURN (p_timestamp - INTERVAL '1 day')::DATE;
  ELSE
    RETURN p_timestamp::DATE;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Filtre exponentiel (poids de tendance)
CREATE OR REPLACE FUNCTION exponential_weight_filter(
  p_previous_trend DECIMAL,
  p_new_weight DECIMAL,
  p_coefficient DECIMAL DEFAULT 0.1
) RETURNS DECIMAL AS $$
BEGIN
  IF p_previous_trend IS NULL THEN
    RETURN p_new_weight;
  END IF;
  RETURN p_previous_trend
    + p_coefficient * (p_new_weight - p_previous_trend);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- BF estimation Navy
CREATE OR REPLACE FUNCTION estimate_bf_navy(
  p_sex VARCHAR,
  p_height_cm DECIMAL,
  p_waist_cm DECIMAL,
  p_neck_cm DECIMAL,
  p_hip_cm DECIMAL DEFAULT NULL
) RETURNS DECIMAL AS $$
DECLARE
  v_bf DECIMAL;
BEGIN
  IF p_sex = 'M' THEN
    v_bf := 495 / (
      1.0324
      - 0.19077 * LOG(p_waist_cm - p_neck_cm)
      + 0.15456 * LOG(p_height_cm)
    ) - 450;
  ELSIF p_sex = 'F' AND p_hip_cm IS NOT NULL THEN
    v_bf := 495 / (
      1.29579
      - 0.35004 * LOG(p_waist_cm + p_hip_cm - p_neck_cm)
      + 0.22100 * LOG(p_height_cm)
    ) - 450;
  ELSE
    RETURN NULL;
  END IF;
  RETURN ROUND(v_bf::DECIMAL, 1);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- BMR Mifflin-St Jeor
CREATE OR REPLACE FUNCTION calculate_bmr(
  p_sex VARCHAR,
  p_weight_kg DECIMAL,
  p_height_cm DECIMAL,
  p_age INT
) RETURNS DECIMAL AS $$
BEGIN
  IF p_sex = 'M' THEN
    RETURN (10 * p_weight_kg)
      + (6.25 * p_height_cm)
      - (5 * p_age) + 5;
  ELSE
    RETURN (10 * p_weight_kg)
      + (6.25 * p_height_cm)
      - (5 * p_age) - 161;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

---

## 6. EDGE FUNCTIONS — RESPONSABILITÉS

motor-daily-compute      → Flux 2 : consolidation check-in
                           + calcul MOTOR_STATE quotidien
motor-nutrition-process  → Flux 3B : traitement nutritionnel
                           + cross-check apports/cibles
motor-training-process   → Flux 3C : traitement training
                           + mise à jour MESOCYCLE
motor-weekly-report      → Flux 4 : bilan hebdomadaire complet
motor-monthly-report     → Flux 7 : bilan mensuel complet
motor-safety-sweep       → Flux 6 : Safety Layer
                           (toutes les 24h via pg_cron)
motor-transition         → Flux 5 : transitions de phase
                           + protocoles ponctuels
food-search              → Recherche full-text base alimentaire
food-barcode             → Lookup code-barres
                           (Open Food Facts + base interne)
supplements-lookup       → Recherche base SUPPLEMENT_REFERENCE

---

## 7. VARIABLES D'ENVIRONNEMENT

# .env.local (JAMAIS committé dans git)
EXPO_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=[anon-key]

# Supabase Dashboard → Settings → Edge Functions → Secrets
SUPABASE_SERVICE_ROLE_KEY=[service-role-key]
SENTRY_DSN=[sentry-dsn]
POSTHOG_API_KEY=[posthog-key]

---

## 8. CONVENTIONS DE CODE

TypeScript strict activé ("strict": true dans tsconfig.json)

NOMMAGE :
  Composants React    : PascalCase    → Button.tsx
  Hooks               : camelCase     → useMotorState.ts
  Types/Interfaces    : PascalCase    → MotorState
  Constantes          : UPPER_SNAKE   → MAX_DEFICIT_KCAL
  Tables PostgreSQL   : snake_case    → body_measurements
  Colonnes PostgreSQL : snake_case    → physiological_date

RÈGLES :
  - Jamais de fetch direct dans les composants
    → Toujours via hooks TanStack Query dans lib/queries/
  - Validation Zod sur toutes les données externes
    (réponses API, formulaires, données Supabase)
  - Pattern Result pour la gestion d'erreurs :
      type Result<T> =
        | { success: true; data: T }
        | { success: false; error: string }
  - Jamais de "any"
  - Jamais de ts-ignore sans commentaire explicatif

---

## 9. ORDRE D'IMPLÉMENTATION — SESSIONS

SESSION 1 : Setup complet
  - Projet Expo SDK 52+ initialisé avec TypeScript strict
  - Supabase configuré (projet EU West — Frankfurt)
  - Migrations 001-004 exécutées
  - Auth fonctionnel (email + Sign in with Apple)
  - Structure de dossiers complète (section 2)
  - Design tokens de base (constants/theme.ts)
  - .gitignore configuré (.env.local exclu)

SESSION 2 : Onboarding
  - 9 étapes d'onboarding
  - Calcul moteur initial (Edge Function motor-daily-compute)
  - Premier MOTOR_STATE créé

SESSION 3 : Smart Agenda + Check-in
  - Vue jour du Smart Agenda
  - Check-in quotidien (Flux 2)
  - Pesée + Body Measurement

SESSION 4 : Nutrition Composer
  - 4 couches du Composer
  - Base food_items (100 items initiaux)
  - Scan code-barres (Open Food Facts)

SESSION 5 : Hydratation + Compléments
  - Quick hydration
  - Base supplement_references (~80 items BE + FR)
  - Log compléments

SESSION 6 : Training
  - Log séance
  - MESOCYCLE
  - HealthKit iOS + Health Connect Android

SESSION 7 : Moteur hebdomadaire
  - Bilan hebdomadaire (Flux 4)
  - Edge Function motor-weekly-report

SESSION 8 : Safety Layer
  - Edge Function motor-safety-sweep
  - Alertes et notifications push

SESSION 9 : Transitions + Protocoles
  - Flux 5 complet
  - Refeed, Diet Break, Reverse Diet, Déload

SESSION 10 : Animations + Polish
  - React Native Reanimated 3 sur composants clés
  - Design premium final

SESSION 11 : Soumission stores
  - EAS Build production iOS + Android
  - App Store + Google Play Store

---

## 10. RÉSUMÉ DU MODÈLE DE DONNÉES

20 entités PostgreSQL :

CORE :
  1.  users
  2.  user_notification_preferences
  3.  healthkit_sync_logs

MESURES :
  4.  body_measurements
  5.  daily_checkins
  6.  cycle_logs

NUTRITION :
  7.  nutrition_entries
  8.  meals
  9.  food_items
  10. hydration_entries
  11. supplement_entries
  12. supplement_references

TRAINING :
  13. training_sessions
  14. mesocycles

ÉTAT ET INTERVENTIONS :
  15. phases
  16. motor_states
  17. interventions
  18. alert_logs
  19. monthly_summaries
  20. message_history

---

## RÉFÉRENCES CROISÉES

Ce projet est construit sur :
  - REFERENTIEL.md    → Référentiel Scientifique V1.0.0
  - FUNCTIONAL_SPEC.md → Cahier Fonctionnel V1.0.1
  - SESSION_LOG.md    → Journal des sessions

Relation avec l'écosystème STRYVLAB :
  La plateforme coach (stryvlab/) et l'app mobile (stryvr/)
  partagent potentiellement le même backend Supabase.
  L'authentification peut être unifiée via Supabase Auth.
  Les types TypeScript peuvent être partagés via un
  dossier packages/ commun au niveau stryvlab/ (V2).
