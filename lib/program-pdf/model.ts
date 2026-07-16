export interface PdfCoachInfo {
  id: string
  name: string
  email: string | null
  phone: string | null
  brandName?: string | null
  logoUrl?: string | null
}

export interface PdfClientInfo {
  id: string
  firstName: string
  lastName: string
  email: string | null
}

export interface PdfExercise {
  id: string
  name: string
  sets: number | null
  reps: string | null
  restSec: number | null
  rir: number | null
  tempo: string | null
  notes: string | null
  imageUrl: string | null
  position: number
}

export interface PdfSession {
  id: string
  name: string
  notes: string | null
  position: number
  exercises: PdfExercise[]
}

export interface PdfProgramDocumentData {
  sourceType: 'program' | 'template'
  title: string
  description: string | null
  weeks: number | null
  frequency: number | null
  goalLabel: string | null
  levelLabel: string | null
  muscleTags: string[]
  notes: string | null
  sessionMode: string | null
  generatedAt: string
  coach: PdfCoachInfo
  client: PdfClientInfo | null
  sessions: PdfSession[]
}

const GOAL_LABELS: Record<string, string> = {
  hypertrophy: 'Hypertrophie',
  strength: 'Force',
  endurance: 'Endurance',
  fat_loss: 'Perte de gras',
  recomp: 'Recomposition',
  maintenance: 'Maintenance',
  athletic: 'Athlétique',
}

const LEVEL_LABELS: Record<string, string> = {
  beginner: 'Débutant',
  intermediate: 'Intermédiaire',
  advanced: 'Avancé',
  elite: 'Élite',
}

export function goalLabel(value?: string | null) {
  if (!value) return null
  return GOAL_LABELS[value] ?? value
}

export function levelLabel(value?: string | null) {
  if (!value) return null
  return LEVEL_LABELS[value] ?? value
}

export function normalizeFileName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'programme'
}

export function buildProgramPdfFilename(data: PdfProgramDocumentData) {
  const base = normalizeFileName(data.title)
  const suffix = data.client
    ? normalizeFileName(`${data.client.firstName} ${data.client.lastName}`.trim())
    : data.sourceType === 'template'
      ? 'template'
      : 'client'
  return `${base}-${suffix}.pdf`
}

export function formatSessionSubtitle(session: PdfSession) {
  const count = session.exercises.length
  return `${count} exercice${count > 1 ? 's' : ''}`
}

export function formatPrescription(exercise: PdfExercise) {
  const bits: string[] = []
  if (exercise.sets) bits.push(`${exercise.sets} séries`)
  if (exercise.reps) bits.push(`${exercise.reps} reps`)
  if (typeof exercise.restSec === 'number' && exercise.restSec > 0) bits.push(`${exercise.restSec}s repos`)
  if (exercise.tempo) bits.push(`Tempo ${exercise.tempo}`)
  if (typeof exercise.rir === 'number') bits.push(`RIR ${exercise.rir}`)
  return bits.join(' · ')
}
