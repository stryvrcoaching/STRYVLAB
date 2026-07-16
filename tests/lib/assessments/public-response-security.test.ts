import { describe, expect, it } from 'vitest'
import {
  isValidPublicAssessmentToken,
  publicAssessmentPayloadSchema,
  validatePublicAssessmentResponses,
} from '@/lib/assessments/public-response-security'
import type { BlockConfig } from '@/types/assessment'

const snapshot: BlockConfig[] = [
  {
    id: 'general',
    module: 'general',
    label: 'Général',
    order: 0,
    fields: [
      { key: 'goal', label: 'Objectif', input_type: 'text', required: true, visible: true },
      { key: 'weight_kg', label: 'Poids', input_type: 'number', required: true, visible: true, min: 30, max: 300 },
      { key: 'front_photo', label: 'Photo', input_type: 'photo_upload', required: false, visible: true },
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
})
