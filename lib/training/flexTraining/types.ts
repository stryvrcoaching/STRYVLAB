export type FlexWorkoutRelation = 'replace' | 'bonus' | 'unknown'
export type FlexWorkoutType = 'free' | 'bonus' | 'replacement' | 'modified_planned'
export type FlexWorkoutStatus = 'draft' | 'active' | 'completed' | 'cancelled'

export type FlexWorkoutSessionRow = {
  id: string
  client_id: string
  coach_id: string | null
  type: FlexWorkoutType
  relation_to_planned_workout: FlexWorkoutRelation | null
  source_program_id: string | null
  source_workout_id: string | null
  replaced_workout_id: string | null
  started_at: string
  ended_at: string | null
  duration_seconds: number | null
  perceived_difficulty: number | null
  global_rir: number | null
  notes: string | null
  status: FlexWorkoutStatus
  created_at: string
  updated_at: string
}

export type FlexWorkoutExerciseRow = {
  id: string
  session_id: string
  exercise_id: string | null
  custom_exercise_name: string | null
  muscle_groups: string[] | null
  movement_pattern: string | null
  equipment: string[] | null
  primary_muscles: string[] | null
  secondary_muscles: string[] | null
  is_compound: boolean | null
  unilateral: boolean | null
  image_url: string | null
  order_index: number
  notes: string | null
  created_at: string
  updated_at: string
}

export type FlexWorkoutSetRow = {
  id: string
  exercise_log_id: string
  set_number: number
  side: 'left' | 'right' | 'bilateral'
  set_type: 'warmup' | 'working' | 'cooldown' | 'dropset'
  weight: number | string | null
  reps: number | null
  rir: number | null
  rpe: number | null
  rest_seconds: number | null
  tempo: string | null
  completed: boolean
  pain_flag: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export type FlexWorkoutSummary = {
  total_sets: number
  hard_sets: number
  tonnage: number
  duration_seconds: number | null
  muscle_group_volume: Record<string, number>
  intensity_score: number | null
  fatigue_score: number | null
  recovery_impact: number | null
  adherence_impact: number | null
}

export type FlexWorkoutSessionBundle = {
  session: FlexWorkoutSessionRow
  exercises: Array<
    FlexWorkoutExerciseRow & {
      display_name: string
      sets: FlexWorkoutSetRow[]
    }
  >
  summary: FlexWorkoutSummary
}

export type FlexWorkoutCreatePayload = {
  relation_to_planned_workout?: FlexWorkoutRelation | null
  source_program_id?: string | null
  source_workout_id?: string | null
  replaced_workout_id?: string | null
  notes?: string | null
}

export type FlexWorkoutExerciseCreatePayload = {
  exercise_id?: string | null
  custom_exercise_name?: string | null
  muscle_groups?: string[] | null
  movement_pattern?: string | null
  equipment?: string[] | null
  primary_muscles?: string[] | null
  secondary_muscles?: string[] | null
  is_compound?: boolean | null
  unilateral?: boolean | null
  image_url?: string | null
  order_index?: number | null
  notes?: string | null
}

export type FlexWorkoutSetCreatePayload = {
  exercise_log_id: string
  set_number: number
  side?: 'left' | 'right' | 'bilateral'
  set_type?: 'warmup' | 'working' | 'cooldown' | 'dropset'
  weight?: number | null
  reps?: number | null
  rir?: number | null
  rpe?: number | null
  rest_seconds?: number | null
  tempo?: string | null
  completed?: boolean
  pain_flag?: boolean
  notes?: string | null
}
