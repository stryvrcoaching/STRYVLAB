import { AssessmentModule, BlockConfig, FieldConfig } from '@/types/assessment'

// ------------------------------------------------------------------
// Labels et icônes des modules
// ------------------------------------------------------------------

export const MODULE_LABELS: Record<AssessmentModule, string> = {
  general:      'Informations générales',
  biometrics:   'Biométrie & Composition',
  measurements: 'Mensurations',
  photos:       'Photos',
  nutrition:    'Nutrition',
  training:     'Entraînement',
  cardio:       'Cardio & Activité',
  wellness:     'Bien-être & Récupération',
  goals:        'Objectifs',
  medical:      'Santé & Médical',
  lifestyle:    'Lifestyle',
  performance:  'Performance & Force',
  psychology:   'Psychologie & Motivation',
}

export const MODULE_ICONS: Record<AssessmentModule, string> = {
  general:      'User',
  biometrics:   'Scale',
  measurements: 'Ruler',
  photos:       'Camera',
  nutrition:    'Utensils',
  training:     'Dumbbell',
  cardio:       'Heart',
  wellness:     'Moon',
  goals:        'Target',
  medical:      'Shield',
  lifestyle:    'Coffee',
  performance:  'Trophy',
  psychology:   'Brain',
}

export const MODULE_DESCRIPTIONS: Record<AssessmentModule, string> = {
  general:      'Taille, âge, sexe, chronotype, niveau d\'expérience, occupation',
  biometrics:   'Poids, composition corporelle, plis cutanés, tours principaux',
  measurements: 'Circonférences segmentaires (bras, cuisses, mollets…)',
  photos:       'Photos de progression (avant, arrière, profil)',
  nutrition:    'Alimentation, macros, hydratation, comportements alimentaires',
  training:     'Fréquence, volume, types de séances, style préféré, RPE',
  cardio:       'Activité non-sportive (pas/NEAT), cardio dédié, VO2max, FC',
  wellness:     'Sommeil, stress, énergie, récupération, caféine',
  goals:        'Objectifs, délais, motivations, contraintes',
  medical:      'Bilan sanguin, tension artérielle, blessures, pathologies, traitements',
  lifestyle:    'Alcool, tabac, écrans, situation de vie, budget alimentaire',
  performance:  'Records personnels (squat, bench, deadlift…), tests fonctionnels',
  psychology:   'Rapport au corps, historique de régimes, stade de motivation, relation au coaching',
}

// ------------------------------------------------------------------
// MODULE : Informations générales
// ------------------------------------------------------------------
const GENERAL_FIELDS: FieldConfig[] = [
  {
    key: 'birth_date',
    label: 'Date de naissance',
    input_type: 'date',
    required: false,
    visible: true,
    helper: 'Utilisé pour calculer l\'âge et adapter les recommandations',
  },
  {
    key: 'gender',
    label: 'Sexe',
    input_type: 'single_choice',
    required: false,
    visible: true,
    options: ['Homme', 'Femme', 'Non-binaire / autre'],
  },
  {
    key: 'height_cm',
    label: 'Taille',
    input_type: 'number',
    unit: 'cm',
    required: true,
    visible: true,
    min: 100,
    max: 230,
    step: 0.5,
    helper: 'Donnée stable — à renseigner une seule fois',
  },
  {
    key: 'occupation',
    label: 'Profession / activité quotidienne',
    input_type: 'single_choice',
    required: false,
    visible: true,
    options: ['Sédentaire (bureau)', 'Légèrement actif', 'Modérément actif', 'Très actif (travail physique)'],
    helper: 'Niveau d\'activité quotidienne hors sport — influence le TDEE',
  },
  {
    key: 'chronotype',
    label: 'Chronotype',
    input_type: 'single_choice',
    required: false,
    visible: true,
    options: ['Matinal (lève-tôt)', 'Neutre / intermédiaire', 'Tardif (couche-tard)'],
    helper: 'Influence l\'heure idéale d\'entraînement et le pic de cortisol',
  },
  {
    key: 'living_situation',
    label: 'Situation de vie',
    input_type: 'single_choice',
    required: false,
    visible: false,
    options: ['Seul(e)', 'En couple sans enfants', 'Famille avec enfants', 'Colocation', 'Autre'],
    helper: 'Impact sur la disponibilité horaire et la compliance',
  },
  {
    key: 'coaching_start_date',
    label: 'Date de début du suivi',
    input_type: 'date',
    required: false,
    visible: true,
  },
  {
    key: 'experience_level',
    label: 'Niveau d\'expérience sportive',
    input_type: 'single_choice',
    required: false,
    visible: true,
    options: ['Débutant (< 1 an)', 'Intermédiaire (1–3 ans)', 'Avancé (3–5 ans)', 'Expert (5+ ans)'],
  },
]

// ------------------------------------------------------------------
// MODULE : Biométrie & Composition corporelle
// ------------------------------------------------------------------
const BIOMETRICS_FIELDS: FieldConfig[] = [
  // — Poids —
  {
    key: 'weight_kg',
    label: 'Poids',
    input_type: 'number',
    unit: 'kg',
    required: true,
    visible: true,
    min: 30,
    max: 300,
    step: 0.1,
    helper: 'À jeun, le matin de préférence',
  },
  // — Méthode de mesure (en premier pour débloquer les champs conditionnels) —
  {
    key: 'measurement_method',
    label: 'Méthode de mesure',
    input_type: 'multiple_choice',
    required: false,
    visible: true,
    options: ['Balance à impédance', 'DEXA', 'Plis cutanés', 'Méthode Navy', 'Autre'],
    helper: 'Sélectionnez toutes les méthodes dont vous disposez. Les champs correspondants s\'afficheront ensuite.',
  },
  // — Composition corporelle (conditionnelle sur la méthode) —
  {
    key: 'body_fat_pct',
    label: '% Masse grasse',
    input_type: 'number',
    unit: '%',
    required: false,
    visible: true,
    min: 3,
    max: 60,
    step: 0.1,
    helper: 'Pourcentage de masse grasse fourni par votre appareil. Prioritaire sur la Masse grasse (kg) si les deux sont renseignés.',
    show_if: { field_key: 'measurement_method', operator: 'not_empty' },
  },
  {
    key: 'fat_mass_kg',
    label: 'Masse grasse',
    input_type: 'number',
    unit: 'kg',
    required: false,
    visible: false,
    min: 1,
    max: 150,
    step: 0.1,
    helper: 'Si fourni directement par l\'appareil',
    show_if: { field_key: 'measurement_method', operator: 'not_empty' },
  },
  {
    key: 'lean_mass_kg',
    label: 'Masse maigre',
    input_type: 'number',
    unit: 'kg',
    required: false,
    visible: false,
    min: 20,
    max: 150,
    step: 0.1,
    helper: 'Poids total – masse grasse (muscles + os + eau + organes). Différent de la masse musculaire squelettique.',
    show_if: { field_key: 'measurement_method', operator: 'not_empty' },
  },
  {
    key: 'muscle_mass_kg',
    label: 'Masse musculaire',
    input_type: 'number',
    unit: 'kg',
    required: false,
    visible: true,
    min: 10,
    max: 120,
    step: 0.1,
    helper: 'Masse totale de tous les types de muscles. Fourni directement par la balance à impédance, InBody ou DEXA.',
    show_if: { field_key: 'measurement_method', operator: 'not_empty' },
  },
  {
    key: 'muscle_mass_pct',
    label: 'Masse musculaire (%)',
    input_type: 'number',
    unit: '%',
    required: false,
    visible: true,
    min: 5,
    max: 70,
    step: 0.1,
    helper: 'Pourcentage de masse musculaire totale. Fourni directement par la balance à impédance.',
    show_if: { field_key: 'measurement_method', operator: 'not_empty' },
  },
  {
    key: 'skeletal_muscle_pct',
    label: 'Masse musculaire squelettique (%)',
    input_type: 'number',
    unit: '%',
    required: false,
    visible: true,
    min: 5,
    max: 60,
    step: 0.1,
    helper: 'Muscles contractiles attachés au squelette uniquement (sous-ensemble de la masse musculaire totale). Fourni par InBody, DEXA ou certaines Tanita.',
    show_if: { field_key: 'measurement_method', operator: 'not_empty' },
  },
  {
    key: 'visceral_fat_level',
    label: 'Graisse viscérale',
    input_type: 'number',
    unit: 'niveau',
    required: false,
    visible: false,
    min: 1,
    max: 30,
    step: 1,
    helper: 'Lu sur balance à impédance (1–30, idéal < 12)',
    show_if: { field_key: 'measurement_method', operator: 'includes', value: 'Balance à impédance' },
  },
  {
    key: 'body_water_pct',
    label: 'Eau corporelle totale',
    input_type: 'number',
    unit: '%',
    required: false,
    visible: false,
    min: 30,
    max: 75,
    step: 0.1,
    show_if: { field_key: 'measurement_method', operator: 'includes', value: 'Balance à impédance' },
  },
  {
    key: 'bone_mass_kg',
    label: 'Masse osseuse',
    input_type: 'number',
    unit: 'kg',
    required: false,
    visible: false,
    min: 1,
    max: 10,
    step: 0.1,
    show_if: { field_key: 'measurement_method', operator: 'not_empty' },
  },
  {
    key: 'metabolic_age',
    label: 'Âge métabolique',
    input_type: 'number',
    unit: 'ans',
    required: false,
    visible: false,
    min: 10,
    max: 90,
    step: 1,
    helper: 'Valeur fournie directement par votre balance impédancemétrique (Tanita, InBody, Withings…). Si non disponible, une estimation sera calculée automatiquement.',
    show_if: { field_key: 'measurement_method', operator: 'includes', value: 'Balance à impédance' },
  },
  {
    key: 'bmr_kcal_measured',
    label: 'BMR mesuré',
    input_type: 'number',
    unit: 'kcal',
    required: false,
    visible: false,
    min: 800,
    max: 4000,
    step: 1,
    helper: 'Métabolisme de base lu directement sur la balance impédancemétrique (Tanita, InBody, Withings…). Utilisé à la place des formules estimatives dans le calculateur de macros.',
    show_if: { field_key: 'measurement_method', operator: 'includes', value: 'Balance à impédance' },
  },
]

// ------------------------------------------------------------------
// MODULE : Mensurations
// Circonférences segmentaires + tours corporels + frame size.
// ------------------------------------------------------------------
const MEASUREMENTS_FIELDS: FieldConfig[] = [
  {
    key: 'waist_cm',
    label: 'Tour de taille',
    input_type: 'number',
    unit: 'cm',
    required: false,
    visible: true,
    min: 40,
    max: 180,
    step: 0.5,
    helper: `📏 Comment mesurer — Tour de taille

• Endroit exact : au niveau du nombril, entre le bas des côtes et le haut des hanches
• Position : debout, pieds joints, abdomen détendu (ne pas rentrer le ventre)
• Mètre : posé à plat sur la peau, non serré — glisser un doigt sous le mètre pour vérifier
• Moment : à jeun le matin, après être allé aux toilettes
• Respiration : mesurer en expiration normale, pas en apnée`,
  },
  {
    key: 'hips_cm',
    label: 'Tour de hanches',
    input_type: 'number',
    unit: 'cm',
    required: false,
    visible: true,
    min: 50,
    max: 180,
    step: 0.5,
    helper: `📏 Comment mesurer — Tour de hanches

• Endroit exact : à la saillie maximale des fessiers — généralement 18 à 22 cm sous le nombril
• Position : debout, pieds joints, jambes légèrement décontractées
• Mètre : horizontal, parallèle au sol sur tout le tour
• Moment : le matin, mêmes conditions que les autres mesures`,
  },
  {
    key: 'waist_hip_ratio',
    label: 'Ratio taille/hanches',
    input_type: 'number',
    unit: '',
    required: false,
    visible: false,
    min: 0.5,
    max: 1.5,
    step: 0.01,
    helper: 'Calculé automatiquement depuis tour de taille ÷ tour de hanches — indicateur de risque métabolique (idéal < 0,85 chez la femme, < 0,90 chez l\'homme)',
  },
  {
    key: 'chest_cm',
    label: 'Tour de poitrine',
    input_type: 'number',
    unit: 'cm',
    required: false,
    visible: true,
    min: 50,
    max: 160,
    step: 0.5,
    helper: `📏 Comment mesurer — Tour de poitrine

• Endroit exact : au niveau des mamelons, à la saillie maximale du torse
• Position : debout, bras légèrement écartés le temps de passer le mètre, puis ramenés le long du corps
• Mètre : horizontal, dans le dos et sur la poitrine au même niveau
• Moment : expiration normale, torse décontracté`,
  },
  {
    key: 'arm_cm',
    label: 'Tour de bras (dominant, détendu)',
    input_type: 'number',
    unit: 'cm',
    required: false,
    visible: true,
    min: 15,
    max: 70,
    step: 0.5,
    helper: `📏 Comment mesurer — Tour de bras

• Endroit exact : à mi-distance entre l'épaule (acromion) et le coude (olécrâne) — le point le plus large du bras
• Position : bras pendant le long du corps, complètement détendu — ne pas contracter
• Bras à mesurer : bras dominant (droitier → bras droit, gaucher → bras gauche)
• Mètre : posé sans serrer, perpendiculaire à l'axe du bras`,
  },
  {
    key: 'thigh_cm',
    label: 'Tour de cuisse (dominant, debout)',
    input_type: 'number',
    unit: 'cm',
    required: false,
    visible: true,
    min: 30,
    max: 100,
    step: 0.5,
    helper: `📏 Comment mesurer — Tour de cuisse

• Endroit exact : à mi-hauteur entre le pli de l'aine et le dessus de la rotule
• Position : debout, poids réparti sur les deux jambes, cuisse légèrement décontractée
• Jambe à mesurer : jambe dominante
• Mètre : horizontal, sans pincer ni comprimer les tissus`,
  },
  {
    key: 'calf_cm',
    label: 'Tour de mollet (dominant, maxi)',
    input_type: 'number',
    unit: 'cm',
    required: false,
    visible: true,
    min: 20,
    max: 60,
    step: 0.5,
    helper: `📏 Comment mesurer — Tour de mollet

• Endroit exact : à la circonférence maximale du mollet — généralement au tiers supérieur
• Position : debout, pieds à plat, mollet détendu (ne pas se mettre sur la pointe des pieds)
• Jambe à mesurer : jambe dominante
• Mètre : horizontal, au point le plus large`,
  },
  {
    key: 'arm_right_cm',
    label: 'Bras droit (détendu)',
    input_type: 'number',
    unit: 'cm',
    required: false,
    visible: false,
    min: 15,
    max: 70,
    step: 0.5,
    helper: `📏 Comment mesurer — Tour de bras droit détendu

• Endroit exact : à mi-distance entre l'épaule (acromion) et le coude
• Position : bras pendant le long du corps, complètement détendu
• Mètre : perpendiculaire à l'axe du bras, sans serrer`,
  },
  {
    key: 'arm_left_cm',
    label: 'Bras gauche (détendu)',
    input_type: 'number',
    unit: 'cm',
    required: false,
    visible: false,
    min: 15,
    max: 70,
    step: 0.5,
    helper: `📏 Comment mesurer — Tour de bras gauche détendu

• Endroit exact : à mi-distance entre l'épaule (acromion) et le coude
• Position : bras pendant le long du corps, complètement détendu
• Mètre : perpendiculaire à l'axe du bras, sans serrer`,
  },
  {
    key: 'arm_right_contracted_cm',
    label: 'Bras droit (contracté)',
    input_type: 'number',
    unit: 'cm',
    required: false,
    visible: false,
    min: 15,
    max: 70,
    step: 0.5,
    helper: `📏 Comment mesurer — Bras droit contracté

• Endroit exact : à mi-distance entre l'épaule et le coude, à la pointe du biceps
• Position : bras levé à l'horizontale, coude fléchi à 90°, biceps contracté au maximum
• Mètre : autour du point le plus saillant du biceps, sans écraser le muscle`,
  },
  {
    key: 'arm_left_contracted_cm',
    label: 'Bras gauche (contracté)',
    input_type: 'number',
    unit: 'cm',
    required: false,
    visible: false,
    min: 15,
    max: 70,
    step: 0.5,
    helper: `📏 Comment mesurer — Bras gauche contracté

• Endroit exact : à mi-distance entre l'épaule et le coude, à la pointe du biceps
• Position : bras levé à l'horizontale, coude fléchi à 90°, biceps contracté au maximum
• Mètre : autour du point le plus saillant du biceps, sans écraser le muscle`,
  },
  {
    key: 'forearm_right_cm',
    label: 'Avant-bras droit',
    input_type: 'number',
    unit: 'cm',
    required: false,
    visible: false,
    min: 10,
    max: 45,
    step: 0.5,
    helper: `📏 Comment mesurer — Avant-bras droit

• Endroit exact : à la circumférence maximale de l'avant-bras, juste sous le coude
• Position : bras tendu, main ouverte et détendue, paume vers le haut
• Mètre : horizontal, au point le plus large`,
  },
  {
    key: 'forearm_left_cm',
    label: 'Avant-bras gauche',
    input_type: 'number',
    unit: 'cm',
    required: false,
    visible: false,
    min: 10,
    max: 45,
    step: 0.5,
    helper: `📏 Comment mesurer — Avant-bras gauche

• Endroit exact : à la circumférence maximale de l'avant-bras, juste sous le coude
• Position : bras tendu, main ouverte et détendue, paume vers le haut
• Mètre : horizontal, au point le plus large`,
  },
  {
    key: 'thigh_right_cm',
    label: 'Cuisse droite',
    input_type: 'number',
    unit: 'cm',
    required: false,
    visible: true,
    min: 30,
    max: 100,
    step: 0.5,
    helper: `📏 Comment mesurer — Cuisse droite

• Endroit exact : à mi-hauteur entre le pli de l'aine et le dessus de la rotule
• Position : debout, poids réparti sur les deux jambes, cuisse légèrement décontractée
• Mètre : horizontal, sans pincer ni comprimer les tissus`,
  },
  {
    key: 'thigh_left_cm',
    label: 'Cuisse gauche',
    input_type: 'number',
    unit: 'cm',
    required: false,
    visible: false,
    min: 30,
    max: 100,
    step: 0.5,
    helper: `📏 Comment mesurer — Cuisse gauche

• Endroit exact : à mi-hauteur entre le pli de l'aine et le dessus de la rotule
• Position : debout, poids réparti sur les deux jambes, cuisse légèrement décontractée
• Mètre : horizontal, sans pincer ni comprimer les tissus`,
  },
  {
    key: 'calf_right_cm',
    label: 'Mollet droit',
    input_type: 'number',
    unit: 'cm',
    required: false,
    visible: false,
    min: 20,
    max: 60,
    step: 0.5,
    helper: `📏 Comment mesurer — Mollet droit

• Endroit exact : à la circonférence maximale du mollet droit
• Position : debout, pieds à plat, mollet détendu (pas sur la pointe des pieds)
• Mètre : horizontal, au point le plus large`,
  },
  {
    key: 'calf_left_cm',
    label: 'Mollet gauche',
    input_type: 'number',
    unit: 'cm',
    required: false,
    visible: false,
    min: 20,
    max: 60,
    step: 0.5,
    helper: `📏 Comment mesurer — Mollet gauche

• Endroit exact : à la circonférence maximale du mollet gauche
• Position : debout, pieds à plat, mollet détendu (pas sur la pointe des pieds)
• Mètre : horizontal, au point le plus large`,
  },
  {
    key: 'shoulder_circumference_cm',
    label: 'Tour d\'épaules',
    input_type: 'number',
    unit: 'cm',
    required: false,
    visible: false,
    min: 80,
    max: 160,
    step: 0.5,
    helper: `📏 Comment mesurer — Tour d'épaules

• Endroit exact : autour des épaules au niveau des deltoïdes, en passant sur les pointes des deux épaules
• Position : debout, bras le long du corps, épaules décontractées (ne pas les remonter)
• Mètre : horizontal, passant sur les deux acromions (pointes des épaules) et dans le dos
• Note : différent de la "largeur d'épaules" os-à-os — ici c'est la circonférence`,
  },
  {
    key: 'neck_cm',
    label: 'Tour de cou',
    input_type: 'number',
    unit: 'cm',
    required: false,
    visible: false,
    min: 20,
    max: 60,
    step: 0.5,
    helper: `📏 Comment mesurer — Tour de cou (utilisé pour la méthode Navy)

• Endroit exact : juste en dessous de la pomme d'Adam (larynx), au point le plus étroit
• Position : tête droite, regard à l'horizon, cou détendu
• Mètre : horizontal, sans serrer — glisser un doigt pour vérifier l'espace`,
  },
  {
    key: 'wrist_cm',
    label: 'Tour de poignet',
    input_type: 'number',
    unit: 'cm',
    required: false,
    visible: false,
    min: 10,
    max: 25,
    step: 0.5,
    helper: `📏 Comment mesurer — Tour de poignet (utilisé pour estimer la frame size / ossature)

• Endroit exact : autour du poignet dominant, juste en dessous de l'os du poignet (styloïde)
• Position : bras tendu, main ouverte, paume vers le bas
• Mètre : ajusté sans serrer — poignet détendu`,
  },
  // — Plis cutanés (méthode de terrain) —
  {
    key: 'skinfold_biceps_mm',
    label: 'Pli cutané biceps',
    input_type: 'number',
    unit: 'mm',
    required: false,
    visible: false,
    min: 1,
    max: 50,
    step: 0.5,
    helper: 'Pince à plis — protocole Durnin & Womersley ou Jackson-Pollock',
    show_if: { field_key: 'measurement_method', operator: 'includes', value: 'Plis cutanés' },
  },
  {
    key: 'skinfold_triceps_mm',
    label: 'Pli cutané triceps',
    input_type: 'number',
    unit: 'mm',
    required: false,
    visible: false,
    min: 1,
    max: 50,
    step: 0.5,
    show_if: { field_key: 'measurement_method', operator: 'includes', value: 'Plis cutanés' },
  },
  {
    key: 'skinfold_subscapular_mm',
    label: 'Pli sous-scapulaire',
    input_type: 'number',
    unit: 'mm',
    required: false,
    visible: false,
    min: 1,
    max: 60,
    step: 0.5,
    show_if: { field_key: 'measurement_method', operator: 'includes', value: 'Plis cutanés' },
  },
  {
    key: 'skinfold_suprailiac_mm',
    label: 'Pli supra-iliaque',
    input_type: 'number',
    unit: 'mm',
    required: false,
    visible: false,
    min: 1,
    max: 60,
    step: 0.5,
    show_if: { field_key: 'measurement_method', operator: 'includes', value: 'Plis cutanés' },
  },
  // — Indicateurs calculés —
  {
    key: 'bmi',
    label: 'IMC',
    input_type: 'number',
    unit: 'kg/m²',
    required: false,
    visible: false,
    min: 10,
    max: 60,
    step: 0.1,
    helper: 'Calculé si taille + poids renseignés — indicateur limité, à contextualiser',
  },
]

// ------------------------------------------------------------------
// MODULE : Photos
// ------------------------------------------------------------------

const PHOTO_GUIDE = `📸 Guide photo — pour des résultats cohérents et comparables entre chaque bilan :

• Angle : appareil à hauteur du nombril, perpendiculaire au corps (ni trop haut ni trop bas)
• Distance : 2 à 3 mètres du sujet — le corps entier doit être visible, pieds compris
• Lumière : lumière naturelle frontale ou éclairage uniforme — éviter les contre-jours et les ombres dures sur le corps
• Fond : fond uni neutre (mur blanc, gris ou noir) — pas de miroir, pas de motifs, pas de mobilier
• Tenue : maillot de bain, sous-vêtements ou tenue de sport minimale — le ventre doit être visible
• Pose : debout, bras légèrement écartés le long du corps, mains ouvertes et détendues
• Respiration : expirer normalement avant la prise — ne pas rentrer le ventre, ne pas bloquer la respiration
• Résolution : photo en portrait (format 9:16 idéal), minimum 1 mégapixel — ne pas utiliser le zoom numérique`

const PHOTOS_FIELDS: FieldConfig[] = [
  {
    key: 'photo_front',
    label: 'Face avant',
    input_type: 'photo_upload',
    required: false,
    visible: true,
    helper: PHOTO_GUIDE,
  },
  {
    key: 'photo_back',
    label: 'Face arrière',
    input_type: 'photo_upload',
    required: false,
    visible: true,
    helper: PHOTO_GUIDE,
  },
  {
    key: 'photo_side_right',
    label: 'Profil droit',
    input_type: 'photo_upload',
    required: false,
    visible: true,
    helper: PHOTO_GUIDE,
  },
  {
    key: 'photo_side_left',
    label: 'Profil gauche',
    input_type: 'photo_upload',
    required: false,
    visible: false,
    helper: PHOTO_GUIDE,
  },
  {
    key: 'photo_relaxed',
    label: 'Pose détendue',
    input_type: 'photo_upload',
    required: false,
    visible: false,
    helper: PHOTO_GUIDE,
  },
  {
    key: 'photo_contracted',
    label: 'Pose contractée',
    input_type: 'photo_upload',
    required: false,
    visible: false,
    helper: PHOTO_GUIDE,
  },
]

// ------------------------------------------------------------------
// MODULE : Nutrition
// ------------------------------------------------------------------
const NUTRITION_FIELDS: FieldConfig[] = [
  {
    key: 'diet_type',
    label: 'Type d\'alimentation',
    input_type: 'single_choice',
    required: false,
    visible: true,
    options: ['Omnivore', 'Végétarien', 'Végétalien / Vegan', 'Flexitarien', 'Sans gluten', 'Cétogène / Low carb', 'Autre'],
  },
  {
    key: 'calories_target',
    label: 'Apport calorique journalier',
    input_type: 'number',
    unit: 'kcal',
    required: false,
    visible: true,
    min: 500,
    max: 6000,
    step: 50,
    helper: 'Apport actuel ou ciblé par le coach',
  },
  {
    key: 'protein_g',
    label: 'Protéines',
    input_type: 'number',
    unit: 'g',
    required: false,
    visible: true,
    min: 0,
    max: 500,
    step: 1,
  },
  {
    key: 'carbs_g',
    label: 'Glucides',
    input_type: 'number',
    unit: 'g',
    required: false,
    visible: true,
    min: 0,
    max: 800,
    step: 1,
  },
  {
    key: 'fat_g',
    label: 'Lipides',
    input_type: 'number',
    unit: 'g',
    required: false,
    visible: true,
    min: 0,
    max: 400,
    step: 1,
  },
  {
    key: 'water_l',
    label: 'Hydratation quotidienne',
    input_type: 'number',
    unit: 'L',
    required: false,
    visible: true,
    min: 0,
    max: 10,
    step: 0.1,
  },
  {
    key: 'meals_per_day',
    label: 'Nombre de repas par jour',
    input_type: 'number',
    unit: 'repas',
    required: false,
    visible: false,
    min: 1,
    max: 10,
    step: 1,
  },
  {
    key: 'meals_outside_per_week',
    label: 'Repas à l\'extérieur par semaine',
    input_type: 'number',
    unit: 'repas/sem',
    required: false,
    visible: false,
    min: 0,
    max: 21,
    step: 1,
    helper: 'Restaurant, cantine, livraison — impact sur le contrôle calorique',
  },
  {
    key: 'meal_timing',
    label: 'Organisation des repas',
    input_type: 'single_choice',
    required: false,
    visible: false,
    options: ['Horaires fixes et réguliers', 'Horaires flexibles', 'Sauts de repas fréquents', 'Jeûne intermittent', 'Alimentation intuitive'],
  },
  {
    key: 'diet_budget',
    label: 'Budget alimentaire hebdomadaire',
    input_type: 'single_choice',
    required: false,
    visible: false,
    options: ['< 50 €', '50–100 €', '100–150 €', '150–200 €', '> 200 €'],
    helper: 'Permet d\'adapter les recommandations nutritionnelles à la réalité économique',
  },
  {
    key: 'supplements',
    label: 'Suppléments utilisés',
    input_type: 'multiple_choice',
    required: false,
    visible: false,
    options: ['Protéines en poudre', 'Créatine', 'BCAA / EAA', 'Oméga-3', 'Vitamine D', 'Magnésium', 'Caféine / Pré-workout', 'Collagène', 'Aucun', 'Autre'],
  },
  {
    key: 'diet_adherence',
    label: 'Respect du plan alimentaire',
    input_type: 'scale_1_10',
    required: false,
    visible: false,
    helper: '1 = très difficile à suivre, 10 = suivi parfaitement',
  },
  {
    key: 'diet_notes',
    label: 'Commentaires alimentaires',
    input_type: 'textarea',
    required: false,
    visible: false,
    placeholder: 'Difficultés, écarts, contexte particulier cette semaine…',
  },
  {
    key: 'daily_meal_routine',
    label: 'Journée alimentaire type',
    input_type: 'meal_journal',
    required: false,
    visible: true,
    helper: 'Décris tes repas habituels sur une journée type — le coach analysera ton organisation alimentaire',
  },
]

// ------------------------------------------------------------------
// MODULE : Entraînement
// ------------------------------------------------------------------
const TRAINING_FIELDS: FieldConfig[] = [
  {
    key: 'training_frequency',
    label: 'Fréquence d\'entraînement',
    input_type: 'number',
    unit: 'séances/sem',
    required: false,
    visible: true,
    min: 0,
    max: 14,
    step: 1,
  },
  {
    key: 'session_duration_min',
    label: 'Durée moyenne par séance',
    input_type: 'number',
    unit: 'min',
    required: false,
    visible: true,
    min: 10,
    max: 300,
    step: 5,
    show_if: { field_key: 'training_frequency', operator: 'not_empty' },
  },
  {
    key: 'training_types',
    label: 'Types d\'entraînement pratiqués',
    input_type: 'multiple_choice',
    required: false,
    visible: true,
    options: [
      'Musculation / Powerlifting',
      'Haltérophilie',
      'CrossFit / HIIT',
      'Bodybuilding / Physique',
      'Calisthenics',
      'Yoga / Pilates',
      'Sports collectifs',
      'Arts martiaux / Boxe',
      'Autre',
    ],
    show_if: { field_key: 'training_frequency', operator: 'not_empty' },
  },
  {
    key: 'equipment_preference',
    label: 'Matériel préféré',
    input_type: 'single_choice',
    required: false,
    visible: false,
    options: ['Machines guidées', 'Barres & haltères libres', 'Mixte (machines + libres)', 'Poids de corps / calisthenics', 'Élastiques / câbles', 'Pas de préférence'],
    helper: 'Impact direct sur la compliance au programme proposé',
    show_if: { field_key: 'training_frequency', operator: 'not_empty' },
  },
  {
    key: 'had_coach_before',
    label: 'Suivi coaching antérieur',
    input_type: 'single_choice',
    required: false,
    visible: false,
    options: ['Jamais eu de coach', 'Coaching < 3 mois', 'Coaching 3–12 mois', 'Coaching > 1 an', 'Plusieurs coachs'],
    helper: 'Informe sur les attentes et le niveau d\'autonomie du client',
  },
  {
    key: 'perceived_intensity',
    label: 'Intensité perçue (RPE moyen)',
    input_type: 'scale_1_10',
    required: false,
    visible: true,
    helper: '1 = très léger, 10 = effort maximal',
    show_if: { field_key: 'training_frequency', operator: 'not_empty' },
  },
  {
    key: 'training_calories',
    label: 'Dépense calorique estimée (sport)',
    input_type: 'number',
    unit: 'kcal/sem',
    required: false,
    visible: false,
    min: 0,
    max: 10000,
    step: 50,
    helper: 'Total hebdomadaire estimé ou fourni par montre connectée',
    show_if: { field_key: 'training_frequency', operator: 'not_empty' },
  },
  {
    key: 'program_adherence',
    label: 'Respect du programme',
    input_type: 'scale_1_10',
    required: false,
    visible: false,
    helper: '1 = aucune séance réalisée, 10 = programme suivi à 100%',
    show_if: { field_key: 'training_frequency', operator: 'not_empty' },
  },
  {
    key: 'training_notes',
    label: 'Commentaires entraînement',
    input_type: 'textarea',
    required: false,
    visible: false,
    placeholder: 'Séances manquées, douleurs, performances notables…',
    show_if: { field_key: 'training_frequency', operator: 'not_empty' },
  },
]

// ------------------------------------------------------------------
// MODULE : Cardio & Activité
// ------------------------------------------------------------------
const CARDIO_FIELDS: FieldConfig[] = [
  {
    key: 'daily_steps',
    label: 'Pas quotidiens (NEAT)',
    input_type: 'number',
    unit: 'pas/j',
    required: false,
    visible: true,
    min: 0,
    max: 50000,
    step: 100,
    helper: 'Moyenne sur la semaine — impact majeur sur la dépense calorique totale',
  },
  {
    key: 'cardio_frequency',
    label: 'Fréquence cardio dédiée',
    input_type: 'number',
    unit: 'séances/sem',
    required: false,
    visible: true,
    min: 0,
    max: 14,
    step: 1,
  },
  {
    key: 'cardio_types',
    label: 'Types de cardio pratiqués',
    input_type: 'multiple_choice',
    required: false,
    visible: true,
    options: ['Course à pied', 'Vélo / Cycling', 'Natation', 'Rameur', 'Elliptique', 'Marche rapide', 'Corde à sauter', 'LISS', 'HIIT cardio', 'Autre'],
    show_if: { field_key: 'cardio_frequency', operator: 'not_empty' },
  },
  {
    key: 'cardio_duration_min',
    label: 'Durée moyenne par séance cardio',
    input_type: 'number',
    unit: 'min',
    required: false,
    visible: false,
    min: 5,
    max: 300,
    step: 5,
    show_if: { field_key: 'cardio_frequency', operator: 'not_empty' },
  },
  {
    key: 'cardio_zone',
    label: 'Zone d\'entraînement cardio habituelle',
    input_type: 'single_choice',
    required: false,
    visible: false,
    options: ['Zone 2 — endurance longue durée (faible intensité)', 'Zone 3-4 — tempo / seuil', 'Zone 4-5 — HIIT / efforts courts intenses', 'Mixte selon les séances', 'Pas de cardio structuré'],
    helper: 'Permet d\'adapter le cardio prescrit sans créer de conflit d\'adaptation',
    show_if: { field_key: 'cardio_frequency', operator: 'not_empty' },
  },
  {
    key: 'connected_tracker',
    label: 'Tracker connecté utilisé',
    input_type: 'single_choice',
    required: false,
    visible: false,
    options: ['Garmin', 'Apple Watch', 'Fitbit', 'Polar', 'Whoop', 'Samsung', 'Oura Ring', 'Autre', 'Aucun'],
    helper: 'Fiabilité des données NEAT, FC et VO2max à ajuster selon l\'appareil',
  },
  {
    key: 'vo2max',
    label: 'VO2max estimé',
    input_type: 'number',
    unit: 'mL/kg/min',
    required: false,
    visible: false,
    min: 20,
    max: 90,
    step: 0.5,
    helper: 'Fourni par montre connectée (Garmin, Polar, Apple Watch…)',
  },
  {
    key: 'max_heart_rate',
    label: 'FC max',
    input_type: 'number',
    unit: 'bpm',
    required: false,
    visible: false,
    min: 100,
    max: 230,
    step: 1,
  },
  {
    key: 'resting_heart_rate',
    label: 'FC repos',
    input_type: 'number',
    unit: 'bpm',
    required: false,
    visible: false,
    min: 30,
    max: 120,
    step: 1,
    helper: 'Indicateur de condition cardiorespiratoire — idéal < 60 bpm chez les sportifs',
  },
]

// ------------------------------------------------------------------
// MODULE : Bien-être & Récupération
// ------------------------------------------------------------------
const WELLNESS_FIELDS: FieldConfig[] = [
  {
    key: 'sleep_duration_h',
    label: 'Durée du sommeil',
    input_type: 'number',
    unit: 'h',
    required: false,
    visible: true,
    min: 0,
    max: 14,
    step: 0.5,
    helper: 'Moyenne sur la semaine',
  },
  {
    key: 'sleep_quality',
    label: 'Qualité du sommeil',
    input_type: 'scale_1_10',
    required: false,
    visible: true,
    helper: '1 = très mauvaise, 10 = excellente',
  },
  {
    key: 'stress_level',
    label: 'Niveau de stress global',
    input_type: 'scale_1_10',
    required: false,
    visible: true,
    helper: '1 = très serein, 10 = extrêmement stressé',
  },
  {
    key: 'energy_level',
    label: 'Niveau d\'énergie',
    input_type: 'scale_1_10',
    required: false,
    visible: true,
    helper: '1 = épuisé, 10 = plein d\'énergie',
  },
  {
    key: 'recovery_score',
    label: 'Récupération musculaire ressentie',
    input_type: 'scale_1_10',
    required: false,
    visible: true,
    helper: '1 = courbatures importantes, 10 = parfaitement récupéré',
  },
  {
    key: 'post_session_recovery',
    label: 'Récupération post-séance',
    input_type: 'scale_1_10',
    required: false,
    visible: false,
    helper: 'Ressenti dans les 24–48h après les entraînements — distinct de la récupération générale',
  },
  {
    key: 'caffeine_daily_mg',
    label: 'Consommation de caféine',
    input_type: 'single_choice',
    required: false,
    visible: false,
    options: ['Aucune', '< 100 mg (1 café)', '100–200 mg (1–2 cafés)', '200–400 mg (3–4 cafés)', '> 400 mg'],
    helper: 'Impact sur la qualité du sommeil et la tolérance aux stimulants',
  },
  {
    key: 'mood',
    label: 'Humeur générale',
    input_type: 'scale_1_10',
    required: false,
    visible: false,
    helper: '1 = très négatif, 10 = excellent moral',
  },
  {
    key: 'libido',
    label: 'Libido / vitalité',
    input_type: 'scale_1_10',
    required: false,
    visible: false,
    helper: 'Indicateur hormonal induit — 1 = très faible, 10 = normale',
  },
  {
    key: 'wellness_notes',
    label: 'Commentaires bien-être',
    input_type: 'textarea',
    required: false,
    visible: false,
    placeholder: 'Événements particuliers, état de forme général…',
  },
]

// ------------------------------------------------------------------
// MODULE : Objectifs
// ------------------------------------------------------------------
const GOALS_FIELDS: FieldConfig[] = [
  {
    key: 'primary_goal',
    label: 'Objectif principal',
    input_type: 'single_choice',
    required: false,
    visible: true,
    options: [
      'Perte de gras',
      'Prise de muscle',
      'Recomposition corporelle',
      'Amélioration des performances',
      'Santé & bien-être général',
      'Préparation compétition',
      'Rééducation / Retour à l\'activité',
      'Autre',
    ],
  },
  {
    key: 'secondary_goals',
    label: 'Objectifs secondaires',
    input_type: 'multiple_choice',
    required: false,
    visible: false,
    options: [
      'Améliorer le sommeil',
      'Réduire le stress',
      'Améliorer la mobilité',
      'Améliorer le cardio',
      'Prendre des habitudes alimentaires',
      'Améliorer la confiance en soi',
    ],
  },
  {
    key: 'target_weight_kg',
    label: 'Poids cible',
    input_type: 'number',
    unit: 'kg',
    required: false,
    visible: false,
    min: 30,
    max: 300,
    step: 0.5,
  },
  {
    key: 'target_body_fat_pct',
    label: '% graisse cible',
    input_type: 'number',
    unit: '%',
    required: false,
    visible: false,
    min: 3,
    max: 40,
    step: 0.5,
  },
  {
    key: 'goal_deadline',
    label: 'Date cible',
    input_type: 'date',
    required: false,
    visible: true,
  },
  {
    key: 'motivation',
    label: 'Motivation principale',
    input_type: 'textarea',
    required: false,
    visible: true,
    placeholder: 'Pourquoi cet objectif est important pour vous…',
  },
  {
    key: 'obstacles',
    label: 'Obstacles / contraintes identifiés',
    input_type: 'textarea',
    required: false,
    visible: false,
    placeholder: 'Voyage fréquent, emploi du temps chargé, blessures passées…',
  },
  {
    key: 'coach_notes_goals',
    label: 'Notes du coach',
    input_type: 'textarea',
    required: false,
    visible: false,
    placeholder: 'Observations coach sur les objectifs…',
  },
]

// ------------------------------------------------------------------
// MODULE : Santé & Médical
// ------------------------------------------------------------------
const MEDICAL_FIELDS: FieldConfig[] = [
  {
    key: 'medical_clearance',
    label: 'Autorisation médicale',
    input_type: 'boolean',
    required: false,
    visible: true,
    helper: 'Le client a-t-il obtenu l\'autorisation de pratiquer ?',
  },
  {
    key: 'blood_pressure',
    label: 'Tension artérielle',
    input_type: 'text',
    required: false,
    visible: true,
    placeholder: '120/80 mmHg',
    helper: 'Systolique / diastolique — mesurée au repos. Signal de sécurité avant protocole cardio intense',
  },
  {
    key: 'injuries_active',
    label: 'Blessures ou douleurs actuelles',
    input_type: 'textarea',
    required: false,
    visible: true,
    placeholder: 'Localisation, intensité, depuis quand…',
  },
  {
    key: 'injuries_history',
    label: 'Antécédents de blessures',
    input_type: 'textarea',
    required: false,
    visible: false,
    placeholder: 'Opérations, fractures, entorses graves passées…',
  },
  {
    key: 'pathologies',
    label: 'Pathologies chroniques',
    input_type: 'multiple_choice',
    required: false,
    visible: false,
    options: ['Diabète type 1', 'Diabète type 2', 'Hypertension', 'Hypotension', 'Asthme', 'Maladie cardiovasculaire', 'Hypothyroïdie', 'Hyperthyroïdie', 'SOPK', 'Aucune', 'Autre'],
  },
  {
    key: 'family_history',
    label: 'Antécédents familiaux',
    input_type: 'multiple_choice',
    required: false,
    visible: false,
    options: ['Maladie cardiovasculaire', 'Diabète type 2', 'Hypertension', 'Cancer', 'Obésité', 'Aucun connu', 'Autre'],
    helper: 'Facteurs de risque héréditaires à intégrer dans le suivi long terme',
  },
  // — Bilan sanguin —
  {
    key: 'blood_ferritin',
    label: 'Ferritine',
    input_type: 'number',
    unit: 'ng/mL',
    required: false,
    visible: false,
    min: 0,
    max: 500,
    step: 1,
    helper: 'Réserves en fer — souvent déficiente chez les femmes et sportifs d\'endurance (idéal > 50)',
  },
  {
    key: 'blood_vitamin_d',
    label: 'Vitamine D (25-OH)',
    input_type: 'number',
    unit: 'ng/mL',
    required: false,
    visible: false,
    min: 0,
    max: 150,
    step: 1,
    helper: 'Carence fréquente — impact sur récupération, immunité, hormones (optimal 40–70)',
  },
  {
    key: 'blood_tsh',
    label: 'TSH (thyroïde)',
    input_type: 'number',
    unit: 'mUI/L',
    required: false,
    visible: false,
    min: 0,
    max: 20,
    step: 0.01,
    helper: 'Dépistage hypo/hyperthyroïdie — expliquerait une stagnation ou fatigue inexpliquée',
  },
  {
    key: 'blood_testosterone',
    label: 'Testostérone totale',
    input_type: 'number',
    unit: 'ng/dL',
    required: false,
    visible: false,
    min: 0,
    max: 1500,
    step: 1,
    helper: 'Indicateur hormonal clé pour la récupération et la composition corporelle',
  },
  {
    key: 'medications',
    label: 'Traitements médicaux en cours',
    input_type: 'textarea',
    required: false,
    visible: false,
    placeholder: 'Nom du traitement, posologie, impact potentiel sur l\'entraînement…',
  },
  {
    key: 'menstrual_cycle',
    label: 'Phase du cycle menstruel',
    input_type: 'single_choice',
    required: false,
    visible: false,
    options: ['Phase folliculaire (J1–J13)', 'Ovulation (J14)', 'Phase lutéale (J15–J28)', 'Règles', 'Ménopause / Aménorrhée', 'Non applicable'],
    helper: 'Impact sur la rétention d\'eau, l\'énergie et les performances',
    show_if: { field_key: 'gender', operator: 'eq', value: 'Femme' },
  },
  {
    key: 'therapy_or_psy',
    label: 'Suivi psychologique ou thérapeutique',
    input_type: 'boolean',
    required: false,
    visible: false,
    helper: 'Contexte important pour calibrer l\'accompagnement — à ne pas utiliser comme critère d\'exclusion',
  },
  {
    key: 'medical_notes',
    label: 'Notes médicales / autres',
    input_type: 'textarea',
    required: false,
    visible: false,
    placeholder: 'Toute information médicale pertinente pour le suivi…',
  },
]

// ------------------------------------------------------------------
// MODULE : Lifestyle
// Alcool, tabac, écrans, situation de vie, budget — variables qui
// sabotent les résultats silencieusement.
// ------------------------------------------------------------------
const LIFESTYLE_FIELDS: FieldConfig[] = [
  {
    key: 'alcohol_weekly',
    label: 'Consommation d\'alcool',
    input_type: 'single_choice',
    required: false,
    visible: true,
    options: ['Aucune', '1–3 verres/sem', '4–7 verres/sem', '8–14 verres/sem', '> 14 verres/sem'],
    helper: 'Calories cachées + impact direct sur la testostérone, le sommeil et la récupération',
  },
  {
    key: 'smoking',
    label: 'Tabac / cigarette',
    input_type: 'single_choice',
    required: false,
    visible: true,
    options: ['Non-fumeur', 'Ex-fumeur', 'Fumeur occasionnel', 'Fumeur régulier (< 10/j)', 'Fumeur (> 10/j)', 'Vapoteur'],
    helper: 'Impact cardiovasculaire et sur la récupération tissulaire',
  },
  {
    key: 'screen_time_evening',
    label: 'Écrans le soir (avant de dormir)',
    input_type: 'single_choice',
    required: false,
    visible: false,
    options: ['Aucun écran après 21h', 'Arrêt 30–60 min avant de dormir', 'Écrans jusqu\'à l\'endormissement', 'Téléphone au lit'],
    helper: 'Lumière bleue → suppression mélatonine → qualité de sommeil dégradée',
  },
  {
    key: 'work_hours_per_week',
    label: 'Volume de travail hebdomadaire',
    input_type: 'single_choice',
    required: false,
    visible: false,
    options: ['< 35h', '35–40h', '40–50h', '50–60h', '> 60h'],
    helper: 'Indicateur de charge globale — influence le temps disponible et la récupération',
  },
  {
    key: 'travel_frequency',
    label: 'Fréquence de déplacements professionnels',
    input_type: 'single_choice',
    required: false,
    visible: false,
    options: ['Jamais', 'Occasionnel (< 1x/mois)', 'Régulier (1–2x/mois)', 'Fréquent (> 2x/mois)', 'Quasi permanent'],
    helper: 'Contrainte sur les entraînements et l\'alimentation structurée',
  },
  {
    key: 'lifestyle_notes',
    label: 'Notes lifestyle',
    input_type: 'textarea',
    required: false,
    visible: false,
    placeholder: 'Contraintes particulières, contexte de vie, événements à venir…',
  },
]

// ------------------------------------------------------------------
// MODULE : Performance & Force
// Records personnels et tests fonctionnels — baseline objective.
// ------------------------------------------------------------------
const PERFORMANCE_FIELDS: FieldConfig[] = [
  // — Grands levés (powerlifting / force) —
  {
    key: 'pr_squat_kg',
    label: 'Squat — record (1RM ou estimé)',
    input_type: 'number',
    unit: 'kg',
    required: false,
    visible: true,
    min: 0,
    max: 500,
    step: 0.5,
    helper: 'Back squat. Si pas de 1RM testé, entrer le poids utilisé × reps pour estimation',
  },
  {
    key: 'pr_bench_kg',
    label: 'Développé couché — record (1RM ou estimé)',
    input_type: 'number',
    unit: 'kg',
    required: false,
    visible: true,
    min: 0,
    max: 400,
    step: 0.5,
  },
  {
    key: 'pr_deadlift_kg',
    label: 'Soulevé de terre — record (1RM ou estimé)',
    input_type: 'number',
    unit: 'kg',
    required: false,
    visible: true,
    min: 0,
    max: 600,
    step: 0.5,
  },
  {
    key: 'pr_overhead_press_kg',
    label: 'Développé militaire — record (1RM ou estimé)',
    input_type: 'number',
    unit: 'kg',
    required: false,
    visible: false,
    min: 0,
    max: 250,
    step: 0.5,
  },
  {
    key: 'pr_row_kg',
    label: 'Rowing barre — record (1RM ou estimé)',
    input_type: 'number',
    unit: 'kg',
    required: false,
    visible: false,
    min: 0,
    max: 300,
    step: 0.5,
  },
  // — Tests fonctionnels —
  {
    key: 'max_pullups',
    label: 'Tractions max (consécutives)',
    input_type: 'number',
    unit: 'reps',
    required: false,
    visible: false,
    min: 0,
    max: 100,
    step: 1,
    helper: 'Poids de corps, prise neutre ou pronation',
  },
  {
    key: 'max_pushups',
    label: 'Pompes max (consécutives)',
    input_type: 'number',
    unit: 'reps',
    required: false,
    visible: false,
    min: 0,
    max: 200,
    step: 1,
  },
  {
    key: 'run_5k_min',
    label: '5 km — meilleur temps',
    input_type: 'number',
    unit: 'min',
    required: false,
    visible: false,
    min: 10,
    max: 60,
    step: 0.5,
    helper: 'Indicateur de condition aérobie générale',
  },
  {
    key: 'performance_notes',
    label: 'Notes performance',
    input_type: 'textarea',
    required: false,
    visible: false,
    placeholder: 'Contexte des records (équipement, fatigue), autres performances notables…',
  },
]

// ------------------------------------------------------------------
// MODULE : Psychologie & Motivation
// Rapport au corps, historique de régimes, stade de changement.
// ------------------------------------------------------------------
const PSYCHOLOGY_FIELDS: FieldConfig[] = [
  {
    key: 'diet_history',
    label: 'Historique de régimes',
    input_type: 'single_choice',
    required: false,
    visible: true,
    options: [
      'Aucun régime passé',
      'Quelques tentatives isolées',
      'Plusieurs régimes sans succès durable',
      'Yo-yo chronique (> 5 cycles)',
      'Régimes très restrictifs / phases de restriction sévère',
    ],
    helper: 'Indicateur de résistance métabolique potentielle et de relation à la nourriture',
  },
  {
    key: 'relationship_with_food',
    label: 'Rapport à la nourriture',
    input_type: 'single_choice',
    required: false,
    visible: true,
    options: [
      'Neutre — outil de performance',
      'Plaisir — j\'aime manger sans culpabilité',
      'Émotionnel — je mange plus sous stress',
      'Restrictif — j\'ai tendance à me priver',
      'Complexe — TCA passé ou présent',
    ],
    helper: 'Signal important pour adapter le discours nutritionnel et éviter les déclencheurs',
  },
  {
    key: 'body_image',
    label: 'Rapport au corps',
    input_type: 'scale_1_10',
    required: false,
    visible: false,
    helper: '1 = très mal dans son corps, 10 = totalement à l\'aise',
  },
  {
    key: 'motivation_stage',
    label: 'Stade de motivation (Prochaska)',
    input_type: 'single_choice',
    required: false,
    visible: false,
    options: [
      'Pré-contemplation — je ne vois pas encore le besoin de changer',
      'Contemplation — j\'y pense mais je n\'ai pas encore agi',
      'Préparation — je suis prêt à commencer',
      'Action — j\'ai déjà commencé à changer',
      'Maintien — je maintiens mes habitudes depuis > 6 mois',
    ],
    helper: 'Permet d\'adapter l\'accompagnement au niveau de préparation réel du client',
  },
  {
    key: 'coaching_expectation',
    label: 'Style de coaching attendu',
    input_type: 'single_choice',
    required: false,
    visible: true,
    options: [
      'Directif — dis-moi exactement quoi faire',
      'Collaboratif — construisons ensemble',
      'Autonomisant — guide-moi, je veux comprendre',
      'Bienveillant — soutien et encouragement avant tout',
    ],
    helper: 'Aligner le style du coach avec les attentes du client réduit l\'abandon',
  },
  {
    key: 'previous_obstacles',
    label: 'Principal obstacle par le passé',
    input_type: 'single_choice',
    required: false,
    visible: false,
    options: [
      'Manque de temps',
      'Manque de motivation / constance',
      'Résultats trop lents',
      'Difficultés alimentaires',
      'Blessures récurrentes',
      'Facteurs externes (travail, famille…)',
      'Pas d\'obstacle — première tentative sérieuse',
    ],
  },
  {
    key: 'psychology_notes',
    label: 'Notes psychologiques / motivation',
    input_type: 'textarea',
    required: false,
    visible: false,
    placeholder: 'Éléments contextuels sur la relation au corps, à l\'alimentation, au sport…',
  },
]

// ------------------------------------------------------------------
// Map module → champs par défaut
// ------------------------------------------------------------------
export const DEFAULT_MODULE_FIELDS: Record<AssessmentModule, FieldConfig[]> = {
  general:      GENERAL_FIELDS,
  biometrics:   BIOMETRICS_FIELDS,
  measurements: MEASUREMENTS_FIELDS,
  photos:       PHOTOS_FIELDS,
  nutrition:    NUTRITION_FIELDS,
  training:     TRAINING_FIELDS,
  cardio:       CARDIO_FIELDS,
  wellness:     WELLNESS_FIELDS,
  goals:        GOALS_FIELDS,
  medical:      MEDICAL_FIELDS,
  lifestyle:    LIFESTYLE_FIELDS,
  performance:  PERFORMANCE_FIELDS,
  psychology:   PSYCHOLOGY_FIELDS,
}

// ------------------------------------------------------------------
// Ordre d'affichage dans la palette
// ------------------------------------------------------------------
export const MODULE_ORDER: AssessmentModule[] = [
  'general',
  'biometrics',
  'measurements',
  'photos',
  'nutrition',
  'training',
  'cardio',
  'wellness',
  'goals',
  'medical',
  'lifestyle',
  'performance',
  'psychology',
]

// ------------------------------------------------------------------
// Créer un BlockConfig par défaut pour un module
// ------------------------------------------------------------------
export function createDefaultBlock(module: AssessmentModule, order: number): BlockConfig {
  return {
    id: crypto.randomUUID(),
    module,
    label: MODULE_LABELS[module],
    order,
    fields: DEFAULT_MODULE_FIELDS[module].map(f => ({ ...f })),
  }
}
