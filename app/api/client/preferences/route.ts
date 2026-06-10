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

  const { data, error } = await service
    .from('client_preferences')
    .upsert(
      { client_id: client.id, ...body.data, updated_at: new Date().toISOString() },
      { onConflict: 'client_id' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ preferences: data })
}
