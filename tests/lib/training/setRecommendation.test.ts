import { describe, it, expect } from 'vitest'
import { recommendNextSet, estimateLoadFromOneRM } from '@/lib/training/setRecommendation'

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
    expect(result!.weight_kg).toBe(27.8)      // 27 + safety clamp (+4 * 0.2 = +0.8)
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
    expect(result!.weight_kg).toBe(87.5)      // 1RM load (80 + 7.5, within +10 safety clamp)
    expect(result!.reps).toBe(10)             // inZone but too easy → keep reps (10), increase weight
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
    expect(result!.weight_kg).toBe(90)        // 100 - safety clamp (-4 * 2.5 = -10)
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

  it('Path B — under rep_min AND RIR <= 1 → trigger failure recovery and drop weight', () => {
    // Client did 7 reps @ 52 kg (below zone 8-12) with RIR 1 (exhausted)
    // Should drop weight from 52 to 50 kg (52 - 2.5 = 49.5, rounded to 50 kg)
    const result = recommendNextSet({
      actual_weight_kg: 52,
      actual_reps: 7,
      rir_actual: 1,
      goal: 'hypertrophy',
      level: 'intermediate',
      planned_reps: 10,
      set_number: 2,
      rep_min: 8,
      rep_max: 12,
      target_rir: 2,
      weight_increment_kg: 2.5,
      prev_set_weight_kg: 52,
    })
    expect(result).not.toBeNull()
    expect(result!.weight_kg).toBe(47.5)     // 1RM load drop (within clamp 52 - 10 = 42)
    expect(result!.reps).toBe(10)
    expect(result!.phase).toBe('failure_recovery')
  })

  it('Path B — under rep_min but RIR > 1 → maintain weight and never round up weight', () => {
    // Client did 7 reps @ 52 kg (below zone 8-12) with RIR 2
    // RIR 2 > 1 means they did not fail. Maintain weight but do NOT round up to 52.5 kg.
    // Instead round down to 50 kg because they did not hit the rep range.
    const result = recommendNextSet({
      actual_weight_kg: 52,
      actual_reps: 7,
      rir_actual: 2,
      goal: 'hypertrophy',
      level: 'intermediate',
      planned_reps: 10,
      set_number: 2,
      rep_min: 8,
      rep_max: 12,
      target_rir: 2,
      weight_increment_kg: 2.5,
      prev_set_weight_kg: 52,
    })
    expect(result).not.toBeNull()
    expect(result!.weight_kg).toBe(52)
    expect(result!.reps).toBe(10)
    expect(result!.phase).toBe('intra_session')
  })

  // ── Phase 2 — 1RM-based autorégulation ──

  it('Phase 2 — estimateLoadFromOneRM: 100kg×13reps@RIR2 → e1RM→charge pour 8reps@RIR2', () => {
    // e1RM = 100 × (1 + (13+2)/30) = 100 × 1.5 = 150 kg
    // w_target pour 8+2=10 reps à failure = 150 / (1 + 10/30) = 150 / 1.333 ≈ 112.5 kg
    // Clamped at 100 + 4 * 2.5 = 110 kg
    const est = estimateLoadFromOneRM(100, 13, 2, 8, 2, 2.5)
    expect(est).not.toBeNull()
    expect(est!.weight_kg).toBe(110)
    expect(est!.e1rm).toBeCloseTo(150, 0)
    expect(est!.delta_kg).toBeCloseTo(10, 1)
  })

  it('Phase 2 — aboveZone + rirTooHigh → 1RM load targeting rep_min @ target_rir', () => {
    // Client fait 13 reps @ 100 kg avec RIR 2 (cible 8-12 @ RIR 2)
    // → aboveZone=true, rirTooHigh=(2 > 2+2=4)=false → branche aboveZone simple
    // 1RM → charge pour rep_min=8 @ rir=2 = ~112.5 kg
    const result = recommendNextSet({
      actual_weight_kg: 100,
      actual_reps: 13,
      rir_actual: 2,
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
    expect(result!.weight_kg).toBe(110)           // Clamped at 100 + 4 * 2.5
    expect(result!.reps).toBe(8)                 // rep_min
    expect(result!.used_one_rm_estimate).toBe(true)
    expect(result!.phase).toBe('intra_session')
  })

  it('Phase 2 — aboveZone + rirTooHigh extrême → 1RM load', () => {
    // Client fait 13 reps @ 100 kg avec RIR 5 (cible RIR 2, écart = 3 → rirTooHigh)
    // → branche aboveZone && rirTooHigh
    const result = recommendNextSet({
      actual_weight_kg: 100,
      actual_reps: 13,
      rir_actual: 5,
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
    // e1RM = 100 × (1 + 18/30) = 160 kg; w pour 10 reps fail = 160/1.333 = 120 kg
    // Mais clamped à MAX_RM_JUMP_INCREMENTS=4 × 2.5=10 → max 110 kg
    expect(result!.weight_kg).toBe(110)           // clamped at +4 increments
    expect(result!.used_one_rm_estimate).toBe(true)
  })

  it('Phase 2 — inZone + rirTooHigh → 1RM ajuste la charge, garde les mêmes reps', () => {
    // Client fait 10 reps @ 80 kg avec RIR 6 (cible RIR 2, écart = 4 → rirTooHigh)
    // → inZone=true, rirTooHigh=true
    // e1RM = 80 × (1 + 16/30) = 80 × 1.533 = 122.7 kg
    // w pour 10+2=12 reps fail = 122.7/1.4 = 87.6 → arrondi 87.5 kg
    const result = recommendNextSet({
      actual_weight_kg: 80,
      actual_reps: 10,
      rir_actual: 6,
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
    expect(result!.weight_kg).toBe(87.5)          // 1RM-derived, même nombre de reps
    expect(result!.reps).toBe(10)                 // reps inchangées
    expect(result!.used_one_rm_estimate).toBe(true)
    expect(result!.phase).toBe('intra_session')
  })

  it('Phase 2 — failure_recovery utilise 1RM si possible pour descendre à la charge optimale', () => {
    // Client fait 5 reps @ 100 kg avec RIR 0 (belowZone, failure)
    // e1RM = 100 × (1 + 5/30) = 116.7 kg
    // w pour 10+2=12 reps fail = 116.7/1.4 = 83.3 → arrondi 82.5 kg
    // Mais safety: doit toujours être < actual_weight (100 kg) → 82.5 < 100 ✓
    const result = recommendNextSet({
      actual_weight_kg: 100,
      actual_reps: 5,
      rir_actual: 0,
      goal: 'hypertrophy',
      level: 'intermediate',
      planned_reps: 10,
      set_number: 2,
      rep_min: 8,
      rep_max: 12,
      target_rir: 2,
      weight_increment_kg: 2.5,
    })
    expect(result).not.toBeNull()
    expect(result!.weight_kg).toBe(90)            // 1RM-derived drop clamped to 90kg (-10kg safety clamp)
    expect(result!.reps).toBe(10)                 // planned_reps
    expect(result!.phase).toBe('failure_recovery')
    expect(result!.used_one_rm_estimate).toBe(true)
    // Must always be strictly below actual_weight_kg
    expect(result!.weight_kg).toBeLessThan(100)
  })

  it('Phase 2 — Epley domaine invalide (reps > 20) → fallback incrément fixe', () => {
    // 25 reps → hors domaine Epley → fallback aboveZone: +1 incrément
    const result = recommendNextSet({
      actual_weight_kg: 40,
      actual_reps: 25,    // > EPLEY_MAX_REPS=20
      rir_actual: 1,
      goal: 'endurance',
      level: 'beginner',
      planned_reps: 15,
      set_number: 1,
      rep_min: 12,
      rep_max: 20,
      target_rir: 2,
      weight_increment_kg: 2.5,
    })
    expect(result).not.toBeNull()
    expect(result!.used_one_rm_estimate).toBeFalsy()  // 1RM non utilisé
    expect(result!.weight_kg).toBe(42.5)              // fallback +1 incrément
    expect(result!.phase).toBe('intra_session')
  })

  it('Phase 2 — unilatéral: is_unilateral flag propagé dans output, aucune conversion', () => {
    // Fentes: 20 kg/jambe × 12 reps (rep_max) @ RIR 2
    // → inZone, bon RIR → maintenir charge + 1 rep
    // Le moteur NE multiplie/divise PAS par 2 — travaille en charge-par-membre
    const result = recommendNextSet({
      actual_weight_kg: 20,   // per limb
      actual_reps: 12,        // dans la zone [10-15]
      rir_actual: 2,
      goal: 'hypertrophy',
      level: 'intermediate',
      planned_reps: 12,
      set_number: 1,
      rep_min: 10,
      rep_max: 15,
      target_rir: 2,
      weight_increment_kg: 2,
      is_unilateral: true,
    })
    expect(result).not.toBeNull()
    expect(result!.weight_kg).toBe(20)            // charge-par-membre inchangée
    expect(result!.reps).toBe(13)                 // +1 rep
    expect(result!.is_unilateral).toBe(true)      // flag propagé
    expect(result!.phase).toBe('intra_session')
  })

  it("Phase 2 — unilatéral false ou absent → is_unilateral absent de l'output", () => {
    const result = recommendNextSet({
      actual_weight_kg: 80,
      actual_reps: 10,
      rir_actual: 2,
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
    expect(result!.is_unilateral).toBeUndefined()
  })
})
