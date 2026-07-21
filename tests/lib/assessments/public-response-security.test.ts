import { describe, expect, it } from 'vitest'
import {
  isValidPublicAssessmentToken,
  publicAssessmentPayloadSchema,
  validatePublicAssessmentResponses,
} from '@/lib/assessments/public-response-security'
import { isAdultBirthDate } from '@/lib/assessments/eligibility'
import type { BlockConfig } from '@/types/assessment'

const snapshot: BlockConfig[] = [
  {
    id: 'general',
    module: 'general',
    label: 'Général',
    order: 0,
    fields: [
      { key: 'goal', label: 'Objectif', input_type: 'text', required: true, visible: true },
      { key: 'birth_date', label: 'Date de naissance', input_type: 'date', required: false, visible: true },
      { key: 'weight_kg', label: 'Poids', input_type: 'number', required: true, visible: true, min: 30, max: 300 },
      { key: 'front_photo', label: 'Photo', input_type: 'photo_upload', required: false, visible: true },
    ],
  },
  {
    id: 'food_preferences',
    module: 'food_preferences',
    label: 'Préférences alimentaires',
    order: 1,
    fields: [
      {
        key: 'food_preferences_profile',
        label: 'Profil alimentaire',
        input_type: 'food_preferences',
        required: true,
        visible: true,
      },
    ],
  },
]

const context = {
  snapshot,
  coachId: 'coach-1',
  clientId: 'client-1',
  submissionId: 'submission-1',
}

describe('public assessment response security', () => {
  it('accepts adults and rejects minors using the exact birthday cutoff', () => {
    const reference = new Date('2026-07-20T12:00:00.000Z')
    expect(isAdultBirthDate('2008-07-20', reference)).toBe(true)
    expect(isAdultBirthDate('2008-07-21', reference)).toBe(false)
    expect(isAdultBirthDate('2026-02-31', reference)).toBe(false)
  })

  it('accepts only 256-bit hexadecimal public tokens', () => {
    expect(isValidPublicAssessmentToken('a'.repeat(64))).toBe(true)
    expect(isValidPublicAssessmentToken('../' + 'a'.repeat(64))).toBe(false)
    expect(isValidPublicAssessmentToken('a'.repeat(63))).toBe(false)
  })

  it('accepts responses declared by the immutable template snapshot', () => {
    const parsed = publicAssessmentPayloadSchema.parse({
      responses: [
        { block_id: 'general', field_key: 'goal', value_text: 'Reprendre le sport' },
        { block_id: 'general', field_key: 'weight_kg', value_number: 82 },
        {
          block_id: 'general',
          field_key: 'front_photo',
          storage_path: 'coach-1/client-1/submission-1/general/front_photo.jpg',
        },
      ],
    })

    expect(validatePublicAssessmentResponses({ ...context, payload: parsed })).toEqual({ ok: true })
  })

  it('rejects fields absent from the template snapshot', () => {
    const payload = publicAssessmentPayloadSchema.parse({
      responses: [{ block_id: 'general', field_key: 'admin_note', value_text: 'forged' }],
    })

    expect(validatePublicAssessmentResponses({ ...context, payload }).ok).toBe(false)
  })

  it('rejects numeric values outside template limits', () => {
    const payload = publicAssessmentPayloadSchema.parse({
      responses: [{ block_id: 'general', field_key: 'weight_kg', value_number: 999 }],
    })

    expect(validatePublicAssessmentResponses({ ...context, payload }).ok).toBe(false)
  })

  it('rejects incomplete final submissions', () => {
    const payload = publicAssessmentPayloadSchema.parse({
      responses: [
        { block_id: 'general', field_key: 'goal', value_text: 'Reprendre le sport' },
      ],
      submit: true,
    })

    expect(validatePublicAssessmentResponses({ ...context, payload }).ok).toBe(false)
  })

  it('rejects a minor birth date', () => {
    const payload = publicAssessmentPayloadSchema.parse({
      responses: [
        { block_id: 'general', field_key: 'birth_date', value_text: '2012-01-01' },
      ],
    })

    expect(validatePublicAssessmentResponses({ ...context, payload }).ok).toBe(false)
  })

  it('rejects storage paths outside the current submission', () => {
    const payload = publicAssessmentPayloadSchema.parse({
      responses: [
        {
          block_id: 'general',
          field_key: 'front_photo',
          storage_path: 'coach-2/client-2/submission-2/general/front_photo.jpg',
        },
      ],
    })

    expect(validatePublicAssessmentResponses({ ...context, payload }).ok).toBe(false)
  })

  it('validates the structured food preference profile', () => {
    const valid = publicAssessmentPayloadSchema.parse({
      responses: [
        {
          block_id: 'food_preferences',
          field_key: 'food_preferences_profile',
          value_json: {
            allergy_status: 'none',
            allergies: [],
            intolerances: [],
            frameworks: ['omnivore'],
            preferences: [],
          },
        },
      ],
    })
    const invalid = publicAssessmentPayloadSchema.parse({
      responses: [
        {
          block_id: 'food_preferences',
          field_key: 'food_preferences_profile',
          value_json: {
            allergy_status: 'declared',
            allergies: [],
            intolerances: [],
            frameworks: [],
            preferences: [],
          },
        },
      ],
    })

    expect(validatePublicAssessmentResponses({ ...context, payload: valid }).ok).toBe(true)
    expect(validatePublicAssessmentResponses({ ...context, payload: invalid }).ok).toBe(false)
  })
})
