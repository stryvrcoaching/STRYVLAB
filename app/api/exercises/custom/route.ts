import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { z } from 'zod'

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const createSchema = z.object({
  // Identity
  name: z.string().min(2).max(120),
  description: z.string().max(500).nullable().optional(),
  muscle_group: z.string().max(50),
  media_url: z.string().url(),
  media_type: z.enum(['image', 'gif', 'video']),
  // Classification
  movement_pattern: z.string().max(50),
  plane: z.enum(['sagittal', 'frontal', 'transverse']),
  mechanic: z.enum(['isolation', 'compound', 'isometric', 'plyometric']),
  unilateral: z.boolean(),
  equipment: z.array(z.string()).min(1).max(10),
  is_compound: z.boolean(),
  // Muscles
  primary_muscle: z.string().max(80),
  primary_activation: z.number().min(0.3).max(1.0),
  muscles: z.array(z.string()).max(12).optional().default([]),
  secondary_muscles_detail: z.array(z.string()).max(5).optional().default([]),
  secondary_activations: z.array(z.number()).max(5).optional().default([]),
  stabilizers: z.array(z.string()).max(5).optional().default([]),
  // Biomechanics
  joint_stress_spine: z.number().int().min(1).max(8),
  joint_stress_knee: z.number().int().min(1).max(8),
  joint_stress_shoulder: z.number().int().min(1).max(8),
  global_instability: z.number().int().min(1).max(9),
  coordination_demand: z.number().int().min(1).max(9),
  constraint_profile: z.string().max(50),
  stimulus_coefficient: z.number().min(0).max(1).optional().default(0.60),
  notes: z.string().max(1000).nullable().optional(),
})

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export async function GET(_req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = serviceClient()
  const { data, error } = await db
    .from('coach_custom_exercises')
    .select('*')
    .eq('coach_id', user.id)
    .order('name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = createSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map(i => i.message).join(', ') }, { status: 400 })
  }

  const db = serviceClient()
  const slug = toSlug(parsed.data.name)

  const { data, error } = await db
    .from('coach_custom_exercises')
    .insert({
      coach_id: user.id,
      slug,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      muscle_group: parsed.data.muscle_group,
      media_url: parsed.data.media_url,
      media_type: parsed.data.media_type,
      movement_pattern: parsed.data.movement_pattern,
      plane: parsed.data.plane,
      mechanic: parsed.data.mechanic,
      unilateral: parsed.data.unilateral,
      equipment: parsed.data.equipment,
      is_compound: parsed.data.is_compound,
      muscles: parsed.data.muscles,
      primary_muscle: parsed.data.primary_muscle,
      primary_activation: parsed.data.primary_activation,
      secondary_muscles_detail: parsed.data.secondary_muscles_detail,
      secondary_activations: parsed.data.secondary_activations,
      stabilizers: parsed.data.stabilizers,
      joint_stress_spine: parsed.data.joint_stress_spine,
      joint_stress_knee: parsed.data.joint_stress_knee,
      joint_stress_shoulder: parsed.data.joint_stress_shoulder,
      global_instability: parsed.data.global_instability,
      coordination_demand: parsed.data.coordination_demand,
      constraint_profile: parsed.data.constraint_profile,
      stimulus_coefficient: parsed.data.stimulus_coefficient,
      notes: parsed.data.notes ?? null,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Un exercice avec ce nom existe déjà.' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
