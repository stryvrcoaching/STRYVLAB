/**
 * Script de génération du catalogue d'exercices depuis les GIFs
 * Run: npx ts-node --project tsconfig.json scripts/generate-exercise-catalog.ts
 *
 * Corrections v2 (2026-04-17) :
 * - movementPattern : élévations latérales → lateral_raise (≠ horizontal_pull)
 * - movementPattern : tirage menton → vertical_pull (plan de traction vertical)
 * - movementPattern : overhead shrug → vertical_pull (élévation scapulaire plane verticale)
 * - movementPattern : shrug (tous) → scapular_elevation (trapèzes supérieurs isolés)
 * - movementPattern : curl-poulie-en-position-squat → elbow_flexion (≠ squat_pattern)
 * - movementPattern : extension-de-jambe-unilateral-machine-dips-assistes → knee_extension (≠ horizontal_push)
 * - isCompound : hip-thrust avec charge externe (barre, machine, smith) → true (fessiers + érecteurs + core)
 * - isCompound : nordic-hamstring-curl → true (conservé — ischio excentrique multi-joint)
 * - isCompound : hex-press → false (isolation triceps / pecs en position neutre)
 * - isCompound : oiseau-inverse-avec-sangles → false (deltoïde postérieur isolation)
 * - isCompound : tirage-menton → false (isolation deltoïdes + biceps, plan guidé)
 * - stimulus_coefficient : ajouté via table biomécanique calibrée (Schoenfeld 2010, Maeo 2021, Pedrosa 2022)
 */

import fs from 'fs'
import path from 'path'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ExerciseEntry {
  id: string
  name: string
  slug: string
  gifUrl: string
  muscleGroup: string
  exerciseType: 'exercise' | 'pedagogique'
  pattern: string[]
  movementPattern: string
  equipment: string[]
  isCompound: boolean
  muscles: string[]
  stimulus_coefficient: number
}

// ─── Name formatting ─────────────────────────────────────────────────────────

const PEDAGOGIQUE_SLUGS = new Set([
  'bonne-mauvaise-position-bassin-squat',
  'bonne-mauvaise-position-genoux-squat',
  'deadlift-vue-avant',
  'deadlift-vue-de-dos',
  'exercice-squat-vue-profil',
  'fente-avant-barre-vue-profil-homme',
  'position-bassin-souleve-de-terre',
])

function slugToName(slug: string): string {
  const base = slug.replace(/\.gif$/, '')
  let name = base.replace(/-/g, ' ')

  name = name.replace(/\s+exercice musculation$/i, '')
  name = name.replace(/\s+exercice musculation\s+\w+$/i, '')
  name = name.replace(/\s+exercice$/i, '')
  name = name.replace(/\s+musculation$/i, '')
  name = name.replace(/\bexercice\s+/gi, '')
  name = name.replace(/\s+musculation\b/gi, '')
  name = name.replace(/\s+shoulder press$/i, '')
  name = name.replace(/\s+abdos$/i, '')
  name = name.replace(/\s+abdominaux$/i, '')
  name = name.replace(/\s+exercice musculation\s+/gi, ' ')
  name = name.replace(/\s+dips assistes$/i, '')
  name = name.replace(/\s*\(\s*1\s*\)\s*/g, ' ')

  const accents: [RegExp, string][] = [
    [/\bDeveloppe\b/g, 'Développé'],
    [/\bdeveloppe\b/g, 'développé'],
    [/\bSouleve\b/g, 'Soulevé'],
    [/\bsouleve\b/g, 'soulevé'],
    [/\ba\b/g, 'à'],
    [/\belastique\b/gi, 'élastique'],
    [/\blaterale\b/gi, 'latérale'],
    [/\blaterales\b/gi, 'latérales'],
    [/\blateral\b/gi, 'latéral'],
    [/\belastiques\b/gi, 'élastiques'],
    [/\bhaltere\b/gi, 'haltère'],
    [/\bhalteres\b/gi, 'haltères'],
    [/\bderriere\b/gi, 'derrière'],
    [/\becarte\b/gi, 'écarté'],
    [/\becartes\b/gi, 'écartés'],
    [/\bepaule\b/gi, 'épaule'],
    [/\bepaules\b/gi, 'épaules'],
    [/\bele[vé]ation\b/gi, 'élévation'],
    [/\belevation\b/gi, 'Élévation'],
    [/\televations\b/gi, 'élévations'],
    [/\belevations\b/gi, 'Élévations'],
    [/\btete\b/gi, 'tête'],
    [/\bunilateral\b/gi, 'unilatéral'],
    [/\bunilaterale\b/gi, 'unilatérale'],
    [/\bplie\b/gi, 'plié'],
    [/\bpliee\b/gi, 'pliée'],
    [/\bgenere\b/gi, 'généré'],
    [/\ballonge\b/gi, 'allongé'],
    [/\ballongee\b/gi, 'allongée'],
    [/\bdebout\b/gi, 'debout'],
    [/\bassis\b/gi, 'assis'],
    [/\bincline\b/gi, 'incliné'],
    [/\binclinee\b/gi, 'inclinée'],
    [/\bdecline\b/gi, 'décliné'],
    [/\bdeclinee\b/gi, 'déclinée'],
    [/\bpoulie\b/gi, 'poulie'],
    [/\bpenche\b/gi, 'penché'],
    [/\bfermier\b/gi, 'fermier'],
    [/\bsuspendu\b/gi, 'suspendu'],
    [/\bserree\b/gi, 'serrée'],
    [/\bserre\b/gi, 'serré'],
    [/\binverse\b/gi, 'inversé'],
    [/\binversee\b/gi, 'inversée'],
    [/\bconcre\b/gi, 'concentré'],
    [/\bderriere\b/gi, 'derrière'],
    [/\bchaise\b/gi, 'chaise'],
    [/\blordose\b/gi, 'lordose'],
    [/\bprise\b/gi, 'prise'],
  ]

  for (const [pattern, replacement] of accents) {
    name = name.replace(pattern, replacement)
  }

  name = name.replace(/\s{2,}/g, ' ').trim()
  name = name.charAt(0).toUpperCase() + name.slice(1)

  return name
}

// ─── Equipment inference ──────────────────────────────────────────────────────

function inferEquipment(slug: string): string[] {
  const s = slug.toLowerCase()
  const equip: string[] = []

  if (s.includes('haltere') || s.includes('halteres') || s.includes('dumbbell') || s.includes('dumbell')) {
    equip.push('dumbbell')
  }

  const isBarbell =
    (s.includes('barre') && !s.includes('barre-front')) ||
    s.includes('barbell') ||
    s.includes('zercher') ||
    s.includes('pin-squat') ||
    s.includes('safety-bar-squat') ||
    s.includes('overhead-shrug') ||
    s.includes('reeves-deadlift') ||
    s.includes('renegade-row')
  if (isBarbell) equip.push('barbell')

  if (s.includes('smith') || s.includes('smith-machine')) {
    if (!equip.includes('smith')) equip.push('smith')
  }

  if (
    s.includes('machine') ||
    s.includes('hammer') ||
    s.includes('technogym') ||
    s.includes('iso-lateral') ||
    s.includes('prechargee') ||
    s.includes('convergente') ||
    s.includes('ab-coaster') ||
    s.includes('leg-press') ||
    s.includes('presse-a-cuisse') ||
    s.includes('presse-a-cuisses') ||
    s.includes('presse-cuisse') ||
    s.includes('hack-squat-assis') ||
    s.includes('pendulum-squat') ||
    s.includes('belt-squat') ||
    s.includes('sissy-squat-machine') ||
    s.includes('extension-hanche-machine') ||
    s.includes('extension-de-jambe') ||
    s.includes('leg-extension') ||
    s.includes('leg-curl') ||
    s.includes('hip-thrust-a-la-machine') ||
    s.includes('hip-thrust-machine') ||
    s.includes('extension-lombaire-a-la-machine') ||
    s.includes('shrug-machine')
  ) {
    equip.push('machine')
  }

  if (s.includes('poulie') || s.includes('cable') || s.includes('vis-a-vis')) {
    equip.push('cable')
  }

  if (s.includes('kettlebell') || s.includes('kettlebells')) {
    if (!equip.includes('kettlebell')) equip.push('kettlebell')
  }

  if (s.includes('windmill') && !equip.includes('kettlebell')) {
    equip.push('kettlebell')
    equip.push('dumbbell')
  }

  if (s.includes('elastique') || s.includes('bande-elastique')) equip.push('band')
  if (s.includes('sangle') || s.includes('trx') || s.includes('suspension')) equip.push('trx')
  if (s.includes('landmine')) equip.push('landmine')
  if (s.includes('medecine') || s.includes('medicine')) equip.push('medicine_ball')
  if (s.includes('sandbag')) equip.push('sandbag')
  if (s.includes('anneaux')) equip.push('rings')
  if (s.includes('ballon') || s.includes('swiss-ball')) equip.push('swiss_ball')
  if (s.includes('sled') || s.includes('traineau')) equip.push('sled')
  if (s.includes('trap-bar')) equip.push('trap_bar')
  if (s.includes('ez') || s.includes('barre-ez')) equip.push('ez_bar')
  if (s.includes('barre-front')) equip.push('barbell')
  if (s.includes('renegade-row') && !equip.includes('dumbbell')) equip.push('dumbbell')

  if (s.includes('valise') && !equip.includes('dumbbell')) {
    equip.push('dumbbell')
    equip.push('kettlebell')
  }

  if (s.includes('jefferson-squat') && !equip.includes('barbell')) equip.push('barbell')
  if (s.includes('pec-deck') && !equip.includes('machine')) equip.push('machine')

  const isClearBodyweight =
    s.includes('pompe') ||
    s.includes('dips-entre') ||
    s.includes('dips-sur') ||
    s.includes('dips-aux-anneaux') ||
    s.includes('planche') ||
    s.includes('gainage') ||
    s.includes('hollow') ||
    s.includes('dead-bug') ||
    s.includes('mountain-climber') ||
    s.includes('dragon-flag') ||
    s.includes('bird-dog') ||
    s.includes('superman') ||
    s.includes('fire-hydratant') ||
    s.includes('donkey-kick') ||
    s.includes('ciseaux') ||
    s.includes('cocon') ||
    s.includes('air-squat') ||
    s.includes('squat-pistol') ||
    s.includes('pistol-squat-assiste') ||
    s.includes('box-pistol-squat') ||
    s.includes('handstand') ||
    s.includes('pike-push') ||
    s.includes('nordic') ||
    s.includes('glute-ham') ||
    s.includes('sit-up-avec-medecine') ||
    s.includes('bear-plank') ||
    s.includes('crunch-au-sol') ||
    s.includes('crunch-avec-jambes') ||
    s.includes('cercles-jambes') ||
    s.includes('v-ups') ||
    s.includes('jackknife') ||
    s.includes('touche-talon') ||
    s.includes('chinese-plank') ||
    s.includes('hyperextension-inversee-ballon') ||
    s.includes('releve-de-genoux-suspendu') ||
    s.includes('releve-de-jambes-suspendu') ||
    s.includes('releve-jambes-chaise-romaine') ||
    s.includes('sits-up-chaise-romaine') ||
    s.includes('abdominaux-a-la-barre') ||
    s.includes('rotations-abdos-obliques-suspendu') ||
    s.includes('traction-') ||
    s.includes('chin-up') ||
    s.includes('marche-avec-elastique')

  if (isClearBodyweight && !equip.includes('bodyweight')) equip.push('bodyweight')
  if (equip.length === 0) equip.push('bodyweight')

  return Array.from(new Set(equip))
}

// ─── Pattern inference ────────────────────────────────────────────────────────

function inferPattern(slug: string, muscleGroup: string): string[] {
  const s = slug.toLowerCase()
  const patterns: string[] = []

  if (
    s.includes('developpe') ||
    (s.includes('press') && !s.includes('presse-a-cuisse') && !s.includes('presse-a-cuisses') && !s.includes('presse-cuisse') && !s.includes('leg-press')) ||
    s.includes('dips') ||
    s.includes('pompe') || s.includes('elevation-frontale') || s.includes('elevations-frontales') ||
    s.includes('pike-push') || s.includes('handstand-push') ||
    s.includes('extension-triceps') || s.includes('extensions-des-triceps') ||
    s.includes('extensions-triceps') || s.includes('extensions-concentres') ||
    s.includes('kickback') || s.includes('extension-horizontale-poulie') ||
    s.includes('barre-front') || s.includes('tate-press') || s.includes('hex-press')
  ) patterns.push('push')

  if (s.includes('thruster')) { patterns.push('push'); patterns.push('legs') }
  if (s.includes('overhead-squat')) { patterns.push('push'); patterns.push('legs') }

  if (
    s.includes('traction') || s.includes('rowing') || s.includes('tirage') ||
    s.includes('curl') ||
    s.includes('chin-up') || s.includes('pull-over') || s.includes('pullover') ||
    s.includes('face-pull') || s.includes('oiseau') || s.includes('sled-pull') ||
    s.includes('elevation-laterale') || s.includes('elevations-laterales') ||
    s.includes('elevation-en-y') || s.includes('ecarte-arriere') ||
    s.includes('pec-deck-inverse') || s.includes('rotation-externe') ||
    s.includes('passage-depaule') || s.includes('shrug') || s.includes('tirage-menton')
  ) patterns.push('pull')

  if (
    s.includes('souleve-de-terre') || s.includes('deadlift') || s.includes('good-morning') ||
    s.includes('hip-thrust') || s.includes('kettlebell-swing') ||
    s.includes('zercher-deadlift') || s.includes('reeves-deadlift') ||
    s.includes('rack-pull') || s.includes('pull-through') ||
    s.includes('reverse-hyperextension') || s.includes('hyperextension') ||
    s.includes('glute-ham') || s.includes('extension-lombaire') ||
    s.includes('extension-hanche') || s.includes('nordic') ||
    s.includes('back-extension') || s.includes('superman')
  ) patterns.push('hinge')

  if (
    s.includes('squat') || s.includes('fente') ||
    s.includes('presse-a-cuisse') || s.includes('presse-a-cuisses') || s.includes('presse-cuisse') ||
    s.includes('leg-press') || s.includes('hack-squat') ||
    s.includes('split-squat') || s.includes('montees-sur-banc') || s.includes('pistol') ||
    s.includes('sissy') || s.includes('belt-squat') || s.includes('pendulum') ||
    s.includes('safety-bar') || s.includes('jefferson-squat') || s.includes('zercher-squat') ||
    s.includes('air-squat') || s.includes('cossack') || s.includes('curtsy-lunge') ||
    s.includes('leg-extension') || s.includes('leg-curl') ||
    s.includes('extension-mollets') || s.includes('extensions-mollets') || s.includes('extensions-des-mollets') ||
    s.includes('box-pistol') ||
    s.includes('marche-avec-elastique')
  ) patterns.push('legs')

  if (
    s.includes('marche-du-fermier') || s.includes('zercher-carry') ||
    s.includes('sled-push') || s.includes('sled-pull') || s.includes('fentes-marchees')
  ) patterns.push('carry')

  if (
    muscleGroup === 'abdos' ||
    s.includes('planche') || s.includes('gainage') || s.includes('crunch') ||
    s.includes('rotation-buste') || s.includes('rotation-abdos') || s.includes('rotations-russes') ||
    s.includes('sit-up') || s.includes('releve-de') || s.includes('dragon-flag') ||
    s.includes('dead-bug') || s.includes('hollow') || s.includes('mountain-climber') ||
    s.includes('bird-dog') || s.includes('roulette') ||
    s.includes('windmill') || s.includes('ab-coaster') || s.includes('abdominaux') ||
    s.includes('obliques') || s.includes('jackknife') || s.includes('ciseaux') ||
    s.includes('cocon') || s.includes('v-ups') || s.includes('touche-talon') || s.includes('bear-plank') ||
    s.includes('cercles-jambes') || s.includes('russian-twist') || s.includes('chinese-plank') ||
    s.includes('pallof') || s.includes('zercher-carry') || s.includes('rotations-abdos-obliques')
  ) patterns.push('core')

  if (patterns.length === 0) {
    patterns.push(muscleGroup === 'abdos' ? 'core' : 'pull')
  }

  return Array.from(new Set(patterns))
}

// ─── isCompound inference ─────────────────────────────────────────────────────
//
// Définition biomécanique stricte : un exercice est composé s'il mobilise
// simultanément ≥2 articulations majeures avec recrutement actif de ≥2
// groupes musculaires distincts sous charge.
//
// Corrections v2 :
// - hip-thrust avec charge externe (barre/machine/smith) → TRUE
//   Raison : co-contraction simultanée fessiers (extension hanche), ischio-jambiers
//   (stabilisation genou), érecteurs spinaux + core (stabilisation lombaire).
//   Bret Contreras 2014 — EMG fessiers maximal sur hip thrust barre.
// - hip-thrust élastique/sangles/à genoux → FALSE (charge externe insuffisante,
//   mobilisation core/érecteurs absente)
// - nordic/glute-ham → TRUE (genou + hanche en chaîne postérieure)
// - hex-press → FALSE (isolation triceps/pecs en prise neutre, plan guidé)
// - oiseau-inverse (face pull, rear delt fly) → FALSE (deltoïde post. isolation)
// - tirage-menton → FALSE (upright row : isolation deltoïdes + biceps, plan guidé)
// - overhead-shrug → FALSE (élévation scapulaire pure, mono-articulaire)

function inferIsCompound(slug: string): boolean {
  const s = slug.toLowerCase()

  // ── Explicitement composés — priorité maximale, non annulable ──
  if (s.includes('nordic') || s.includes('glute-ham')) return true

  // Hip thrust avec charge externe lourde = composé
  // (fessiers + érecteurs + core en co-contraction — Contreras 2014)
  // hips-thrust (sans suffixe) = variante barre standard → composé
  if (s.includes('hip-thrust') || s.includes('hips-thrust')) {
    const isLightVariant =
      s.includes('elastique') || s.includes('sangle') ||
      s.includes('suspension') || s.includes('genoux') || s.includes('unilateral')
    return !isLightVariant
  }

  // ── Toujours isolation ──
  if (
    // Curl biceps (sauf tractions supination et chin-up qui recrutent grand dorsal)
    (s.includes('curl') && !s.includes('chin-up') && !s.includes('traction-supination')) ||
    // Élévations latérales et frontales (deltoïdes isolation)
    s.includes('elevation-laterale') || s.includes('elevations-laterales') ||
    s.includes('elevation-frontale') || s.includes('elevations-frontales') ||
    // Écarté / flies
    s.includes('ecarte') || s.includes('ecartes') ||
    // Isolation jambes
    s.includes('leg-extension') || s.includes('leg-curl') ||
    // Triceps isolation
    s.includes('extension-triceps') || s.includes('extensions-des-triceps') ||
    s.includes('extensions-concentres') || s.includes('kickback') ||
    s.includes('extension-horizontale-poulie') ||
    // Extension mollets (mono-articulaire cheville)
    s.includes('extension-mollets') || s.includes('extensions-mollets') || s.includes('extensions-des-mollets') ||
    // Pec deck / flies
    s.includes('pec-deck') || s.includes('fly') ||
    // Coiffe des rotateurs
    s.includes('rotation-externe') || s.includes('rotation-interne') ||
    // Shrug / élévation scapulaire (trapèzes supérieurs mono-articulaire)
    s.includes('shrug') ||
    // Tirage menton (upright row — isolation deltoïdes + biceps, plan guidé)
    s.includes('tirage-menton') ||
    // Hex press (isolation triceps/pecs en prise neutre)
    s.includes('hex-press') ||
    // Oiseau inversé (rear delt fly — deltoïde postérieur isolation)
    (s.includes('oiseau-inverse') || s.includes('oiseau')) && !s.includes('traction') ||
    // Core / abdominaux
    s.includes('crunch') || s.includes('planche') || s.includes('gainage') ||
    s.includes('sit-up') || s.includes('releve-de') || s.includes('dragon-flag') ||
    s.includes('hollow') || s.includes('dead-bug') || s.includes('mountain-climber') ||
    s.includes('bird-dog') || s.includes('roulette') || s.includes('ciseaux') ||
    s.includes('cocon') || s.includes('v-ups') || s.includes('touche-talon') ||
    s.includes('cercles-jambes') || s.includes('russian-twist') || s.includes('abdominaux') ||
    s.includes('ab-coaster') || s.includes('donkey-kick') || s.includes('fire-hydratant') ||
    s.includes('bear-plank') || s.includes('jackknife') || s.includes('chinese-plank') ||
    s.includes('superman') || s.includes('pallof') || s.includes('windmill') ||
    s.includes('rotations-abdos-obliques') || s.includes('rotations-russes') ||
    s.includes('rotation-buste') || s.includes('rotation-abdos') ||
    // Isolations épaules
    s.includes('face-pull') || s.includes('tate-press') ||
    // Isolation hanche / lombaires
    s.includes('extension-hanche') ||
    // Pull-through (isolation ischio/fessiers en tirage câble)
    s.includes('pull-through') ||
    // Hyperextension (érecteurs isolation)
    s.includes('extension-lombaire') || s.includes('reverse-hyperextension') ||
    s.includes('hyperextension') ||
    // Biceps variants isolation
    s.includes('drag-curl') || s.includes('spider-curl') || s.includes('waiter-curl') ||
    s.includes('curl-concentre') ||
    // JM press (triceps isolation)
    s.includes('barre-front') ||
    // Sissy squat (extension genou isolation)
    s.includes('sissy-squat') ||
    // Croix de fer (deltoïdes antérieurs isolation)
    s.includes('croix-de-fer') ||
    // Pec deck inversé (deltoïdes postérieurs isolation)
    s.includes('pec-deck-inverse')
  ) return false

  return true
}

// ─── Muscles inference ────────────────────────────────────────────────────────

function inferMuscles(slug: string, muscleGroup: string): string[] {
  const muscles: string[] = [muscleGroup]
  const s = slug.toLowerCase()

  if (muscleGroup === 'pectoraux') {
    if (s.includes('developpe') || s.includes('dips')) muscles.push('triceps', 'epaules')
  }
  if (muscleGroup === 'dos') {
    muscles.push('biceps')
    if (s.includes('souleve-de-terre') || s.includes('deadlift')) muscles.push('fessiers', 'ischio-jambiers', 'quadriceps')
    if (s.includes('rowing')) muscles.push('epaules')
  }
  if (muscleGroup === 'epaules') {
    if (s.includes('developpe') || s.includes('thruster')) muscles.push('triceps')
    if (s.includes('tirage-menton')) muscles.push('biceps', 'dos')
    if (s.includes('thruster')) muscles.push('quadriceps', 'fessiers')
  }
  if (muscleGroup === 'biceps') {
    if (s.includes('chin-up') || s.includes('traction-supination')) muscles.push('dos')
  }
  if (muscleGroup === 'triceps') {
    if (s.includes('developpe') || s.includes('dips')) muscles.push('pectoraux', 'epaules')
  }
  if (muscleGroup === 'fessiers') {
    if (s.includes('squat') || s.includes('fente') || s.includes('thruster')) muscles.push('quadriceps', 'ischio-jambiers')
    if (s.includes('souleve-de-terre') || s.includes('hip-thrust')) muscles.push('ischio-jambiers')
  }
  if (muscleGroup === 'quadriceps') {
    if (s.includes('squat') || s.includes('fente') || s.includes('thruster')) muscles.push('fessiers', 'ischio-jambiers')
    if (s.includes('presse') || s.includes('leg-press')) muscles.push('fessiers')
    if (s.includes('souleve-de-terre')) muscles.push('fessiers', 'ischio-jambiers', 'dos')
  }
  if (muscleGroup === 'ischio-jambiers') {
    if (s.includes('souleve-de-terre') || s.includes('deadlift')) muscles.push('fessiers', 'dos', 'quadriceps')
    if (s.includes('nordic') || s.includes('glute-ham')) muscles.push('fessiers', 'mollets')
  }

  return Array.from(new Set(muscles))
}

// ─── Movement pattern (sous-pattern biomécanique) ────────────────────────────
//
// Corrections v2 :
// - élévations latérales → lateral_raise (≠ horizontal_pull)
//   Raison : plan de force oblique 45–90° abduction scapulaire, aucune composante
//   de rétraction scapulaire (≠ rowing). Classification NSCA 2016.
// - tirage menton → vertical_pull
//   Raison : plan de traction vertical ascendant (coudes montant au-dessus des épaules).
//   Malgré la confusion fréquente avec "rowing", le vecteur primaire est vertical.
// - overhead shrug → scapular_elevation
//   Raison : élévation scapulaire pure en position overhead. Aucun pattern de traction.
// - shrug (tous) → scapular_elevation
//   Raison : mono-articulaire, élévation scapulo-thoracique pure.
// - curl-poulie-en-position-squat → elbow_flexion (posture squat ≠ pattern squat)
// - extension-de-jambe-unilateral-machine-dips-assistes → knee_extension

function inferMovementPattern(slug: string, muscleGroup: string): string {
  const s = slug.toLowerCase()

  // ── CORE ──
  if (s.includes('crunch') || s.includes('sit-up') || s.includes('releve-de') ||
      s.includes('releve-jambes') || s.includes('abdominaux-a-la-barre') ||
      s.includes('dragon-flag') || s.includes('v-ups') || s.includes('jackknife') ||
      s.includes('ciseaux') || s.includes('cocon') || s.includes('cercles-jambes') ||
      s.includes('ab-coaster') || s.includes('rotations-abdos-obliques'))
    return 'core_flex'

  if (s.includes('rotation-buste') || s.includes('rotations-russes') ||
      s.includes('russian-twist') || s.includes('pallof') || s.includes('windmill') ||
      s.includes('touche-talon'))
    return 'core_rotation'

  if (s.includes('planche') || s.includes('gainage') || s.includes('hollow') ||
      s.includes('dead-bug') || s.includes('mountain-climber') || s.includes('bear-plank') ||
      s.includes('chinese-plank') || s.includes('bird-dog') || s.includes('superman') ||
      s.includes('hyperextension-inversee') || s.includes('zercher-carry'))
    return 'core_anti_flex'

  // ── CALF ──
  if (s.includes('extension-mollets') || s.includes('extensions-mollets') ||
      s.includes('extensions-des-mollets'))
    return 'calf_raise'

  // ── CARRY ──
  if (s.includes('marche-du-fermier') || s.includes('sled-push') ||
      s.includes('sled-pull') || s.includes('fentes-marchees'))
    return 'carry'

  // ── SCAPULAR ELEVATION (shrug / overhead shrug) ──
  // Élévation scapulo-thoracique pure, plan vertical ascendant — trapèzes supérieurs
  // Distinct de horizontal_pull (pas de rétraction scapulaire) et vertical_pull (pas de traction)
  if (s.includes('shrug'))
    return 'scapular_elevation'

  // ── LATERAL RAISE ──
  // Abduction gléno-humérale dans le plan frontal / scapulaire (30–45° ante)
  // Plan de force oblique, aucune composante de rétraction scapulaire → ≠ horizontal_pull
  if (s.includes('elevation-laterale') || s.includes('elevations-laterales') ||
      s.includes('elevation-en-y'))
    return 'lateral_raise'

  // ── HIP ABDUCTION ──
  if (s.includes('abducteur') || s.includes('abduction-hanche') || s.includes('hip-abduction') ||
      s.includes('clamshell') || s.includes('fire-hydrant'))
    return 'hip_abduction'

  // ── HIP ADDUCTION ──
  if (s.includes('adducteur') || s.includes('adduction-hanche') || s.includes('hip-adduction') ||
      s.includes('sumo') && s.includes('machine'))
    return 'hip_adduction'

  // ── SHOULDER ROTATION ──
  if (s.includes('rotation-externe') || s.includes('rotation-interne') ||
      s.includes('shoulder-rotation') || s.includes('coiffe-rotateurs'))
    return 'shoulder_rotation'

  // ── SCAPULAR RETRACTION ──
  if (s.includes('retraction') || s.includes('face-pull') || s.includes('band-pull-apart') ||
      s.includes('w-raise') || s.includes('y-raise'))
    return 'scapular_retraction'

  // ── SCAPULAR PROTRACTION ──
  if (s.includes('protraction') || s.includes('serratus') || s.includes('punchout'))
    return 'scapular_protraction'

  // ── KNEE EXTENSION (isolation quad) ──
  if (
    (s.includes('leg-extension') &&
      !s.includes('machine-dips-assistes') &&
      !s.includes('hip-thrust-machine-leg-extension')) ||
    // Cas aberrant du catalogue : extension-de-jambe-unilateral-machine-dips-assistes
    s.includes('extension-de-jambe-unilateral-machine-dips-assistes') ||
    s.includes('sissy-squat')
  ) return 'knee_extension'

  // ── KNEE FLEXION (ischio-jambiers) ──
  if (s.includes('leg-curl') || s.includes('nordic') || s.includes('glute-ham'))
    return 'knee_flexion'

  // ── HIP HINGE ──
  if (s.includes('souleve-de-terre') || s.includes('deadlift') ||
      s.includes('good-morning') || s.includes('hip-thrust') || s.includes('hips-thrust') ||
      s.includes('kettlebell-swing') || s.includes('pull-through') ||
      s.includes('rack-pull') || s.includes('reeves-deadlift') ||
      s.includes('extension-lombaire') || s.includes('extension-hanche') ||
      s.includes('hyperextension') || s.includes('reverse-hyperextension') ||
      s.includes('superman'))
    return 'hip_hinge'

  // ── SQUAT / LUNGE ──
  if (s.includes('squat') || s.includes('fente') || s.includes('split-squat') ||
      s.includes('presse-a-cuisse') || s.includes('presse-a-cuisses') ||
      s.includes('presse-cuisse') || s.includes('leg-press') ||
      s.includes('hack-squat') || s.includes('montees-sur-banc') ||
      s.includes('pistol') || s.includes('belt-squat') ||
      s.includes('pendulum') || s.includes('safety-bar') ||
      s.includes('jefferson-squat') || s.includes('cossack') ||
      s.includes('curtsy-lunge') || s.includes('box-pistol'))
    return 'squat_pattern'

  // ── VERTICAL PULL ──
  // Inclut tirage menton (plan de traction vertical ascendant — vecteur primaire vertical)
  if (s.includes('traction') || s.includes('chin-up') ||
      s.includes('tirage-vertical') || s.includes('tirage-avant') ||
      s.includes('tirage-incline-poulie-haute') || s.includes('pull-over') ||
      s.includes('pullover') || s.includes('tirage-menton'))
    return 'vertical_pull'

  // ── HORIZONTAL PULL ──
  // Rétraction scapulaire dans le plan horizontal — rowing, tirage assis, face pull
  if (s.includes('rowing') || s.includes('tirage-horizontal') ||
      s.includes('seal-row') || s.includes('renegade-row') ||
      s.includes('oiseau') || s.includes('ecarte-arriere') ||
      s.includes('pec-deck-inverse') || s.includes('passage-depaule'))
    return 'horizontal_pull'

  // ── ELBOW FLEXION (curl) ──
  if (s.includes('curl') && !s.includes('chin-up') && !s.includes('traction-supination'))
    return 'elbow_flexion'

  // ── LATERAL RAISE (élévations frontales et croix de fer) ──
  if (s.includes('elevation-frontale') || s.includes('elevations-frontales') ||
      s.includes('croix-de-fer'))
    return 'lateral_raise'

  // ── ELBOW EXTENSION (triceps) ──
  if (s.includes('extension-triceps') || s.includes('extensions-des-triceps') ||
      s.includes('extensions-triceps') || s.includes('extensions-concentres') ||
      s.includes('kickback') || s.includes('extension-horizontale-poulie') ||
      s.includes('barre-front') || s.includes('tate-press'))
    return 'elbow_extension'

  // ── VERTICAL PUSH ──
  if ((s.includes('developpe') && (s.includes('epaule') || s.includes('militaire') ||
      s.includes('arnold') || s.includes('nuque') || s.includes('landmine') ||
      s.includes('kettlebell') || s.includes('overhead') || s.includes('z-press'))) ||
      s.includes('developpe-militaire') || s.includes('handstand-push') ||
      s.includes('pike-push') || s.includes('thruster'))
    return 'vertical_push'

  // ── HORIZONTAL PUSH ──
  if (s.includes('developpe') || s.includes('dips') || s.includes('pompe') ||
      s.includes('ecarte-couche') || s.includes('ecartes-') ||
      s.includes('ecarte-a-la-poulie') || s.includes('ecarte-poulie') ||
      s.includes('ecartes-poulie') || s.includes('pec-deck-butterfly') ||
      s.includes('hyght') ||
      (s.includes('press') && muscleGroup === 'pectoraux'))
    return 'horizontal_push'

  // Fallback par muscleGroup
  const fallbacks: Record<string, string> = {
    pectoraux: 'horizontal_push',
    dos: 'horizontal_pull',
    epaules: 'vertical_push',
    biceps: 'elbow_flexion',
    triceps: 'elbow_extension',
    quadriceps: 'squat_pattern',
    fessiers: 'hip_hinge',
    'ischio-jambiers': 'knee_flexion',
    mollets: 'calf_raise',
    abdos: 'core_anti_flex',
  }
  return fallbacks[muscleGroup] ?? 'core_anti_flex'
}

// ─── Stimulus coefficient ─────────────────────────────────────────────────────
//
// Coefficient 0.0–1.0 encodant le stimulus d'hypertrophie par set effectif.
// Composantes : tension mécanique (Schoenfeld 2010) × demande neurale (Vigotsky 2016)
// Modulation stretch-position : Maeo 2021–2022, Pedrosa 2022 (+0.08 si étirement maximal sous charge)
//
// Table par movementPattern × isCompound :
//
// squat_pattern composé      0.90  — recrutement chaîne fermée, charge absolue maximale
// squat_pattern machine      0.72  — fatigue SNC réduite, tension mécanique conservée
// squat_pattern isolation    0.45  — mono-articulaire (leg ext, sissy)
// hip_hinge composé lourd    0.95  — stimulus systémique maximal, ischio en étirement (Maeo 2021)
// hip_hinge composé modéré   0.82  — hip thrust, KB swing, good morning
// hip_hinge isolation        0.48  — extension lombaire, hyperextension, extension hanche
// horizontal_push composé    0.82  — pecs en excursion complète, tri-articulaire
// horizontal_push machine    0.68  — pattern guidé, demande neurale réduite
// horizontal_push isolation  0.52  — écarté, pec deck (stretch-position bonus si applicable)
// vertical_push composé      0.80  — deltoïdes + triceps + core stabilisation
// vertical_push machine      0.65  — support dorsier, demande neurale réduite
// horizontal_pull composé    0.88  — rowing : grand dorsal + rhomboïdes + ischio stabilisation
// horizontal_pull modéré     0.75  — rowing haltère, câble assis
// horizontal_pull isolation  0.40  — face pull, oiseau (faible masse, charge absolue minimale)
// vertical_pull composé BW   0.92  — tractions : grand dorsal excursion complète, poids corps
// vertical_pull machine      0.74  — tirage poulie haute
// vertical_pull isolation    0.40  — tirage menton (upright row — isolation)
// scapular_elevation         0.30  — trapèzes supérieurs, mono-articulaire, charge relative faible
// elbow_flexion standard     0.55  — mono-articulaire, charge absolue modérée
// elbow_extension overhead   0.52  — triceps longue portion en étirement (overhead > pushdown)
// elbow_extension poulie     0.42  — position raccourcie, charge faible
// lateral_raise              0.35  — deltoïdes médians, masse faible, recrutement UM bas seuil
// knee_flexion composé       0.78  — nordic : excentrique sous charge corporelle (Mjølsnes 2004)
// knee_flexion machine       0.55  — leg curl, stimulus inférieur au nordic
// calf_raise lourd           0.50  — excursion requise, fibres résistantes à la fatigue
// calf_raise standard        0.38  — soléaire dominant, stimulus limité vs patterns majeurs
// core_*                     0.28–0.32 — TUT élevé, tension sous-maximale, stimulus hypertrophique faible
// carry                      0.65  — stimulus systémique isométrique prolongé
//
// Bonus stretch-position (+0.08) : Maeo 2021 (curl incliné, leg curl assis),
//   Pedrosa 2022 (split squat bulgare, RDL), Maeo 2022 (extension triceps overhead)

// Slugs avec étirement maximal sous charge (stretch-mediated hypertrophy bonus)
const STRETCH_POSITION_SLUGS = new Set([
  // Biceps distaux en position allongée
  'curl-incline-halteres',
  'curl-incline',
  'spider-curl',
  'curl-concentre',
  'drag-curl',
  // Triceps longue portion overhead
  'extension-triceps-derriere-tete',
  'extension-triceps-overhead',
  'skull-crusher',
  'barre-front',
  // Ischio-jambiers distaux (leg curl assis > couché — Maeo 2021)
  'leg-curl-assis',
  'leg-curl-assis-machine',
  // Ischio-jambiers en étirement proximal
  'souleve-de-terre-roumain',
  'souleve-de-terre-roumain-kettlebell',
  'souleve-de-terre-roumain-landmine',
  'souleve-de-terre-jambes-tendues',
  'good-morning',
  'good-morning-elastique',
  // Fessiers / quadriceps en étirement profond
  'squat-bulgare-halteres-exercice-musculation',
  'fente-avant-barre-femme',
  'fentes-avant-exercice-musculation',
  'fentes-avant-kettlebell',
  'split-squat-bulgare',
  // Pull-over (grand dorsal en étirement maximal overhead)
  'pull-over',
  'pull-over-barre',
  'musculation-pull-over-assis-machine',
])

function inferStimulusCoeff(slug: string, movementPattern: string, isCompound: boolean): number {
  const s = slug.toLowerCase()

  // Bonus stretch-position (Maeo 2021, Pedrosa 2022)
  const stretchBonus = STRETCH_POSITION_SLUGS.has(s) ? 0.08 : 0

  let base: number

  switch (movementPattern) {
    case 'squat_pattern':
      if (isCompound) {
        // Machine guidée (leg press, hack squat machine) vs libre
        const isMachine = s.includes('machine') || s.includes('presse-a-cuisse') ||
          s.includes('presse-a-cuisses') || s.includes('presse-cuisse') ||
          s.includes('leg-press') || s.includes('hack-squat-assis') ||
          s.includes('pendulum') || s.includes('belt-squat')
        base = isMachine ? 0.72 : 0.90
      } else {
        base = 0.45 // leg extension, sissy squat
      }
      break

    case 'hip_hinge':
      if (isCompound) {
        // Composés lourds (SDT et variantes) vs modérés (hip thrust, KB swing)
        const isHeavy = s.includes('souleve-de-terre') || s.includes('deadlift') ||
          s.includes('rack-pull') || s.includes('reeves-deadlift') ||
          s.includes('zercher-deadlift') || s.includes('good-morning')
        base = isHeavy ? 0.95 : 0.82
      } else {
        base = 0.48 // extension lombaire, hyperextension, extension hanche, pull-through
      }
      break

    case 'horizontal_push':
      if (isCompound) {
        const isMachine = s.includes('machine') || s.includes('smith')
        base = isMachine ? 0.68 : 0.82
      } else {
        base = 0.52 // écarté, pec deck
      }
      break

    case 'vertical_push':
      if (isCompound) {
        const isMachine = s.includes('machine') || s.includes('smith')
        base = isMachine ? 0.65 : 0.80
      } else {
        base = 0.60 // pike push-up, handstand push-up (composé BW)
      }
      break

    case 'horizontal_pull':
      if (isCompound) {
        // Rowing barre / seal row (lourd) vs haltère / câble (modéré)
        const isHeavy = s.includes('barre') || s.includes('barbell') ||
          s.includes('seal-row') || s.includes('renegade-row')
        base = isHeavy ? 0.88 : 0.75
      } else {
        base = 0.40 // face pull, oiseau, écartés arrière, rotation externe
      }
      break

    case 'vertical_pull':
      if (isCompound) {
        // Tractions BW (poids du corps) vs machine/câble
        const isBodyweight = s.includes('traction') || s.includes('chin-up')
        base = isBodyweight ? 0.92 : 0.74
      } else {
        base = 0.40 // tirage menton (upright row, isolation)
      }
      break

    case 'scapular_elevation':
      // Trapèzes supérieurs mono-articulaire — faible stimulus hypertrophique
      base = 0.30
      break

    case 'elbow_flexion':
      // Différentiation overhead (stretch) gérée par stretchBonus
      base = 0.55
      break

    case 'elbow_extension':
      // Overhead (longue portion étirement) > poulie (raccourci)
      const isOverhead = s.includes('derriere-tete') || s.includes('overhead') ||
        s.includes('skull-crusher') || s.includes('barre-front')
      base = isOverhead ? 0.52 : 0.42
      break

    case 'lateral_raise':
      // Deltoïdes médians et antérieurs — masse faible, charge absolue minimale
      base = 0.35
      break

    case 'knee_flexion':
      // Nordic / GHD (composé excentrique) vs leg curl machine
      if (isCompound) base = 0.78
      else {
        // Leg curl assis (étirement distal) > leg curl couché — géré par stretchBonus
        base = 0.55
      }
      break

    case 'knee_extension':
      base = 0.45 // leg extension, sissy squat — isolation quad
      break

    case 'calf_raise':
      // Charge lourde (donkey, debout barre) vs machine assis
      const isHeavyCalf = s.includes('donkey') || s.includes('barre') ||
        s.includes('debout') || s.includes('standing')
      base = isHeavyCalf ? 0.50 : 0.38
      break

    case 'core_flex':
      base = 0.32
      break

    case 'core_anti_flex':
      base = 0.30
      break

    case 'core_rotation':
      base = 0.28
      break

    case 'carry':
      // Stimulus systémique isométrique prolongé — trapèzes, érecteurs, core, quad
      base = 0.65
      break

    default:
      base = 0.50
  }

  return Math.min(1.0, Math.round((base + stretchBonus) * 100) / 100)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const BASE_DIR = path.join(process.cwd(), 'public', 'bibliotheque_exercices')
const OUTPUT = path.join(process.cwd(), 'data', 'exercise-catalog.json')

const catalog: ExerciseEntry[] = []
const seen = new Set<string>()

const dirs = fs.readdirSync(BASE_DIR).filter(d => {
  return fs.statSync(path.join(BASE_DIR, d)).isDirectory()
})

for (const dir of dirs) {
  const dirPath = path.join(BASE_DIR, dir)
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.gif'))

  for (const file of files) {
    const slug = file.replace(/\.gif$/, '')
    const isPedagogique = PEDAGOGIQUE_SLUGS.has(slug)

    const id = `${dir}__${slug}`
    const uniqueId = seen.has(id) ? `${id}__2` : id
    seen.add(id)

    const gifUrl = `/bibliotheque_exercices/${dir}/${file}`
    const name = slugToName(file)
    const equipment = inferEquipment(slug)
    const pattern = inferPattern(slug, dir)
    const movementPattern = inferMovementPattern(slug, dir)
    const isCompound = inferIsCompound(slug)
    const muscles = inferMuscles(slug, dir)
    const stimulus_coefficient = inferStimulusCoeff(slug, movementPattern, isCompound)

    catalog.push({
      id: uniqueId,
      name,
      slug,
      gifUrl,
      muscleGroup: dir,
      exerciseType: isPedagogique ? 'pedagogique' : 'exercise',
      pattern,
      movementPattern,
      equipment,
      isCompound,
      muscles,
      stimulus_coefficient,
    })
  }
}

fs.writeFileSync(OUTPUT, JSON.stringify(catalog, null, 2))
console.log(`✅ Catalogue généré: ${catalog.length} exercices → ${OUTPUT}`)

// ── Audit rapide post-génération ──
const anomalies: string[] = []
for (const ex of catalog) {
  if (ex.movementPattern === 'horizontal_push' && ex.slug.includes('jambe')) {
    anomalies.push(`WARN: horizontal_push + jambe → ${ex.slug}`)
  }
  if (ex.movementPattern === 'squat_pattern' && ex.slug.includes('curl') && !ex.slug.includes('squat')) {
    anomalies.push(`WARN: squat_pattern + curl → ${ex.slug}`)
  }
  if (ex.movementPattern === 'horizontal_pull' && (ex.slug.includes('elevation-laterale') || ex.slug.includes('elevations-laterales'))) {
    anomalies.push(`WARN: horizontal_pull + elevation-laterale → ${ex.slug}`)
  }
  if (ex.stimulus_coefficient < 0.1 || ex.stimulus_coefficient > 1.0) {
    anomalies.push(`WARN: stimulus_coefficient hors range → ${ex.slug} = ${ex.stimulus_coefficient}`)
  }
}

if (anomalies.length === 0) {
  console.log('✅ Audit post-génération : 0 anomalie détectée')
} else {
  console.warn(`⚠️  Anomalies détectées (${anomalies.length}) :`)
  anomalies.forEach(a => console.warn(`   ${a}`))
}
