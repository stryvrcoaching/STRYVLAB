import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { CreateTemplatePayload } from '@/types/assessment'

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET /api/assessments/templates — liste les templates du coach connecté
export async function GET() {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { data, error } = await serviceClient()
    .from('assessment_templates')
    .select('*')
    .eq('coach_id', user.id)
    .neq('name', '__csv_import__')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('GET /api/assessments/templates:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ templates: data })
}

// POST /api/assessments/templates — crée un nouveau template
export async function POST(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const body: CreateTemplatePayload = await req.json()

  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'Le nom du template est obligatoire' }, { status: 400 })
  }
  if (!Array.isArray(body.blocks) || body.blocks.length === 0) {
    return NextResponse.json({ error: 'Le template doit contenir au moins un bloc' }, { status: 400 })
  }

  // Si is_default = true, retirer le flag des autres templates du coach
  if (body.is_default) {
    await serviceClient()
      .from('assessment_templates')
      .update({ is_default: false })
      .eq('coach_id', user.id)
      .eq('is_default', true)
  }

  const { data, error } = await serviceClient()
    .from('assessment_templates')
    .insert({
      coach_id:      user.id,
      name:          body.name.trim(),
      description:   body.description?.trim() || null,
      template_type: body.template_type || 'intake',
      blocks:        body.blocks,
      is_default:    body.is_default ?? false,
    })
    .select()
    .single()

  if (error) {
    console.error('POST /api/assessments/templates:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ template: data }, { status: 201 })
}
