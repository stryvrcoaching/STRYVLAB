import { describe, it, expect } from 'vitest'
import { recommendNextSet } from '@/lib/training/setRecommendation'

describe('recommendNextSet', () => {
  it('returns null for invalid input (zero weight)', () => {
    const result = recommendNextSet({
      actual_weight_kg: 0,
      actual_reps: 8,
      rir_actual: 2,
      goal: 'hypertrophy',
      level: 'intermediate',
      planned_reps: 10,
      set_number: 1,
    })
    expect(result).toBeNull()
  })

  it('returns null for invalid input (zero reps)', () => {
    const result = recommendNextSet({
      actual_weight_kg: 80,
      actual_reps: 0,
      rir_actual: 2,
      goal: 'hypertrophy',
      level: 'intermediate',
      planned_reps: 10,
      set_number: 1,
    })
    expect(result).toBeNull()
  })

  // ── Path B — intra-session sans historique ──

  it('Path B — client dans la zone, bon RIR → maintenir charge, +1 rep', () => {
    const result = recommendNextSet({
      actual_weight_kg: 30,
      actual_reps: 9,   // dans la zone [8-12]
      rir_actual: 2,    // RIR cible
      goal: 'hypertrophy',
      level: 'intermediate',
      planned_reps: 10,
      set_number: 1,
      rep_min: 8,
      rep_max: 12,
      target_rir: 2,
      weight_increment_kg: 2.5,
    })
    expect(result).not.toBeNull()
    expect(result!.weight_kg).toBe(30)        // charge maintenue
    expect(result!.reps).toBe(10)             // +1 rep (9+1=10, cap rep_max=12)
    expect(result!.confidence).toBe('low')    // pas d'historique S-1
    expect(result!.delta_vs_last).toBeNull()
    expect(result!.phase).toBe('intra_session')
  })

  it('Path B — client dépasse rep_max → augmenter charge', () => {
    // Coach prescrit 10 reps, client en fait 16 → charge trop légère
    const result = recommendNextSet({
      actual_weight_kg: 27,
      actual_reps: 16,
      rir_actual: 1,
      goal: 'hypertrophy',
      level: 'intermediate',
      planned_reps: 10,
      set_number: 1,
      rep_min: 8,
      rep_max: 12,
      target_rir: 1,
      weight_increment_kg: 0.2,
    })
    expect(result).not.toBeNull()
    expect(result!.weight_kg).toBe(27.2)      // 27 + incrément 0.2
    expect(result!.reps).toBe(8)              // retour à rep_min
    expect(result!.phase).toBe('intra_session')
  })

  it('Path B — client trop facile (RIR >> target) → augmenter charge', () => {
    const result = recommendNextSet({
      actual_weight_kg: 80,
      actual_reps: 10,
      rir_actual: 6,   // RIR cible = 2, écart +4 → trop facile
      goal: 'hypertrophy',
      level: 'intermediate',
      planned_reps: 10,
      set_number: 1,
      rep_min: 8,
      rep_max: 12,
      target_rir: 2,
      weight_increment_kg: 2.5,
    })
    expect(result).not.toBeNull()
    expect(result!.weight_kg).toBe(82.5)      // 80 + 2.5
    expect(result!.reps).toBe(8)              // retour à rep_min
  })

  it('Path B — client proche échec (RIR < target-1) → maintenir charge', () => {
    const result = recommendNextSet({
      actual_weight_kg: 80,
      actual_reps: 10,
      rir_actual: 0,   // RIR cible = 2, réel = 0 → trop difficile
      goal: 'hypertrophy',
      level: 'intermediate',
      planned_reps: 10,
      set_number: 1,
      rep_min: 8,
      rep_max: 12,
      target_rir: 2,
      weight_increment_kg: 2.5,
    })
    expect(result).not.toBeNull()
    expect(result!.weight_kg).toBe(80)        // charge maintenue
  })

  it('Path B — sous rep_min + proche échec → descendre charge', () => {
    const result = recommendNextSet({
      actual_weight_kg: 100,
      actual_reps: 5,   // sous rep_min=8
      rir_actual: 0,    // proche échec
      goal: 'hypertrophy',
      level: 'intermediate',
      planned_reps: 10,
      set_number: 1,
      rep_min: 8,
      rep_max: 12,
      target_rir: 2,
      weight_increment_kg: 2.5,
    })
    expect(result).not.toBeNull()
    expect(result!.weight_kg).toBe(97.5)     // 100 - 2.5
  })

  // ── Path A — double progression avec historique S-1 ──

  it('Path A — S-1 à rep_max avec bon RIR → overload (charge +incrément)', () => {
    const result = recommendNextSet({
      actual_weight_kg: 80,
      actual_reps: 10,
      rir_actual: 2,
      goal: 'hypertrophy',
      level: 'intermediate',
      planned_reps: 10,
      set_number: 2,
      rep_min: 8,
      rep_max: 12,
      target_rir: 2,
      weight_increment_kg: 2.5,
      lastWeek: { weight_kg: 80, reps: 12, rir_actual: 2 }, // atteint rep_max
    })
    expect(result).not.toBeNull()
    expect(result!.weight_kg).toBe(82.5)         // 80 + 2.5
    expect(result!.reps).toBe(8)                 // retour rep_min
    expect(result!.delta_vs_last).toBe(2.5)
    expect(result!.phase).toBe('double_progression_overload')
    expect(result!.confidence).toBe('high')
  })

  it('Path A — S-1 sous rep_max → garder charge S-1, +1 rep', () => {
    const result = recommendNextSet({
      actual_weight_kg: 80,
      actual_reps: 9,
      rir_actual: 2,
      goal: 'hypertrophy',
      level: 'intermediate',
      planned_reps: 10,
      set_number: 2,
      rep_min: 8,
      rep_max: 12,
      target_rir: 2,
      weight_increment_kg: 2.5,
      lastWeek: { weight_kg: 80, reps: 9, rir_actual: 2 }, // sous rep_max=12
    })
    expect(result).not.toBeNull()
    expect(result!.weight_kg).toBe(80)           // charge maintenue
    expect(result!.reps).toBe(10)                // +1 rep (9+1)
    expect(result!.phase).toBe('double_progression_reps')
  })

  it('Path A — prev_set_weight est supérieur → ne jamais descendre sous le set précédent', () => {
    const result = recommendNextSet({
      actual_weight_kg: 80,
      actual_reps: 9,
      rir_actual: 2,
      goal: 'hypertrophy',
      level: 'intermediate',
      planned_reps: 10,
      set_number: 2,
      rep_min: 8,
      rep_max: 12,
      target_rir: 2,
      weight_increment_kg: 2.5,
      lastWeek: { weight_kg: 75, reps: 9, rir_actual: 2 },
      prev_set_weight_kg: 82.5, // set précédent plus lourd
    })
    expect(result).not.toBeNull()
    expect(result!.weight_kg).toBe(82.5)         // cap par prev_set_weight
  })

  it('no floating point artefacts with 0.2kg increment', () => {
    const result = recommendNextSet({
      actual_weight_kg: 32,
      actual_reps: 12,
      rir_actual: 1,
      goal: 'hypertrophy',
      level: 'intermediate',
      planned_reps: 10,
      set_number: 2,
      rep_min: 8,
      rep_max: 12,
      target_rir: 1,
      weight_increment_kg: 0.2,
      lastWeek: { weight_kg: 32, reps: 12, rir_actual: 1 },
    })
    expect(result).not.toBeNull()
    expect(result!.weight_kg).toBe(32.2)         // pas de 32.199999...
    expect(String(result!.weight_kg)).not.toContain('9999')
  })

  it('falls back to hypertrophy zone for unknown goal', () => {
    const result = recommendNextSet({
      actual_weight_kg: 100,
      actual_reps: 5,
      rir_actual: 2,
      goal: 'unknown_goal',
      level: 'intermediate',
      planned_reps: 5,
      set_number: 1,
    })
    expect(result).not.toBeNull()
    expect(result!.weight_kg).toBeGreaterThan(0)
  })

  // ── Path A — RIR modulation + delta badge ──

  it('Path A — overload dû MAIS RIR actuel trop bas (HOLD) → maintenir charge S-1', () => {
    // S-1 à rep_max avec bon RIR → overload normalement dû
    // MAIS rir_actual=0 ≤ target(2)-2=0 → HOLD → pas d'overload
    const result = recommendNextSet({
      actual_weight_kg: 80,
      actual_reps: 10,
      rir_actual: 0,
      goal: 'hypertrophy',
      level: 'intermediate',
      planned_reps: 10,
      set_number: 2,
      rep_min: 8,
      rep_max: 12,
      target_rir: 2,
      weight_increment_kg: 2.5,
      lastWeek: { weight_kg: 80, reps: 12, rir_actual: 2 },
    })
    expect(result).not.toBeNull()
    expect(result!.weight_kg).toBe(80)
    expect(result!.phase).toBe('double_progression_overload')
    expect(result!.confidence).toBe('high')
  })

  it('Path A — overload dû ET RIR actuel très haut (BOOST) → +2 incréments', () => {
    // rir_actual=5 ≥ target(2)+3=5 → BOOST → +2×incrément
    const result = recommendNextSet({
      actual_weight_kg: 80,
      actual_reps: 12,
      rir_actual: 5,
      goal: 'hypertrophy',
      level: 'intermediate',
      planned_reps: 10,
      set_number: 2,
      rep_min: 8,
      rep_max: 12,
      target_rir: 2,
      weight_increment_kg: 2.5,
      lastWeek: { weight_kg: 80, reps: 12, rir_actual: 2 },
    })
    expect(result).not.toBeNull()
    expect(result!.weight_kg).toBe(85)
    expect(result!.reps).toBe(8)
  })

  it('Path A — delta_vs_last null quand targetWeight <= prev_set_weight', () => {
    // Client déjà à 82.5 cette session → badge "+2.5kg vs S-1" trompeur → null
    const result = recommendNextSet({
      actual_weight_kg: 82.5,
      actual_reps: 10,
      rir_actual: 2,
      goal: 'hypertrophy',
      level: 'intermediate',
      planned_reps: 10,
      set_number: 3,
      rep_min: 8,
      rep_max: 12,
      target_rir: 2,
      weight_increment_kg: 2.5,
      lastWeek: { weight_kg: 80, reps: 12, rir_actual: 2 },
      prev_set_weight_kg: 82.5,
    })
    expect(result).not.toBeNull()
    expect(result!.weight_kg).toBe(82.5)
    expect(result!.delta_vs_last).toBeNull()
  })

  it('Path B — sous rep_min mais RIR OK → maintenir charge, viser planned_reps', () => {
    // Client fait 8 reps (sous rep_min=10) mais avec RIR 2 (pas proche de l'échec)
    // target_rir=1 → rirTooLow = rir_actual < (1-1) = rir < 0 → false
    // Charge trop lourde techniquement, pas à l'effort → maintenir, viser prescription
    const result = recommendNextSet({
      actual_weight_kg: 50,
      actual_reps: 8,
      rir_actual: 2,
      goal: 'hypertrophy',
      level: 'intermediate',
      planned_reps: 10,
      set_number: 1,
      rep_min: 10,
      rep_max: 12,
      target_rir: 1,
      weight_increment_kg: 2.5,
    })
    expect(result).not.toBeNull()
    expect(result!.weight_kg).toBe(50)
    expect(result!.reps).toBe(10)
    expect(result!.phase).toBe('intra_session')
    expect(result!.confidence).toBe('low')
  })
})
