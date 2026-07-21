import { z } from 'zod'
import type { BlockConfig, FieldConfig } from '@/types/assessment'
import { extractTemplateBlocks, type TemplateSnapshotLike } from '@/lib/assessments/templateSnapshot'
import { foodPreferenceAssessmentSchema } from '@/lib/nutrition/food-preferences'
import { evaluateCondition } from '@/lib/assessments/condition'
import { isAdultBirthDate } from '@/lib/assessments/eligibility'
import type { AssessmentResponseValue, ResponseMap } from '@/types/assessment'

export const MAX_PUBLIC_ASSESSMENT_BODY_BYTES = 512_000

export function isValidPublicAssessmentToken(token: string) {
  return /^[a-f0-9]{64}$/.test(token)
}

const identifierSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/)

const responseSchema = z
  .object({
    block_id: identifierSchema,
    field_key: identifierSchema,
    value_text: z.string().max(10_000).optional(),
    value_number: z.number().finite().optional(),
    value_json: z.unknown().optional(),
    storage_path: z.string().max(500).optional(),
  })
  .strict()

export const publicAssessmentPayloadSchema = z
  .object({
    responses: z.array(responseSchema).min(1).max(250),
    submit: z.boolean().optional(),
  })
  .strict()
  .superRefine((payload, context) => {
    for (const [index, response] of payload.responses.entries()) {
      if (response.value_json === undefined) continue

      let serialized = ''
      try {
        serialized = JSON.stringify(response.value_json)
      } catch {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Valeur JSON invalide.',
          path: ['responses', index, 'value_json'],
        })
        continue
      }

      if (serialized.length > 64_000) {
        context.addIssue({
          code: z.ZodIssueCode.too_big,
          maximum: 64_000,
          inclusive: true,
          type: 'string',
          message: 'Valeur JSON trop volumineuse.',
          path: ['responses', index, 'value_json'],
        })
      }
    }
  })

export type PublicAssessmentPayload = z.infer<typeof publicAssessmentPayloadSchema>

function fieldIndex(blocks: BlockConfig[]) {
  const index = new Map<string, FieldConfig>()
  for (const block of blocks) {
    for (const field of block.fields) {
      if (!field.visible) continue
      index.set(`${block.id}\u001f${field.key}`, field)
    }
  }
  return index
}

function responseValue(response: PublicAssessmentPayload['responses'][number]): AssessmentResponseValue {
  if (response.value_json !== undefined) return response.value_json as AssessmentResponseValue
  if (response.value_number !== undefined) return response.value_number
  if (response.storage_path !== undefined) return response.storage_path
  return response.value_text ?? ''
}

function isMissingRequiredValue(value: AssessmentResponseValue | undefined) {
  return (
    value === undefined ||
    value === null ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  )
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
}

function isExpectedStoragePath(params: {
  storagePath: string
  coachId: string
  clientId: string
  submissionId: string
  blockId: string
  fieldKey: string
}) {
  const escapedExtension = '(?:jpg|jpeg|png|webp)'
  const legacyPath = `${params.coachId}/${params.clientId}/${params.submissionId}/${params.fieldKey}`
  const scopedPath = `${params.coachId}/${params.clientId}/${params.submissionId}/${params.blockId}/${params.fieldKey}`
  const pattern = new RegExp(`^(?:${escapeRegExp(legacyPath)}|${escapeRegExp(scopedPath)})\\.${escapedExtension}$`)
  return pattern.test(params.storagePath)
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function validatePublicAssessmentResponses(params: {
  payload: PublicAssessmentPayload
  snapshot: TemplateSnapshotLike
  coachId: string
  clientId: string
  submissionId: string
}): { ok: true } | { ok: false; error: string } {
  const blocks = extractTemplateBlocks(params.snapshot)
  const fields = fieldIndex(blocks)
  const responses: ResponseMap = {}

  for (const response of params.payload.responses) {
    const field = fields.get(`${response.block_id}\u001f${response.field_key}`)
    if (!field) return { ok: false, error: 'Le bilan contient un champ inconnu.' }
    responses[response.block_id] = {
      ...(responses[response.block_id] ?? {}),
      [response.field_key]: responseValue(response),
    }

    if (field.input_type === 'number' || field.input_type === 'scale_1_10') {
      if (response.value_number === undefined) {
        return { ok: false, error: 'Une valeur numérique est invalide.' }
      }
      if (field.min !== undefined && response.value_number < field.min) {
        return { ok: false, error: 'Une valeur numérique est hors limites.' }
      }
      if (field.max !== undefined && response.value_number > field.max) {
        return { ok: false, error: 'Une valeur numérique est hors limites.' }
      }
      continue
    }

    if (field.input_type === 'multiple_choice') {
      if (!isStringArray(response.value_json)) {
        return { ok: false, error: 'Une sélection multiple est invalide.' }
      }
      if (field.options && response.value_json.some((value) => !field.options?.includes(value))) {
        return { ok: false, error: 'Une option sélectionnée est invalide.' }
      }
      continue
    }

    if (field.input_type === 'photo_upload') {
      if (
        !response.storage_path ||
        !isExpectedStoragePath({
          storagePath: response.storage_path,
          coachId: params.coachId,
          clientId: params.clientId,
          submissionId: params.submissionId,
          blockId: response.block_id,
          fieldKey: response.field_key,
        })
      ) {
        return { ok: false, error: 'Le chemin de la photo est invalide.' }
      }
      continue
    }

    if (field.input_type === 'meal_journal') {
      if (response.value_json === undefined && response.value_text === undefined) {
        return { ok: false, error: 'Le journal alimentaire est invalide.' }
      }
      continue
    }

    if (field.input_type === 'food_preferences') {
      if (!foodPreferenceAssessmentSchema.safeParse(response.value_json).success) {
        return { ok: false, error: 'Le profil alimentaire est invalide ou incomplet.' }
      }
      continue
    }

    if (response.value_text === undefined) {
      return { ok: false, error: 'Une réponse textuelle est invalide.' }
    }

    if (field.key === 'birth_date' && !isAdultBirthDate(response.value_text)) {
      return { ok: false, error: 'Cette plateforme est réservée aux personnes majeures.' }
    }

    if (field.input_type === 'boolean' && !['true', 'false'].includes(response.value_text)) {
      return { ok: false, error: 'Une réponse booléenne est invalide.' }
    }

    if (field.input_type === 'single_choice' && field.options && !field.options.includes(response.value_text)) {
      return { ok: false, error: 'Une option sélectionnée est invalide.' }
    }
  }

  if (params.payload.submit) {
    for (const block of blocks) {
      for (const field of block.fields) {
        if (!field.visible || !field.required) continue
        if (!evaluateCondition(field.show_if, responses)) continue
        if (isMissingRequiredValue(responses[block.id]?.[field.key])) {
          return { ok: false, error: `Champ requis manquant : ${field.label}.` }
        }
      }
    }
  }

  return { ok: true }
}
