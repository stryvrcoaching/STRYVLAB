export interface TrainingZone {
  targetPct: number   // fraction of 1RM (e.g. 0.72)
  rirTarget: number   // reps in reserve to aim for
  repRangeMin: number
  repRangeMax: number
}

const ZONES: Record<string, TrainingZone> = {
  hypertrophy:  { targetPct: 0.72, rirTarget: 2, repRangeMin: 8,  repRangeMax: 12 },
  strength:     { targetPct: 0.85, rirTarget: 1, repRangeMin: 3,  repRangeMax: 5  },
  endurance:    { targetPct: 0.57, rirTarget: 4, repRangeMin: 15, repRangeMax: 20 },
  recomp:       { targetPct: 0.71, rirTarget: 2, repRangeMin: 8,  repRangeMax: 12 },
  fat_loss:     { targetPct: 0.67, rirTarget: 3, repRangeMin: 10, repRangeMax: 15 },
  maintenance:  { targetPct: 0.70, rirTarget: 2, repRangeMin: 8,  repRangeMax: 12 },
}

const FALLBACK: TrainingZone = ZONES.hypertrophy

export function getTrainingZone(goal: string): TrainingZone {
  return ZONES[goal] ?? FALLBACK
}
