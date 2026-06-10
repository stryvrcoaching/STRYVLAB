# CAHIER D'ARCHITECTURE FONCTIONNELLE — STRYVR

## Version 1.0.1 — Mai 2026

## Spécification fonctionnelle complète

---

## INTRODUCTION

Ce document spécifie le comportement fonctionnel complet
du moteur STRYVR. Il est organisé en trois parties :

PARTIE A — Modèle de données (20 entités)
PARTIE B — Flux fonctionnels (8 flux + transverse)
PARTIE C — Carte des outputs (Smart Agenda, Messages, Recalibrations)

Ce document s'appuie sur REFERENTIEL.md pour toutes
les valeurs physiologiques de référence.

Marché principal : Belgique | Secondaire : France

---

# PARTIE A — MODÈLE DE DONNÉES

---

## A.0 — PRINCIPE TRANSVERSE : JOURNÉE PHYSIOLOGIQUE

Une journée physiologique commence au réveil et se termine
au coucher suivant. Elle est distincte de la journée calendaire.

ATTRIBUT USER : day_cutoff_hour (défaut 04:00)

RÈGLE DE RATTACHEMENT :
SI horodatage.heure < day_cutoff_hour :
journée_physiologique = date - 1 jour
SINON :
journée_physiologique = date

FONCTION UNIVERSELLE :
compute_physiological_date(timestamp, user.day_cutoff_hour)
→ Utilisée par TOUS les flux pour dater les événements

IMPACTS :
daily_checkins.physiological_date
nutrition_entries.physiological_date
body_measurements.physiological_date
training_sessions.physiological_date
cycle_logs.j1_date
meals.physiological_date
hydration_entries.physiological_date
supplement_entries.physiological_date

DÉTECTION AUTOMATIQUE DU RYTHME :
Après 14 jours : analyse heure du dernier repas moyen
Si heure_dernier_repas > 23h → suggérer décalage cutoff

---

## A.1 — ENTITÉ : users

Données créées à l'onboarding. Persistantes. Modifiables.

ATTRIBUTS :
id : UUID (PK, FK auth.users)

-- Identité
sex : VARCHAR(1) CHECK IN ('M','F') NOT NULL
birth_date : DATE NOT NULL
locale : VARCHAR(10) DEFAULT 'fr-BE'
country : VARCHAR(5) DEFAULT 'BE'
units_system : VARCHAR(10) DEFAULT 'metric'

-- Mesures de référence
height_cm : DECIMAL(5,1) NOT NULL
wrist_circ_cm : DECIMAL(4,1)
palm_width_cm : DECIMAL(4,1) DEFAULT 9.0
hand_calibration_method : VARCHAR(10) DEFAULT 'default'

-- Training
training_level : VARCHAR(15) DEFAULT 'beginner'
training_history_years : DECIMAL(4,1) DEFAULT 0
training_history_pause_months : DECIMAL(5,1) DEFAULT 0
activity_level : SMALLINT DEFAULT 1 (0-4)

-- Blessures (ajout V1.0.1)
injury_current : BOOLEAN DEFAULT FALSE
injury_muscle_group : VARCHAR(50) nullable
injury_status : VARCHAR(15) nullable ('active','recovery')

-- Objectifs
goal : VARCHAR(20)
('fat_loss','lean_bulk','recomp','maintenance','recovery')
ambition_level : VARCHAR(10) DEFAULT 'standard'

-- Cycle féminin
cycle_tracking_level : SMALLINT DEFAULT 0 (0-4)
cycle_last_j1 : DATE nullable
cycle_avg_duration_days : SMALLINT DEFAULT 28

-- Conditions médicales
medical_conditions : TEXT[] DEFAULT '{}'

-- Flags de convenance (dérivés de medical_conditions)
-- Mis à jour automatiquement si medical_conditions change
senior_mode : BOOLEAN DEFAULT FALSE (auto si âge ≥ 55)
athlete_mode : BOOLEAN DEFAULT FALSE
glp1_active : BOOLEAN DEFAULT FALSE
is_bariatric : BOOLEAN DEFAULT FALSE

-- Bariatrique
bariatric_surgery_type : VARCHAR(20) nullable
bariatric_surgery_date : DATE nullable
nadir_weight_kg : DECIMAL(5,1) nullable (ajout V1.0.1)

-- TCA
tca_status : VARCHAR(15) DEFAULT 'none'
('active','remission','vigilance','none')

-- Clearance médicale (ajout V1.0.1)
requires_medical_clearance : BOOLEAN DEFAULT FALSE
clearance_confirmed : BOOLEAN DEFAULT FALSE
clearance_confirmed_at : TIMESTAMPTZ nullable
clearance_type : VARCHAR(20) nullable
('cardiovascular','bariatric','other')

-- Préférences nutrition
nutrition_precision_mode : VARCHAR(10) DEFAULT 'standard'
weigh_frequency_pref : VARCHAR(10) DEFAULT 'daily'

-- Journée physiologique
day_cutoff_hour : TIME DEFAULT '04:00:00'
cutoff_auto_suggested : BOOLEAN DEFAULT FALSE
cutoff_last_reviewed_at : TIMESTAMPTZ nullable

-- Calibration morphologique
palm_width_cm : DECIMAL(4,1) DEFAULT 9.0
hand_calibration_method : VARCHAR(10) DEFAULT 'default'

-- Métadonnées
onboarding_completed : BOOLEAN DEFAULT FALSE
referential_version : VARCHAR(10) DEFAULT '1.0.0'
created_at : TIMESTAMPTZ DEFAULT NOW()
updated_at : TIMESTAMPTZ DEFAULT NOW()

---

## A.2 — ENTITÉ : user_notification_preferences

id : UUID PK
user_id : UUID FK users

notifications_enabled : BOOLEAN DEFAULT TRUE
daily_checkin_reminder : BOOLEAN DEFAULT TRUE
daily_checkin_time : TIME DEFAULT '07:30:00'
weekly_review_enabled : BOOLEAN DEFAULT TRUE
weekly_review_day : SMALLINT DEFAULT 0 (0=dim, 6=sam)
nutrition_reminders : BOOLEAN DEFAULT TRUE

weight_display_mode : VARCHAR(15) DEFAULT 'numeric'
('numeric','qualitative','hidden')
caloric_display_mode : VARCHAR(15) DEFAULT 'detailed'
('detailed','summary','hidden')
tone_preference : VARCHAR(10) DEFAULT 'standard'
('standard','technical','gentle')

medical_resource_country : VARCHAR(5) DEFAULT 'BE'

UNIQUE(user_id)

VALEURS PAR DÉFAUT SELON PROFIL :
tca_safe_mode → weight_display_mode = 'qualitative'
caloric_display_mode = 'hidden'
senior_mode → tone_preference = 'gentle' suggéré
athlete_mode → tone_preference = 'technical' suggéré

---

## A.3 — ENTITÉ : body_measurements

id : UUID PK
user_id : UUID FK users
measured_at : TIMESTAMPTZ DEFAULT NOW()
physiological_date : DATE NOT NULL

-- Mesures saisies
weight_kg : DECIMAL(5,1) NOT NULL
waist_cm : DECIMAL(4,1) nullable
hip_cm : DECIMAL(4,1) nullable
neck_cm : DECIMAL(4,1) nullable
arm_cm : DECIMAL(4,1) nullable
thigh_cm : DECIMAL(4,1) nullable
chest_cm : DECIMAL(4,1) nullable

-- Conditions (ajout V1.0.1)
is_first_morning : BOOLEAN DEFAULT TRUE
had_recent_meal : BOOLEAN DEFAULT FALSE
measurement_conditions : VARCHAR(15) DEFAULT 'standard'

-- Calculés par le moteur
bf_estimated : DECIMAL(4,2) nullable
lean_mass_kg : DECIMAL(5,1) nullable
ffmi : DECIMAL(4,1) nullable
ffmi_normalized : DECIMAL(4,1) nullable
bf_confidence : DECIMAL(3,2) DEFAULT 0.70
is_outlier : BOOLEAN DEFAULT FALSE
confidence_score : DECIMAL(3,2) DEFAULT 0.70

-- Nullable si cycle_tracking_level ∉ {1,2} (correction V1.0.1)
cycle_phase_at_measure : VARCHAR(20) nullable

CALCUL confidence_score :
Base : 1.0
SI is_first_morning = false : -0.3
SI had_recent_meal = true : -0.2
SI heure < 5h ou > 11h : -0.1
SI pesée précédente < 12h : -0.2
Minimum : 0.1

DÉTECTION OUTLIER :
SI |weight*kg - pesée_précédente.weight_kg| > 2.0 kg
ET heures*écart < 48 :
is_outlier = true

---

## A.4 — ENTITÉ : daily_checkins

id : UUID PK
user_id : UUID FK users
date : DATE NOT NULL
physiological_date : DATE NOT NULL

-- Scores quotidiens (1-5)
energy_score : SMALLINT nullable
mood_score : SMALLINT nullable
sleep_quality_score : SMALLINT nullable
stress_score : SMALLINT nullable
hunger_score : SMALLINT nullable

-- Sommeil
sleep_duration_h : DECIMAL(4,1) nullable
sleep_source : VARCHAR(10) DEFAULT 'manual'

-- HealthKit passif
hrv : DECIMAL(6,1) nullable
resting_hr : SMALLINT nullable
hrv_source : VARCHAR(10) DEFAULT 'healthkit'

-- Signaux cycliques
bloating : VARCHAR(10) nullable ('none','light','yes')
unusual_cravings : VARCHAR(10) nullable ('sweet','salty','none')
period_started : BOOLEAN DEFAULT FALSE
period_ended : BOOLEAN DEFAULT FALSE (ajout V1.0.1)

-- Maladie (ajout V1.0.1)
sick_today : BOOLEAN DEFAULT FALSE
sick_symptoms : VARCHAR(15) nullable ('fatigue','fever','gi','other')

-- Training
training_done : BOOLEAN DEFAULT FALSE

notes : TEXT nullable
checkin_completed_at : TIMESTAMPTZ nullable
confidence_score : DECIMAL(3,2) DEFAULT 0.70

created_at : TIMESTAMPTZ DEFAULT NOW()
updated_at : TIMESTAMPTZ DEFAULT NOW()

UNIQUE(user_id, physiological_date)

QUESTIONS QUOTIDIENNES (toujours posées) :
energy_score, mood_score, sleep_duration_h, sleep_quality_score

QUESTIONS ROTATIVES (1 tous les 2-3 jours, plafond 6) :
stress_score, hunger_score, bloating, unusual_cravings, notes
Note : les 4 questions quotidiennes ne comptent PAS dans le plafond

QUESTIONS CONDITIONNELLES :
period_started : si sex=F ET cycle_tracking_level ∈ {1,2,3}
perceived_fatigue_post : si TRAINING_SESSION du jour

---

## A.5 — ENTITÉ : cycle_logs

id : UUID PK
user_id : UUID FK users
j1_date : DATE NOT NULL
j1_confidence : VARCHAR(10) DEFAULT 'declared'
('declared','detected','estimated')
duration_days : SMALLINT nullable
period_duration_days : SMALLINT nullable
(calculé quand period_ended = true dans daily_checkins)
is_complete : BOOLEAN DEFAULT FALSE
irregularity_flag : BOOLEAN DEFAULT FALSE
phase_lengths_estimated : JSONB nullable
symptoms_observed : JSONB nullable

CYCLE ACTIF : is_complete = false (pas encore de J1 suivant)

CALCUL irregularity_flag :
SI duration_days > 35 OU duration_days < 21 :
irregularity_flag = true

---

## A.6 — ENTITÉ : food_items

id : UUID PK
name_fr : VARCHAR(200) NOT NULL
name_en : VARCHAR(200) nullable

-- Catégories Nutrition Composer
category_l1 : VARCHAR(20)
('proteins','carbs','vegetables','fruits','fats','extras')
category_l2 : VARCHAR(50) nullable
category_l3 : VARCHAR(50) nullable

barcode : VARCHAR(20) nullable
off_id : VARCHAR(100) nullable (Open Food Facts ID)

-- Macros pour 100g
kcal_per_100g : DECIMAL(6,1) NOT NULL
protein_per_100g : DECIMAL(5,1) DEFAULT 0
carbs_per_100g : DECIMAL(5,1) DEFAULT 0
fat_per_100g : DECIMAL(5,1) DEFAULT 0
fiber_per_100g : DECIMAL(5,1) DEFAULT 0
sugar_per_100g : DECIMAL(5,1) nullable (ajout V1.0.1)
sodium_per_100g : DECIMAL(6,1) nullable (ajout V1.0.1)
alcohol_per_100g : DECIMAL(5,1) nullable (ajout V1.0.1)
kcal_alcohol_per_100g : DECIMAL(5,1) nullable (ajout V1.0.1)

standard_portions : JSONB nullable
-- Ex: [{label:"paume", grams:100, icon:"palm"}, ...]

is_verified : BOOLEAN DEFAULT FALSE
source : VARCHAR(20) DEFAULT 'internal'
('open_food_facts','internal','restaurant','ugc')

created_at : TIMESTAMPTZ DEFAULT NOW()
updated_at : TIMESTAMPTZ DEFAULT NOW()

INDEXES :
idx_food_items_barcode ON (barcode)
idx_food_items_category ON (category_l1, category_l2)
idx_food_items_name GIN (to_tsvector('french', name_fr))

---

## A.7 — ENTITÉ : meals

id : UUID PK
user_id : UUID FK users
physiological_date : DATE NOT NULL
meal_type : VARCHAR(15) ('breakfast','lunch','dinner','snack')
meal_order : SMALLINT DEFAULT 1
is_favorite : BOOLEAN DEFAULT FALSE
favorite_name : VARCHAR(100) nullable

-- Totaux calculés (mis à jour à chaque NUTRITION_ENTRY)
total_calories : DECIMAL(7,1) DEFAULT 0
total_protein_g : DECIMAL(5,1) DEFAULT 0
total_carbs_g : DECIMAL(5,1) DEFAULT 0
total_fat_g : DECIMAL(5,1) DEFAULT 0
total_fiber_g : DECIMAL(5,1) DEFAULT 0

logged_at : TIMESTAMPTZ DEFAULT NOW()
created_at : TIMESTAMPTZ DEFAULT NOW()
updated_at : TIMESTAMPTZ DEFAULT NOW()

INFÉRENCE meal_type SELON HEURE :
05:00-11:00 → breakfast
11:00-15:00 → lunch
15:00-17:30 → snack
17:30-22:00 → dinner
Autres → snack

NOTE V2 : prévoir household_id pour système Foyer (partage familles)

---

## A.8 — ENTITÉ : nutrition_entries

id : UUID PK
user_id : UUID FK users
meal_id : UUID FK meals ON DELETE CASCADE
food_item_id : UUID FK food_items

logged_at : TIMESTAMPTZ DEFAULT NOW()
physiological_date : DATE NOT NULL

quantity_raw : DECIMAL(7,1) NOT NULL
quantity_unit : VARCHAR(20) NOT NULL
quantity_g : DECIMAL(7,1) NOT NULL (toujours en grammes)

input_mode : VARCHAR(15)
('composer','scan','photo','favorite','lab','search')
confidence_score : DECIMAL(3,2) DEFAULT 0.70

-- Macros calculés = quantity_g × food_item.X_per_100g / 100
calories_kcal : DECIMAL(7,1) NOT NULL
protein_g : DECIMAL(5,1) DEFAULT 0
carbs_g : DECIMAL(5,1) DEFAULT 0
fat_g : DECIMAL(5,1) DEFAULT 0
fiber_g : DECIMAL(5,1) DEFAULT 0
sugar_g : DECIMAL(5,1) nullable
sodium_mg : DECIMAL(7,1) nullable

meal_timing_relative_to_training : VARCHAR(20) nullable
('pre','pre_immediate','post','post_delayed','other')

CONFIDENCE_SCORE PAR VOIE ET MODALITÉ :
Composer + grammes directs : 0.85
Composer + portion visuelle : 0.65
Scan code-barres (DB off.) : 0.95
Scan code-barres (UGC) : 0.85
Recherche directe DB : 0.85
Photo IA V1 : 0.55
Photo IA V1.1 : 0.65-0.70
Favori (hérité de l'origine): confidence d'origine

CALCUL meal_timing_relative_to_training :
SI TRAINING_SESSION existe pour le jour physiologique :
delta_h = (training.started_at - meal.logged_at) en heures
delta_h ∈ [2h, 3h] avant → 'pre'
delta_h ∈ [30min, 2h] avant → 'pre_immediate'
delta_h ∈ [0, 30min] après → 'post'
delta_h ∈ [30min, 3h] après → 'post_delayed'
Sinon → 'other'

MODIFICATION D'UN REPAS EXISTANT :

1. Mise à jour de la NUTRITION_ENTRY modifiée
2. Recalcul MEAL.total\_\*
3. Trigger Flux 3B immédiat
4. Si jour passé (J-1 ou antérieur) :
   Recalcul différé au prochain sweep (pas en temps réel)

---

## A.9 — ENTITÉ : hydration_entries

id : UUID PK
user_id : UUID FK users
logged_at : TIMESTAMPTZ DEFAULT NOW()
physiological_date : DATE NOT NULL

volume_ml : INT NOT NULL
beverage_type : VARCHAR(20)
('water','tea','coffee','sports_drink','soda','alcohol','other')
input_mode : VARCHAR(10) ('composer','quick','voice')

caffeine_mg : DECIMAL(5,1) DEFAULT 0
alcohol_g : DECIMAL(4,1) DEFAULT 0
counts_toward_hydration_ml : INT NOT NULL

COEFFICIENT D'HYDRATATION :
water, tea, coffee, sports_drink : × 1.0
soda, juice : × 0.5
alcohol : × 0.0

---

## A.10 — ENTITÉ : supplement_references (base de connaissance)

id : UUID PK
name_fr : VARCHAR(100) NOT NULL
name_en : VARCHAR(100) nullable
aliases : TEXT[] nullable

category : VARCHAR(30)
('protein_amino','vitamins_minerals','fatty_acids',
'performance','cognitive_stress','sleep_recovery',
'hormonal_metabolic','digestion','anti_inflammatory',
'cbd','other')

evidence_level : VARCHAR(1) ('A','B','C','D')

physiological_impact : JSONB nullable
-- Ex: {"sleep_quality":"+","stress":"-","cortisol":"-"}

warnings : JSONB nullable
typical_dose_range : JSONB nullable
is_pharma : BOOLEAN DEFAULT FALSE

VOLUME INITIAL V1.0 :
~80 entrées (BE + FR principalement)
Couverture : niveau A et B + médicaments communs BE/FR

---

## A.11 — ENTITÉ : supplement_entries

id : UUID PK
user_id : UUID FK users
supplement_ref_id : UUID FK supplement_references nullable

logged_at : TIMESTAMPTZ DEFAULT NOW()
physiological_date : DATE NOT NULL

name_custom : VARCHAR(100) nullable (si non reconnu)
category : VARCHAR(30) nullable

dose_amount : DECIMAL(7,1) nullable
dose_unit : VARCHAR(15) nullable ('g','mg','iu','capsule','scoop','ml')

is_recurring : BOOLEAN DEFAULT FALSE
recurrence_pattern : JSONB nullable
is_skipped : BOOLEAN DEFAULT FALSE (ajout V1.0.1)

is_pharma : BOOLEAN DEFAULT FALSE
is_recognized : BOOLEAN DEFAULT FALSE
want_recognition : BOOLEAN DEFAULT FALSE
recognition_attempts : SMALLINT DEFAULT 0

notes : TEXT nullable

MATCHING CUSTOM → RECONNU :
Recherche fuzzy dans supplement_references.aliases
SI trouvé → supplement_ref_id renseigné, is_recognized = true
SI non trouvé + want_recognition = true :
→ Loggé pour curation (Couche 3 V1.1)

IMPACT MOTEUR DES COMPLÉMENTS RECONNUS :
SI supplement_ref.evidence_level IN ('A','B')
ET physiological_impact non vide :
→ Moteur contextualise les signaux affectés
→ Annotation interne "Signal modulé par [complément]"
→ Pas d'alerte si amélioration soudaine du signal concerné

---

## A.12 — ENTITÉ : training_sessions

id : UUID PK
user_id : UUID FK users
physiological_date : DATE NOT NULL
started_at : TIMESTAMPTZ NOT NULL (ajout V1.0.1)
ended_at : TIMESTAMPTZ nullable (ajout V1.0.1)
duration_min : INT NOT NULL

session_type : VARCHAR(20)
('resistance','cardio','hiit','mobility','sport','mixed')

muscle_groups : TEXT[] DEFAULT '{}'
volume_sets : INT nullable (optionnel — dégrade gracieusement)

intensity_rpe : SMALLINT (1-10)
perceived_fatigue_post : SMALLINT (1-5)
recovery_perceived_h : DECIMAL(3,1) nullable

energy_expenditure_kcal : DECIMAL(6,1) nullable
energy_source : VARCHAR(10) DEFAULT 'estimated' ('healthkit','estimated')

is_deload : BOOLEAN DEFAULT FALSE
healthkit_activity_id : VARCHAR(100) nullable
notes : TEXT nullable

CALCUL energy_expenditure_kcal (si pas HealthKit) :
MET selon session_type et intensity_rpe
energy = BMR/24 × duration_h × MET × (weight_kg/70)
Plafond : 80 kcal minimum, 1500 kcal (confirmation si dépassé)

SI volume_sets = NULL :
Overreaching calculé uniquement sur signaux qualitatifs
flag_mrv_exceeded non calculable
Volume MEV/MAV/MRV non vérifiable

HORIZON DE PROGRAMMATION DES SÉANCES :
Moteur programme J+1 à J+7 uniquement
Au-delà : jalons seulement (déload, compétition)

---

## A.13 — ENTITÉ : mesocycles

id : UUID PK
user_id : UUID FK users
phase_id : UUID FK phases nullable

started_at : DATE NOT NULL
ended_at : DATE nullable

planned_duration_weeks : SMALLINT NOT NULL
actual_duration_weeks : SMALLINT nullable

deload_planned_week : SMALLINT nullable
deload_completed : BOOLEAN DEFAULT FALSE

target_volume_progression : VARCHAR(15) DEFAULT 'linear'
('linear','undulating','block')

-- Volumes par groupe (sets/semaine)
mev_baseline : JSONB NOT NULL
mav_target : JSONB NOT NULL
mrv_ceiling : JSONB NOT NULL

outcome : VARCHAR(20) nullable
('completed_success','completed_mixed','overreaching','aborted')

VALEURS MEV/MAV/MRV INITIALES (sets/semaine/groupe) :
Débutant Intermédiaire Avancé
MEV 6-8 8-12 10-14
MAV 10-15 15-20 18-25
MRV 15-20 20-25 25-30+

senior_mode : × 0.70
athlete_mode : × 1.20
post-blessure : × 0.60 pour le groupe concerné
memory_effect : MEV + 30% au démarrage

---

## A.14 — ENTITÉ : phases

id : UUID PK
user_id : UUID FK users

phase_type : VARCHAR(20) NOT NULL
('fat_loss','lean_bulk','recomp','maintenance',
'recovery','reverse_diet','diet_break','refeed')

started_at : DATE NOT NULL
ended_at : DATE nullable (null si phase courante)

-- Cibles
caloric_target_kcal : DECIMAL(7,1) NOT NULL
deficit_surplus_kcal : DECIMAL(6,1) NOT NULL (signé)
protein_target_g : DECIMAL(5,1) NOT NULL
carbs_target_g : DECIMAL(5,1) NOT NULL
fat_target_g : DECIMAL(5,1) NOT NULL
fiber_target_g : DECIMAL(5,1) NOT NULL (ajout V1.0.1)
hydration_target_ml : INT NOT NULL

-- Progression
target_weekly_change_kg : DECIMAL(4,2) nullable
max_phase_duration_weeks : SMALLINT nullable (ajout V1.0.1)

-- Snapshot au démarrage
weight_at_start : DECIMAL(5,1) nullable
bf_at_start : DECIMAL(4,2) nullable
lean_mass_at_start : DECIMAL(5,1) nullable
tdee_at_start : DECIMAL(7,1) nullable

triggered_by : VARCHAR(20) ('onboarding','motor','manual','safety')
referential_version : VARCHAR(10) DEFAULT '1.0.0'

NOTE : Refeed et Diet Break sont des INTERVENTIONS dans la phase courante
Ils ne créent pas de nouvelle PHASE
Fin de Refeed/Diet Break ≠ transition de phase
→ Le cooldown de 14j entre transitions n'est PAS activé

---

## A.15 — ENTITÉ : motor_states

id : UUID PK
user_id : UUID FK users
computed_at : TIMESTAMPTZ NOT NULL DEFAULT NOW()

-- Références actives
active_phase_id : UUID FK phases
current_mesocycle_id : UUID FK mesocycles nullable
current_mesocycle_week : SMALLINT nullable
cycle_log_id : UUID FK cycle_logs nullable

-- Poids et tendance
weight_trend_kg : DECIMAL(5,1) nullable
weight_trend_direction : VARCHAR(10) ('up','stable','down')
weekly_change_kg : DECIMAL(4,2) nullable
weekly_change_pct : DECIMAL(5,2) nullable
velocity_status : VARCHAR(15)
('on_target','too_slow','too_fast','aberrant')

-- TDEE et adaptation
tdee_effective_kcal : DECIMAL(7,1) nullable
adaptation_level : VARCHAR(10) DEFAULT 'none'
('none','light','moderate','marked')

-- Composition
ffmi_current : DECIMAL(4,1) nullable

-- Cycle féminin
cycle_phase : VARCHAR(20) nullable
('menstrual','follicular_late','ovulation',
'luteal_early','luteal_late','unknown')

-- Sommeil
sleep_debt_h : DECIMAL(4,1) DEFAULT 0

-- Nutrition
nutrition_confidence_today : DECIMAL(3,2) nullable
daily_kcal_gap : DECIMAL(6,1) nullable
daily_protein_gap_pct : DECIMAL(5,2) nullable
daily_carbs_target_modulated : DECIMAL(5,1) nullable (ajout V1.0.1)
daily_kcal_target_modulated : DECIMAL(7,1) nullable (ajout V1.0.1)
modulation_reason : VARCHAR(100) nullable (ajout V1.0.1)

-- Cohérence
coherence_status : VARCHAR(10)
('good','light','notable','major')
coherence_diagnosis : VARCHAR(20)
('metabolic_adaptation','under_reporting','tdee_overestimate',
'hydric_retention','body_recomp','unknown')

-- Plateau
plateau_status : VARCHAR(15) DEFAULT 'none'
('none','suspected','confirmed')
plateau_type : VARCHAR(15)
('weight','strength','composition')
plateau_duration_days : SMALLINT DEFAULT 0

-- RED-S et Safety
red_s_signals_count : SMALLINT DEFAULT 0
red_s_alert_active : BOOLEAN DEFAULT FALSE
cortisol_chronic_signals_count : SMALLINT DEFAULT 0
cortisol_chronic_alert_active : BOOLEAN DEFAULT FALSE

-- Overreaching
overreaching_signals_count : SMALLINT DEFAULT 0
overreaching_level : SMALLINT DEFAULT 0 (0-4)

-- Flags nutrition
flag_caloric_floor_breached : BOOLEAN DEFAULT FALSE
flag_protein_floor_breached : BOOLEAN DEFAULT FALSE
flag_glp1_lean_mass_risk : BOOLEAN DEFAULT FALSE

-- Fenêtres temporelles
whoosh_window_active : BOOLEAN DEFAULT FALSE
post_cut_window_days_remaining : SMALLINT DEFAULT 0

-- Memory effect
memory_effect_active : BOOLEAN DEFAULT FALSE
memory_effect_weeks_remaining : SMALLINT DEFAULT 0

-- Bien-être
wellbeing_score_7j : DECIMAL(3,2) nullable
wellbeing_score_30j : DECIMAL(3,2) nullable (ajout V1.0.1)

-- Athlètes
ea_avg_7d : DECIMAL(5,1) nullable
ea_status : VARCHAR(15)
('optimal','acceptable','suboptimal','critical')

-- Patterns hebdomadaires
weekend_drift_active : BOOLEAN DEFAULT FALSE
hydration_status : VARCHAR(15) ('good','insufficient','critical')
fiber_insufficient : BOOLEAN DEFAULT FALSE
sleep_fatigue_craving_active : BOOLEAN DEFAULT FALSE
protein_distribution_asymmetric : BOOLEAN DEFAULT FALSE

-- Volume training
weekly_sessions_count : SMALLINT DEFAULT 0
weekly_high_intensity_sessions : SMALLINT DEFAULT 0
weekly_total_duration_min : INT DEFAULT 0
weekly_energy_expenditure_kcal : DECIMAL(7,1) DEFAULT 0
weekly_volume_by_group : JSONB DEFAULT '{}'
volume_status_by_group : JSONB DEFAULT '{}'
flag_mrv_exceeded : BOOLEAN DEFAULT FALSE
flag_deload_due : BOOLEAN DEFAULT FALSE

-- Performances
performance_trend_3w : VARCHAR(10)
('up','stable','down','mixed')

-- Interventions
pending_interventions : TEXT[] DEFAULT '{}'
active_alerts : UUID[] DEFAULT '{}'
highest_active_alert_level : SMALLINT DEFAULT 0

-- Bilan mensuel
phase_quality_score_last : DECIMAL(3,2) nullable
monthly_summary_id_last : UUID nullable

-- Post-bariatrique
nadir_delta_alert : VARCHAR(10) DEFAULT 'none'
('none','light','marked')

-- Semaine malade
sick_week_flagged : BOOLEAN DEFAULT FALSE

RÈGLE : INSERT un nouveau MOTOR_STATE à chaque calcul
Ne jamais UPDATE le précédent (historique complet conservé)

VUE : current_motor_state
SELECT DISTINCT ON (user_id) \*
FROM motor_states ORDER BY user_id, computed_at DESC

---

## A.16 — ENTITÉ : interventions

id : UUID PK
user_id : UUID FK users

type : VARCHAR(20) NOT NULL
('refeed','diet_break','deload','reverse_start',
'phase_transition','reds_alert','recovery_mode',
'overtraining','illness','travel')

triggered_at : TIMESTAMPTZ DEFAULT NOW()
trigger_reasons : TEXT[]
referential_section : VARCHAR(20)

proposed_at : TIMESTAMPTZ nullable
user_response : VARCHAR(15)
('accepted','refused','ignored','in_progress')

started_at : DATE nullable
ended_at : DATE nullable

outcome : VARCHAR(15) ('completed','abandoned','modified')

intervention_parameters : JSONB nullable
-- Refeed : {duration_days:2, kcal_target:2800, carbs_target:350}
-- Diet Break : {duration_days:14, kcal_target:2400}
-- Travel : {destination:"NYC", duration_days:7, timezone:"America/New_York"}

---

## A.17 — ENTITÉ : healthkit_sync_logs

id : UUID PK
user_id : UUID FK users
synced_at : TIMESTAMPTZ DEFAULT NOW()
data_type : VARCHAR(20)
('sleep','hr','hrv','activity','weight','workout')
start_date : DATE nullable
end_date : DATE nullable
records_imported : INT DEFAULT 0
sync_status : VARCHAR(15) ('success','partial_error','failure')
error_message : TEXT nullable

SÉPARATION DES RESPONSABILITÉS :
Flux 2C : sync données passives (sleep, hr, hrv, weight)
Flux 3C Voie B : import Workouts HealthKit
→ Flux 2C ne crée PAS de TRAINING_SESSION directement

---

## A.18 — ENTITÉ : alert_logs

id : UUID PK
user_id : UUID FK users
alert_type : VARCHAR(30) NOT NULL
alert_level : SMALLINT NOT NULL (0-5)
triggered_at : TIMESTAMPTZ DEFAULT NOW()
trigger_reasons : TEXT[]
acknowledged_at : TIMESTAMPTZ nullable
user_response : VARCHAR(15)
('acknowledged','dismissed','actioned','ignored')
resolved_at : TIMESTAMPTZ nullable
resolution_type : VARCHAR(20)
('auto_resolved','user_action','medical_clearance','ignored')
escalated_from : UUID FK alert_logs nullable

DÉDUPLICATION :
Avant tout déclenchement, vérifier si même type d'alerte
déjà active ET dans le cooldown → pas de nouvelle notification

ESCALADE :
Alerte niveau N ignorée > 7 jours → escalade niveau N+1
Alerte niveau 3 ignorée > 14 jours → escalade niveau 4

---

## A.19 — ENTITÉ : monthly_summaries

id : UUID PK
user_id : UUID FK users
period_start : DATE NOT NULL
period_end : DATE NOT NULL
phase_id : UUID FK phases nullable
mesocycle_id : UUID FK mesocycles nullable

-- Poids et composition
weight_start_kg, weight_end_kg, delta_weight_kg
bf_start, bf_end, delta_lean_mass_kg

-- Nutrition
avg_kcal_30j, avg_protein_30j, avg_carbs_30j, avg_fat_30j
adherence_calorique, adherence_proteique
confidence_nutrition_30j

-- Training
sessions_totales : SMALLINT
performance_trend : VARCHAR(10)
mesocycle_outcome : VARCHAR(20)

-- Bien-être
phase_quality_score : DECIMAL(3,2)
wellbeing_score_30j : DECIMAL(3,2)
sleep_avg_30j : DECIMAL(4,1)

-- Safety
alerts_triggered, alerts_ignored : SMALLINT

-- Décisions
tdee_recalibree : DECIMAL(7,1) nullable
decision_strategique : VARCHAR(20)
('continue','adjust','transition')

referential_version : VARCHAR(10) DEFAULT '1.0.0'

---

## A.20 — ENTITÉ : message_history

id : UUID PK
user_id : UUID FK users
message_type : VARCHAR(50) NOT NULL
message_family : SMALLINT (1-7)
delivered_at : TIMESTAMPTZ DEFAULT NOW()
acknowledged_at : TIMESTAMPTZ nullable

UNIQUE(user_id, message_type)

USAGE : avant d'envoyer un message Famille 7 (éducatif),
vérifier MESSAGE_HISTORY. Si déjà livré → ne pas envoyer.

---

## A.21 — RÉSUMÉ DES 20 ENTITÉS

CORE :

1.  users
2.  user_notification_preferences
3.  healthkit_sync_logs

MESURES : 4. body_measurements 5. daily_checkins 6. cycle_logs

NUTRITION : 7. nutrition_entries 8. meals 9. food_items 10. hydration_entries 11. supplement_entries 12. supplement_references

TRAINING : 13. training_sessions 14. mesocycles

ÉTAT ET INTERVENTIONS : 15. phases 16. motor_states 17. interventions 18. alert_logs 19. monthly_summaries 20. message_history

---

# PARTIE B — FLUX FONCTIONNELS

---

## B.0 — ARCHITECTURE GÉNÉRALE

8 flux + 1 module transverse (journée physiologique) :

Flux 1 : Onboarding
Flux 2 : Check-in quotidien
Flux 3A : Capture nutritionnelle
Flux 3B : Traitement nutritionnel
Flux 3C : Tracking training
Flux 4 : Bilan hebdomadaire
Flux 5 : Transitions et événements ponctuels
Flux 6 : Safety Layer continu
Flux 7 : Bilan mensuel

INTERACTIONS :
Flux 6 peut interrompre n'importe quel autre flux
Flux 5 est déclenché par Flux 4, 6, 7 ou l'utilisateur
Flux 4 consomme les sorties de Flux 2, 3A, 3B, 3C
Flux 7 consomme les sorties de Flux 4

---

## FLUX 1 — ONBOARDING

### 1.1 — Déclencheur

Première ouverture de l'app après installation.

### 1.2 — 9 étapes + calcul moteur

ÉTAPE 1 — Identité de base (obligatoire)
Capture : sex, birth_date, locale (auto), country
Safety : SI âge < 18 ans → BLOCAGE TOTAL (Safety absolu)
Auto-activation : SI âge ≥ 55 → senior_mode = true

ÉTAPE 2 — Mesures corporelles (obligatoire)
Capture : height_cm, weight_kg, wrist_circ_cm
Optionnel recommandé : waist_cm, neck_cm, hip_cm

Crée première BODY_MEASUREMENT :
measured_at = now
is_first_morning = false (sauf déclaration)
confidence_score = 0.70

Calcul immédiat (en mémoire) :
bf_estimated (formule Navy si mesures suffisantes)
lean_mass_kg, ffmi, ffmi_normalized

ÉTAPE 3 — Historique training (obligatoire)
Capture : training_level, training_history_years,
training_history_pause_months,
injury_current, injury_muscle_group (si applicable)

Calcul memory_effect_active :
SI training_history_years ≥ 2
ET training_history_pause_months > 0.5
ET training_history_pause_months ≤ 60 :
memory_effect_active = true

ÉTAPE 4 — Activité spontanée (obligatoire)
Capture : activity_level (0-4)
Sert au calcul du facteur d'activité TDEE

ÉTAPE 5 — Cycle féminin (conditionnel : sex = F uniquement)
Options et actions :
"Cycle régulier connu" → cycle_tracking_level = 1 + capture cycle_last_j1, cycle_avg_duration_days + création CYCLE_LOG initial (is_complete = false)
"Cycle mais pas suivi" → cycle_tracking_level = 2 + Mode Découverte Assistée activé
"Cycle irrégulier" → cycle_tracking_level = 3
"Ménopausée" → cycle_tracking_level = 4 + sous-question : THM actif ?
"Pas de cycle / contraception" → cycle_tracking_level = 0
"Préfère ne pas indiquer" → cycle_tracking_level = 0

ÉTAPE 6 — Conditions médicales (optionnel mais critique)
Multi-sélection :
Hypothyroïdie → sous-question TSH équilibrée ?
SOPK
Diabète Type 1
Diabète Type 2
Condition cardiovasculaire → activation requires_medical_clearance
Trouble alimentaire → sous-question niveau (actif/rémission/vigilance)
GLP-1 (Ozempic/Wegovy/Mounjaro/etc.) → activation glp1_active
Post-bariatrique → type + date + nadir_weight_kg
Aucune / Je préfère ne pas indiquer

Activations immédiates :
Cardiovasculaire → requires_medical_clearance = true
TCA actif → tca_safe_mode : weight_display_mode='qualitative'
caloric_display_mode='hidden'
GLP-1 → plancher protéique strict activé
Post-bariat < 3 mois → redirection message : soins chirurgicaux d'abord
is_bariatric = true si post-bariatrique déclaré

ÉTAPE 7 — Objectif et ambition (obligatoire)
Capture : goal (déclaratif, peut être modifié par le moteur)
ambition_level (standard/advanced)

Le moteur peut proposer une phase différente à l'étape 9.
L'utilisateur garde le dernier mot sauf Safety Layer.

ÉTAPE 8 — Préférences (optionnel)
Crée USER_NOTIFICATION_PREFERENCE avec valeurs par défaut
Modifiables par l'utilisateur à tout moment

Valeurs par défaut selon profil :
tca_safe_mode → weight_display_mode='qualitative', display='hidden'
senior_mode → tone='gentle' suggéré
athlete_mode → tone='technical' suggéré

ÉTAPE 9 — CALCUL MOTEUR (invisible utilisateur)

9.1 Calcul BF et FFMI :
SI mesures Navy complètes → formule Navy (confidence 0.75)
SINON → estimation BMI + sexe + âge (confidence 0.45)
lean_mass_kg = weight_kg × (1 - bf_estimated)
ffmi = lean_mass_kg / height_m²
ffmi_normalized = ffmi + (6.1 × (1.8 - height_m))

9.2 Calcul TDEE de référence :
BMR = Mifflin-St Jeor(sex, weight, height, age)
OU Katch-McArdle(lean_mass_kg) si bf_confidence ≥ 0.65
TDEE_théorique = BMR × facteur_activité(activity_level)
Modulations :
senior_mode → TDEE × 0.95
hypothyroïdie → TDEE × 0.85-0.90
athlete_mode → recalcul dynamique

9.3 Détermination phase initiale recommandée :
Arbitrage : bf_estimated + goal_déclaré + conditions médicales + ambition_level + senior_mode + memory_effect_active

    Règles clés :
      BF > 22% (H) / 30% (F) + goal=lean_bulk → Fat Loss d'abord
      memory_effect_active + BF dans zone → Lean Bulk ou Recomp
      TCA actif → Maintenance, tracking calorique désactivé
      Post-bariat. intermédiaire → Recomp ou Maintenance
      Cardio sans clearance → Maintenance, training en attente
      GLP-1 → selon perte en cours, plancher protéique strict

9.4 Calcul des cibles :
Selon phase recommandée et profil
protein_target = lean_mass_kg × cible_protéique(phase, profil)
fat_target = max(0.6g/kg_PC, 15-25% kcal)
carbs_target = (caloric_target - kcal_P - kcal_F) / 4
fiber_target = selon profil (25g/j F, 30-38g/j H + modulations)
hydration_target = weight_kg × 35 (+ modulations profil)

9.5 Création PHASE initiale :
triggered_by = 'onboarding'
referential_version = '1.0.0'

9.6 Création MESOCYCLE (si phase implique training structuré) :
planned_duration_weeks = 4-6 (senior : 3-4)
deload_planned_week = planned_duration - 1
mev/mav/mrv calculés selon profil

9.7 Création MOTOR_STATE initial :
ea_kcal_per_kglm = NULL (pas de données encore — correction V1.0.1)
weight_trend_kg = weight_kg mesure initiale (1 seul point)
adaptation_level = 'none'
red_s_alert_active = false
memory_effect_active = calculé en étape 3
pending_interventions = []

9.8 Recommandations médicales contextuelles :
Senior 55+ → suggestion bilan médical
Cardiovasculaire → confirmation médicale obligatoire
Post-bariatrique → confirmation suivi chirurgical
TCA actif → orientation soignants
GLP-1 → rappel suivi prescripteur

### 1.3 — Outputs de l'onboarding

users complet créé
user_notification_preferences créé
Première body_measurements créée
phases active créée (phase recommandée)
mesocycles initial créé (si applicable)
motor_states initial créé
cycle_logs initial créé (si Niveau 1)
Smart Agenda initialisé (premier check-in, première pesée, bilan J+7)

---

## FLUX 2 — CHECK-IN QUOTIDIEN

### 2.1 — Vue d'ensemble

3 sous-flux :
2.A : Capture qualitative
2.B : Capture pesée
2.C : Sync HealthKit

### 2.2 — Déclencheurs

2.A : Notification matinale (daily_checkin_time) OU ouverture manuelle
2.B : Rappel selon weigh_frequency_pref OU saisie manuelle
2.C : Automatique à chaque ouverture + sync nocturne 03:00

### 2.3 — Sous-flux 2.A — Capture qualitative

QUESTIONS QUOTIDIENNES (toujours) :
energy_score, mood_score, sleep_duration_h, sleep_quality_score
Note : ne comptent PAS dans le plafond de 6 questions rotatives

QUESTIONS ROTATIVES (max 6, cooldown 2-3 jours selon la question) :
stress_score, hunger_score, bloating, unusual_cravings, notes
Priorité : question dont la dernière réponse est la plus ancienne

QUESTIONS CONDITIONNELLES :
period_started : sex=F ET cycle_tracking_level ∈ {1,2,3}
perceived_fatigue_post : TRAINING_SESSION créée le jour physiologique

DÉCOUVERTE ASSISTÉE (cycle_tracking_level = 2) :
Questions supplémentaires en rotation prioritaire :
"Règles cette semaine ?" (hebdomadaire)
bloating (priorité +1)
unusual_cravings = sweet (priorité +1)
energy comparée à hier (priorité +1)

MODE TCA-SAFE :
Supprimés : hunger_score, unusual_cravings
Reformulés : mood_score → "Comment te sens-tu globalement ?"
Ajoutés : champ qualitatif libre

### 2.4 — Sous-flux 2.B — Capture pesée

Crée BODY_MEASUREMENT avec physiological_date calculée
Calcul confidence_score selon conditions déclarées
Détection outlier : |delta| > 2.0 kg en 48h → is_outlier = true

MODE TCA-SAFE :
weight_display_mode = 'qualitative' → pesée stockée, jamais affichée
weight_display_mode = 'hidden' → pesée désactivée

### 2.5 — Sous-flux 2.C — Sync HealthKit

Récupère : sleep_duration, HRV, resting_hr, active_calories
Workouts → transmis à Flux 3C (Flux 2C ne crée PAS de TRAINING_SESSION)
Priorité sommeil : HealthKit > déclaratif
Trace chaque sync dans healthkit_sync_logs

### 2.6 — Consolidation du DAILY_CHECKIN

À day_cutoff_hour le lendemain OU à la demande du bilan hebdo
Un seul DAILY_CHECKIN par journée physiologique (UNIQUE contrainte)

### 2.7 — Mise à jour du MOTOR_STATE après check-in

2.7.1 Tendance pondérale (si nouvelle pesée non-outlier) :
weight_trend_kg = filtre exponentiel(précédent, nouvelle_pesée, 0.1)
direction = ↑ si > précédent+0.1, ↓ si < précédent-0.1, sinon stable

2.7.2 Dette sommeil 7 jours :
sleep_debt_h = Σ max(0, besoin_sommeil - sleep_duration_h) sur 7j
Seuils : <2h (OK), 2-5h (modéré), 5-10h (significatif), >10h (critique)

2.7.3 Phase cycle (si cycle_tracking_level ∈ {1,2}) :
Cas j1_date > today → cycle_phase = 'unknown' + alerte interne
jours_depuis_j1 = today - cycle_log_actif.j1_date
Mapping :
J1-J5 → 'menstrual'
J6-J13 → 'follicular_late'
J14-J16 → 'ovulation'
J17-J21 → 'luteal_early'
J22-J28 → 'luteal_late'

    SI period_started = true dans check-in :
      cycle_log_actif.is_complete = true
      cycle_log_actif.duration_days = jours_depuis_j1
      Nouveau CYCLE_LOG créé avec j1_date = today

    SI period_ended = true dans check-in :
      period_duration_days calculée et stockée dans CYCLE_LOG

2.7.4 Découverte Assistée (cycle_tracking_level = 2) :
Analyse patterns sur DAILY_CHECKIN récents
SI 6+ semaines ET ≥ 2 cycles observés :
Proposer migration Niveau 1 (via Flux 5)

2.7.5 Fenêtre post-cut :
SI phase précédente = Fat Loss ET ended_at ≤ 14j :
post_cut_window_days_remaining = 14 - jours_depuis_fin
whoosh_window_active = true

2.7.6 Signaux RED-S (sex = F) :
Évaluation 10 signaux (voir Flux 6.4.1)
SI ≥ 3 signaux dont ≥ 1 HARD → Flux 6 déclenché

2.7.7 Signaux cortisol chronique :
Évaluation 7 signaux (voir Référentiel Section 3.5.6)
≥ 3 signaux → cortisol_chronic_alert_active = true

2.7.8 Énergie disponible (athlete_mode) :
ea_jour = (apports_jour - dépense_training_jour) / lean_mass_kg
SI < 30 → signal RED-S hard ajouté

2.7.9 Snapshot MOTOR_STATE créé (INSERT, pas UPDATE)

---

## FLUX 3A — CAPTURE NUTRITIONNELLE

### 3A.1 — 5 voies de saisie

VOIE 1 — Nutrition Composer (saisie guidée, voie principale)

4 couches :
Couche 1 : Catégorie (Protéines/Glucides/Légumes/Fruits/Lipides/Extras)
Couche 2 : Sous-type (4-6 items selon catégorie)
Couche 3 : Item précis (6-10 items selon sous-type)
Couche 4 : Quantité (3 modalités)

Couche 4 modalités :
A — Scan code-barres → confidence 0.95
B — Portion visuelle (Lexique de Portions) → confidence 0.65
C — Grammes directs → confidence 0.85

Lexique de Portions (calibré selon palm_width_cm) :
Paume (sans doigts) : ~100g viande/poisson × coefficient
Poing fermé : ~150g féculents cuits × coefficient
Pouce entier : ~15g lipide/fromage × coefficient
Cuillère à soupe : ~10-15g (pas de modulation)
Cuillère à café : ~3-5g
Deux mains en coupe : ~50g feuilles/salade × coefficient
Pincée : ~1-2g × (coefficient × 0.5)

coefficient = palm_width_cm / 9.0 (référence)

Suggestions contextuelles :
Heure repas typique → 3 derniers favoris ou repas répétés
Training dans 2-3h → suggestion pré-séance
Lutéale tardive → mention discrète glucides augmentés (1 fois/phase)

VOIE 2 — Scan code-barres
Lookup barcode dans food_items
SI trouvé → confidence 0.95 (DB off.) ou 0.85 (UGC)
SI non trouvé → saisie manuelle OU bascule Voie 1

VOIE 3 — Recherche directe DB
Recherche fuzzy dans food_items.name_fr
Résultats classés : pertinence + fréquence usage user + verified > UGC
Chaînes restaurants intégrées (McDo, BK, Subway, etc. BE+FR)
confidence = 0.85

VOIE 4 — Photo IA
V1 : reconnaissance basique, confidence max 0.55
V1.1 : reconnaissance améliorée, confidence 0.65-0.70
Photo IA pré-remplit le Composer → l'utilisateur valide
Photo IA ne crée PAS directement les NUTRITION_ENTRY
Post-remplissage → question : "Y a-t-il un lipide ajouté ?"

VOIE 5 — Favori
La recharge crée TOUJOURS un nouveau MEAL distinct
Le MEAL source (favori) est conservé inchangé
Option ajustement quantités → appliqué au nouveau MEAL uniquement

### 3A.2 — Création MEAL et NUTRITION_ENTRY

MEAL créé :
physiological*date = compute_physiological_date(now, user.day_cutoff_hour)
meal_type = inféré selon heure OU déclaré
total*\* = Σ NUTRITION_ENTRY liées

NUTRITION_ENTRY créée par item :
quantity_g = converti depuis quantity_raw + quantity_unit
calories_kcal = quantity_g × food_item.kcal_per_100g / 100
protein_g, carbs_g, fat_g, fiber_g = idem
meal_timing_relative_to_training = calculé selon TRAINING_SESSION du jour

TRIGGER après toute création/modification NUTRITION_ENTRY :
→ Flux 3B (traitement nutritionnel)

### 3A.3 — Hydratation

VOIE A — Quick Hydration :
Tap → sélection rapide (250ml/500ml/750ml/1L/custom)
Type par défaut : water
Crée HYDRATION_ENTRY

VOIE B — Via Composer (Catégorie Extras → Hydratation)
VOIE C — Sync HealthKit (water intake si dispo)

CIBLE hydration_target_ml (dans PHASE) :
poids_kg × 35 + modulations profil

POST-BARIATRIQUE — séparation liquides/repas :
SI HYDRATION_ENTRY dans ±15 min d'un MEAL :
Note discrète "Pense à séparer eau et repas"

### 3A.4 — Compléments nutritionnels

VOIE A — Recurring programmé (auto-loggé quotidiennement)
VOIE B — Ponctuel via bouton "+"
VOIE C — Via Composer (Extras → Compléments)

MATCHING COMPLÉMENT NON RECONNU :

1. Recherche fuzzy dans supplement_references.aliases
2. SI trouvé → is_recognized = true, supplement_ref_id renseigné
3. SI non trouvé + want_recognition = true :
   → Loggé pour curation future (V1.1)
4. SI non trouvé → custom pur, pas de modulation moteur

MÉDICAMENTS RECONNUS :
is_pharma = true
Adaptation selon médicament :
Levothyrox → cohérent hypothyroïdie
Metformine → cohérent diabète T2 / SOPK
GLP-1 → activation protocole 4.3.4
Contraception hormonale → adaptation cycle niveau 0
Corticoïdes → alerte rétention hydrique + impact métabolique

SUBSTANCES HORS SCOPE (anabolisants, SARMs, etc.) :
Enregistrées sans jugement
Plafonds naturels (Section 3.5) non applicables
Recommandation bilan médical

### 3A.5 — Modes TCA-safe

tca_safe_mode_complet (TCA actif) :
Tracking nutrition désactivé entièrement
Voies de saisie inaccessibles

tca_safe_mode_partial (TCA rémission) :
Calories non affichées
NUTRITION_ENTRY créées normalement en base
Smart Agenda : "🍽 Déjeuner — composé" (sans chiffres)

---

## FLUX 3B — TRAITEMENT NUTRITIONNEL

### 3B.1 — Déclencheurs

Primaires : création/modification/suppression NUTRITION_ENTRY
consolidation DAILY_CHECKIN
création/modification HYDRATION_ENTRY
Secondaires : avant Flux 4, Flux 7, transition de phase

### 3B.2 — Calculs journaliers

TOTAUX DU JOUR :
apports_jour.total_kcal = Σ NUTRITION_ENTRY.calories_kcal
apports_jour.total_protein_g = Σ protein_g
apports_jour.total_carbs_g = Σ carbs_g
apports_jour.total_fat_g = Σ fat_g
apports_jour.total_fiber_g = Σ fiber_g
apports_jour.total_water_ml = Σ HYDRATION_ENTRY.counts_toward_hydration_ml
apports_jour.total_alcohol_g = Σ HYDRATION_ENTRY.alcohol_g
apports_jour.total_caffeine_mg = Σ caffeine_mg

CONFIDENCE DU JOUR :
confidence_jour = moyenne pondérée par part calorique de chaque entry
≥ 0.85 → Haute | [0.65, 0.85[ → Moyenne | < 0.65 → Basse

GAPS VS CIBLES (calculés contre cibles MODULÉES si cycle actif) :
gaps.kcal = total_kcal - phase.caloric_target_kcal (ou modulé)
gaps.protein = total_protein_g - phase.protein_target_g
gaps.carbs = total_carbs_g - phase.carbs_target_g (ou modulé)
gaps.fiber = total_fiber_g - phase.fiber_target_g
gaps.hydration = total_water_ml - phase.hydration_target_ml

CIBLES MODULÉES (athlètes) :
Stockées dans MOTOR_STATE.daily_carbs_target_modulated
Stockées dans MOTOR_STATE.daily_kcal_target_modulated
NE modifient PAS PHASE.carbs_target_g (moyenne hebdomadaire)

### 3B.3 — Modulations cycliques (femme)

SI cycle_phase = 'luteal_early' :
caloric_target_modulé = caloric_target × 0.85
carbs_target_modulé = carbs_target + 10g

SI cycle_phase = 'luteal_late' :
caloric_target_modulé = caloric_target × 0.70-0.75
carbs_target_modulé = carbs_target × 1.15-1.20

Les gaps sont calculés contre les cibles MODULÉES

### 3B.4 — Cohérence apports/perte

Fenêtre roulante 14 jours :
déficit_moyen = Σ (apports_j - tdee_effective) / 14
perte_attendue_kg = (déficit_moyen × 14) / 7700
perte_observée_kg = weight_trend(J) - weight_trend(J-14)
écart = |perte_attendue - perte_observée| / |perte_attendue|

Interprétation :
écart < 0.10 → cohérence bonne
[0.10, 0.25] → écart acceptable
[0.25, 0.40] → écart notable → surveillance > 0.40 → écart majeur → diagnostic causal

Diagnostic causal (dans l'ordre) :
SI confidence_score moyen bas → sous-déclaration probable
SI signaux adaptation ≥ 2 ET déficit long → adaptation métabolique
SI activity_level surestimé → surestimation TDEE
SI rétention récente (phase lutéale, sodium) → rétention hydrique
Sinon → inconnu

CRITIQUE : si coherence_diagnosis = 'under_reporting'
→ PAS de Diet Break / Refeed
→ Coaching tracking uniquement

### 3B.5 — Planchers

CALORIQUE ABSOLU (Flux 6.6.1) :
H : 1500 kcal/j | F : 1200 kcal/j
Athlète : max(plancher, BMR × 1.1)
1 jour : info interne | 2j : niveau 1 | 3j : niveau 2
5j : niveau 3 | 7j : niveau 4 → Recovery

PROTÉIQUE (planchers section A.2.2) :
1-2j : niveau 1 | 3-4j : niveau 2 | 5j+ : niveau 3

### 3B.6 — Signaux par profil

SOPK :
% glucides simples / total_carbs si > 30% sur 7j → suggestion
fiber_target = fiber_standard + 5g

DIABÈTE T2 :
Même que SOPK + surveillance plus stricte glucides simples

HYPOTHYROÏDIE :
total_carbs < 80g/j sur 7j → note discrète

CARDIO :
sodium_estimé_jour > 2g/j → note
alcohol_g > 14g/j sur ≥ 3j/sem pendant 2 sem → niveau 2
caféine + arythmie > 200mg/j → note

POST-BARIATRIQUE :
Volume repas → si > 350g sur > 2 repas/sem → note
< 4 prises/j sur > 3j/sem → note
Bypass : glucides simples > 20% → alerte douce

GLP-1 :
Plancher protéique 0.85 × cible (non négociable)
SI tdee - apports > 500 ET perte en cours :
→ Suggestion augmenter apports (médicament crée déjà le déficit)

### 3B.7 — Patterns hebdomadaires

WEEKEND_DRIFT : moy.kcal sam+dim vs lun-ven > 20% sur 4 semaines
SLEEP_FATIGUE_CRAVING : cravings sucrés > 3j + sleep_quality < 3
PROTEIN_ASYMMETRIC : > 60% protéines sur 1 repas
FIBER_INSUFFICIENT : < cible × 0.7 sur 2+ semaines

### 3B.8 — Vitesse pondérale

weekly_change_kg = weight_trend(J) - weight_trend(J-7)
Comparaison aux cibles PHASE → flag pour Flux 4

### 3B.9 — Impact des compléments physiologiques

SI supplement_ref.evidence_level IN ('A','B') ET is_recurring :
Pour chaque signal affecté dans physiological_impact :
Annotation interne "Signal modulé par [complément]"
→ Pas d'alerte si amélioration soudaine du signal concerné
→ Ne masque pas le signal, le contextualise

### 3B.10 — Outputs vers le MOTOR_STATE

Mise à jour :
nutrition_confidence_today, daily_kcal_gap, daily_protein_gap_pct
coherence_status, coherence_diagnosis
weekend_drift_active, sleep_fatigue_craving_active
protein_distribution_asymmetric, hydration_status, fiber_insufficient
weekly_change_kg, velocity_status
flag_caloric_floor_breached, flag_protein_floor_breached

Outputs vers autres flux :
→ Flux 4 : patterns hebdomadaires, vitesse, adhérence
→ Flux 6 : plancher calorique > 7j, EA critique
→ Flux 3C : energy_expenditure pour EA

---

## FLUX 3C — TRACKING TRAINING

### 3C.1 — 3 voies de capture

VOIE A — Saisie manuelle structurée :
8 étapes : type, durée, groupes musculaires, RPE,
fatigue post, volume (optionnel), notes, is_deload

VOIE B — Import HealthKit :
Sync automatique des Workouts
healthkit_activity_id stocké (évite doublons)
Champs manquants demandés à l'utilisateur (RPE + fatigue, 2 taps)
Workouts transmis par Flux 2C → créés ici dans TRAINING_SESSION

VOIE C — Séance programmée depuis Smart Agenda :
Pré-remplie avec le type programmé par le mésocycle
Horizon de programmation : J+1 à J+7 uniquement

SI volume_sets = NULL :
Overreaching calculé sur signaux qualitatifs uniquement
flag_mrv_exceeded non calculable → dégradation gracieuse

### 3C.2 — Calcul dépense énergétique

SI HealthKit fournit → utilisation directe (confidence 0.80)
SINON → BMR/24 × duration_h × MET × (weight_kg/70)
Plafond : 80 kcal min, 1500 kcal (confirmation si dépassé)

### 3C.3 — Mise à jour MESOCYCLE

semaine_méso = semaine depuis MESOCYCLE.started_at

Vérification MEV/MAV/MRV (si volume_sets déclaré) :
< MEV → flag_under_mev
∈ [MEV, MAV] → optimal
∈ [MAV, MRV] → flag_approaching_mrv > MRV → flag_mrv_exceeded

SI semaine = deload_planned_week :
Rappel déload dans Smart Agenda

SI semaine > planned_duration_weeks :
→ Trigger Flux 5 : proposer nouveau mésocycle

### 3C.4 — Détection overreaching

Évaluation sur 14 jours glissants :

SIGNAUX TRAINING (depuis training_sessions) :
□ performance en baisse > 5% sur 3 séances
□ RPE moyen > 8 sur 10+ jours
□ MRV dépassé sur ≥ 2 groupes
□ > 6 séances RPE ≥ 7 sur 7 jours

SIGNAUX RÉCUPÉRATION (depuis daily_checkins) :
□ fatigue_post moyenne > 4/5 sur 10+ jours
□ sleep_quality < 3/5 sur 7+ jours
□ mood_score < 2.5 sur 7+ jours
□ energy_score < 2.5 sur 7+ jours
□ HRV déclin sur 7j (si HealthKit)
□ resting_hr > baseline + 8 bpm sur 5+ jours

Niveaux :
0 signaux → aucune action
1-3 → note surveillance (niveau 1)
4-5 → proposition déload semaine suivante (niveau 2)
6+ → déload immédiat fortement recommandé (niveau 3)
6+ sur > 3 sem → surentraînement suspect (niveau 4 → Flux 6)

### 3C.5 — Adaptations par profil

SENIOR :
MEV/MAV/MRV × 0.70
Déload toutes 3-4 semaines
Seuil overreaching niveau 3 déclenché à 5 signaux (vs 6)

ATHLÈTE :
MEV/MAV/MRV × 1.20
Périodisation glucidique synchronisée (via MOTOR_STATE)
Carb loading déclenché si compétition endurance > 90 min déclarée

MEMORY EFFECT ACTIF :
Volume initial = MEV + 30%
MEV → MAV en 2-3 semaines (vs 4-6 normal)
SI memory_effect_weeks_remaining = 0 → Flux 5 pour notification

POST-BLESSURE :
MEV/MAV/MRV × 0.60 pour le groupe concerné
RPE cible ≤ 5 pour ce groupe
Validation médicale recommandée

CARDIO (cardiovasculaire) :
SI clearance_confirmed = false → training bloqué RPE ≥ 6
HIIT interdit sans clearance

TCA rémission :
Dépense calorique masquée dans l'affichage
Training présenté comme "mouvement" pas "brûlage"

---

## FLUX 4 — BILAN HEBDOMADAIRE

### 4.1 — Déclencheur

7 jours depuis le dernier bilan (ou onboarding)
Exécuté à day_cutoff_hour du dernier jour de la semaine
Préconditions : ≥ 3 DAILY_CHECKIN sur les 7 derniers jours

### 4.2 — Collecte des données de la semaine

Données pondérales, nutritionnelles, training, bien-être,
cycle, compléments, safety (red_s, cortisol), EA athlètes,
post-bariatrique (nadir), sick_days_count

### 4.3 — Évaluation pondérale

FILTRES DANS L'ORDRE (correction V1.0.1) : 1. Modulations cycle (lutéale tardive × 0.60, menstruelle × 0.50) 2. Fenêtre post-cut (gel de lecture) 3. Whoosh window (chute soudaine > 0.8 kg en 48h = relargage hydrique,
pas de recalibration TDEE — correction majeure V1.0.1) 4. Adaptation métabolique (recalibration TDEE) 5. Glycogène post-refeed (variation attendue) 6. Maladie (sick_days_count ≥ 3 → données atypiques) 7. Rétention hydrique générale

LECTURE SELON PHASE :
Fat Loss :
TropRapide : > 1%/sem (GLP-1 : > 1.5%/sem)
DansCible : dans les fourchettes Référentiel
LenteMaisPositive : > 0 mais sous la cible

    Lean Bulk :
      TropRapide : > 0.5%/sem
      DansCible : dans les fourchettes
      LentOuStagnation : < 0.5 cible sur > 3 semaines

### 4.4 — Évaluation nutritionnelle

adhérence_calorique_7j = % jours dans cible ±10%
adhérence_proteique_7j = % jours ≥ 90% cible

PONDÉRATION SELON CONFIDENCE (ajout V1.0.1) :
Jours confidence_jour ≥ 0.65 : poids normal
Jours confidence_jour [0.50, 0.65[ : poids × 0.70
Jours confidence_jour < 0.50 : exclus du calcul
SI < 4 jours valides → "Données insuffisantes" (pas d'alerte)

### 4.5 — Détection des phénomènes

ADAPTATION MÉTABOLIQUE :
SI coherence_status ∈ {notable, major}
ET coherence_diagnosis = 'metabolic_adaptation' (CRITIQUE V1.0.1)
ET durée_phase ≥ 6 semaines
ET signaux_secondaires ≥ 2 (liste complète Section 3.1.3) :
adaptation_level qualifié

    SI coherence_diagnosis = 'under_reporting' :
      → PAS d'adaptation détectée (correction V1.0.1)
      → Coaching tracking uniquement

PLATEAU :
Qualification selon durées seuil (Section 3.6.2)
Diagnostic causal AVANT toute intervention
Causes → réponses différenciées (Section 3.6.3)

REBOND POST-CUT :
SI phase précédente = fat_loss ET ≤ 21 jours :
Variation > 2.5 kg/1 sem → glycogène (normal)
Variation > 2.5 kg/2+ sem → suspicion regain gras

MEMORY EFFECT :
SI memory_effect_active ET progression > 150% normale :
Confirmation memory effect, recalcul weeks_remaining

### 4.6 — Décision d'ajustement

RÈGLE ABSOLUE : 1 seul ajustement majeur par bilan hebdomadaire

HIÉRARCHIE (dans l'ordre) :

1. Safety Check (red_s, overreaching 4, plancher, cortisol critique)
2. Plateau + adaptation (diagnostic causal d'abord)
3. Progression hors cible
4. Bien-être critique
5. Ajustements fins

DIET BREAK EN LEAN BULK (ajout V1.0.1) :
SI adaptation en Lean Bulk → Maintenance temporaire 7j
Pas de Diet Break (terminologie et objectif différents)

REFEED — TIMING :
Lutéale tardive → timing sous-optimal mais possible
→ Signaler, proposer décalage si < 14j
→ Si attente > 14j → procéder quand même

DIET BREAK — TIMING :
J1 dans ≤ 14j → attendre et démarrer au J1
J1 dans > 14j → démarrer immédiatement

### 4.7 — Rapport utilisateur (5 sections)

Section 1 : Résumé (3-4 observations clés)
Section 2 : Poids et composition (contextualisé)
Section 3 : Nutrition (adhérence, patterns, hydratation)
Section 4 : Training (séances, volume, mésocycle)
Section 5 : Plan semaine suivante (ajustements + interventions)

- Section 4bis si compléments physiologiques actifs :
  "À noter : certains signaux peuvent être influencés par [complément]"

Adaptations ton par profil :
TCA-safe : pas de chiffres, focus énergie/force/bien-être
Athlète : données précises, périodisation
Senior : valoriser la régularité, rappels micronutriments
Post-bariatrique : protéines + hydratation + bilan bio

---

## FLUX 5 — TRANSITIONS ET ÉVÉNEMENTS PONCTUELS

### 5.1 — Types de transitions

PLANIFIÉES (validées par l'utilisateur) :
Fat Loss ↔ Reverse Diet / Maintenance / Lean Bulk
Lean Bulk ↔ Maintenance / Fat Loss
Maintenance ↔ Fat Loss / Lean Bulk
Reverse Diet → Maintenance / Lean Bulk
Recovery → Maintenance (avec précautions)

FORCÉES Safety Layer (pas de validation requise) :
Toute phase → Recovery : RED-S confirmé, aménorrhée > 3 mois,
TCA actif détecté
Lean Bulk/Fat Loss → Maintenance : cardio sans clearance

INTERDITES :
Recovery → Fat Loss (avant 3 cycles si RED-S)
Toute phase → Hard Bulk (senior, cardio, TCA actif)
Fat Loss → reprise (post-bariat. < 3 mois)

### 5.2 — Règles générales

Cooldown : 14 jours entre 2 transitions de PHASE
Exception : Safety Layer (pas de cooldown)
Exception : fin Refeed/Diet Break (ce sont des INTERVENTIONS,
pas des PHASES → cooldown non activé)

### 5.3 — Workflow transition standard

1. Proposition moteur OU demande utilisateur
2. Calcul état actuel (weight, bf, lean_mass, tdee, adaptation)
3. Vérification Safety Layer
4. Calcul nouveaux paramètres PHASE
5. Présentation utilisateur (sauf Safety forcé)
6. Si validé :
   PHASE courante : ended_at = now
   INSERT nouvelle PHASE
   MOTOR_STATE mis à jour
   Smart Agenda mis à jour
   Nouveau MESOCYCLE si applicable

### 5.4 — Protocoles ponctuels (INTERVENTIONS)

REFEED :
Durée 1-2 jours. Override temporaire PHASE courante.
Paramètres : TDEE + 20-30%, glucides × 2.0-2.5, lipides réduits
Auto-terminaison à J+durée
Prise de poids post-refeed : normale, pas d'alerte

DIET BREAK :
Durée 7-14j selon adaptation_level
Calories : TDEE effective (exactement)
Recalibration TDEE post-break
Auto-terminaison + retour phase précédente

REVERSE DIET :
Nouvelle PHASE créée
Vitesse selon durée du cut (voir Section 1.3.6)
Durées maximales selon durée du cut (voir Section 1.3.6)
Si TDEE objectif non atteint après durée max :
→ Maintenance + recommandation médicale

DÉLOAD :
INTERVENTION dans le mésocycle, pas de nouvelle PHASE
Volume MEV × 0.60 (programmé) ou × 0.50 (overreaching)
Nutrition inchangée (sauf si Diet Break simultané)

### 5.5 — Mésocycles

FIN DE MÉSOCYCLE :
Évaluation performance, volume, récupération
Recalibration MEV/MAV/MRV selon tolérance observée
Nouveau MESOCYCLE créé avec paramètres ajustés

AJUSTEMENT EN COURS :
Overreaching, maladie, blessure → modification sans terminer

### 5.6 — Transitions cycle féminin

Migrations entre niveaux : voir Section 2.6.2 du Référentiel
Aménorrhée > 3 mois + contexte déficit → signal RED-S hard

### 5.7 — Memory effect

FIN DE FENÊTRE :
memory_effect_active = false
training_level recalibré selon progression réelle
MEV/MAV/MRV → valeurs standard pour le niveau recalibré
SI progression encore > Table A → extension 2 semaines

### 5.8 — Événements exceptionnels

COMPÉTITION :
Déclarée dans Smart Agenda → TYPE = VOYAGE_COMPETITION
J-21 à J-7 : nutrition orientée performance (pas de déficit profond)
J-3 à J-1 : carb loading (si endurance > 90 min)
J+1 à J+7 : récupération post-compétition

MALADIE PROLONGÉE (> 7 jours) :
Déclarée via sick_today = true dans check-in
Déclaration via événement Smart Agenda possible
Phase → Maintenance (ni déficit ni surplus)
MESOCYCLE → pause
Reprise post-maladie : MEV × 0.70 / 0.85 / normal sur 3 semaines

VOYAGE (ajout V1.0.1) :
Déclaré comme événement Smart Agenda TYPE = 'travel'
Mode voyage : ajustements suspendus, données sans pénalité
day_cutoff_hour ajusté selon fuseau local du téléphone
Bilan Flux 4 au retour : fenêtre lecture poids étendue +7j

CHANGEMENT CONDITION MÉDICALE :
Ajout → activation immédiate protocole correspondant
Retrait → désactivation progressive (TCA nécessite double validation)
Si Safety Layer impliqué → transition phase si nécessaire

ACTIVATION SENIOR MID-USE (ajout V1.0.1) :
SI birth_date modifiée ET nouvel âge ≥ 55 :
senior_mode = true
Recalcul immédiat : TDEE × 0.95, déficit max, protéines, MEV/MAV/MRV

### 5.9 — Communication de transition

Structure 5 étapes (Section 2.5.7 du Référentiel) :

1. Contexte | 2. Bilan | 3. Raison | 4. Plan | 5. Premiers pas

Recovery forcée RED-S (Safety absolu) :
Pas de validation requise pour démarrer
Double validation 48h d'écart minimum pour sortir :
Étape 1 : "Je comprends les risques et je me sens mieux"
Étape 2 : "J'ai consulté ou je prends en charge ma situation"
Conditions supplémentaires : red_s_signals_count = 0 sur 21j consécutifs + retour règles ≥ 3 cycles (si aménorrhée)

---

## FLUX 6 — SAFETY LAYER CONTINU

### 6.1 — Exécution

À chaque consolidation DAILY_CHECKIN
À chaque création/modification BODY_MEASUREMENT
À chaque création TRAINING_SESSION
À chaque création NUTRITION_ENTRY (planchers)
Sweep automatique à day_cutoff_hour (toutes les 24h)

### 6.2 — Architecture des niveaux d'alerte

NIVEAU 0 — INFO : note dans Smart Agenda, aucune action requise
NIVEAU 1 — SUGGESTION : message discret, cooldown 72h
NIVEAU 2 — ALERTE DOUCE : notification + action, bypass 1 tap, cooldown 48h
NIVEAU 3 — ALERTE FORTE : notification prioritaire, double validation, cooldown 24h
NIVEAU 4 — CRITIQUE : transition forcée OU double validation, pas de cooldown
NIVEAU 5 — URGENCE MÉDICALE : écran complet, bloque navigation, numéros d'urgence

### 6.3 — Surveillance RED-S (sex = F)

10 SIGNAUX (voir détail Section 2.6.5 du Référentiel) :
HARD (3 signaux) :
□ Aménorrhée > 3 mois + contexte déficit/training
□ EA < 30 kcal/kgLM (athlete_mode)
□ BF < 17%

SECONDAIRES (7 signaux) :
□ Charge training > 6h/sem ou > 5 séances intenses
□ Perte > 1%/sem sur ≥ 4 semaines
□ Performance training en baisse ≥ 3 semaines
□ Sommeil dégradé > 2 semaines
□ FC repos < 50 bpm (non-athlète endurance)
□ Mood < 2/5 > 2 semaines
□ Faim absente + apports < plancher × 1.2

DÉCLENCHEMENT :
1 signal, 0 hard → niveau 1
2 signaux, 0 hard → niveau 2
≥ 3 signaux ET ≥ 1 hard → niveau 4 SAFETY ABSOLU
≥ 3 signaux, 0 hard → niveau 3

SORTIE RED-S ALERT :
red_s_signals_count = 0 pendant ≥ 21j + retour règles ≥ 3 cycles (si aménorrhée) + double validation 48h d'écart minimum

ATHLÈTE ENDURANCE : FC repos < 50 bpm = NORMAL → signal 8 désactivé

### 6.4 — Surveillance cardiovasculaire

Douleur thoracique → niveau 5 URGENCE
Contacts : BE : 100 | FR : 15
Suspension immédiate training
requires_medical_clearance = true réactivé

Essoufflement disproportionné → niveau 4
Palpitations inhabituelles → niveau 3
Oedèmes membres inférieurs → niveau 3

Surveillance continue :
resting_hr > 100 bpm sur 3j → niveau 2
resting_hr < 40 bpm sur 3j → niveau 3
Alcool > 14g/j sur ≥ 3j/sem × 2 semaines → niveau 2
sodium > 2g/j sur ≥ 5j/sem → niveau 1

### 6.5 — Surveillance planchers caloriques

Escalade progressive (section 3B.5 ci-dessus)

GLP-1 : niveau 2 immédiat si < plancher (pas d'escalade)
Post-bariat. précoce < 800 kcal/j > 5j → niveau 4 urgent

### 6.6 — Surveillance overreaching niveaux 3-4

Niveau 3 persistant > 14j malgré déload :
→ Escalade niveau 4
→ requires_medical_clearance pour reprendre training intensif

Niveau 4 (surentraînement) :
Repos complet recommandé 2 semaines
Consultation sportive obligatoire pour reprendre

### 6.7 — Surveillance TCA

4 patterns détectés PASSIVEMENT (jamais communiqués tels quels) :
RESTRICTION_EXTREME : apports < plancher × 0.80 sur > 3j
COMPULSIVE_EXERCISE : sessions ≥ 7/sem + énergie basse + restriction
BINGE_RESTRICT : variation max-min > 2000 kcal sur 7j + cycles
COMPULSIVE_WEIGHING : > 3 pesées/j sur > 3j/sem

RÉPONSE SELON STATUT :
TCA actif : log interne, message soutien neutre seulement
TCA rémission : message doux, pas de mention du pattern
Sans déclaration : tone → 'gentle' temporairement

RESSOURCES LOCALISÉES :
BE : ALBA 0800 20 120
FR : Anorexie Boulimie Info Écoute 0 810 037 037
Hors BE/FR : IASP https://www.iasp.info/resources/Crisis_Centres/

### 6.8 — Surveillance GLP-1

Perte > 1.5%/sem × 3 sem + performance ↓ :
→ flag_glp1_lean_mass_risk = true → niveau 3
Vomissements > 5 jours → niveau 3 + consultation prescripteur
Apports < planchers > 3j → niveau 3

### 6.9 — Surveillance post-bariatrique

Apports < 800 kcal/j > 5j → niveau 4 urgent
Vomissements > 3j → alerte chirurgien
nadir_delta > 10% → niveau 2
nadir_delta > 20% → niveau 3
Rappel bilan biologique si > 60 jours (mensuel)

### 6.10 — Surveillance cortisol chronique

≥ 3 signaux → cortisol_chronic_alert_active = true → niveau 2
Persistant > 3 semaines → niveau 3 + proposition Diet Break/Recovery
Persistant > 6 semaines → recommandation consultation médicale

### 6.11 — Surveillance bien-être critique

wellbeing_score_7j < 1.5 → niveau 3 + suspension ajustements
mood_score < 1.5 > 10j → niveau 3 + ressources santé mentale :
BE : Centre Prévention Suicide 0800 32 123
FR : 3114
Hors BE/FR : IASP
mood_score = 1 > 5j → niveau 4 + ressources affichées immédiatement

NOTE : le moteur ne fait pas de dépistage psychiatrique.
Il détecte la dégradation et oriente vers des professionnels.
Pas d'analyse de sentiment sur le texte libre (notes) en V1.

### 6.12 — Safety absolues

ABSOLUES (aucun bypass) :
□ Mineur < 18 ans → blocage total + suppression données (RGPD 24h)
□ Grossesse déclarée → suspension Fat Loss + tracking composition
□ Douleur thoracique → suspension training + urgence médicale
□ TCA actif + tracking calorique → désactivation permanente
□ RED-S confirmé → Recovery automatique
□ Post-bariat. < 3 mois → blocage Fat Loss
□ Cardio sans clearance → blocage training intensif

ABSOLUES avec double validation pour sortir :
□ Recovery forcée RED-S
□ Surentraînement niveau 4 (clearance médicale)
□ TCA actif → rémission déclarée + 2 validations

FORTES (bypass double validation consciente) :
□ Plancher calorique niveau 4
□ Plancher protéique niveau 3
□ Overreaching niveau 3 (refus déload)
□ RED-S niveau 3 non confirmé

### 6.13 — Grossesse et post-partum

Grossesse → Safety absolu : suspension Fat Loss + tracking
Post-partum < 6 mois → Fat Loss refusé
Allaitement → Fat Loss refusé, cibles spéciales (Section 2.6.8)

### 6.14 — Mineurs

Âge < 18 détecté pendant onboarding → blocage immédiat,
suppression toutes données onboarding partiel
Âge < 18 détecté post-onboarding → blocage immédiat +
suppression RGPD dans les 24h + email confirmation

---

## FLUX 7 — BILAN MENSUEL

### 7.1 — Déclencheur

30 jours depuis le dernier bilan (ou onboarding)
SI fin mésocycle ±7 jours → fusion bilan mensuel + bilan mésocycle
Préconditions : ≥ 14 DAILY_CHECKIN sur 30j

### 7.2 — Collecte et évaluation

Tendance pondérale lissée sur 30j
Delta lean_mass_kg et bf (si bf_confidence ≥ 0.60)
Analyses p-ratio et partitionnement (si bf fiable)
Patterns nutritionnels persistants
Bilan mésocycle si terminé
Tendances long terme (adaptation, FFMI, bien-être)

SI bf_confidence < 0.60 :
Analyse p-ratio désactivée (correction V1.0.1)
Redistribution pondération PHASE_QUALITY_SCORE :
Nutritionnel 37.5% | Pondéral 31.25% | Training 18.75% | Bien-être 12.5%

### 7.3 — Recalibration TDEE

Sur 30j de données avec confidence_moyenne ≥ 0.70 :
déficit_réel = (delta_poids × 7700) / 30
tdee_recalibrée = moyenne_kcal_30j - déficit_réel

    SI |tdee_recalibrée - tdee_effective| > 150 kcal :
      → Recalibration proposée (message + validation)

    SI confidence < 0.65 → recalibration bloquée
    SI sick_days > 7 → recalibration reportée

### 7.4 — PHASE_QUALITY_SCORE (interne uniquement)

5 dimensions pondérées :
Adhérence nutritionnelle : 30%
Progression pondérale : 25%
Composition corporelle : 20% (si bf fiable)
Adhérence training : 15%
Bien-être : 10%

≥ 0.75 → Continuer
[0.55, 0.75[ → Ajustements mineurs
[0.35, 0.55[ → Révision significative
< 0.35 → Reconsidérer stratégie

### 7.5 — Bilan mésocycle (si terminé)

Performance : hausse/stable/baisse
Volume : progression, MRV fréquent, sous-MEV fréquent
Récupération : overreaching épisodes, efficacité déload

Recalibration MEV/MAV/MRV pour le prochain cycle :
MRV dépassé fréquemment → mrv_ceiling × 0.90
Sous-MEV fréquent → mev_baseline × 1.15
Performance hausse → volume +1-2 sets/groupe
Performance baisse → volume -10-20%

### 7.6 — Décisions stratégiques

Règle : 1 seul ajustement majeur par bilan mensuel

Continuer : PHASE_QUALITY_SCORE ≥ 0.75 + progression dans cible + durée restante dans les limites + bien-être ≥ 3.0

Ajuster : PHASE_QUALITY_SCORE [0.55, 0.75[ OU progression hors cible
OU adaptation détectée

Reconsidérer : PHASE_QUALITY_SCORE < 0.55 OU plateau long terme ≥ 3 sem
OU adaptation persistante > 2 mois
OU bien-être < 2.5/5 sur 30j
→ Proposition transition via Flux 5

### 7.7 — Rapport mensuel (7 sections)

1. Résumé exécutif (3-5 observations clés)
2. Progression (tendance lissée, composition estimée)
3. Nutrition du mois (adhérence, patterns, confidence, hydratation)
4. Training et performance (bilan mésocycle, volume)
5. Bien-être (scores, tendances, alertes du mois)
6. Analyse et insights (phénomènes, recalibration TDEE)
7. Plan du mois suivant (décision stratégique + nouveaux paramètres)

### 7.8 — Archivage

INSERT MONTHLY_SUMMARY avec toutes les métriques du mois
Historique utilisé pour : graphiques long terme,
insights personnalisés (V1.1 ≥ 3 mois),
recalibration projections futures,
traçabilité version Référentiel

---

# PARTIE C — CARTE DES OUTPUTS

---

## C.1 — SMART AGENDA

### C.1.1 — Architecture

3 niveaux de vue : Jour (défaut) / Semaine / Mois

3 zones permanentes :
CIBLES DU JOUR (haut) : kcal, protéines, hydratation
PHASE COURANTE : nom phase, semaine N/durée, prochaine étape
ALERTES ACTIVES (si niveau ≥ 3) : bandeau non masquable niveau 4-5

### C.1.2 — 16 types d'événements (5 catégories)

CATÉGORIE 1 — ACTIONS UTILISATEUR :
CHECKIN*MATIN : quotidien, priorité haute
PESÉE : selon weigh_frequency_pref, priorité haute
REPAS*À_LOGGER : créneaux vides, priorité moyenne
SÉANCE_PROGRAMMÉE : selon mésocycle, priorité haute
COMPLÉMENT_RAPPEL : selon recurrence_pattern, priorité basse
→ 1 tap = crée SUPPLEMENT_ENTRY (ou is_skipped=true si skip)
→ Permet calcul compliance_supplements dans Flux 7

CATÉGORIE 2 — PROTOCOLES ACTIFS :
REFEED_ACTIF : bannière distincte, jours concernés
DIET_BREAK_ACTIF : couleur distincte, toute la période
DELOAD_ACTIF : badge sur séances
CARB_LOADING : spécifique compétition, J-3 à J-1

CATÉGORIE 3 — BILANS ET REVUES :
BILAN_HEBDOMADAIRE : chaque semaine
BILAN_MENSUEL : mensuel
BILAN_MÉSOCYCLE : fin de mésocycle

CATÉGORIE 4 — ÉVÉNEMENTS SYSTÈME :
TRANSITION_PHASE : marqueur visuel fort
AJUSTEMENT_CIBLES : tap pour voir les détails
FIN_MEMORY_EFFECT : informatif positif
DÉLOAD_PROGRAMMÉ : préavis J-7
COMPÉTITION : marqueur fort
RAPPEL_MÉDICAL : vers section Ressources

CATÉGORIE 5 — ALERTES :
ALERTE_NIVEAU_1 : discrète, intégrée
ALERTE_NIVEAU_2 : bloc distinct
ALERTE_NIVEAU_3 : bandeau + action requise
ALERTE_NIVEAU_4 : bandeau persistant non masquable
ALERTE_NIVEAU_5 : écran complet prioritaire, bloque navigation

### C.1.3 — Règles

PLAFOND : 8 événements visibles/jour (priorité si surcharge)
COHÉRENCE TEMPORELLE : pas d'événements "optimistes" non confirmés
RYTHME UTILISATEUR : adaptation selon comportement réel observé
MODE TCA-SAFE : suppression repas à logger + cibles du jour
SECTION RESSOURCES (tap RAPPEL_MÉDICAL) :
Ressources médicales localisées BE+FR par condition
Ressources santé mentale (BE/FR/international)
Ressources TCA
Bilans biologiques recommandés selon profil
Annuaires professionnels

---

## C.2 — MESSAGES ET ALERTES

### C.2.1 — 7 familles de messages

FAMILLE 1 — Contextuels quotidiens (max 2/j, cooldown 8h)
FAMILLE 2 — Suivi nutritionnel (max 1/repas manqué, cooldown 24h)
FAMILLE 3 — Coaching training (max 1 post-séance + 1 contextuel)
FAMILLE 4 — Bilans (hebdo + mensuel)
FAMILLE 5 — Interventions (transitions, protocoles) (cooldown 48h)
FAMILLE 6 — Alertes Safety (templates section 6.16.2)
FAMILLE 7 — Éducatifs "une seule fois" (logués dans MESSAGE_HISTORY)

### C.2.2 — Règles générales

MAXIMUM QUOTIDIEN : 4 messages push (hors urgences et bilans)

PRIORITÉ SI SATURATION : 1. Urgences | 2. Niveau 4 | 3. Niveau 3 | 4. Interventions 5. Famille 1 | 6. Famille 2 | 7. Famille 3 | 8. Famille 7

COHÉRENCE SÉQUENTIELLE :
"Même type" = même combinaison (famille + contexte_principal)
Ex: Famille 1 + "poids" ne peut pas s'inverser en 48h
Événement intermédiaire requis (delta > 1.5 pts sur un score)

FAMILLE 7 — VÉRIFICATION MESSAGE_HISTORY :
Avant envoi → vérifier UNIQUE(user_id, message_type)
Si déjà livré → ne pas envoyer

### C.2.3 — Messages cycliques (femme)

Première fois (Famille 7) : explication pédagogique complète
Cycles suivants (Famille 1) : rappel contextuel court
Fréquence : 1 fois par phase cyclique (pas tous les jours)

### C.2.4 — Reformulations TCA-safe

RÈGLE ABSOLUE :
Aucun chiffre de poids, calories, BF dans aucun message
Aucune comparaison à une norme
Aucune mention de restriction
Aucun jugement de valeur sur les apports

TABLE DE REFORMULATION :
"Tu as perdu X kg" → "Ta tendance est en baisse"
"Tes calories à X%" → "Tu es dans ton plan de la journée"
"Déficit de X kcal" → "Bonne journée"
"Tu as dépassé ta cible" → "Journée différente du plan — c'est OK"
Tout "insuffisant" → reformulé en positif

### C.2.5 — Ton conditionnel

tone_preference = 'standard' → neutre, équilibré
tone_preference = 'technical' → précis, moins narratif
tone_preference = 'gentle' → doux, encouragement renforcé

Modulations automatiques :
tca_safe_mode → jamais de chiffres, reformulation systématique
senior_mode → valoriser la régularité
athlete_mode → registre technique admis
wellbeing_score bas → tous messages en 'gentle' temporairement

---

## C.3 — RECALIBRATIONS

### C.3.1 — Définitions

AJUSTEMENT : modification intentionnelle de la stratégie
Ex: creuser le déficit de 100 kcal

RECALIBRATION : correction du modèle de référence
Ex: TDEE réelle = 2100 kcal au lieu de 2350

TRANSITION : changement de phase

### C.3.2 — Séquence obligatoire

1. TDEE effective (base de tout le reste)
2. BF et lean_mass (impact sur protéines)
3. Cibles protéiques (sur lean_mass recalculée)
4. Cibles lipidiques (plancher maintenu)
5. Cibles glucidiques (solde calorique restant)
6. Cibles hydratation (sur poids recalculé)
7. MEV/MAV/MRV (sur profil recalibré)
8. Modulations spécifiques (cycle, conditions médicales)

### C.3.3 — Déclencheurs par type

TDEE :
Flux 7 : 30j données confidence ≥ 0.70 ET écart > 150 kcal
Flux 4 : adaptation métabolique confirmée
Flux 4 : coherence_status = major sur 14j
Flux 5 : fin Diet Break (restauration partielle)
Bloqué si : confidence < 0.65 OU sick_days ≥ 7 OU < 14j données

PROTÉINES :
Flux 7 : variation poids > 3 kg/mois
Flux 5 : transition de phase
Activation senior_mode, condition médicale

GLUCIDES/LIPIDES :
Recalibration TDEE, migration niveau cycle,
SI estimée change, activation SOPK/diabète

HYDRATATION :
Transition phase, variation poids > 3 kg,
activation senior/GLP-1/post-bariat., changement activity_level

BF/FFMI :
À chaque BODY_MEASUREMENT avec mesures suffisantes

MEV/MAV/MRV :
Fin mésocycle, nouveau mésocycle, overreaching persistant,
activation senior/post-blessure, fin memory effect

### C.3.4 — Restauration adaptation post-Diet Break

Après Diet Break 7j : 50-60% récupéré en 1 semaine
Après Diet Break 14j : 60-70% récupéré en 2 semaines
Après Diet Break 21j+: 80-90% récupéré en 3 semaines
Après Reverse Diet complet : restauration sur toute la durée

### C.3.5 — Gardes-fous absolus

1. TDEE recalibrée ≥ BMR × 1.1 (jamais en dessous)
2. Protéines ≥ planchers absolus par profil (section A.2.2)
3. Calories ≥ planchers absolus (H:1500 / F:1200)
4. Déficit ≤ maximums par profil (section 1.3.5 Référentiel)
5. Recalibration bloquée si confidence < 0.65
6. Délai minimum entre 2 recalibrations du même type : 14 jours
   "Même type" = même tableau (TDEE, protéines, glucides, etc.)
   Exception : transition de phase (cooldown levé)

### C.3.6 — Propagation

IMMÉDIATE :
MOTOR_STATE.tdee_effective_kcal
PHASE.caloric_target_kcal
PHASE.protein_target_g
Smart Agenda CIBLES DU JOUR

DIFFÉRÉE (prochain cycle de chaque flux) :
Flux 4 et 7 : nouvelles cibles
Flux 3B : cross-check immédiat
Flux 3C : nouveaux volumes à prochaine séance

COMMUNICATION :
Recalibration < 5% TDEE : Famille 1 (discret)
Recalibration ≥ 5% TDEE : Famille 7 si première fois,
Famille 5C si post-Diet Break,
Famille 4 si dans un bilan

---

## ANNEXE — RÈGLES DE CONFORMITÉ RGPD

Données en Europe : Supabase EU West (Frankfurt)
Chiffrement : TLS 1.3 transit, AES-256 repos, MMKV appareil

Suppression utilisateur :
Endpoint dédié, cascade complète sur 20 entités
Délai 30 jours avant suppression définitive
Mineur < 18 ans : suppression immédiate 24h

Consentement :
Données de santé = catégorie spéciale RGPD Art. 9
Consentement explicite à l'onboarding
Granularité : HealthKit / analytics / notifications

Portabilité :
Export JSON toutes données utilisateur (SQL select)

Mention légale obligatoire :
"Les recommandations de cette app sont à titre informatif
et ne constituent pas un avis médical. Elles ne remplacent
pas la consultation d'un médecin, d'un diététicien ou
d'un professionnel de santé."

---

## CHANGELOG

V1.0.0 — Mai 2026 (initial)
Création complète : Parties A, B, C
20 entités, 8 flux, 3 parties outputs

V1.0.1 — Mai 2026 (révision globale)
A.1 : clearance_confirmed + is_bariatric + injury_current
A.3 : period_ended dans daily_checkins
A.3 : cycle_phase_at_measure nullable
A.6 : sugar/sodium/alcohol/kcal_alcohol dans food_items
A.7 : note V2 household_id documentée
A.8 : started_at/ended_at dans training_sessions
A.14 : fiber_target_g + max_phase_duration_weeks dans phases
A.15 : daily_carbs_target_modulated, wellbeing_score_30j
A.20 : message_history définition complète
B.2.1 : plafond questions rotatives clarif (4 fixes hors plafond)
B.2.2 : j1_date futur → cycle_phase = 'unknown'
B.2.3 : séparation Flux 2C / Flux 3C Workouts
B.3A.1 : modification repas existant → workflow précisé
B.3A.2 : Photo IA V1 confidence max 0.55
B.3A.3 : recharge favori → toujours nouveau MEAL
B.3B.3 : cibles modulées athlète dans MOTOR_STATE (pas PHASE)
B.3C.1 : volume_sets optionnel → dégradation gracieuse
B.3C.2 : horizon programmation J+1 à J+7
B.4.1 : pondération adhérence selon confidence_jour
B.4.2 : Diet Break en Lean Bulk → Maintenance à la place
B.4.3 : whoosh coefficient corrigé (interprétation, pas coefficient)
B.4.4 : signaux adaptation liste complète (10 signaux)
B.4.5 : branche sous-déclaration dans l'arbre de décision
B.4.6 : GLP-1 seuil TropRapide → 1.5%/sem
B.4.7 : nadir post-bariatrique dans l'évaluation pondérale
B.5.1 : cooldown non activé par fin Refeed/Diet Break
B.5.2 : mécanisme voyage ajouté (événement Smart Agenda)
B.5.3 : durées maximales Reverse Diet
B.6.2 : ressources santé mentale hors BE/FR (IASP)
B.6.3 : mineurs post-onboarding → suppression RGPD
B.6.4 : notes libres → pas d'analyse V1
B.7.1 : p-ratio désactivé si bf confidence < 0.60
B.7.2 : redistribution pondération PHASE_QUALITY_SCORE
C.1.1 : is_skipped dans SUPPLEMENT_ENTRY
C.1.2 : contenu section Ressources défini
C.2.1 : "même type" message défini précisément
C.3.1 : restauration adaptation post-Diet Break ajustée
C.3.2 : "même type" recalibration défini précisément

---

## RÉFÉRENCES CROISÉES

REFERENTIEL.md → valeurs physiologiques, seuils, protocoles
ARCHITECTURE.md → stack, schéma SQL, Edge Functions
SESSION_LOG.md → journal de développement

Toutes les valeurs numériques de ce document
sont sourçables dans REFERENTIEL.md.
