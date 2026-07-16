import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { z } from 'zod'

const patchSchema = z.object({
  weight_unit:            z.enum(['kg', 'lbs']).optional(),
  height_unit:            z.enum(['cm', 'ft']).optional(),
  language:               z.enum(['fr', 'en', 'es']).optional(),
  notif_session_reminder: z.boolean().optional(),
  notif_bilan_received:   z.boolean().optional(),
  notif_program_updated:  z.boolean().optional(),
  notif_checkin_reminder: z.boolean().optional(),
  notif_hydration_reminder: z.boolean().optional(),
  notif_meal_reminder: z.boolean().optional(),
  notif_protein_reminder: z.boolean().optional(),
  notif_coach_messages: z.boolean().optional(),
  notif_progress_updates: z.boolean().optional(),
  training_reminder_times: z.array(z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)).min(1).max(2).optional(),
  hydration_reminder_first_time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).optional(),
  hydration_reminder_count: z.number().int().min(1).max(10).optional(),
  meal_reminder_breakfast_time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).optional(),
  meal_reminder_lunch_time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).optional(),
  protein_reminder_time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).optional(),
})

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: client } = await service
    .from('coach_clients')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const { data: prefs } = await service
    .from('client_preferences')
    .select('*')
    .eq('client_id', client.id)
    .single()

  // Return defaults if no preferences row yet
  return NextResponse.json({
    preferences: prefs ?? {
      weight_unit: 'kg',
      height_unit: 'cm',
      language: 'fr',
      notif_session_reminder: true,
      notif_bilan_received: true,
      notif_program_updated: true,
      notif_checkin_reminder: true,
      notif_hydration_reminder: true,
      notif_meal_reminder: true,
      notif_protein_reminder: true,
      notif_coach_messages: true,
      notif_progress_updates: true,
      training_reminder_times: ['08:00', '18:00'],
      hydration_reminder_first_time: '09:00',
      hydration_reminder_count: 3,
      meal_reminder_breakfast_time: '10:30',
      meal_reminder_lunch_time: '14:30',
      protein_reminder_time: '20:00',
    }
  })
}

export async function PATCH(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = patchSchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error }, { status: 400 })

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: client } = await service
    .from('coach_clients')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const update = { ...body.data, updated_at: new Date().toISOString() }
  const { data: existing, error: lookupError } = await service
    .from('client_preferences')
    .select('id')
    .eq('client_id', client.id)
    .maybeSingle()

  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 })

  const query = existing
    ? service.from('client_preferences').update(update).eq('client_id', client.id)
    : service.from('client_preferences').insert({
        client_id: client.id,
        weight_unit: 'kg',
        height_unit: 'cm',
        language: 'fr',
        notif_session_reminder: true,
        notif_bilan_received: true,
        notif_program_updated: true,
        notif_checkin_reminder: true,
        notif_hydration_reminder: true,
        notif_meal_reminder: true,
        notif_protein_reminder: true,
        notif_coach_messages: true,
        notif_progress_updates: true,
        training_reminder_times: ['08:00', '18:00'],
        hydration_reminder_first_time: '09:00',
        hydration_reminder_count: 3,
        meal_reminder_breakfast_time: '10:30',
        meal_reminder_lunch_time: '14:30',
        protein_reminder_time: '20:00',
        ...body.data,
        updated_at: new Date().toISOString(),
      })

  const { data, error } = await query.select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ preferences: data })
}
