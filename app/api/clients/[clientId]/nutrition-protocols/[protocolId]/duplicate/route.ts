import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string; protocolId: string }> },
) {
  const { clientId, protocolId } = await params
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const db = serviceClient()
  const { data: source, error: sourceError } = await db
    .from('nutrition_protocols')
    .select(`
      *,
      days:nutrition_protocol_days(*),
      schedule_slots:nutrition_protocol_schedule_slots(*)
    `)
    .eq('id', protocolId)
    .eq('client_id', clientId)
    .eq('coach_id', user.id)
    .single()

  if (sourceError || !source) {
    return NextResponse.json({ error: 'Protocole introuvable' }, { status: 404 })
  }

  const { data: createdProtocol, error: createError } = await db
    .from('nutrition_protocols')
    .insert({
      client_id: clientId,
      coach_id: user.id,
      name: `${source.name} (copie)`,
      status: 'draft',
      notes: source.notes ?? null,
      schedule_start_date: source.schedule_start_date ?? null,
      cycle_sync_enabled: source.cycle_sync_enabled ?? false,
      tdee_auto_enabled: source.tdee_auto_enabled ?? false,
      tdee_adaptive_active: false,
      tdee_reference: source.tdee_reference ?? null,
    })
    .select('id')
    .single()

  if (createError || !createdProtocol) {
    return NextResponse.json({ error: createError?.message ?? 'Duplication impossible' }, { status: 500 })
  }

  const sourceDays = ((source as any).days ?? []).slice().sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
  if (sourceDays.length > 0) {
    const { error: daysError } = await db
      .from('nutrition_protocol_days')
      .insert(
        sourceDays.map((day: any) => ({
          protocol_id: createdProtocol.id,
          name: day.name,
          position: day.position ?? 0,
          calories: day.calories ?? null,
          protein_g: day.protein_g ?? null,
          carbs_g: day.carbs_g ?? null,
          fat_g: day.fat_g ?? null,
          hydration_ml: day.hydration_ml ?? null,
          role: day.role ?? 'neutral',
          carb_cycle_type: day.carb_cycle_type ?? null,
          cycle_sync_phase: day.cycle_sync_phase ?? null,
          recommendations: day.recommendations ?? null,
          meal_plan: day.meal_plan ?? [],
        })),
      )

    if (daysError) {
      await db.from('nutrition_protocols').delete().eq('id', createdProtocol.id)
      return NextResponse.json({ error: daysError.message }, { status: 500 })
    }
  }

  const sourceSlots = ((source as any).schedule_slots ?? []).slice().sort(
    (a: any, b: any) => (a.week_index ?? 0) - (b.week_index ?? 0) || (a.dow ?? 0) - (b.dow ?? 0),
  )
  if (sourceSlots.length > 0) {
    const { error: slotsError } = await db
      .from('nutrition_protocol_schedule_slots')
      .insert(
        sourceSlots.map((slot: any) => ({
          protocol_id: createdProtocol.id,
          week_index: slot.week_index,
          dow: slot.dow,
          protocol_day_position: slot.protocol_day_position,
        })),
      )

    if (slotsError) {
      await db.from('nutrition_protocols').delete().eq('id', createdProtocol.id)
      return NextResponse.json({ error: slotsError.message }, { status: 500 })
    }
  }

  const { data: duplicatedProtocol, error: duplicatedError } = await db
    .from('nutrition_protocols')
    .select(`
      *,
      days:nutrition_protocol_days(*),
      schedule_slots:nutrition_protocol_schedule_slots(*)
    `)
    .eq('id', createdProtocol.id)
    .eq('coach_id', user.id)
    .single()

  if (duplicatedError || !duplicatedProtocol) {
    return NextResponse.json({ error: duplicatedError?.message ?? 'Duplication impossible' }, { status: 500 })
  }

  return NextResponse.json({ protocol: duplicatedProtocol }, { status: 201 })
}
