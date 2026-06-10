import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET /api/assessments/templates/[templateId]
export async function GET(_req: NextRequest, { params }: { params: { templateId: string } }) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { data, error } = await serviceClient()
    .from('assessment_templates')
    .select('*')
    .eq('id', params.templateId)
    .eq('coach_id', user.id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Template introuvable' }, { status: 404 })
  }

  return NextResponse.json({ template: data })
}

// PUT /api/assessments/templates/[templateId]
export async function PUT(req: NextRequest, { params }: { params: { templateId: string } }) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const body = await req.json()

  if (body.is_default) {
    await serviceClient()
      .from('assessment_templates')
      .update({ is_default: false })
      .eq('coach_id', user.id)
      .eq('is_default', true)
      .neq('id', params.templateId)
  }

  const { data, error } = await serviceClient()
    .from('assessment_templates')
    .update({
      ...(body.name        && { name:          body.name.trim()        }),
      ...(body.description !== undefined && { description: body.description?.trim() || null }),
      ...(body.template_type && { template_type: body.template_type    }),
      ...(body.blocks      && { blocks:         body.blocks            }),
      ...(body.is_default  !== undefined && { is_default: body.is_default }),
    })
    .eq('id', params.templateId)
    .eq('coach_id', user.id)
    .select()
    .single()

  if (error || !data) {
    console.error('PUT /api/assessments/templates:', error)
    return NextResponse.json({ error: 'Mise à jour impossible' }, { status: 500 })
  }

  return NextResponse.json({ template: data })
}

// POST /api/assessments/templates/[templateId]/duplicate — duplique le template
export async function POST(_req: NextRequest, { params }: { params: { templateId: string } }) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { data: source, error: fetchError } = await serviceClient()
    .from('assessment_templates')
    .select('*')
    .eq('id', params.templateId)
    .eq('coach_id', user.id)
    .single()

  if (fetchError || !source) {
    return NextResponse.json({ error: 'Template introuvable' }, { status: 404 })
  }

  const { data, error } = await serviceClient()
    .from('assessment_templates')
    .insert({
      coach_id:      user.id,
      name:          `${source.name} (copie)`,
      description:   source.description,
      template_type: source.template_type,
      blocks:        source.blocks,
      is_default:    false,
    })
    .select()
    .single()

  if (error || !data) {
    console.error('POST /api/assessments/templates/[id] duplicate:', error)
    return NextResponse.json({ error: 'Duplication impossible' }, { status: 500 })
  }

  return NextResponse.json({ template: data }, { status: 201 })
}

// DELETE /api/assessments/templates/[templateId]
export async function DELETE(_req: NextRequest, { params }: { params: { templateId: string } }) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { error } = await serviceClient()
    .from('assessment_templates')
    .delete()
    .eq('id', params.templateId)
    .eq('coach_id', user.id)

  if (error) {
    console.error('DELETE /api/assessments/templates:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
