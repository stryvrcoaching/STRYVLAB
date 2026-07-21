type LibraryLanguage = 'fr' | 'en' | 'es'

type Labels = Record<LibraryLanguage, string>

const muscleGroupLabels: Record<string, Labels> = {
  abdos: { fr: 'Abdos', en: 'Abs', es: 'Abdominales' },
  'avant-bras': { fr: 'Avant-bras', en: 'Forearms', es: 'Antebrazos' },
  biceps: { fr: 'Biceps', en: 'Biceps', es: 'Bíceps' },
  cardio: { fr: 'Cardio', en: 'Cardio', es: 'Cardio' },
  dos: { fr: 'Dos', en: 'Back', es: 'Espalda' },
  epaules: { fr: 'Épaules', en: 'Shoulders', es: 'Hombros' },
  fessiers: { fr: 'Fessiers', en: 'Glutes', es: 'Glúteos' },
  'ischio-jambiers': { fr: 'Ischio-jambiers', en: 'Hamstrings', es: 'Isquiotibiales' },
  mollets: { fr: 'Mollets', en: 'Calves', es: 'Pantorrillas' },
  pectoraux: { fr: 'Pectoraux', en: 'Chest', es: 'Pectorales' },
  quadriceps: { fr: 'Quadriceps', en: 'Quadriceps', es: 'Cuádriceps' },
  triceps: { fr: 'Triceps', en: 'Triceps', es: 'Tríceps' },
}

const muscleLabels: Record<string, Labels> = {
  adductors: { fr: 'Adducteurs', en: 'Adductors', es: 'Aductores' },
  anconeus: { fr: 'Anconé', en: 'Anconeus', es: 'Ancóneo' },
  anterior_deltoid: { fr: 'Deltoïde antérieur', en: 'Anterior deltoid', es: 'Deltoide anterior' },
  biceps: { fr: 'Biceps', en: 'Biceps', es: 'Bíceps' },
  biceps_brachii: { fr: 'Biceps brachial', en: 'Biceps brachii', es: 'Bíceps braquial' },
  brachialis: { fr: 'Brachial', en: 'Brachialis', es: 'Braquial' },
  brachioradialis: { fr: 'Brachio-radial', en: 'Brachioradialis', es: 'Braquiorradial' },
  calves: { fr: 'Mollets', en: 'Calves', es: 'Pantorrillas' },
  cardio: { fr: 'Cardio', en: 'Cardio', es: 'Cardio' },
  core: { fr: 'Sangle abdominale', en: 'Core', es: 'Core' },
  core_global: { fr: 'Sangle abdominale', en: 'Core', es: 'Core' },
  deltoids: { fr: 'Deltoïdes', en: 'Deltoids', es: 'Deltoides' },
  external_rotators: { fr: 'Rotateurs externes', en: 'External rotators', es: 'Rotadores externos' },
  finger_flexors: { fr: 'Fléchisseurs des doigts', en: 'Finger flexors', es: 'Flexores de los dedos' },
  forearm_flexors: { fr: 'Fléchisseurs de l’avant-bras', en: 'Forearm flexors', es: 'Flexores del antebrazo' },
  gastrocnemius: { fr: 'Gastrocnémiens', en: 'Gastrocnemius', es: 'Gastrocnemios' },
  glutes: { fr: 'Fessiers', en: 'Glutes', es: 'Glúteos' },
  gluteus_maximus: { fr: 'Grand fessier', en: 'Gluteus maximus', es: 'Glúteo mayor' },
  gluteus_medius: { fr: 'Moyen fessier', en: 'Gluteus medius', es: 'Glúteo medio' },
  gluteus_minimus: { fr: 'Petit fessier', en: 'Gluteus minimus', es: 'Glúteo menor' },
  grip_flexors: { fr: 'Fléchisseurs de la prise', en: 'Grip flexors', es: 'Flexores del agarre' },
  hamstrings: { fr: 'Ischio-jambiers', en: 'Hamstrings', es: 'Isquiotibiales' },
  hip_flexors: { fr: 'Fléchisseurs de hanche', en: 'Hip flexors', es: 'Flexores de cadera' },
  lats: { fr: 'Grands dorsaux', en: 'Lats', es: 'Dorsales' },
  levator_scapulae: { fr: 'Élévateur de la scapula', en: 'Levator scapulae', es: 'Elevador de la escápula' },
  lower_abs: { fr: 'Abdominaux inférieurs', en: 'Lower abs', es: 'Abdominales inferiores' },
  medial_deltoid: { fr: 'Deltoïde moyen', en: 'Lateral deltoid', es: 'Deltoide lateral' },
  none: { fr: '', en: '', es: '' },
  obliques: { fr: 'Obliques', en: 'Obliques', es: 'Oblicuos' },
  pec_major: { fr: 'Grand pectoral', en: 'Pectoralis major', es: 'Pectoral mayor' },
  pectoralis_major: { fr: 'Grand pectoral', en: 'Pectoralis major', es: 'Pectoral mayor' },
  pectoralis_major_lower: { fr: 'Grand pectoral inférieur', en: 'Lower pectoralis major', es: 'Pectoral mayor inferior' },
  pectoralis_major_upper: { fr: 'Grand pectoral supérieur', en: 'Upper pectoralis major', es: 'Pectoral mayor superior' },
  posterior_deltoid: { fr: 'Deltoïde postérieur', en: 'Posterior deltoid', es: 'Deltoide posterior' },
  pronators_supinators: { fr: 'Pronateurs et supinateurs', en: 'Pronators and supinators', es: 'Pronadores y supinadores' },
  quadratus_lumborum: { fr: 'Carré des lombes', en: 'Quadratus lumborum', es: 'Cuadrado lumbar' },
  quadriceps: { fr: 'Quadriceps', en: 'Quadriceps', es: 'Cuádriceps' },
  quads: { fr: 'Quadriceps', en: 'Quadriceps', es: 'Cuádriceps' },
  rear_delts: { fr: 'Deltoïdes postérieurs', en: 'Rear delts', es: 'Deltoides posteriores' },
  rectus_abdominis: { fr: 'Grand droit', en: 'Rectus abdominis', es: 'Recto abdominal' },
  rhomboids: { fr: 'Rhomboïdes', en: 'Rhomboids', es: 'Romboides' },
  rotator_cuff: { fr: 'Coiffe des rotateurs', en: 'Rotator cuff', es: 'Manguito rotador' },
  scapula: { fr: 'Scapula', en: 'Scapula', es: 'Escápula' },
  shoulders: { fr: 'Épaules', en: 'Shoulders', es: 'Hombros' },
  soleus: { fr: 'Soléaire', en: 'Soleus', es: 'Sóleo' },
  spine_erectors: { fr: 'Érecteurs du rachis', en: 'Spinal erectors', es: 'Erectores espinales' },
  subscapularis: { fr: 'Subscapulaire', en: 'Subscapularis', es: 'Subescapular' },
  teres_major: { fr: 'Grand rond', en: 'Teres major', es: 'Redondo mayor' },
  traps: { fr: 'Trapèzes', en: 'Traps', es: 'Trapecios' },
  transverse_abdominis: { fr: 'Transverse', en: 'Transverse abdominis', es: 'Transverso abdominal' },
  triceps: { fr: 'Triceps', en: 'Triceps', es: 'Tríceps' },
  triceps_brachii: { fr: 'Triceps brachial', en: 'Triceps brachii', es: 'Tríceps braquial' },
  upper_back: { fr: 'Haut du dos', en: 'Upper back', es: 'Espalda alta' },
  upper_chest: { fr: 'Haut des pectoraux', en: 'Upper chest', es: 'Pectoral superior' },
  upper_traps: { fr: 'Trapèzes supérieurs', en: 'Upper traps', es: 'Trapecios superiores' },
  wrist_extensors: { fr: 'Extenseurs du poignet', en: 'Wrist extensors', es: 'Extensores de la muñeca' },
  wrist_flexors: { fr: 'Fléchisseurs du poignet', en: 'Wrist flexors', es: 'Flexores de la muñeca' },
  wrist_stabilizers: { fr: 'Stabilisateurs du poignet', en: 'Wrist stabilizers', es: 'Estabilizadores de la muñeca' },
}

const movementPatternLabels: Record<string, Labels> = {
  cardio: { fr: 'Cardio', en: 'Cardio', es: 'Cardio' },
  carry: { fr: 'Porté', en: 'Carry', es: 'Porteo' },
  calf_raise: { fr: 'Extension de mollets', en: 'Calf raise', es: 'Elevación de gemelos' },
  core_anti_flex: { fr: 'Gainage anti-flexion', en: 'Anti-flexion core', es: 'Core anti-flexión' },
  core_flex: { fr: 'Flexion du tronc', en: 'Core flexion', es: 'Flexión de tronco' },
  core_rotation: { fr: 'Rotation du tronc', en: 'Core rotation', es: 'Rotación de tronco' },
  elbow_extension: { fr: 'Extension du coude', en: 'Elbow extension', es: 'Extensión de codo' },
  elbow_flexion: { fr: 'Flexion du coude', en: 'Elbow flexion', es: 'Flexión de codo' },
  forearm_rotation: { fr: 'Rotation de l’avant-bras', en: 'Forearm rotation', es: 'Rotación de antebrazo' },
  hip_abduction: { fr: 'Abduction de hanche', en: 'Hip abduction', es: 'Abducción de cadera' },
  hip_hinge: { fr: 'Charnière de hanche', en: 'Hip hinge', es: 'Bisagra de cadera' },
  horizontal_pull: { fr: 'Tirage horizontal', en: 'Horizontal pull', es: 'Tirón horizontal' },
  horizontal_push: { fr: 'Poussée horizontale', en: 'Horizontal push', es: 'Empuje horizontal' },
  knee_extension: { fr: 'Extension du genou', en: 'Knee extension', es: 'Extensión de rodilla' },
  knee_flexion: { fr: 'Flexion du genou', en: 'Knee flexion', es: 'Flexión de rodilla' },
  lateral_raise: { fr: 'Élévation latérale', en: 'Lateral raise', es: 'Elevación lateral' },
  scapular_elevation: { fr: 'Élévation scapulaire', en: 'Scapular elevation', es: 'Elevación escapular' },
  scapular_retraction: { fr: 'Rétraction scapulaire', en: 'Scapular retraction', es: 'Retracción escapular' },
  shoulder_rotation: { fr: 'Rotation d’épaule', en: 'Shoulder rotation', es: 'Rotación de hombro' },
  squat_pattern: { fr: 'Pattern squat', en: 'Squat pattern', es: 'Patrón de sentadilla' },
  vertical_pull: { fr: 'Tirage vertical', en: 'Vertical pull', es: 'Tirón vertical' },
  vertical_push: { fr: 'Poussée verticale', en: 'Vertical push', es: 'Empuje vertical' },
  wrist_flexion: { fr: 'Flexion du poignet', en: 'Wrist flexion', es: 'Flexión de muñeca' },
}

function resolveLanguage(lang: string): LibraryLanguage {
  return lang === 'es' || lang === 'en' ? lang : 'fr'
}

function formatFallback(value: string) {
  const label = value.replaceAll('_', ' ').replaceAll('-', ' ')
  return label ? `${label.charAt(0).toUpperCase()}${label.slice(1)}` : ''
}

function labelFor(value: string | null | undefined, labels: Record<string, Labels>, lang: string) {
  if (!value) return ''
  return labels[value]?.[resolveLanguage(lang)] ?? formatFallback(value)
}

export function getExerciseLibraryMuscleGroupLabel(value: string | null | undefined, lang: string) {
  return labelFor(value, muscleGroupLabels, lang)
}

export function getExerciseLibraryMuscleLabel(value: string | null | undefined, lang: string) {
  return labelFor(value, muscleLabels, lang)
}

export function getExerciseLibraryMovementLabel(value: string | null | undefined, lang: string) {
  return labelFor(value, movementPatternLabels, lang)
}

export function getExerciseLibraryMetadataLabel({
  muscleGroup,
  primaryMuscle,
  lang,
}: {
  muscleGroup?: string | null
  primaryMuscle?: string | null
  lang: string
}) {
  return Array.from(new Set([
    getExerciseLibraryMuscleGroupLabel(muscleGroup, lang),
    getExerciseLibraryMuscleLabel(primaryMuscle, lang),
  ].filter(Boolean))).join(' · ')
}
