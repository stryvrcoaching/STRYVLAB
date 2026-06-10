Nutrition Studio — Système Algorithmique Complet

1. Données d'entrée
   Le Studio charge tout depuis /api/clients/[clientId]/nutrition-data, alimenté par les bilans client (système de soumissions sélectionnable) :

Biométrie (bilan)

Donnée Usage Source priorité
Poids (kg) BMR, macros, NEAT, hydratation Bilan
Taille (cm) BMR fallback Bilan
Âge BMR Bilan
Sexe BMR, macros, hydratation Profil
% Masse grasse LBM → macros protéines Bilan
Masse musculaire kg LBM prioritaire (DEXA/InBody) Bilan
BMR mesuré (kcal) Court-circuite toutes les formules Balance impédance
Graisse viscérale (niveau) Moduler déficit, alertes Bilan
Entraînement

Fréquence hebdo, durée session, type(s) d'entraînement → EAT musculation
Fréquence cardio, durée cardio, types → EAT cardio séparé
Calories tracker hebdo → override si delta > 20% vs table
Pas quotidiens → NEAT
Lifestyle

Occupation multiplier (1.0–1.18) → NEAT
Heures de travail/semaine → correction NEAT si > 45h
Stress (1–10), sommeil (h + qualité) → modulation déficit + suggestions
Caféine (mg/j) → correction thermogénique BMR +3–5%
Alcool (verres/semaine) → ajout TDEE + suggestions
Objectif client — mappé depuis training_goal :

fat_loss / sèche / cut → deficit
muscle_gain / bulk → surplus
maintenance / recomp → maintenance 2. Pipeline de calcul (dans cet ordre)
Étape 1 — Masse Maigre (LBM)
Priorité décroissante :

Masse musculaire mesurée (DEXA/InBody) si dans 28–68% du poids
BF% mesuré → LBM = poids × (1 - BF/100)
Formule Boer 1984 (fallback) :
Homme : 0.407 × poids + 0.267 × taille - 19.2
Femme : 0.252 × poids + 0.473 × taille - 48.3
Étape 2 — BMR
Priorité décroissante :

BMR mesuré (balance impédance) — priorité absolue
Katch-McArdle (si LBM connu) : 370 + 21.6 × LBM avec décrement âge −2%/décennie après 30 ans
Mifflin-St Jeor (fallback pur) : 10×P + 6.25×T − 5×A ± 5/161
Correction caféine appliquée post-BMR : +3% si > 200 mg/j, +5% si > 400 mg/j.

Étape 3 — NEAT (activité non-structurée)

NEAT = (pas × 0.0005 × poids) × occupation_multiplier
Correction : −5% si > 45h/semaine de travail sédentaire ET pas = 0.

Étape 4 — EAT (activité structurée)
Musculation — 3 sources par ordre de priorité :

Tracker hebdo si delta > 20% vs table → tracker_kcal / 7
Durée × MET moyen des types d'entraînement (Ainsworth 2011) × fréquence / 7
Table standard par fréquence : 0→0, 1→200, 2→260, 3→330, 4→410, 5→490 kcal/j
Cardio — calcul séparé via MET cardio (Course : 9.0, HIIT : 10.0, Vélo : 7.5…)

Étape 5 — TEF + Alcool + Phase lutéale

TEF = BMR × 10%
Alcool = verres × 14g × 7 kcal/g / 7 jours
Phase lutéale = +175 kcal (femme uniquement)
Étape 6 — TDEE final

TDEE = BMR + NEAT + EAT_muscu + EAT_cardio + TEF
TDEE_final = TDEE + alcool + phase_lutéale
Étape 7 — Ajustement selon objectif
Déficit — stratifié par BF% (Helms 2014) :

BF% Facteur déficit

> 30% 30%
> 25% 25%
> 20% 20%
> 15% 15%
> ≤ 15% 12%
> Modulations : −3% si ≥ 5 séances/semaine, +5% si viscéral ≥ 13 (plafonné 30%).

Surplus — fixe par BF% :

BF% Surplus (kcal)
< 10% +250
< 13% +200
< 16% +165
< 20% +130
≥ 20% +100
Étape 8 — Macros

Protéines = LBM × ratio
→ Déficit BF>20% : 2.5 g/kg LBM
→ Déficit BF≤20% : 2.8 g/kg LBM
→ Surplus : 2.2 g/kg LBM
→ Maintenance : 2.0 g/kg LBM

Lipides = max(poids × 0.7/0.9, calories × 25%/22% ÷ 9)
(0.9 g/kg femme, 0.7 g/kg homme minimum)

Glucides = (calories − P×4 − F×9) ÷ 4 [résiduel] 3. Couches additionnelles (opt-in coach)
Carb Cycling
[lib/formulas/carbCycling.ts] — protéines et lipides fixes, seuls les glucides flexent :

Jour entraînement (High) : glucides × carbHighMultiplier (ex: ×1.4)
Jour repos (Low) : glucides × carbLowMultiplier (ex: ×0.5)
Calories recalculées : P×4 + F×9 + G_ajusté×4
Cycle Sync (femme uniquement, si cycle_sync_enabled = true)
Ajustements additifs par phase sur les macros de base :

Phase Kcal P (g) G (g) L (g) Eau (ml)
Folliculaire 0 0 0 0 0
Ovulatoire 0 0 0 0 0
Lutéale +100 +10 +20 0 +250
Menstruelle 0 +5 0 +5 +250
La phase est déterminée par getCycleStateFromLogs() depuis menstrual_cycle_logs (engine history-based avec moyenne personnelle, clamp 21–35j, fallback 28j).

Hydratation

Base = f(poids, sexe, niveau activité, climat)
Hydration_finale = base × (hydrationPhase / 100)
hydrationPhase est un slider 0–200 coach.

TDEE Adaptatif (MacroFactor method)
Si ≥ 2 pesées dans la fenêtre :

slope = régression linéaire sur séries de poids
TDEE_adaptatif = avg_intake_kcal - slope × 7700
Confidence "high" si ≥ 4 pesées + logs réels. Le coach peut appliquer ce TDEE adaptatif pour corriger la formule.

Weekly Analysis Engine (coach-facing)
Décision hebdo automatique à partir des check-ins :

Guardrail adhérence : < 85% → bloquer tout ajustement
Guardrail fatigue : signal fatigue ≥ 3j consécutifs → récupération prioritaire
optimal_recomp : tour de taille ↓ + poids stable → no change
deficit_aggressive : poids −0.8 kg/sem + énergie basse → +5–10% glucides
surplus_real : tour de taille ↑ + poids +0.3 kg → −5% glucides 4. Outputs UI — ce que le coach voit dans le Studio
CalculationEngine — panneau latéral droit :

TDEE waterfall visuel : BMR → NEAT → EAT → TEF → ajustement objectif
Macros P/G/L en grammes + % des calories + ratios g/kg LBM
Coherence Score (0–100%) : 5 checks (protéines ≥ 1.8 g/kg LBM, lipides ≥ 0.6 g/kg, calories ≥ plancher, glucides ≤ 8 g/kg, hydratation non nulle)
Data Provenance flags : source de chaque composant (mesuré vs estimé)
Context Flags : alertes viscérale, alcool, caféine, phase lutéale
Smart Protocol Suggestions : priorité critical/high/medium/low, catégories (calories, protéines, lipides, glucides, récupération, stratégie), avec références scientifiques
Recovery Adaptation : suggestion de réduction déficit si stress ≥ 7 ou sommeil ≤ 6h
Carb Cycling section : grille High/Low avec valeurs injectables
Cycle Sync section (femme) : grille 4 phases, deltas, badge "Actuelle", CycleSyncPhaseGrid
TDEE adaptatif : valeur, date, source (weight_delta vs formula_proxy), bouton "Appliquer"
Missing Data Alerts : champs critiques manquants (BMR, poids, BF%, taille)
ProtocolCanvas — zone centrale :

Onglets par jour (Jour entraînement, Jour repos, etc.)
Champs éditables : calories, P, G, L, hydratation, carb_cycle_type, recommandations
Boutons Inject : un clic → valeurs calculées poussées dans le jour actif
CycleArcIndicator dans la TopBar (si active cycle)
Après sauvegarde → côté client :

app/client/nutrition/page.tsx lit le protocole actif
Si cycle_sync_enabled, applique getCycleSyncAdjustment(phase) en runtime sur les macros cibles APRÈS getCycleStateFromLogs()
SmartNutritionHero affiche les macros du jour courant (carb cycling ou base)
ProtocolRationale : accordéons par jour avec la chaîne TDEE → cible → P → G/L → ajustement cycle si activé
Résumé du flux complet

Bilan client
↓
nutrition-data API (biométrie + entraînement + lifestyle)
↓
calculateMacros() [lib/formulas/macros.ts]
→ LBM → BMR → NEAT → EAT → TEF → TDEE → objectif → macros
↓
Couches optionnelles :

- Carb Cycling [lib/formulas/carbCycling.ts]
- Cycle Sync [lib/nutrition/engine/cycleSync.ts]
- TDEE adaptatif [lib/nutrition/adaptiveTdee.ts]
- Hydratation [lib/formulas/hydration.ts]
  ↓
  Coach ajuste / valide / injecte dans les jours du protocole
  ↓
  Sauvegarde en DB (nutrition_protocols + nutrition_protocol_days)
  ↓
  Client app : runtime adjustment cycle sync + affichage ProtocolRationale
  ↓
  Weekly Engine : check-ins → analyzeWeek() → suggestion d'ajustement glucides
