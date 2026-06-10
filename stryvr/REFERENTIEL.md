# RÉFÉRENTIEL SCIENTIFIQUE — STRYVR

## Version 1.0.0 — Mai 2026

## Moteur de coaching physiologique

---

## POSTURE GÉNÉRALE DU RÉFÉRENTIEL

Ce document est la source de vérité scientifique du moteur STRYVR.
Il définit les seuils, protocoles et phénomènes physiologiques
sur lesquels toutes les recommandations sont basées.

Le moteur ne diagnostique pas. Il ne prescrit pas.
Il adapte ses recommandations nutritionnelles et training
à la physiologie réelle de l'utilisateur, et oriente
vers un professionnel de santé chaque fois que nécessaire.

Marché principal : Belgique
Marché secondaire : France
Langue : Français

---

# MODULE 1 — SEUILS PHYSIOLOGIQUES DE RÉFÉRENCE

---

## SECTION 1.1 — BODY FAT (BF)

### 1.1.1 — Méthodes d'estimation

MÉTHODE NAVY (prioritaire si mesures disponibles) :
Homme : BF = 495 / (1.0324 - 0.19077×LOG(taille-cou) + 0.15456×LOG(hauteur)) - 450
Femme : BF = 495 / (1.29579 - 0.35004×LOG(taille+hanche-cou) + 0.22100×LOG(hauteur)) - 450
Données requises H : tour de taille + tour de cou + taille
Données requises F : tour de taille + tour de cou + tour de hanche + taille
Confidence : 0.75

MÉTHODE BMI (fallback si mesures insuffisantes) :
Estimation conservative selon BMI + sexe + âge
Confidence : 0.45

FFMI (Fat-Free Mass Index) :
FFMI = masse_maigre_kg / taille_m²
FFMI normalisé = FFMI + (6.1 × (1.8 - taille_m))

### 1.1.2 — Zones BF de référence

HOMME :
Essentiel : 3-5%
Athlétique : 6-13%
Fitness : 14-17%
Acceptable : 18-24%
Obésité : ≥ 25%

Zone optimale coaching : 8-18%
Seuil Fat Loss recommandé : > 18%
Seuil Lean Bulk recommandé : < 15%
Seuil Hard Bulk contre-indiqué : > 20%
Seuil BF très bas (vigilance RED-S) : < 5%

FEMME :
Essentiel : 10-13%
Athlétique : 14-20%
Fitness : 21-24%
Acceptable : 25-31%
Obésité : ≥ 32%

Zone optimale coaching : 16-26%
Seuil Fat Loss recommandé : > 26%
Seuil Lean Bulk recommandé : < 22%
Seuil Hard Bulk contre-indiqué : > 28%
Seuil BF très bas (vigilance RED-S) : < 17%

### 1.1.3 — FFMI plafonds naturels

Population non entraînée H : 18-20
Population non entraînée F : 15-17
Entraîné régulier H : 20-22
Entraîné régulier F : 17-19
Avancé naturel H : 22-24
Avancé naturel F : 19-21
Plafond naturel estimé H : 24-25
Plafond naturel estimé F : 21-22
Probable assistance H : > 25-26
Probable assistance F : > 22-23

Note : le FFMI est un indicateur probabiliste, pas un seuil absolu.
Utilisé uniquement pour calibrer les projections, jamais pour juger.

### 1.1.4 — Structure osseuse (calibration FFMI)

Tour de poignet → structure osseuse :
Homme < 17 cm : structure fine → FFMI max naturel ~23
Homme 17-20 cm : structure moyenne → FFMI max naturel ~24
Homme > 20 cm : structure large → FFMI max naturel ~25
Femme < 14 cm : structure fine
Femme 14-16 cm : structure moyenne
Femme > 16 cm : structure large

### 1.1.5 — Lecture BF et poids par phase cycle

Modulations de lecture selon la phase (femme, Niveau 1-2) :
Lutéale tardive (J22-J28) : coefficient lecture poids 0.60
Menstruelle (J1-J5) : coefficient lecture poids 0.50
Autres phases : coefficient 1.0

### 1.1.6 — Arbre de décision phase selon BF

HOMME :
BF > 20% + objectif Lean Bulk → proposer Fat Loss d'abord
BF 15-20% → Fat Loss ou Recomp selon préférence
BF 10-15% → zone optimale → Lean Bulk recommandé
BF 8-10% → Lean Bulk ou Maintenance
BF < 8% → Maintenance ou Reverse Diet (vigilance)

FEMME :
BF > 28% + objectif Lean Bulk → proposer Fat Loss d'abord
BF 22-28% → Fat Loss ou Recomp
BF 18-22% → zone optimale → Lean Bulk recommandé
BF 16-18% → Lean Bulk ou Maintenance
BF < 16% → Maintenance ou Reverse Diet (vigilance RED-S)

Sources :
Gallagher et al. — "Healthy percentage body fat ranges" (Am J Clin Nutr, 2000)
Kouri et al. — "Fat-free mass index" (Clin J Sport Med, 1995)
Williams — "Nutrition for Health, Fitness and Sport" (McGraw-Hill, 2010)

---

## SECTION 1.2 — PROTÉINES

### 1.2.1 — Cibles par phase et profil

STANDARD :
Fat Loss : 2.2-2.6 g/kgLM
Lean Bulk : 1.8-2.2 g/kgLM
Recomp : 2.0-2.4 g/kgLM
Maintenance : 1.6-2.0 g/kgLM
Recovery : 1.8-2.2 g/kgLM

SENIOR (55+) :
Toutes phases : 2.0-2.6 g/kgLM
Dose par prise : 0.4-0.6 g/kgPC (vs 0.3-0.4 standard)
Fréquence : 4-5 prises/jour
Leucine par prise : ≥ 3g (résistance anabolique)

ATHLÈTE :
Endurance : 1.4-1.7 g/kgPC
Endurance en cut : 1.8-2.2 g/kgPC
Force / puissance : 1.8-2.2 g/kgPC
Force en cut : 2.2-2.6 g/kgPC
Mixte (CrossFit, tri.) : 1.8-2.4 g/kgPC
Pic de charge : 2.0-2.6 g/kgPC

GLP-1 :
Toutes phases : 2.2-2.6 g/kgLM (priorité absolue)

POST-BARIATRIQUE :
Précoce (3-6 mois) : 60-80g/j minimum absolu
Intermédiaire (6-24 m) : 80-120g/j
Tardif (2+ ans) : 1.5-2.0 g/kgPC
Si Fat Loss actif : 2.0-2.4 g/kgPC

### 1.2.2 — Planchers protéiques absolus

Standard : protein_target × 0.70
GLP-1 : protein_target × 0.85
Post-bariat. précoce : 60g/j absolu
Post-bariat. intermédiaire: 80g/j absolu
Senior 65+ : protein_target × 0.80
Athlète en cut : 1.8 g/kgPC minimum

### 1.2.3 — Distribution optimale

Dose par prise optimale adulte jeune : 0.3-0.4 g/kgPC
Dose par prise optimale senior : 0.4-0.6 g/kgPC
Nombre de prises recommandé : 3-5/jour
Maximum utilisable par prise : pas de plafond démontré
mais au-delà de 0.6g/kgPC, bénéfice marginal décroissant

### 1.2.4 — Leucine et seuil anabolique

Seuil leucine par prise pour déclencher MPS :
Adulte jeune : ~2-3g leucine
Senior : ~3-4g leucine

Sources riches en leucine :
Whey, poulet, bœuf, thon, œufs, cottage cheese

Sources :
Morton et al. — "Systematic review protein supplementation" (Br J Sports Med, 2018)
Stokes et al. — "Role of dietary protein for muscle hypertrophy" (Nutrients, 2018)
Moore et al. — "Protein ingestion older vs younger men" (J Gerontol, 2015)
ISSN Position Stand: Protein and Exercise (J Int Soc Sports Nutr, 2017)

---

## SECTION 1.3 — CALORIES ET TDEE

### 1.3.1 — Formules de calcul BMR

MIFFLIN-ST JEOR (formule principale) :
Homme : BMR = (10 × poids_kg) + (6.25 × taille_cm) - (5 × âge) + 5
Femme : BMR = (10 × poids_kg) + (6.25 × taille_cm) - (5 × âge) - 161

KATCH-MCARDLE (si BF estimé fiable, confidence ≥ 0.65) :
BMR = 370 + (21.6 × masse_maigre_kg)

### 1.3.2 — Facteurs d'activité

0 Sédentaire : × 1.200
1 Légèrement actif : × 1.375
2 Modérément actif : × 1.550
3 Très actif : × 1.725
4 Extrêmement actif : × 1.900

TDEE_théorique = BMR × facteur_activité

### 1.3.3 — Modulations TDEE selon profil

senior_mode = true : TDEE × 0.95
hypothyroïdie déclarée : TDEE × 0.85 à 0.90
athlete_mode = true : recalcul dynamique hebdomadaire
(BMR × 1.2 + EAT estimée + NEAT)

### 1.3.4 — Dépense athlétique par type d'activité (MET)

Résistance RPE ≤ 5 : MET 3.5 → ~300-400 kcal/h
Résistance RPE 6-7 : MET 5.0 → ~400-550 kcal/h
Résistance RPE 8-9 : MET 6.0 → ~500-650 kcal/h
Cardio léger : MET 5.0
Cardio modéré : MET 7.0
Cardio intensif : MET 10.0
HIIT : MET 8.5
Mobilité / Yoga : MET 2.5
Sport collectif : MET 6.5
Mixte : MET 6.0

EAT_kcal = BMR/24 × durée_h × MET × (poids_kg/70)

### 1.3.5 — Déficits et surplus recommandés

FAT LOSS :
Standard : -300 à -500 kcal/j
Vitesse cible : -0.5 à -1.0% PC/semaine
Déficit max absolu : -500 kcal/j
Senior : -200 à -300 kcal/j max
Cardiovasculaire : -250 kcal/j max
Hypothyroïdie : -200 à -300 kcal/j max
GLP-1 : pas d'ajout de déficit
(médicament crée déjà le déficit)
Post-bariatrique : -200 kcal max

LEAN BULK :
Standard débutant : +200 à +300 kcal/j
Standard intermédiaire : +150 à +200 kcal/j
Standard avancé : +100 à +150 kcal/j
Senior : +100 à +200 kcal/j
SI réduite : +50 à +150 kcal/j
Athlète endurance : +50 à +150 kcal/j
Athlète force : +200 à +400 kcal/j

HARD BULK :
Surplus : +400 à +700 kcal/j
Contre-indiqué : senior, cardiovasculaire, TCA actif,
BF > 20% (H) / > 28% (F), GLP-1

PLANCHERS CALORIQUES ABSOLUS :
Homme : 1500 kcal/j
Femme : 1200 kcal/j
Athlète : max(plancher, BMR × 1.1)
Jamais franchissable sauf protocole médical explicite

### 1.3.6 — Vitesses de perte/gain optimales

FAT LOSS :
Débutant / surpoids : 0.7-1.0% PC/sem
Intermédiaire : 0.5-0.7% PC/sem
Avancé / BF bas : 0.3-0.5% PC/sem
Trop rapide (alerte) : > 1.0% PC/sem
GLP-1 : trop rapide : > 1.5% PC/sem

LEAN BULK :
Débutant : +0.7-1.0 kg/mois max
Intermédiaire : +0.35-0.5 kg/mois max
Avancé : +0.15-0.25 kg/mois max
Senior 55-65 : × 0.6 des valeurs ci-dessus
Senior 65+ : × 0.5

REVERSE DIET :
Cut < 8 semaines : +75 kcal/semaine
Cut 8-16 semaines : +50 kcal/semaine
Cut 16-24 semaines : +25-50 kcal/semaine
Cut > 24 sem (compétition): +25 kcal/semaine

Durées maximales Reverse Diet :
Cut < 8 sem : max 12 semaines
Cut 8-16 sem : max 16 semaines
Cut 16-24 sem : max 24 semaines
Cut > 24 sem : max 40 semaines

Sources :
Mifflin et al. — "New predictive equation for REE" (Am J Clin Nutr, 1990)
Hall et al. — "Quantification of energy imbalance on bodyweight" (Lancet, 2011)
Levine — "Non-exercise activity thermogenesis" (Best Pract Res Clin Endocrinol, 2002)
Trexler et al. — "Metabolic adaptation to weight loss" (J Int Soc Sports Nutr, 2014)

---

## SECTION 1.4 — GLUCIDES ET LIPIDES

### 1.4.1 — Cibles glucides standard

Maintenance / Lean Bulk : 40-50% des kcal totales
Fat Loss modéré : 30-40% des kcals totales
SOPK / Diabète T2 : 35-45% kcal, complexes uniquement
Post-bypass bariatrique : glucides simples très limités

ATHLÈTES (g/kgPC/jour selon volume) :
Volume < 1h/j : 3-5g/kgPC
Volume 1-2h/j : 5-7g/kgPC
Volume 2-3h/j : 6-10g/kgPC
Volume > 3h/j : 8-12g/kgPC

### 1.4.2 — Modulations cycliques glucides (femme)

Lutéale précoce (J17-J21) : +10g/j sur cible
Lutéale tardive (J22-J28) : +15-20% sur cible
Autres phases : cible standard

### 1.4.3 — Cibles lipides

Minimum absolu : 0.6g/kgPC/j (santé hormonale)
Standard : 25-35% des kcal totales
Focus qualité : oméga-3, mono-insaturés prioritaires

### 1.4.4 — Cibles fibres

Femme standard : 25g/j
Homme standard : 30-38g/j
SOPK : +5g/j sur cible standard
Conditions cardio : +5g/j sur cible standard
SI réduite : cible standard + focus
Post-bariatrique : adapter si dumping (bypass)

### 1.4.5 — Timing nutritionnel (athlètes)

Pré-entraînement (2-3h) : repas complet équilibré
Pré-entraînement (30-60min): glucides simples 30-60g
si séance > 90 min
Post-entraînement (0-30min): protéines 0.4-0.5g/kgPC + glucides 0.5-1g/kgPC
Post-entraînement (2-3h) : repas complet
Double séance (inter) : glucides simples 1-1.2g/kgPC
dans les 30 min

### 1.4.6 — Périodisation glucidique athlète

Jour entraînement intensif : glucides hauts (7-10g/kgPC)
Jour entraînement modéré : glucides modérés (5-7g/kgPC)
Jour repos : glucides bas (3-5g/kgPC)

### 1.4.7 — Coefficient d'hydratation par type de boisson

Eau pure : 1.00
Thé, café non sucré : 1.00
Boissons sportives : 1.00
Sodas, jus : 0.50
Alcool : 0.00 (déshydratant)

### 1.4.8 — Cibles hydratation

Standard : 35 ml/kgPC/j
Senior 55+ : 40 ml/kgPC/j
GLP-1 ou post-bariatrique : +15% sur standard
Entraînement : +500 ml/h d'exercice
Plancher absolu : 1500 ml/j

Sources :
Burke et al. — "Carbohydrates for training and competition" (J Sports Sci, 2011)
Kerksick et al. — "ISSN Position Stand: Nutrient Timing" (J Int Soc Sports Nutr, 2017)
Jeukendrup — "Periodized Nutrition for Athletes" (Sports Med, 2017)

---

## SECTION 1.5 — SOMMEIL ET RÉCUPÉRATION

### 1.5.1 — Besoins par profil

Standard adulte : 7-9h/nuit
Athlète : 8-10h/nuit
Senior 65+ : 7-8h/nuit
En déficit calorique : +0.5h conseillé

### 1.5.2 — Seuils dette de sommeil

Dette sur 7 jours :
< 2h : pas de dette significative
2-5h : dette modérée
5-10h : dette significative → alerte > 10h : dette critique → alerte forte

### 1.5.3 — Modulations selon phase cycle (femme)

Lutéale tardive : besoin +0.5h
Menstruelle : besoin +0.5-1h

### 1.5.4 — Indicateurs de récupération (HealthKit)

HRV bas vs baseline : récupération insuffisante
FC repos élevée + 8 bpm : charge excessive
FC repos < 50 bpm : alerte (non-athlète endurance)
Sommeil profond < 1h : récupération altérée

### 1.5.5 — Pic GH et sommeil

GH secrétée principalement pendant N3 (sommeil profond)
Déclin GH : -14% par décennie après 30 ans
Manque sommeil → GH réduit → récupération musculaire altérée

### 1.5.6 — Caféine et sommeil

Demi-vie caféine : ~5h
Caféine après 14h00 : risque qualité sommeil
Seuil préoccupant : > 200 mg après 14h00
Décaler la fenêtre selon chronotype

Sources :
Hirshkowitz et al. — "NSF sleep duration recommendations" (Sleep Health, 2015)
Watson et al. — "AASM/SRS consensus on sleep duration" (Sleep, 2015)
Drake et al. — "Caffeine effects 0, 3, 6h before bed" (J Clin Sleep Med, 2013)
Dattilo et al. — "Sleep and muscle recovery" (Med Hypotheses, 2011)

---

# MODULE 2 — PROTOCOLES VALIDÉS

---

## SECTION 2.1 — REFEED

### 2.1.1 — Définition

Augmentation temporaire et planifiée des glucides (1-2 jours)
visant à restaurer la leptine, le glycogène et la performance,
dans le cadre d'une phase Fat Loss prolongée.

### 2.1.2 — Critères de déclenchement

Durée déficit > 6 semaines
ET adaptation_level ≥ Modérée
ET pas de refeed dans les 7 derniers jours
ET coherence_diagnosis = "metabolic_adaptation"

### 2.1.3 — Paramètres

Durée : 1-2 jours
Calories : TDEE + 20-30%
Glucides : cible normale × 2.0-2.5
Protéines : maintenues
Lipides : réduits

### 2.1.4 — Contre-indications

RED-S alert active
Overreaching niveau ≥ 2
BF > 25% (H) / > 32% (F)

### 2.1.5 — Timing optimal

Idéal : phase folliculaire tardive ou ovulatoire
Sous-optimal mais possible : lutéale tardive
→ si lutéale tardive : signaler timing moins idéal
→ si attente > 14 jours : procéder quand même
Si cut trop long : procéder sans attendre le timing optimal

### 2.1.6 — Effet sur la lecture poids

Prise de 0.5-2.5 kg post-refeed = glycogène + eau (normal)
Ne pas alerter sur cette variation
Interprétation correcte : fenêtre 4-7 jours après le refeed

Sources :
Dirlewanger et al. — "Effects of carbohydrate overfeeding on leptin" (Int J Obes, 2000)
Rosenbaum et al. — "Low-calorie dieting increases cortisol" (Psychosom Med, 2010)

---

## SECTION 2.2 — DIET BREAK

### 2.2.1 — Définition

Pause structurée de 7-14 jours à la TDEE effective,
visant à restaurer le métabolisme, les hormones,
et l'adhérence psychologique après un cut prolongé.

### 2.2.2 — Critères de déclenchement

adaptation_level = Marquée (≥ 4 signaux secondaires)
ET coherence_diagnosis = "metabolic_adaptation"
ET coherence_status = Majeure
ET durée phase courante ≥ 8 semaines
ET pas de diet break dans les 6 dernières semaines

### 2.2.3 — Paramètres

Durée selon adaptation_level :
Légère : 7 jours
Modérée : 10 jours
Marquée : 14 jours
Calories : TDEE effective (exactement)
Macros : maintenance équilibrée
Training : maintenu ou -10% volume

### 2.2.4 — Timing cyclique

Idéal : démarrage au J1 du cycle (femme)
Si J1 dans ≤ 14 jours : attendre
Si J1 dans > 14 jours : démarrer immédiatement
Pas de cycle connu : démarrer immédiatement

### 2.2.5 — En phase Lean Bulk

Diet Break non pertinent en Lean Bulk
À la place : Maintenance temporaire 7j si adaptation détectée
OU réduction surplus de 100 kcal

### 2.2.6 — Recalibration post-Diet Break

TDEE effective recalculée sur les données du Diet Break
Restauration adaptation métabolique :
Après 7j : 50-60% récupéré
Après 14j : 60-70% récupéré
Après 21j+ : 80-90% récupéré

Sources :
Camps et al. — "Weight loss, weight maintenance, adaptive thermogenesis"
(Am J Clin Nutr, 2013)

---

## SECTION 2.3 — PÉRIODISATION TRAINING

### 2.3.1 — Volumes de référence (sets/semaine/groupe musculaire)

                  Débutant   Intermédiaire   Avancé

MEV 6-8 8-12 10-14
MAV 10-15 15-20 18-25
MRV 15-20 20-25 25-30+

Senior (× 0.70 de chaque valeur)
Athlète (× 1.20 de chaque valeur)

MEV = Volume Minimum Effectif
MAV = Volume Adaptatif Maximum
MRV = Volume Maximum Récupérable

### 2.3.2 — Structure du mésocycle

Durée standard : 4-8 semaines
Durée senior : 3-4 semaines
Déload : semaine N-1 du mésocycle
Fréquence déload standard : toutes les 4-6 semaines
Fréquence déload senior : toutes les 3-4 semaines

### 2.3.3 — Paramètres déload

Déload programmé :
Volume : MEV × 0.60
Intensité RPE cible : ≤ 6
Fréquence : réduite 30%
Durée : 1 semaine (senior : 1-2 semaines)

Déload d'urgence (overreaching) :
Volume : MEV × 0.50
Durée : 2 semaines minimum

### 2.3.4 — Détection overreaching

Évaluation sur 14 jours glissants :

SIGNAUX TRAINING :
□ Performance en baisse > 5% sur 3 séances
□ RPE moyen > 8 sur 10+ jours
□ MRV dépassé sur ≥ 2 groupes
□ > 6 séances RPE ≥ 7 sur 7 jours

SIGNAUX RÉCUPÉRATION :
□ Fatigue post moyenne > 4/5 sur 10+ jours
□ Sleep quality < 3/5 sur 7+ jours
□ Mood score < 2.5 sur 7+ jours
□ Energy score < 2.5 sur 7+ jours
□ HRV en déclin sur 7j (si HealthKit)
□ FC repos > baseline + 8 bpm sur 5+ jours

Niveaux :
0 signaux : aucune action
1-3 signaux : note surveillance
4-5 signaux : proposition déload semaine suivante
6+ signaux : déload immédiat recommandé fortement
6+ signaux > 3 sem : surentraînement suspecté → consultation

### 2.3.5 — Alignement mésocycle / cycle féminin

Déload → idéalement en lutéale tardive
Nouveau mésocycle → idéalement en folliculaire
Semaine de peak → folliculaire tardive ou ovulation

Sources :
Schoenfeld — "The Science and Development of Muscle Hypertrophy"
(Human Kinetics, 2016)
Israetel et al. — "Scientific Principles of Strength Training"
(Renaissance Periodization, 2015)
Krieger — "Single vs multiple sets for hypertrophy" (J Strength Cond Res, 2010)
Meeusen et al. — "Prevention of overtraining syndrome" (Eur J Sport Sci, 2013)

---

## SECTION 2.4 — REVERSE DIET

### 2.4.1 — Définition

Augmentation progressive et contrôlée des calories
après une phase de déficit, visant à restaurer
la TDEE effective sans prise de gras excessive.

### 2.4.2 — Vitesses d'augmentation

Cut < 8 semaines : +75 kcal/semaine
Cut 8-16 semaines : +50 kcal/semaine
Cut 16-24 semaines : +25-50 kcal/semaine
Cut > 24 sem (compétition): +25 kcal/semaine
RED-S / aménorrhée : +50 kcal/semaine max
durée 12-20 semaines minimum

### 2.4.3 — Durées maximales

Cut < 8 sem : max 12 semaines de Reverse
Cut 8-16 sem : max 16 semaines
Cut 16-24 sem : max 24 semaines
Cut > 24 sem : max 40 semaines
Si TDEE objectif non atteint après durée max :
→ Maintenance + recommandation médicale

### 2.4.4 — Critères de fin

TDEE effective ≈ TDEE théorique (écart < 5%)
ET poids stable depuis 2 semaines
ET objectif TDEE atteint

### 2.4.5 — Signaux de succès

Poids stable ou légère hausse (< 0.3 kg/sem)
Performance training en hausse
Scores énergie et humeur en hausse
TDEE effective se rapproche de la théorique

### 2.4.6 — Signal d'alarme

Prise > 0.5 kg/sem sur 2+ semaines
→ Réduire vitesse d'augmentation

Sources :
Müller & Bosy-Westphal — "Adaptive thermogenesis with weight loss"
(Obesity, 2013)

---

## SECTION 2.5 — TRANSITIONS ENTRE PHASES

### 2.5.1 — Règles générales

Cooldown entre transitions : 14 jours minimum
Exception : Safety Layer (pas de cooldown)
Exception : fin naturelle Refeed ou Diet Break
Un seul ajustement majeur par bilan hebdomadaire

### 2.5.2 — Transitions planifiées (validées par l'utilisateur)

Fat Loss → Reverse Diet
Fat Loss → Maintenance
Lean Bulk → Maintenance
Lean Bulk → Fat Loss (si BF dépassé)
Maintenance → Fat Loss
Maintenance → Lean Bulk
Reverse Diet → Maintenance
Reverse Diet → Lean Bulk
Recovery → Maintenance
Recovery → Fat Loss (avec précautions)

### 2.5.3 — Transitions forcées Safety Layer

Toute phase → Recovery :
RED-S confirmé (≥ 3 signaux dont ≥ 1 hard)
Aménorrhée > 3 mois en contexte déficit
TCA actif détecté

Lean Bulk / Fat Loss → Maintenance :
Cardiovasculaire sans clearance médicale

### 2.5.4 — Transitions interdites

Recovery → Fat Loss : avant 3 cycles menstruels restaurés (si RED-S)
Maintenance → Hard Bulk : profil cardiovasculaire
Toute phase → Hard Bulk : senior, cardiovasculaire, TCA actif
Fat Loss : post-bariatrique < 3 mois post-op

### 2.5.5 — Calcul nouveaux paramètres à la transition

Basé sur l'état RÉEL au moment de la transition :
weight_current = weight_trend_kg (MOTOR_STATE)
bf_current = bf_estimated recalculé
lean_mass_current = weight_current × (1 - bf_current)
tdee_current = tdee_effective_kcal
adaptation_level_current = depuis MOTOR_STATE

### 2.5.6 — Durées maximales par phase

Fat Loss standard : 12-16 semaines
Fat Loss si adaptation : 8-10 semaines → Diet Break
Lean Bulk : 16-20 semaines
Reverse Diet : selon section 2.4.3
Maintenance : pas de durée maximale
Recovery RED-S : minimum 4-8 semaines
Diet Break : 7-14 jours (auto-terminaison)
Refeed : 1-2 jours (auto-terminaison)

### 2.5.7 — Communication de transition

Structure en 5 étapes :

1. CONTEXTE : d'où on vient (durée, phase précédente)
2. BILAN : ce qu'on a accompli (perte, gain, préservation)
3. RAISON : pourquoi on change (physiologie, signal)
4. PLAN : où on va (nouvelle phase, durée estimée)
5. PREMIERS PAS : ce qui change demain (nouvelles cibles)

Sources :
Helms et al. — "Recommendations for natural bodybuilding" (J Sports Med, 2014)

---

## SECTION 2.6 — PROTOCOLES SPÉCIFIQUES CYCLE FÉMININ

### 2.6.1 — Pourquoi cette section est fondamentale

Les apps fitness traitent souvent les femmes comme des hommes
avec moins de masse maigre. Cette section corrige cette erreur.

### 2.6.2 — Architecture des 4 niveaux + Niveau 0

Niveau 0 : pas de cycle / contraception hormonale /
ménopause / refus de partager
→ Principes féminins génériques uniquement

Niveau 1 : cycle régulier connu
→ Toutes modulations cycliques actives

Niveau 2 : cycle présumé mais inconnu
→ Mode Découverte Assistée (6-8 semaines)

Niveau 3 : cycle irrégulier (SOPK, stress, périménopause)
→ Modulations partielles + protocole SOPK si déclaré

Niveau 4 : ménopause confirmée
→ Protocole ménopause dédié (2.6.7)

Migrations entre niveaux :
Niveau 2 → Niveau 1 : 3 cycles cohérents observés
Niveau 1 → Niveau 3 : 2 cycles consécutifs > 35j ou < 21j
Niveau 3 → Niveau 1 : retour 3 cycles réguliers consécutifs
Niveau 1 → Niveau 0 : déclaration ménopause ou contraception
Niveau 1 → Alerte RED-S : aménorrhée > 3 mois + contexte déficit

Le moteur ne migre jamais sans consentement.
Il propose, l'utilisatrice valide.

### 2.6.3 — Protocole Découverte Assistée (Niveau 2)

Phase 1 (semaines 1-2) : observation passive
Questions rotatives dans le check-in :
Ballonnement ? (oui/un peu/non)
Envies alimentaires inhabituelles ?
Énergie comparée à hier ?
Règles cette semaine ? (toggle hebdomadaire)

Phase 2 (semaines 3-6) : détection patterns
Pic bloating + fatigue + envies sucrées → présomption lutéale
Toggle "règles" → confirmation J1

Phase 3 (semaines 6-8) : confirmation
Si 1 cycle complet + 2ème présomption J1 :
Proposition migration Niveau 1

Si aucun pattern après 8 semaines :
Proposition Niveau 3 (irrégulier) ou retour Niveau 0

### 2.6.4 — Vue unifiée des modulations cycliques

Menstruelle (J1-J5) :
Lecture poids : ×0.50 (coefficient)
Calories : standard (focus ressenti)
Glucides : standard
Training : modéré, écoute corps

Folliculaire tardive (J6-J13) :
Lecture poids : fenêtre de référence (coefficient 1.0)
Calories : déficit complet appliqué
Glucides : standard
Training : fenêtre intensif optimale
Refeed : timing idéal

Ovulation (J14-J16) :
Lecture poids : légère rétention possible
Calories : déficit complet
Training : pic performance
Refeed : efficace

Lutéale précoce (J17-J21) :
Lecture poids : normale (coefficient 1.0)
Calories : déficit × 0.85
Glucides : +10g possible
Training : standard

Lutéale tardive (J22-J28) :
Lecture poids : coefficient 0.60
Calories : déficit × 0.70-0.75
Glucides : +15-20% sur cible
Training : charge réduite, focus technique
Refeed : moins nécessaire (timing sous-optimal)

### 2.6.5 — Protocole RED-S (Relative Energy Deficiency in Sport)

Seuil de déclenchement : ≥ 3 signaux dont ≥ 1 signal HARD

SIGNAUX HARD :
□ Aménorrhée > 3 mois en contexte déficit/training élevé
□ EA < 30 kcal/kgLM (athlète)
□ BF estimé < 17%

SIGNAUX SECONDAIRES :
□ Charge training > 6h/sem ou > 5 séances intenses/sem
□ Perte poids > 1% PC/sem sur ≥ 4 semaines
□ Performance training en baisse persistante
□ Sommeil dégradé sans cause identifiée
□ FC repos < 50 bpm (non-athlète endurance)
□ Mood score < 2/5 sur > 2 semaines
□ Faim pathologiquement absente

RÉPONSE MOTEUR (Safety absolu) :
Calories → TDEE effective ou +5% si BF très bas
Déficit → 0 (suspendu immédiatement)
Training → max 4 séances/sem, intensité modérée
Diet Break, Refeed, Fat Loss → suspendus
Transition Recovery → automatique, sans validation

SORTIE DU MODE RED-S :
red_s_signals_count = 0 pendant ≥ 21 jours consécutifs
ET retour règles ≥ 3 cycles consécutifs (si aménorrhée)
ET double validation (2 étapes, 48h d'écart minimum)

EA (Énergie Disponible) :
EA = (Apports kcal - Dépense training kcal) / masse_maigre_kg
Seuil critique : < 30 kcal/kgLM/j
Seuil optimal : ≥ 45 kcal/kgLM/j

Sources :
Mountjoy et al. — "2023 IOC consensus on REDs" (Br J Sports Med, 2023)
De Souza et al. — "Female Athlete Triad Coalition Consensus" (Br J Sports Med, 2014)
Loucks — "Energy availability regulates reproductive function" (Exerc Sport Sci Rev, 2003)
Areta et al. — "Low energy availability: history and definition" (Eur J Sport Sci, 2021)

### 2.6.6 — Protocole SOPK

Prévalence : 8-13% des femmes en âge de procréer.
Activation : déclaration optionnelle.

ADAPTATIONS NUTRITIONNELLES :
Glucides : 35-45% kcal, complexes uniquement
Glucides simples : éviter sauf peri/post-training
Fibres : cible +5g/j
Protéines : 2.0-2.4 g/kgLM (satiété + composition)
Lipides : standard, focus oméga-3
Répartition : 4-5 prises réparties
Refeed : glucides complexes uniquement

ADAPTATIONS TRAINING :
Priorité : résistance (améliore SI)
Cardio : modéré mixte (HIIT court + LISS)
Fréquence : 3-5 séances/sem
Volume : progressif, éviter surentraînement

CYCLE :
Cycles SOPK typiquement irréguliers → Niveau 3 par défaut
Modulations cycliques partielles, sur déclaration J1

LECTURE POIDS :
Tolérance stagnation : 14 jours (vs 10 standard)
Moyennage : 4 semaines
Focus mesures morphologiques

Sources :
Teede et al. — "International Evidence-based Guideline for PCOS" (Fertil Steril, 2023)
Moran et al. — "Lifestyle changes in PCOS" (Cochrane, 2019)
Marsh et al. — "Low GI diet vs conventional diet in PCOS" (Am J Clin Nutr, 2010)

### 2.6.7 — Protocole ménopause

DÉFINITIONS :
Périménopause : cycles irréguliers, symptômes (40-55 ans)
Ménopause : aménorrhée ≥ 12 mois
Post-ménopause: suite

ADAPTATIONS NUTRITIONNELLES :
TDEE : -100-200 kcal vs formules standard
Protéines : 2.0-2.4 g/kgLM (masse maigre critique)
Lipides : focus oméga-3 (santé cardiovasculaire)
Calcium/Vit D : surveillance (santé osseuse)

ADAPTATIONS TRAINING :
Résistance : prioritaire (préservation masse maigre)
Impact modéré : (densité osseuse)
Cardio : mixte modéré

CYCLE :
Périménopause : Niveau 3 (irrégulier)
Ménopause : Niveau 4 (aucun tracking cycle)

Sources :
Davis et al. — "Menopause" (Lancet, 2023)
Sims & Yeager — "Next Level" (Rodale Books, 2022)
Maltais et al. — "Changes in muscle mass after menopause"
(J Musculoskelet Neuronal Interact, 2009)

### 2.6.8 — Cas particuliers

CONTRACEPTION HORMONALE :
Pilule combinée / patch / anneau → Niveau 0
Progestative seule / DIU hormonal → Niveau 0
DIU cuivre → Niveau 1 standard

POST-PARTUM :
< 6 mois : Fat Loss refusé
Maintenance ou Recovery uniquement
Recommandation suivi médical

ALLAITEMENT :
Fat Loss refusé
Calorique minimum = TDEE + 500 kcal (exclusif)
ou + 300 kcal (mixte)
Protéines : 1.8-2.2 g/kgLM
Hydratation : +500 ml/j
Cycle : suspendu (lactationnelle)

Sources :
Most et al. — "Pregnancy and lactation: nutritional requirements"
(Am J Clin Nutr, 2018)

---

# MODULE 3 — PHÉNOMÈNES PHYSIOLOGIQUES DOCUMENTÉS

---

## SECTION 3.1 — ADAPTATION MÉTABOLIQUE

### 3.1.1 — Définition

Diminution du TDEE au-delà de ce qui est attribuable
à la seule perte de masse, en réponse à un déficit prolongé.

Composantes principales affectées :
BMR : baisse 5-15% au-delà de la baisse attendue
TEF : baisse mécanique liée à la baisse des apports
NEAT : baisse 10-25% (composante la plus variable)

### 3.1.2 — Magnitude selon durée et profondeur

0-4 semaines, déficit modéré : < 3% TDEE
4-8 semaines, déficit modéré : 3-7% TDEE
8-16 semaines, déficit modéré : 7-12% TDEE
16+ semaines, déficit modéré : 10-20% TDEE
Cut compétition (16+ sem) : 15-25% TDEE (parfois plus)

### 3.1.3 — Signaux détectables par le moteur

Sur fenêtre roulante de 14 jours :
□ Stagnation pondérale malgré déficit ≥ 300 kcal
□ Écart apports déclarés / perte observée > 25%
□ NEAT bas (energy_score moyen < 2.5 sur 14j)
□ Fatigue progressive (energy_score en baisse continue)
□ Frilosité déclarée (via notes)
□ Sommeil dégradé sans cause identifiée
□ Performance training en baisse
□ Mood score < 2.5 sur 14j
□ FC repos en baisse anormale (si HealthKit)
□ Aménorrhée / cycle perturbé (femme)

Seuils :
Écart > 25% ET déficit > 300 kcal ET ≥ 2 signaux
→ Adaptation modérée suspectée
Écart > 40% ET déficit > 300 kcal ET ≥ 4 signaux
→ Adaptation marquée → Diet Break proposé

### 3.1.4 — Réponse moteur

Adaptation légère : recalibration TDEE -3 à -5%
Adaptation modérée : proposition Refeed + recalibration -5 à -10%
Adaptation marquée : proposition Diet Break + recalibration -10 à -15%
Adaptation profonde + RED-S : Recovery forcée

Recalibration en 2 temps si > 5% :
Semaine 1 : moitié de l'ajustement
Semaine 2 : reste de l'ajustement

### 3.1.5 — Persistance long terme

Post-Biggest-Loser (perte massive) : persistance documentée 6 ans.
Utilisateur avec antécédent perte > 20% PC :
→ calibration TDEE conservative
→ réintroduction Fat Loss avec vigilance accrue

Sources :
Müller & Bosy-Westphal — "Adaptive thermogenesis" (Obesity, 2013)
Trexler et al. — "Metabolic adaptation to weight loss" (J Int Soc Sports Nutr, 2014)
Fothergill et al. — "Persistent metabolic adaptation 6 years post-BL" (Obesity, 2016)
Rosenbaum & Leibel — "Adaptive thermogenesis in humans" (Int J Obes, 2010)

---

## SECTION 3.2 — REBOND POST-CUT

### 3.2.1 — Les 3 phénomènes distincts

PHÉNOMÈNE 1 — Gain glycogène + eau :
Nature : rétention hydrique + glycogène restauré
Temporalité: 3-10 jours post-cut
Amplitude :
Débutant petit gabarit : +0.6-1 kg
Intermédiaire standard : +1-1.6 kg
Avancé masse élevée : +1.6-2.4 kg
Athlète cut compétition : +2-3.2 kg
Interprétation : physiologique, inévitable, bénéfique

PHÉNOMÈNE 2 — Whoosh effect :
Nature : relargage soudain de rétention hydrique
Temporalité: 24-72h, imprévisible
Amplitude : chute soudaine 0.5-2 kg en 24-72h
Mécanisme : adipocytes libèrent l'eau temporaire
stockée pendant la lipolyse
Statut : observé cliniquement, mécanisme partiellement établi
Interprétation : positif — la perte était en cours

PHÉNOMÈNE 3 — Regain masse grasse :
Nature : reconstitution adipocytaire
Cause : surplus calorique post-cut non structuré
Amplitude : 50-60% du poids perdu en 1-2 ans sans structure
Prévention : Reverse Diet (Section 2.4)

### 3.2.2 — Lecture poids post-cut

Fenêtre de gel de lecture : 10-14 jours post-cut
(21 jours si cut de compétition)
Le moteur suspend les alertes de dérive pondérale pendant cette fenêtre.

### 3.2.3 — Interprétation du whoosh

SI variation ↓ > 0.8 kg en 48h :
Interpréter comme relargage hydrique attendu
Pas de recalibration TDEE sur ce signal
Message : "Chute attendue — ta perte latente devient visible"

Sources :
Olsson & Saltin — "Total body water with muscle glycogen changes" (Acta Physiol Scand, 1970)
Cushman & Salans — "Adipose cell size in isolated adipose cells" (J Lipid Res, 1978)
MacLean et al. — "Biology's response to dieting" (Am J Physiol, 2011)
Sumithran et al. — "Long-term hormonal adaptations to weight loss" (NEJM, 2011)

---

## SECTION 3.3 — MEMORY EFFECT MUSCULAIRE

### 3.3.1 — Mécanisme

Les myonoyaux acquis lors de l'hypertrophie persistent
après désentraînement. Lors de la reprise, le muscle
dispose d'un pool de noyaux plus dense → réacquisition accélérée.

### 3.3.2 — Détection

training_history_years ≥ 2
ET training_history_pause_months > 0.5 (au moins 2 semaines)
ET training_history_pause_months ≤ 60 (max 5 ans)
→ memory_effect_active = true

### 3.3.3 — Vitesse de réacquisition

Pause < 2 semaines : force légère ↓, masse stable
réacquisition < 1 semaine
Pause 2-4 semaines : réacquisition 1-2 semaines
Pause 1-3 mois : réacquisition 3-6 semaines
Pause 3-6 mois : réacquisition 6-12 semaines
Pause 6-12 mois : réacquisition 3-5 mois
Pause > 12 mois : réacquisition 4-8 mois

### 3.3.4 — Durée de la fenêtre memory effect

Pause < 3 mois : fenêtre 4-6 semaines
Pause 3-6 mois : fenêtre 6-10 semaines
Pause 6-12 mois : fenêtre 10-16 semaines
Pause > 12 mois : fenêtre 16-24 semaines

### 3.3.5 — Impact sur les recommandations

Volume initial : MEV + 30% (pas repartir de MEV bas)
Progression : MEV → MAV en 2-3 semaines (vs 4-6 normal)
Gains attendus (vs Table A standard) : ×1.5 à ×2.0

Gains en memory effect (homme) :
Intermédiaire : 1-2 kg/mois les 1-3 premiers mois
Avancé : 0.75-1.5 kg/mois les 1-3 premiers mois

Après la fenêtre :
memory_effect_active = false
Retour aux projections standard

Sources :
Bruusgaard et al. — "Myonuclei not lost on detraining" (PNAS, 2010)
Gundersen — "Muscle memory and a new cellular model" (J Exp Biol, 2016)
Bosquet et al. — "Effects of detraining on performance" (Sports Med, 2013)

---

## SECTION 3.4 — SENSIBILITÉ INSULINE ET PARTITIONNEMENT

### 3.4.1 — Définition

Le partitionnement nutritif (p-ratio) = proportion des calories
dirigées vers la masse maigre vs la masse grasse.
La sensibilité insuline est le déterminant majeur du p-ratio.

### 3.4.2 — Scoring interne SI (5 niveaux)

SI Élevée : BF optimal + training régulier + sommeil OK + pas de condition
SI Bonne : BF modéré + training régulier OU sommeil OK
SI Moyenne : BF modéré + training irrégulier OU 1 facteur défavorable
SI Réduite : BF élevé OU SOPK OU sommeil chroniquement dégradé
SI Altérée : BF élevé + condition métabolique + sédentarité

### 3.4.3 — Impact sur les phases

SI Élevée → Lean Bulk efficace (p-ratio ~60-70% muscle)
SI Bonne → Lean Bulk viable (p-ratio ~50-60% muscle)
SI Moyenne → Lean Bulk avec vigilance (p-ratio ~40-50%)
SI Réduite → Lean Bulk déconseillé — Fat Loss d'abord
SI Altérée → Lean Bulk contre-indiqué

### 3.4.4 — Stratégie glucides selon SI

SI Élevée : liberté relative, glucides simples ponctuels OK
SI Bonne : focus timing autour de l'entraînement
SI Moyenne : 70-80% complexes, timing priorisé
SI Réduite : complexes uniquement, 4-5 prises réparties
SI Altérée : protocole SOPK/diabète (Section 2.6.6)

### 3.4.5 — Fenêtre post-training universelle

Dans les 30-120 min post-séance :
Captage glucose musculaire indépendant de l'insuline (GLUT-4)
→ Fenêtre optimale pour glucides même en SI réduite
→ Positionner le repas le plus glucidique de la journée ici

### 3.4.6 — Leviers d'amélioration SI

Résistance training : ↑↑↑ aigu (24-48h) + chronique (4-8 sem)
Réduction BF : ↑↑↑ sur semaines à mois
HIIT : ↑↑ aigu + chronique
Amélioration sommeil : ↑↑ en 1-2 semaines
Qualité alimentaire : ↑ sur semaines
Fibres : ↑ sur semaines à mois
Marche post-repas 10-20min : ↑ aigu

Sources :
DeFronzo et al. — "Insulin resistance: a multifaceted syndrome" (Diabetes, 1991)
Richter & Hargreaves — "Exercise, GLUT4, and skeletal muscle" (Physiol Rev, 2013)
Borghouts & Keizer — "Exercise and insulin sensitivity" (Int J Sports Med, 2000)

---

## SECTION 3.5 — PLAFONDS HORMONAUX ET LIMITES NATURELLES

### 3.5.1 — Système hormonal anabolique

TESTOSTÉRONE (valeurs normales) :
Homme 18-40 ans : 9.9-27.8 nmol/L (280-800 ng/dL)
Homme 40-60 ans : 8.0-24.0 nmol/L (230-690 ng/dL)
Femme adulte : 0.4-2.0 nmol/L (12-58 ng/dL)
Femme post-méno : 0.1-1.7 nmol/L (3-49 ng/dL)

GH et IGF-1 :
Pic GH : pendant N3 (sommeil profond)
IGF-1 adulte normal : 100-300 ng/mL
Déclin GH/IGF-1 : -14% par décennie après 30 ans

Note : l'entraînement améliore la sensibilité des récepteurs
androgènes, pas les taux circulants de manière durable.
Le moteur ne promet jamais de "booster la testostérone".

### 3.5.2 — Taux de gain musculaire naturel maximal

                    Homme/an    Femme/an    Homme/mois  Femme/mois

Débutant (0-2a) 8-12 kg 4-6 kg 0.7-1 kg 0.35-0.5 kg
Interméd (2-4a) 4-6 kg 2-3 kg 0.35-0.5 kg 0.17-0.25 kg
Avancé (4-8a) 1.5-3 kg 0.75-1.5 kg 0.15-0.25 kg 0.07-0.12 kg
Élite (8+a) 0.5-1.5 kg 0.25-0.75 kg 0.05-0.12 kg 0.02-0.06 kg

Ces chiffres représentent les conditions optimales.
En pratique : 50-70% de ces valeurs pour la majorité.

### 3.5.3 — Modulation des projections par âge

18-30 ans : Table A × 1.0 (référence)
30-40 ans : Table A × 1.0 (déclin léger compensable)
40-50 ans : Table A × 0.8
50-60 ans : Table A × 0.6
60-65 ans : Table A × 0.5
65-70 ans : Table A × 0.4
70+ ans : Table A × 0.3 (préservation > gains)

### 3.5.4 — Déclin hormonal et sarcopénie

Testostérone H : -1 à -2%/an après 30-35 ans
GH/IGF-1 : -14% par décennie après 30 ans

Sarcopénie :
Début physiologique : ~35-40 ans (silencieux)
Accélération : ~50-55 ans
Sans entraînement : -0.5 à -1%/an après 40 ans
Sédentaire 65+ : -1.5 à -3%/an
Avec résistance training : ralentit ou stoppe

### 3.5.5 — Adaptations par tranche d'âge

18-30 : protéines 1.8-2.2, déficit max -500, récupération standard
30-40 : protéines 1.8-2.2, déficit max -400, récupération +10-15%
40-50 : protéines 2.0-2.4, déficit max -350, récupération +20%
50-60 : protéines 2.2-2.6, déficit max -300, récupération +30%
60+ : protéines 2.4-2.8, déficit max -200, récupération +40%

### 3.5.6 — Cortisol et pattern hypercortisolique

Signaux de cortisol chronique élevé :
□ Stress score > 3/5 sur 14+ jours
□ Prise gras abdominal malgré déficit (mesures)
□ Baisse force ET endurance combinées
□ Sommeil dégradé (qualité) sans cause
□ Fringales sucrées répétées
□ Humeur basse persistante
□ Cut > 12 semaines sans diet break

≥ 3 signaux → cortisol_chronic_alert_active = true
Réponse : Diet Break ou réduction déficit + sommeil

Sources :
Bhasin et al. — "Testosterone dose-response relationships" (Am J Physiol, 2001)
Kraemer & Ratamess — "Hormonal responses to resistance exercise" (Sports Med, 2005)
Doherty — "Aging and sarcopenia" (J Appl Physiol, 2003)
Hackney — "Stress and the neuroendocrine system" (Expert Rev Endocrinol Metab, 2006)

---

## SECTION 3.6 — PLATEAU ET STAGNATION

### 3.6.1 — Définition opérationnelle

Écart persistant et statistiquement significatif entre
la progression attendue et la progression observée,
sur une variable cible, sur une durée suffisante
pour exclure le bruit normal de mesure.

### 3.6.2 — Durées seuil avant qualification

Fat Loss : 10-14 jours
Lean Bulk : 14-21 jours
Recomp : 21-28 jours
Maintenance : non applicable (stabilité = objectif)

### 3.6.3 — Causes et distinctions

Adaptation métabolique :
Signaux secondaires présents, déficit long > 6 sem
→ Diet Break

Rétention hydrique cyclique :
Synchronisée phase lutéale, résolution post-règles
→ Lecture gelée, aucune intervention

Rétention hydrique générale :
Sodium élevé, stress aigu
→ Observation 3-7 jours

Gain glycogène compensatoire :
Après refeed ou hausse glucides
→ Lecture pondérée, aucune intervention

Recomposition silencieuse :
Poids stable + tour de taille ↓ ET/OU force ↑
→ Continuer — c'est positif

Sous-déclaration apports :
Écart arithmétique incohérent, confidence basse
→ Recadrage tracking, pas de modification cibles

Surestimation dépense training :
TDEE surestimée si training déclaré exagéré
→ Recalibration TDEE

Plafond naturel :
FFMI proche seuil, niveau avancé, BF déjà bas
→ Recadrage objectif

### 3.6.4 — Hiérarchie d'intervention (5 niveaux)

NIVEAU 1 : Observation prolongée (+7 jours)
Plateau tout juste qualifié, cause incertaine

NIVEAU 2 : Recalibration légère (±100 kcal / ±1 séance)
Cause identifiée, adaptation légère

NIVEAU 3 : Intervention protocolaire
Refeed, Diet Break, ou Déload selon cause

NIVEAU 4 : Reconsidération de phase
Plateau persistant malgré niveaux 1-3

NIVEAU 5 : Renvoi et Safety Layer
Signaux RED-S, overreaching sévère, TCA suspecté

### 3.6.5 — Ce que le moteur ne fait jamais face à un plateau

✗ Creuser le déficit de plus de -200 kcal en une fois
✗ Augmenter le volume training si signaux de fatigue
✗ Proposer plusieurs interventions simultanées
✗ Qualifier un plateau avant la fenêtre minimale
✗ Attribuer le plateau au comportement de l'utilisateur

Sources :
Hall et al. — "Quantification of energy imbalance" (Lancet, 2011)
Trexler et al. — "Metabolic adaptation to weight loss" (J Int Soc Sports Nutr, 2014)
Kreher & Schwartz — "Overtraining syndrome" (Sports Health, 2012)

---

## SECTION 3.7 — VARIATIONS HYDRIQUES ET BRUIT DE MESURE

### 3.7.1 — Amplitude du bruit normal

Le poids corporel peut varier de ±1 à ±3 kg au cours
d'une même journée, et de ±0.5 à ±2 kg d'un jour à l'autre,
sans aucun changement de composition réelle.

### 3.7.2 — Sources de variation

Glycogène + eau liée : +0.5 à +3 kg (2-12h, résolution 1-5j)
Sodium alimentaire : +0.5 à +1.5 kg (4-24h, résolution 24-48h)
Contenu digestif : +0.5 à +1.5 kg (immédiat, résolution 12-24h)
Hydratation : ±0.5 à ±1 kg (immédiat, résolution 2-4h)
Alcool : +0.5 à +1 kg rebond (12-24h, résolution 24-48h)
Cycle féminin lutéale : +0.5 à +3 kg (progressif, résolution post-règles)
Stress aigu : +0.3 à +1 kg (12-24h, résolution 24-72h)
Chaleur/sueur : -0.5 à -2 kg (immédiat, résolution 1-3h)
Post-entraînement : -0.5 à -1.5 kg puis +0.5-1 kg (inflammation)
Mauvaise nuit : +0.3 à +0.8 kg (lendemain, résolution 24h)

### 3.7.3 — Conditions de pesée standardisées

□ Le matin, au réveil
□ Après avoir uriné
□ Avant de boire ou manger
□ En sous-vêtements ou nu
□ Même balance, même endroit
→ is_first_morning = true requis pour lecture optimale

### 3.7.4 — Filtre exponentiel (poids de tendance)

Tendance(j) = Tendance(j-1) + 0.1 × (Poids(j) - Tendance(j-1))

Coefficient 0.1 : le poids du jour influence à 10%
Les jours précédents représentent 90%

### 3.7.5 — Détection valeur aberrante

SI delta > 2.0 kg en 24h :
is_outlier = true
Exclue du calcul de tendance
Notification neutre à l'utilisateur

### 3.7.6 — Seuils de décision basés sur la tendance

FAT LOSS :
↓ > 0.5 kg/sem : trop rapide → vigilance
↓ 0.2-0.5 kg/sem : optimal ✓
↓ 0-0.2 kg/sem : lent → surveillance
Stable ou ↑ : plateau après 14 jours

LEAN BULK :
↑ > 0.5 kg/sem : surplus excessif → vérifier apports
↑ 0.1-0.3 kg/sem : optimal ✓
Stable : plateau après 21 jours

### 3.7.7 — Fréquence de pesée recommandée

Standard : quotidienne (avec filtre exponentiel)
Anxiété / TCA : hebdomadaire maximum
TCA rémission : hebdomadaire ou mensuelle
Femme sans suivi cycle: hebdomadaire en lutéale tardive

Sources :
Walker — "The Hacker's Diet" (Autodesk Press, 1991)
Fernández-Elías et al. — "Muscle water and glycogen recovery" (Eur J Appl Physiol, 2015)

---

# MODULE 4 — CONSIDÉRATIONS SPÉCIFIQUES

---

## SECTION 4.1 — SENIORS (55+)

### 4.1.1 — Activation

Automatique si âge ≥ 55 ans → senior_mode = true

### 4.1.2 — Physiologie clé

Résistance anabolique : réponse MPS réduite aux protéines
Récupération allongée : 48-72h inter-séances (vs 24-48h)
Sarcopénie active : -0.5 à -1%/an masse maigre
Hypodipsie : sensation de soif diminuée
Densité osseuse : en déclin, impact training important

### 4.1.3 — Adaptations nutritionnelles

Protéines : 2.0-2.4 g/kgLM (Maintenance)
2.2-2.6 g/kgLM (Fat Loss / Lean Bulk)
Dose par prise : 0.4-0.6 g/kgPC
Leucine par prise : ≥ 3g
Prises/jour : 4-5
Déficit max : -200 à -300 kcal/j
Surplus max : +100 à +200 kcal/j
Hydratation : 40 ml/kgPC/j

Micronutriments à surveiller :
Vitamine D, Calcium, Vitamine B12, Magnésium, Oméga-3
→ Rappel bilan médical, jamais de prescription

### 4.1.4 — Adaptations training

Fréquence résistance : 3-4x/sem (55-65), 2-3x/sem (65+)
Volume par séance : -20-30% vs standard
Intensité cible : RPE ≤ 7 (55-65), RPE ≤ 6 (65+)
Récupération : 48-72h
Déload : toutes les 3-4 semaines
Durée mésocycle : 3-4 semaines

Priorités training : 1. Résistance (sarcopénie) 2. Impact modéré (densité osseuse) 3. Équilibre/proprioception (prévention chutes) 4. Mobilité 5. Cardio modéré

### 4.1.5 — Phases disponibles Senior

Fat Loss : ✓ déficit -200-300 max
Lean Bulk : ✓ surplus conservateur
Recomp : ✓ recommandée en priorité
Maintenance : ✓ phase centrale
Hard Bulk : ✗ contre-indiqué
Cut profond : ✗ contre-indiqué

Sources :
Doherty — "Aging and sarcopenia" (J Appl Physiol, 2003)
Moore et al. — "Protein for seniors" (J Gerontol, 2015)
Churchward-Venne et al. — "Nutritional regulation of MPS" (Nutr Metab, 2012)
Fiatarone et al. — "Exercise in very elderly people" (NEJM, 1994)

---

## SECTION 4.2 — ATHLÈTES ET PROFILS TRÈS ACTIFS

### 4.2.1 — Critères d'activation athlete_mode

≥ 2 critères parmi :
□ ≥ 6h entraînement structuré/semaine
□ ≥ 2 disciplines pratiquées régulièrement
□ Compétition (même occasionnelle)
□ TDEE effectif > 3000 kcal/j (H) ou > 2400 kcal/j (F)
□ Volume training > MAV standard sur ≥ 2 groupes musculaires

### 4.2.2 — TDEE dynamique athlétique

TDEE_athlète = BMR × 1.2 + EAT estimée + NEAT modulé

EAT par type :
Endurance (course, vélo, natation) : 600-900 kcal/h
Force (musculation) : 300-500 kcal/h
Mixte (CrossFit, sports collectifs): 500-800 kcal/h
HIIT : 500-700 kcal/h

Recalcul hebdomadaire selon volume déclaré

### 4.2.3 — Énergie disponible (EA)

EA = (Apports kcal - Dépense training kcal) / masse_maigre_kg

Seuils :
≥ 45 kcal/kgLM : optimal
30-45 : acceptable, surveillance
25-30 : sub-optimal → recommandation augmentation
< 25 : critique → alerte RED-S hard

### 4.2.4 — Carb loading pré-compétition

Déclencheur : compétition endurance > 90 min dans le Smart Agenda

Protocole simplifié (J-3 à J-1) :
Glucides : 8-12 g/kgPC/j
Protéines : maintenues
Lipides : réduits

Jour J (repas 3-4h avant) :
Glucides : 1-4 g/kgPC
Pas de nouvel aliment jamais testé

### 4.2.5 — Protocoles spécifiques athlètes

Voir Section 2.3 pour périodisation training
Voir Section 1.4.6 pour périodisation glucidique
Voir Section 2.6.5 pour RED-S athlétique

Sources :
Thomas et al. — "Nutrition and athletic performance" (J Acad Nutr Diet, 2016)
Mountjoy et al. — "2023 IOC consensus on REDs"
Meeusen et al. — "Prevention of overtraining syndrome" (Eur J Sport Sci, 2013)
Jeukendrup — "Periodized Nutrition for Athletes" (Sports Med, 2017)

---

## SECTION 4.3 — CONDITIONS MÉDICALES SPÉCIFIQUES

### 4.3.1 — Hypothyroïdie

Prévalence : 5-10% des femmes, 1-3% des hommes.
Activation : déclaration optionnelle.

ADAPTATIONS :
TDEE estimée : -10 à -20% vs formule standard
Déficit max : -200 à -300 kcal/j
Protéines : 2.0-2.4 g/kgLM
Glucides : pas de restriction sévère
(thyroïde a besoin de glucides pour T4→T3)
Glucides < 80g/j : note discrète
Iode : sources alimentaires riches encouragées
Sélénium : sources alimentaires encouragées
Soja en excès : limiter (peut interférer avec lévothyroxine)

Lecture poids : tolérance stagnation 14j (vs 10 standard)

Sous-question onboarding : "Traitée et TSH équilibrée ?"

Sources :
Mullur et al. — "Thyroid hormone regulation of metabolism" (Physiol Rev, 2014)

### 4.3.2 — Conditions cardiovasculaires

Périmètre : HTA traitée, maladie coronarienne stable,
insuffisance cardiaque NYHA I-II, arythmies contrôlées,
post-chirurgie cardiaque.

RÈGLE ABSOLUE : confirmation accord médical avant training intensif.

ADAPTATIONS NUTRITIONNELLES :
Sodium : signal si > 2g/j
Lipides saturés : surveillance qualitative
Oméga-3 : encouragés
Fibres : cible +5g/j
Déficit max : -250 kcal/j
Alcool : signal fort si consommation régulière
Caféine + arythmie : note si > 200mg/j

ADAPTATIONS TRAINING :
RPE cible : ≤ 6 (sans clearance explicite)
HIIT : interdit sans feu vert cardiologique
Priorité : cardio modéré + résistance légère

SIGNAUX D'URGENCE (niveau 5) :
Douleur thoracique → arrêt immédiat + urgence médicale
Contacts BE : 100 (SAMU) — FR : 15 (SAMU)

Sources :
Piepoli et al. — "European guidelines cardiovascular prevention" (Eur Heart J, 2016)

### 4.3.3 — Troubles du comportement alimentaire (TCA)

Périmètre : anorexie, boulimie, BED, orthorexie, antécédents.

POSTURE : le moteur détecte passivement, n'accuse jamais,
oriente vers des ressources adaptées.

NIVEAUX :
TCA actif (suivi médical) :
→ Tracking calorique désactivé
→ Objectifs composition désactivés
→ Mode bien-être général uniquement

TCA rémission :
→ Mode TCA-safe complet
→ Pas de chiffres poids affiché
→ Pas de référence aux calories
→ Focus énergie, force, bien-être

Vigilance :
→ Adaptations préventives
→ Surveillance passive

PATTERNS DÉTECTÉS PASSIVEMENT (jamais communiqués tels quels) :
□ Apports < plancher × 0.80 sur > 3 jours
□ Sessions training ≥ 7/sem + énergie basse + restriction
□ Variation kcal max-min > 2000 kcal sur 7 jours
□ Pesées > 3/jour sur > 3 jours/sem

REFORMULATIONS TCA-SAFE :
"Tu as perdu X kg" → "Ta tendance est en baisse"
"Tes calories sont à X%" → "Tu es dans ton plan"
"Déficit de X kcal" → "Bonne journée"
Jamais de chiffres BF, poids, calories en mode TCA-safe

RESSOURCES :
Belgique :
ALBA : 0800 20 120 (gratuit)
Cliniques universitaires Saint-Luc
France :
Anorexie Boulimie Info Écoute : 0 810 037 037

Sources :
NICE — "Eating disorders: recognition and treatment" (NG69, 2017)
Fairburn — "Cognitive Behavior Therapy and Eating Disorders"

### 4.3.4 — GLP-1 (Ozempic, Wegovy, Mounjaro, etc.)

Activation : déclaration optionnelle.

RISQUE MAJEUR : perte de masse maigre si protéines et training
insuffisants (25-40% de la perte peut être du muscle).

ADAPTATIONS :
Protéines : 2.2-2.6 g/kgLM (priorité absolue)
Plancher protéique : protein_target × 0.85 (non négociable)
Volume repas : 4-5 petites prises
Plancher calorique : 1200 kcal/j (F), 1500 kcal/j (H)
Déficit additionnel : pas d'ajout (médicament crée déjà le déficit)
Alcool : déconseillé (interaction + nausées)
Lipides en excès : éviter (nausées aggravées)

Training résistance : priorité absolue

ALERTES SPÉCIFIQUES :
Perte > 1.5%/sem sur 3 sem → flag_glp1_lean_mass_risk
Apports < planchers sur > 3 jours → alerte niveau 3
Vomissements > 5 jours → recommandation consultation médicale

Sources :
Wilding et al. — "Once-weekly semaglutide" (NEJM, 2021)
Bikou et al. — "GLP-1 receptor agonists: body composition" (Rev Endocr, 2024)

---

## SECTION 4.4 — POST-BARIATRIQUE

### 4.4.1 — Types d'interventions couverts

Sleeve gastrectomie (~70% des interventions)
Bypass gastrique Roux-en-Y (~25%)
Anneau gastrique (< 5%)
Dérivation biliopancréatique (< 2%)

### 4.4.2 — Phases temporelles

0-3 mois : hors scope — suivi chirurgical exclusif
3-12 mois : post-op précoce
1-3 ans : post-op intermédiaire
3+ ans : post-op tardif

### 4.4.3 — Capacité gastrique post-opératoire

Sleeve / Bypass précoce : 100-200 ml par repas
Sleeve tardif : jusqu'à 300 ml

→ 5-6 prises/jour maximum
→ Liquides séparés des repas (30 min avant, 30 min après)
→ Protéines d'abord à chaque repas

### 4.4.4 — Adaptations nutritionnelles

PROTÉINES (priorité absolue) :
Précoce (3-6 mois) : 60-80g/j minimum absolu
Intermédiaire (6-24 mois) : 80-120g/j
Tardif (2+ ans) : 1.5-2.0 g/kgPC
Fat Loss actif : 2.0-2.4 g/kgPC

GLUCIDES :
Sleeve : standard mais volume limité
Bypass : glucides simples très limités (dumping)
Tous : éviter boissons sucrées

MICRONUTRIMENTS (supplémentation à vie) :
B12, Fer, Calcium, Vitamine D, Zinc, Vitamine A, Cuivre
→ Rappel bilan biologique trimestriel/semestriel
→ Le moteur rappelle, ne prescrit pas

ALCOOL :
Absorption très rapide post-bypass → ivresse rapide
Risque de transfert d'addiction documenté
→ Mention si consommation déclarée, sans jugement

### 4.4.5 — Phase recommandée

Phase intermédiaire : Recomp prioritaire
Raisonnement : déficit naturel via restriction volumique + protéines hautes + résistance = optimal

### 4.4.6 — Safety Layer post-bariatrique

Apports < 800 kcal/j sur > 5 jours → Niveau 4 urgent
Protéines sous plancher sur > 5 jours → Niveau 3 immédiat
Vomissements > 3 jours → alerte chirurgien
Poids > nadir + 10% → alerte douce
Poids > nadir + 20% → alerte consultation chirurgicale

Sources :
Mechanick et al. — "Clinical practice guidelines bariatric surgery"
(Obesity, 2019)
Coupaye et al. — "Nutritional status sleeve vs bypass" (Obes Surg, 2015)

---

# MODULE 5 — SOURCES ET VERSIONNING

---

## SECTION 5.1 — NIVEAUX DE PREUVE

A — Établi : méta-analyses concordantes, RCT multiples, consensus fort
B — Solide : RCT unique qualité, études prospectives, consensus sociétés
C — Modéré : études observationnelles, extrapolations, consensus praticien
D — Empirique : pratique clinique, extrapolations conservatives, peu d'études

## SECTION 5.2 — ZONES D'INCERTITUDE V1.0.0

Zones à affiner en priorité :

1. Seuils détection adaptation (écart > 25% / > 40%)
   → Calibrer sur données réelles utilisateurs (V1.1)

2. Durées de transition entre phases
   → Consensus praticien, peu d'études contrôlées (V1.1)

3. Coefficients modulation cycle féminin (déficit × 0.70-0.75)
   → Extrapolations hormonales, pas de RCT directes (V1.2)

4. Whoosh effect
   → Mécanisme plausible, documentation directe limitée (V2.0)

5. Taux réacquisition memory effect
   → Peu d'études longitudinales contrôlées (V1.2)

6. Facteurs modulation TDEE athlétique
   → Coefficients MET avec marge d'erreur 20-30% (V1.1)

7. Scoring SI estimée
   → Construit par extrapolation (V1.2)

8. Durées Recovery post-TCA
   → Très variables individuellement (V2.0)

## SECTION 5.3 — PROTOCOLE DE VERSIONNING

Version X.Y.Z :
X : majeure (paradigme, restructuration profonde)
Y : mineure (sections, seuils importants, conditions)
Z : patch (corrections, sources, calibrations)

Version courante : 1.0.0 — Mai 2026

Déclencheurs de révision :
Nouvelle méta-analyse majeure → patch ou mineure
Données utilisateurs (500+, 3+ mois) → patch calibration
Révision consensus société savante → mineure
Signalement erreur → patch correctif immédiat
Nouveau profil significatif → mineure

## SECTION 5.4 — PÉRIMÈTRE ET LIMITES

Ce Référentiel EST :
Source de vérité du moteur STRYVR
Base de décision algorithmique
Document versionnable et évolutif

Ce Référentiel N'EST PAS :
Un outil de diagnostic médical
Un guide de prescription thérapeutique
Un article scientifique peer-reviewed

Populations exclues du scope :
Mineurs (< 18 ans) — blocage absolu
Femmes enceintes — redirection médicale
Pathologies sévères non stabilisées

Mention légale obligatoire dans l'app :
"Les recommandations de cette app sont à titre informatif
et ne constituent pas un avis médical. Elles ne remplacent
pas la consultation d'un médecin, d'un diététicien ou
d'un professionnel de santé. En cas de condition médicale,
consultez votre médecin avant de modifier votre alimentation
ou votre activité physique."

## SECTION 5.5 — BIBLIOGRAPHIE COMPLÈTE

Niveau A :
Morton et al. — Protein supplementation meta-analysis (Br J Sports Med, 2018)
Stokes et al. — Dietary protein for hypertrophy (Nutrients, 2018)
Moore et al. — Protein dose response (Am J Clin Nutr, 2009)
Moore et al. — Protein older vs younger (J Gerontol, 2015)
ISSN — Protein and Exercise Position Stand (J Int Soc Sports Nutr, 2017)
Mifflin et al. — Predictive equation for REE (Am J Clin Nutr, 1990)
Hall et al. — Energy imbalance on bodyweight (Lancet, 2011)
Levine — Non-exercise activity thermogenesis (Best Pract Res, 2002)
Trexler et al. — Metabolic adaptation (J Int Soc Sports Nutr, 2014)
Burke et al. — Carbohydrates for training (J Sports Sci, 2011)
Kerksick et al. — Nutrient Timing Position Stand (J Int Soc Sports Nutr, 2017)
Hirshkowitz et al. — NSF sleep duration (Sleep Health, 2015)
Watson et al. — AASM/SRS sleep consensus (Sleep, 2015)
Drake et al. — Caffeine before sleep (J Clin Sleep Med, 2013)
Müller & Bosy-Westphal — Adaptive thermogenesis (Obesity, 2013)
Sumithran et al. — Hormonal adaptations post-weight loss (NEJM, 2011)
Bruusgaard et al. — Myonuclei not lost on detraining (PNAS, 2010)
Gundersen — Muscle memory cellular model (J Exp Biol, 2016)
DeFronzo et al. — Insulin resistance (Diabetes, 1991)
Richter & Hargreaves — Exercise GLUT4 skeletal muscle (Physiol Rev, 2013)
Spalding et al. — Fat cell turnover in humans (Nature, 2008)
MacLean et al. — Biology's response to dieting (Am J Physiol, 2011)
Doherty — Aging and sarcopenia (J Appl Physiol, 2003)
Kraemer & Ratamess — Hormonal responses to resistance (Sports Med, 2005)
Gallagher et al. — Healthy body fat ranges (Am J Clin Nutr, 2000)
Schoenfeld — Science of Muscle Hypertrophy (Human Kinetics, 2016)
Krieger — Single vs multiple sets meta-analysis (J Strength Cond Res, 2010)
Mountjoy et al. — 2023 IOC consensus on REDs (Br J Sports Med, 2023)
De Souza et al. — Female Athlete Triad Coalition (Br J Sports Med, 2014)
Loucks — Energy availability and reproduction (Exerc Sport Sci Rev, 2003)
Teede et al. — International Guideline PCOS (Fertil Steril, 2023)
Davis et al. — Menopause (Lancet, 2023)
Thomas et al. — Nutrition and athletic performance (J Acad Nutr Diet, 2016)
Meeusen et al. — Prevention overtraining syndrome (Eur J Sport Sci, 2013)
Wilding et al. — Once-weekly semaglutide NEJM 2021
Mechanick et al. — Clinical guidelines bariatric (Obesity, 2019)
NICE — Eating disorders recognition NG69 (2017)
Piepoli et al. — European cardiovascular prevention (Eur Heart J, 2016)

Niveau B :
Kouri et al. — Fat-free mass index (Clin J Sport Med, 1995)
Schutz et al. — FFMI Swiss men (Int J Obes, 2002)
Helms et al. — Natural bodybuilding contest prep (J Sports Med, 2014)
Churchward-Venne et al. — Nutritional regulation MPS (Nutr Metab, 2012)
Dirlewanger et al. — Carbohydrate overfeeding leptin (Int J Obes, 2000)
Rosenbaum et al. — Low-calorie dieting cortisol (Psychosom Med, 2010)
Camps et al. — Weight maintenance adaptive thermogenesis (Am J Clin Nutr, 2013)
Fothergill et al. — Persistent metabolic adaptation (Obesity, 2016)
Bhasin et al. — Testosterone dose-response (Am J Physiol, 2001)
Iranmanesh et al. — Age and GH secretion (J Clin Endocrinol Metab, 1991)
Hackney — Stress and neuroendocrine system (Expert Rev Endocrinol, 2006)
Dattilo et al. — Sleep and muscle recovery (Med Hypotheses, 2011)
Borghouts & Keizer — Exercise and insulin sensitivity (Int J Sports Med, 2000)
Maltais et al. — Muscle mass after menopause (J Musculoskelet, 2009)
Moran et al. — Lifestyle changes in PCOS (Cochrane, 2019)
Bikou et al. — GLP-1 body composition (Rev Endocr Metab Disord, 2024)
Jeukendrup — Periodized Nutrition Athletes (Sports Med, 2017)
Coupaye et al. — Nutritional status sleeve vs bypass (Obes Surg, 2015)
Bosquet et al. — Detraining on performance (Sports Med, 2013)
Mullur et al. — Thyroid hormone regulation (Physiol Rev, 2014)

Niveau C :
McDonald — The Women's Book Vol. 1 (Lyle McDonald Publishing, 2017)
Sims — Roar (Rodale Books, 2016)
Sims & Yeager — Next Level (Rodale Books, 2022)
Israetel et al. — Scientific Principles Strength Training (RP, 2015)
Cushman & Salans — Adipose cell size (J Lipid Res, 1978)

Niveau D :
Walker — The Hacker's Diet (Autodesk Press, 1991)

---

## CHANGELOG

V1.0.0 — Mai 2026
Création complète du Référentiel Scientifique
5 modules, 22 sections
68 références bibliographiques
8 zones d'incertitude documentées
Statut : prêt pour implémentation STRYVR V1

---

## RÉFÉRENCES CROISÉES

Ce document est utilisé par :
ARCHITECTURE.md → Stack et schéma technique
FUNCTIONAL_SPEC.md → Flux fonctionnels (8 flux)
SESSION_LOG.md → Journal de développement

Marché principal : Belgique
Marché secondaire : France
