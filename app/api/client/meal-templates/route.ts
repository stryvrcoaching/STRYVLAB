import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET /api/client/meal-templates
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: clientRow } = await service()
    .from('coach_clients')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!clientRow) return NextResponse.json([])

  const { data, error } = await service()
    .from('coach_meal_templates')
    .select('id, name, description, calories_kcal, protein_g, carbs_g, fats_g, fiber_g, position')
    .eq('client_id', clientRow.id)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
