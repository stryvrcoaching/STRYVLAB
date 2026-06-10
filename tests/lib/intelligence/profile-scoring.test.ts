import { describe, it, expect } from 'vitest'
import { muscleConflictsWithRestriction } from '@/lib/programs/intelligence/catalog-utils'
import { scoreSRA } from '@/lib/programs/intelligence/scoring'
import type { InjuryRestriction, BuilderSession, TemplateMeta, IntelligenceProfile } from '@/lib/programs/intelligence/types'

describe('muscleConflictsWithRestriction', () => {
  it('detects conflict when muscle maps to restricted body_part', () => {
    const restrictions: InjuryRestriction[] = [
      { bodyPart: 'shoulder_right', severity: 'avoid' },
    ]
    expect(muscleConflictsWithRestriction('deltoide_anterieur', restrictions)).toEqual({
      conflicts: true,
      severity: 'avoid',
    })
  })

  it('returns null when no conflict', () => {
    const restrictions: InjuryRestriction[] = [
      { bodyPart: 'knee_right', severity: 'avoid' },
    ]
    expect(muscleConflictsWithRestriction('pectoraux', restrictions)).toBeNull()
  })

  it('handles bilateral restriction (lower_back affects both sides)', () => {
    const restrictions: InjuryRestriction[] = [
      { bodyPart: 'lower_back', severity: 'limit' },
    ]
    expect(muscleConflictsWithRestriction('lombaires', restrictions)).toEqual({
      conflicts: true,
      severity: 'limit',
    })
  })

  it('returns highest severity when multiple muscles conflict', () => {
    const restrictions: InjuryRestriction[] = [
      { bodyPart: 'shoulder_right', severity: 'monitor' },
      { bodyPart: 'shoulder_left', severity: 'avoid' },
    ]
    const result = muscleConflictsWithRestriction('deltoide_anterieur', restrictions)
    expect(result?.severity).toBe('avoid')
  })

  it('returns null for empty restrictions', () => {
    expect(muscleConflictsWithRestriction('quadriceps', [])).toBeNull()
  })
})

const SESSION_HEAVY: BuilderSession = {
  name: 'Day A',
  day_of_week: 1,
  exercises: [{
    name: 'Squat barre',
    sets: 4, reps: '5', rest_sec: 180, rir: 1, notes: '',
    movement_pattern: 'squat_pattern',
    equipment_required: ['barre'],
    primary_muscles: ['quadriceps', 'fessiers'],
    secondary_muscles: [],
  }],
}

const SESSION_SAME_MUS: BuilderSession = {
  name: 'Day B',
  day_of_week: 2,
  exercises: [{
    name: 'Leg Press',
    sets: 4, reps: '10', rest_sec: 90, rir: 2, notes: '',
    movement_pattern: 'squat_pattern',
    equipment_required: ['machine'],
    primary_muscles: ['quadriceps'],
    secondary_muscles: [],
  }],
}

const META_INTERMEDIATE: TemplateMeta = {
  goal: 'strength', level: 'intermediate', weeks: 8, frequency: 4, equipment_archetype: 'full_gym',
}

describe('scoreSRA with fitnessLevel from profile', () => {
  it('uses profile fitnessLevel over meta.level when profile is provided', () => {
    const profileBeginner: IntelligenceProfile = { injuries: [], equipment: [], fitnessLevel: 'beginner' }
    const profileElite: IntelligenceProfile = { injuries: [], equipment: [], fitnessLevel: 'elite' }

    const resultBeginner = scoreSRA([SESSION_HEAVY, SESSION_SAME_MUS], META_INTERMEDIATE, profileBeginner)
    const resultElite = scoreSRA([SESSION_HEAVY, SESSION_SAME_MUS], META_INTERMEDIATE, profileElite)

    // Beginner has longer SRA window (×1.25) → more violations → lower score
    expect(resultBeginner.score).toBeLessThan(resultElite.score)
  })

  it('falls back to meta.level when profile has no fitnessLevel', () => {
    const profileNoLevel: IntelligenceProfile = { injuries: [], equipment: [] }
    const resultWithProfile = scoreSRA([SESSION_HEAVY, SESSION_SAME_MUS], META_INTERMEDIATE, profileNoLevel)
    const resultWithoutProfile = scoreSRA([SESSION_HEAVY, SESSION_SAME_MUS], META_INTERMEDIATE)

    expect(resultWithProfile.score).toBe(resultWithoutProfile.score)
  })
})
