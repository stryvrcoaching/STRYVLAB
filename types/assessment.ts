// ============================================================
// ASSESSMENT SYSTEM — Types TypeScript
// ============================================================

export type AssessmentModule =
  | 'general'
  | 'biometrics'
  | 'measurements'
  | 'photos'
  | 'nutrition'
  | 'training'
  | 'cardio'
  | 'wellness'
  | 'goals'
  | 'medical'
  | 'lifestyle'
  | 'performance'
  | 'psychology'

export type InputType =
  | 'number'
  | 'text'
  | 'textarea'
  | 'scale_1_10'
  | 'single_choice'
  | 'multiple_choice'
  | 'boolean'
  | 'date'
  | 'photo_upload'
  | 'meal_journal'

export type MealType =
  | 'Petit déjeuner'
  | 'Collation matin'
  | 'Déjeuner'
  | 'Collation après-midi'
  | 'Dîner'
  | 'Collation soir'
  | 'Post-entraînement'
  | 'Autre'

export interface MealEntry {
  id: string
  type: MealType
  time: string
  description: string
  kcal?: number
  protein_g?: number
  carbs_g?: number
  fat_g?: number
}

export type TemplateType = 'intake' | 'weekly' | 'monthly' | 'custom'

export type SubmissionStatus = 'pending' | 'in_progress' | 'completed' | 'expired'

export type FilledBy = 'client' | 'coach'

export type NotificationType = 'assessment_completed' | 'assessment_sent' | 'program_updated'

// ------------------------------------------------------------------
// Template building blocks
// ------------------------------------------------------------------

// Condition d'affichage d'un champ basée sur la réponse d'un autre champ
// Le champ s'affiche si la valeur de `field_key` satisfait l'opérateur avec `value`.
// `field_key` peut référencer un champ du même bloc ou d'un autre bloc (recherche globale).
export type ConditionOperator =
  | 'eq'           // égal
  | 'neq'          // différent
  | 'includes'     // la réponse (multiple_choice) contient la valeur
  | 'not_empty'    // champ renseigné (toute valeur non vide)

export interface FieldCondition {
  field_key: string          // clé du champ déclencheur
  operator: ConditionOperator
  value?: string             // valeur attendue (non requis pour not_empty)
}

export interface FieldConfig {
  key: string
  label: string
  input_type: InputType
  unit?: string
  required: boolean
  visible: boolean          // le coach peut masquer un champ sans le supprimer
  min?: number
  max?: number
  step?: number
  options?: string[]        // pour single_choice et multiple_choice
  placeholder?: string
  helper?: string           // texte d'aide affiché sous le champ
  show_if?: FieldCondition  // condition d'affichage dynamique (runtime)
}

export interface BlockConfig {
  id: string
  module: AssessmentModule
  label: string
  order: number
  fields: FieldConfig[]
}

// ------------------------------------------------------------------
// DB Row types
// ------------------------------------------------------------------

export interface AssessmentTemplate {
  id: string
  coach_id: string
  name: string
  description?: string
  template_type: TemplateType
  blocks: BlockConfig[]
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface AssessmentSubmission {
  id: string
  coach_id: string
  client_id: string
  template_id: string
  template_snapshot: BlockConfig[]
  status: SubmissionStatus
  filled_by: FilledBy
  token?: string
  token_expires_at?: string
  submitted_at?: string
  bilan_date: string  // date ISO YYYY-MM-DD choisie par le coach
  created_at: string
  updated_at: string
}

export interface AssessmentResponse {
  id: string
  submission_id: string
  block_id: string
  field_key: string
  value_text?: string
  value_number?: number
  value_json?: unknown
  storage_path?: string
  created_at: string
}

export interface ClientNotification {
  id: string
  coach_id: string
  client_id?: string
  submission_id?: string
  type: NotificationType
  message: string
  read: boolean
  created_at: string
}

// ------------------------------------------------------------------
// Formulaire state
// ------------------------------------------------------------------

export type ResponseMap = Record<string, Record<string, string | number | string[] | boolean>>

// ------------------------------------------------------------------
// Vues enrichies (joins)
// ------------------------------------------------------------------

export interface SubmissionWithClient extends AssessmentSubmission {
  client: {
    id: string
    first_name: string
    last_name: string
    email?: string
  }
  template: {
    id: string
    name: string
  }
}

export interface SubmissionWithResponses extends AssessmentSubmission {
  responses: AssessmentResponse[]
}

// ------------------------------------------------------------------
// Payload API
// ------------------------------------------------------------------

export interface CreateTemplatePayload {
  name: string
  description?: string
  template_type: TemplateType
  blocks: BlockConfig[]
  is_default?: boolean
}

export interface CreateSubmissionPayload {
  client_id: string
  template_id: string
  filled_by: FilledBy
  send_email?: boolean
  bilan_date?: string  // YYYY-MM-DD, défaut = aujourd'hui côté serveur
}

export interface BulkResponsePayload {
  responses: Array<{
    block_id: string
    field_key: string
    value_text?: string
    value_number?: number
    value_json?: unknown
    storage_path?: string
  }>
  submit?: boolean
}
