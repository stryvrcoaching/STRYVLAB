# MorphoPro — Brief Technique Complet pour Claude Code

## 📋 Vue d'ensemble stratégique

**MorphoPro** est une solution SaaS de diagnostic et optimisation morphologique augmentée par IA, destinée aux coaches de fitness et nutrition. L'outil analyse les données déclaratives (questionnaire client) et les photos (vision computer) pour produire un rapport morphologique complet, personnalisé et visuellement riche.

### Valeur produit réelle
- Scanner morphologique professionnel avec intelligence corrective
- Recommandations plus précises qu'un coach humain isolé
- Benchmark morphologique global et apprentissage collectif
- Différenciation massive SaaS pour Stryv Lab

---

## 🎯 Contexte produit

### Ce que MorphoPro fait
1. **Analyse photos** (front/profil/dos) via vision computer
2. **Analyse données déclaratives** (questionnaire client structuré)
3. **Génère un diagnostic morphologique 360°** : posture, symétrie, composition corporelle, développement musculaire, risques biomécaniques
4. **Produit rapports visuels** : overlays annotés, heatmaps, scores, recommandations
5. **Suit l'évolution** : comparaison multi-dates, tracking progression

### Limites structurelles à respecter
- **❌ Pas de mesure biomécanique exacte** (sans DEXA/impédancemètre)
- **❌ Pas de composition corporelle précise**
- **⚠️ Estimation probabiliste uniquement**
- **✅ Analyse visuelle comparative, tendances, asymétries, proportions**

**Positionnement légal** : Outil de coaching fitness ≠ diagnostic médical

---

## 🔍 AXES D'ANALYSE MORPHOLOGIQUE (Taxonomie 360°)

### A. Anthropométrie visuelle (proportions globales)
```
Ratio épaules / taille / hanches
Largeur épaules (bi-acromial visuel)
Largeur bassin (bi-iliaque visuel)
Ratio taille-hanches (WHR estimé)
Longueur segments : jambes vs tronc, bras vs torse
Centre de masse visuel (haut vs bas du corps)
Silhouette globale (V, H, A, O, I)
```

### B. Analyse posturale (critique pour coaching)

**Vue de face**
```
Inclinaison tête (forward head)
Alignement épaules (hautes/basses/asymétriques)
Niveau bassin (tilt latéral)
Rotation apparente tronc
Axe genoux (valgus/varus)
```

**Vue latérale**
```
Courbure cervicale
Hyperlordose lombaire
Cyphose thoracique
Antéversion / rétroversion bassin
Position genoux (hyperextension/flexion permanente)
Centre de gravité (avant/arrière)
```

### C. Symétrie corporelle (asymétries fonctionnelles)
```
Épaule gauche vs droite
Pectoraux asymétriques
Bras dominant vs non-dominant
Trapèzes déséquilibrés
Bassin en rotation
Jambes dominance visuelle
Chaîne croisée (déséquilibres diagonaux)
```

### D. Composition corporelle VISUELLE (estimation)
```
Estimation % masse grasse (ranges)
Distribution graisse : abdominale, pectorale, hanches/fessiers, jambes, bras
Définition musculaire : épaules, bras, abdos, quadriceps
Soft tissue quality (densité musculaire vs relâchement)
```

### E. Profil musculaire (développement relatif)
```
Deltoïdes (antérieur/latéral/postérieur)
Pectoraux (haut/bas)
Dorsaux (largeur vs épaisseur)
Bras (biceps/triceps)
Core (transverse/obliques/droit abdominal)
Jambes (quadriceps/ischios/mollets)
Chaînes faibles probables
```

### F. Alignement articulaire & risques mécaniques
```
Position épaules (protraction/rétraction)
Rotation humérale
Alignement genoux/chevilles
Pieds (pronation/supination indirecte)
Stabilité bassin/lombaires
Indices de surcharge structurelle
```

### G. Morphotype fonctionnel (classification coaching)
```
Endomorphe / ectomorphe / mésomorphe (version modernisée)
Fat storage pattern
Muscle gain pattern
Réactivité aux charges (estimée via structure)
Potentiel hypertrophie zones prioritaires
```

### H. Analyse dynamique (séries de photos dans le temps)
```
Variation masse grasse estimée
Gain musculaire localisé
Correction posture (delta angles)
Symétrie améliorée ou non
Transformation morphotype
Score de progression global
```

---

## 📊 SYSTÈME DE SCORING

Chaque axe d'analyse doit produire :
- **Score 0–100**
- **Niveau** : faible / moyen / élevé / critique
- **Priorité coaching** : P1 / P2 / P3
- **Impact performance** : faible / moyen / fort

**Exemple** : "Déséquilibre scapulaire : 72/100 (P1 – impact fort sur force push/pull)"

---

## 📥 INPUT PHOTO — SCHEMA STRICT (indispensable MVP)

### Format obligatoire JSON
```json
{
  "user_id": "string",
  "photos": {
    "front": "image_url",
    "side": "image_url",
    "back": "image_url"
  },
  "conditions": {
    "lighting": "neutral | poor | good",
    "posture": "relaxed | coached_standard",
    "clothing": "tight | loose | mixed",
    "distance": "standardized | unknown"
  }
}
```

### Règles de capture (bloquantes)
⚠️ Si non respectées → **score de fiabilité réduit**

```
✓ Caméra à hauteur du nombril
✓ Distance fixe (ex: 2.5m recommandé)
✓ Position neutre (pas de contraction)
✓ Pieds largeur épaules
✓ Lumière frontale homogène
✓ Tenue moulante obligatoire
```

### Score de qualité image (QA system)
Chaque photo reçoit un score 0–100 :
```
Angle correct : 0–25
Lumière exploitable : 0–25
Posture neutre : 0–25
Visibilité segments corporels : 0–25
```

**Rule** : Si score < 60 → analyse morpho dégradée

---

## 📋 INPUT QUESTIONNAIRE CLIENT — STRUCTURE JSON

### A. Données anthropo déclaratives
```json
{
  "age": 0,
  "sex": "male | female",
  "height_cm": 0,
  "weight_kg": 0
}
```

### B. Objectifs coaching
```json
{
  "goal": "fat_loss | muscle_gain | recomposition | performance",
  "priority_zone": ["upper_body", "lower_body", "core"],
  "timeline_weeks": 0
}
```

### C. Historique physique
```json
{
  "training_experience": "beginner | intermediate | advanced",
  "injuries": ["shoulder", "knee", "lower_back"],
  "limitations": ["mobility", "pain", "posture"]
}
```

### D. Style de vie (impact morphologie réel)
```json
{
  "activity_level": "sedentary | active | very_active",
  "job_type": "desk | manual | mixed",
  "sleep_hours": 0,
  "stress_level": "low | medium | high"
}
```

### E. Nutrition (optionnel mais puissant)
```json
{
  "diet_type": "omnivore | vegetarian | unknown",
  "protein_intake_estimate": "low | medium | high",
  "consistency": "low | medium | high"
}
```

---

## 📤 OUTPUT ATTENDU DU PIPELINE IA

```json
{
  "morphology_score": "0-100",
  "posture_analysis": {},
  "symmetry_analysis": {},
  "body_composition_estimate": {},
  "muscle_development_map": {},
  "risk_flags": [],
  "priority_actions": [],
  "visual_overlays": [],
  "progression_baseline": {}
}
```

---

## 🏗️ ARCHITECTURE TECHNIQUE (3 COUCHES SÉPARÉES)

### Couche 1 — Ingestion & normalisation

**Objectif** : Rendre les inputs exploitables et standardisés

**Étapes**
1. **Photo validation**
   - Vérifier format image (JPG/PNG)
   - Valider QA score (voir section photos)
   - Accepter/rejeter avec feedback utilisateur

2. **Questionnaire validation**
   - Vérifier schéma JSON
   - Valider ranges (âge, poids, height)
   - Détecter incohérences logiques

3. **Normalisation**
   - Standardiser format métadonnées
   - Créer user baseline record
   - Générer hash input pour versioning

---

### Couche 2 — Vision Computer + Règles Biomécaniques

**Objectif** : Extraire données structurées des photos

#### Option A : MVP rapide (recommandé Phase 1)
- **CV classique** + règles biomécaniques codées
- Detectron2 ou Mediapipe Pose
- Règles custom pour chaque axe d'analyse
- Scoring déterministe basé règles

**Avantages** : Rapide, explicable, contrôlable
**Inconvénients** : Non-scalable, requis maintenance

#### Option B : Vision embedding + LLM (Phase 2+)
- Modèle vision encodant (CLIP, foundation models)
- Embeddings photo + questionnaire
- LLM analyse embeddings + contexte
- Scoring probabiliste

**Avantages** : Scalable, amélioration continue
**Inconvénients** : Coûteux, moins explicable

---

### Couche 3 — Scoring & Rapport

**Objectif** : Synthétiser données en décisions coaching

1. **Scoring moteur**
   - Chaque axe → score 0–100 + priorité
   - Agrégation en scores secondaires
   - Score global morphologie

2. **Risk assessment**
   - Détecter patterns risques biomécaniques
   - Severity flagging (warning/critical)
   - Recommandations prévention

3. **Coaching recommendation engine**
   - Parser axes critiques
   - Proposer exercices correctifs
   - Prioriser P1 → P2 → P3
   - Intégration avec Lab Protocol Canvas (Stryv Lab)

4. **Report generation**
   - Silhouette annotée (overlay)
   - Heatmap déséquilibres
   - Graph morphotype
   - Score global + Top 5 priorités
   - Plan correctif automatique

---

## 🎨 SORTIE ATTENDUE DU PRODUIT

### Rapport final doit contenir

```
1. Silhouette annotée (overlay)
2. Heatmap déséquilibres
3. Graph morphotype
4. Score global morphologie
5. Top 5 priorités coaching (P1/P2/P3)
6. Plan correctif automatique (training bias)
7. Evolution comparée (timeline) — pour follow-ups
```

### Format rapport
- **HTML responsive** (coach peut consulter sur mobile)
- **PDF export** (client peut imprimer/archiver)
- **JSON API** (intégration Stryv Lab)

---

## 🔄 PROGRESSION ENGINE (Suivi Evolution)

### Baseline (première analyse)
```json
{
  "analysis_date": "2024-04-23",
  "morphology_score": 65,
  "posture_score": 58,
  "symmetry_score": 72,
  "composition_estimate": {"fat_percentage": 22, "distribution": {...}},
  "priority_flags": [...]
}
```

### Follow-up analysis (2–4 semaines plus tard)
```json
{
  "baseline_id": "...",
  "analysis_date": "2024-05-07",
  "morphology_score": 68,
  "delta_morphology": +3,
  "deltas_by_axis": {
    "posture": +5,
    "symmetry": +2,
    "composition": {...},
  },
  "progress_velocity": "moderate",
  "corrected_areas": ["posture_cervicale", "shoulder_alignment"],
  "persistent_issues": ["fat_distribution_abdomen"],
  "plateau_detected": false
}
```

### Timeline comparative
- **Visual comparison** : before/after split-screen
- **Graph progression** : morpho_score over time
- **Trend analysis** : exponentielle, linéaire, stagnation, régression
- **AI insight** : "correction efficace, maintenir exercice X" ou "plateau atteint, varier stimulus"

---

## 🤖 LEARNING SYSTEM (Feedback Loop)

### Hypothèse de départ
L'IA devient meilleure avec usage réel

### Mécanisme feedback
1. **Coach validation**
   - Coach valide recommandation : "j'ai appliqué exercice X, client a progressé" (thumbs up)
   - Coach rejette : "exercice X trop difficile/inefficace" (thumbs down)

2. **Collecting signal**
   ```json
   {
     "recommendation_id": "rec_12345",
     "coach_feedback": "effective | ineffective | not_applied",
     "outcome_data": {
       "applied_weeks": 3,
       "client_compliance": 0.85,
       "morpho_delta": +2.5,
       "qualitative_note": "client liked the exercise, easy to implement"
     }
   }
   ```

3. **Learning loop**
   - Agréger signals par exercice + profil client
   - Retrainer scoring moteur
   - Update recommendation priorités

### Safeguards légaux/éthiques
- **Anonymisation** : pas d'ID client dans dataset learning
- **Normalisation** : normaliser décisions par coach (pour ne pas amplifier biais individuels)
- **Audit trail** : logger tous outputs pour retraceability

---

## 📊 SYSTÈME DE KPIs (Pilotage Business)

### A. KPIs MORPHOLOGIQUES (core produit)

#### 1. Morphological Improvement Rate (MIR)
```
MIR = average(GLOBAL_SCORE_delta per client per cycle)
```
**Mesure** : vitesse de transformation réelle

#### 2. Posture Correction Index (PCI)
```
PCI = average(posture_score_improvement)
```
**Mesure** : efficacité correction structurelle

#### 3. Symmetry Improvement Index (SII)
- Amélioration asymétrie moyenne
- Gauche/droite convergence

#### 4. Risk Reduction Index (RRI)
- Diminution flags biomécaniques critiques

---

### B. KPIs EXERCICES (learning system)

#### 1. Exercise Effectiveness Score (EES)
```
EES(exercise) = mean(morpho_delta / usage_frequency)
```
**Mesure réelle** : performance de l'exercice

#### 2. Correction Efficiency Ratio (CER)
```
CER = morpho_improvement / training_volume
```
**Mesure** : efficacité du stimulus

#### 3. Exercise Retention Value (ERV)
- Combien de temps un exercice reste utile dans progression client

---

### C. KPIs CLIENT (produit / UX / coaching)

#### 1. Client Progress Velocity (CPV)
```
CPV = slope(GLOBAL_SCORE over time)
```

#### 2. Compliance Rate
- % exercices réellement effectués

#### 3. Program Adherence Stability
- Régularité semaine à semaine

#### 4. Plateau Detection Rate
- Fréquence stagnation morphologique

---

### D. KPIs PLATFORM (SaaS business)

#### 1. Activation Rate MorphoPro
- % bilans → analyse morpho lancée

#### 2. Analysis Completion Rate
- % analyses terminées sans abandon

#### 3. Coach Retention Rate
- Usage continu par coach

#### 4. Report Consumption Rate
- Ouverture + lecture complète rapports

#### 5. Time-to-Insight
```
time from upload → actionable report
```
**KPI critique UX**

---

### E. KPIs IA / MODEL QUALITY

#### 1. Prediction Accuracy Proxy
- Cohérence prédiction → résultat réel morphologique

#### 2. Model Drift Index
- Divergence performance modèle dans le temps

#### 3. Cross-Population Stability
- Stabilité scores entre profils différents

---

### F. DASHBOARD GLOBAL MORPHOPRO

**Vue système** :
```
1. Health Morpho Index (global population)
   → moyenne amélioration globale

2. Exercise Leaderboard
   → top exercices les plus efficaces

3. Problem Heatmap
   → problèmes morphologiques les plus fréquents

4. Coach Performance Distribution
   → efficacité moyenne des coachs utilisant plateforme
```

### MÉTRIQUE CRITIQUE (Key North Star)
```
Morphological Transformation Efficiency (MTE)
MTE = total_morpho_improvement / total_training_load
```

**Risques si mal mesuré**
- ❌ Optimisation UX sans résultat réel → produit "joli mais inutile"
- ❌ Optimisation exercice sans outcome morphologique → dérive fitness classique
- ❌ Absence tracking longitudinal → perte de rétention

---

## 💰 STRATÉGIE MONÉTISATION & PACKAGING PRODUIT

### Contrainte stratégique
Produit techniquement très riche mais potentiellement illisible commercialement
**→ Règle** : simplifier l'offre sans simplifier le moteur

---

### STRUCTURE PRODUIT (3 NIVEAUX)

#### A. CORE PRODUCT (MorphoPro Engine) — Invisible pour le client
```
CV pipeline
Scoring morphologique
Overlays
Progression engine
Feedback loop
Dataset global learning
```

#### B. PRODUIT VISIBLE (UX coach) — 3 modules

**1. Diagnostic Morphologique**
- Analyse instantanée
- Score global
- Overlays

**2. Suivi Progression**
- Before/after
- Timeline
- Évolution scores

**3. Plan Coaching Automatisé**
- Exercices recommandés
- Priorisation P1/P2/P3
- Progression adaptative

#### C. LAYER PREMIUM (AI Intelligence)
```
Benchmarking populationnel
Optimisation automatique programmes
Insights avancés (plateau, efficacité exercices)
Recommandations dynamiques
```

---

### PACKAGING OFFRES (SaaS)

#### 1. STARTER (coach individuel)
**Cible** : Coaches indépendants

**Inclus**
- X analyses / mois
- Rapports standard
- Overlays basiques
- Progression simple

**Limites**
- Pas de dataset global avancé
- Pas d'insights IA avancés

---

#### 2. PRO (studio / coach actif)
**Cible** : Coaches structurés

**Inclus**
- Analyses illimitées ou large quota
- Feedback loop complet
- Progression adaptative
- Bibliothèque exercices intelligente
- Comparaison multi-clients

---

#### 3. ELITE (data-driven coaching system)
**Cible** : Équipes, business, organisations

**Inclus**
- Dataset global learning
- Insights populationnels
- Optimisation automatique exercices
- Benchmarking clients
- API access possible

---

### STRUCTURE DE PRICING LOGIQUE

**Modèle recommandé**

1. **Abonnement de base**
   - Accès plateforme
   
2. **Pricing variable** basé sur :
   - Nombre d'analyses MorphoPro
   - OU nombre de clients actifs

**Logique économique**
```
Revenue = base_subscription + (analysis_volume × unit_cost)
```

---

### UNIT ECONOMICS (CRITIQUE)

**Coûts principaux**
```
CV processing : faible/modéré
LLM analysis : principal coût variable
Storage images : faible
```

**Levier business**
→ Chaque analyse doit être :
- Optimisée coût
- Facturée valeur perçue élevée

---

### VALUE PERCEPTION (TRÈS IMPORTANT)

Tu ne vends pas : **un rapport**

Tu vends : **"scanner morphologique professionnel + intelligence corrective"**

---

### STRATÉGIE D'UPSELL NATUREL

**Déclencheurs**
```
Nouveau client ajouté → upgrade plan
Suivi longitudinal → besoin Pro
Insights populationnels → Elite
```

---

### RISQUES BUSINESS

```
❌ Pricing trop technique
   → incompréhensible pour coach

❌ Sous-évaluation analyse IA
   → marge détruite

❌ Trop de plans
   → confusion
```

---

## 🎬 POSITIONNEMENT FINAL

### Ce que tu construis

**NOT** : un outil de diagnostic
**NOT** : un tracker fitness
**NOT** : une app de coaching

### **YES** : Un système d'intelligence morphologique collective auto-apprenante basé sur données biomécaniques réelles

---

## 🚀 PROCHAINES ÉTAPES D'IMPLÉMENTATION

### Phase 1 (MVP — 6–8 semaines)
```
1. Photo validation engine + QA scoring
2. Questionnaire schema + API endpoint
3. CV pipeline basique (Mediapipe + règles)
4. Scoring moteur (posture + symétrie + composition)
5. Rapport HTML simple
6. Integration Stryv Lab (API)
```

### Phase 2 (Progression + Learning — 4–6 semaines)
```
1. Baseline + follow-up timeline logic
2. Coach feedback collection system
3. Learning loop (exercice feedback → ranking)
4. Dashboard KPIs premier niveau
5. Plateau detection
```

### Phase 3 (Premium Intelligence — 8–10 semaines)
```
1. Vision embedding model (CLIP ou fondation model)
2. LLM analysis layer (Claude API / GPT)
3. Benchmarking populationnel
4. Insights avancés + anomaly detection
5. Dashboard complet
6. API premium tier
```

---

## 📚 ANNEXE : HYPOTHÈSES CRITIQUES À VALIDER

### H1 — Standardisation des photos
**Impact** : Si non imposée → analyse inutilisable

→ **Action** : Règles de capture strictes + QA score < 60 = rejet ou dégradation

---

### H2 — Modèle IA
**Deux options**
- CV classique + règles biomécaniques (MVP rapide)
- Modèle vision + embeddings (scalable mais coûteux)

→ **Action** : Commencer Option A, prévoir migration Option B

---

### H3 — Niveau de précision attendu
**Contrainte légale** : Coaching fitness ≠ diagnostic médical

→ **Action** : Disclaimer légal clair, focus sur recommandations coaching, pas diagnostic

---

### H4 — Intégration Stryv Lab
**Lien critique** : MorphoPro → Protocol Canvas recommendations

→ **Action** : API contract définir avec Lab team

---

## 📞 Contacts & Governance

- **Product Owner** : Coach Kev
- **Architecture** : Claude (Design + Code)
- **Testing** : Real coaches + clients MorphoPro beta

---

**Document généré** : 2026-04-23
**Statut** : Brief complet prêt pour implémentation Claude Code
**Audience** : Développeurs, Architects, Product Team
