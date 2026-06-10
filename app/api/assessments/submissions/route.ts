import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { CreateSubmissionPayload } from '@/types/assessment'
import crypto from 'crypto'
import { sendBilanEmail } from '@/lib/email/mailer'
import { insertClientNotification } from '@/lib/notifications/insert-client-notification'

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET /api/assessments/submissions — liste les soumissions du coach avec join client + template
export async function GET(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get('client_id')

  let query = serviceClient()
    .from('assessment_submissions')
    .select(`
      *,
      client:coach_clients(id, first_name, last_name, email),
      template:assessment_templates(id, name)
    `)
    .eq('coach_id', user.id)
    .order('created_at', { ascending: false })

  if (clientId) {
    query = query.eq('client_id', clientId)
  }

  const { data, error } = await query

  if (error) {
    console.error('GET /api/assessments/submissions:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Exclude system CSV import submissions from the bilans list
  const filtered = (data ?? []).filter(
    (s: { template?: { name?: string } }) => s.template?.name !== '__csv_import__'
  )

  return NextResponse.json({ submissions: filtered })
}

// POST /api/assessments/submissions — crée une soumission + génère token + notifie
export async function POST(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const body: CreateSubmissionPayload = await req.json()

  if (!body.client_id || !body.template_id) {
    return NextResponse.json({ error: 'client_id et template_id sont obligatoires' }, { status: 400 })
  }

  const db = serviceClient()

  // Vérifier que le client appartient au coach
  const { data: client } = await db
    .from('coach_clients')
    .select('id, first_name, last_name, email')
    .eq('id', body.client_id)
    .eq('coach_id', user.id)
    .single()

  if (!client) {
    return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
  }

  // Fetch du template pour snapshot
  const { data: template } = await db
    .from('assessment_templates')
    .select('*')
    .eq('id', body.template_id)
    .eq('coach_id', user.id)
    .single()

  if (!template) {
    return NextResponse.json({ error: 'Template introuvable' }, { status: 404 })
  }

  const token = crypto.randomBytes(32).toString('hex')
  const tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const bilanDate = body.bilan_date ?? new Date().toISOString().slice(0, 10)

  const { data: submission, error: insertError } = await db
    .from('assessment_submissions')
    .insert({
      coach_id:          user.id,
      client_id:         body.client_id,
      template_id:       body.template_id,
      template_snapshot: template.blocks,   // snapshot immuable
      status:            'pending',
      filled_by:         body.filled_by || 'client',
      token,
      token_expires_at:  tokenExpiresAt,
      bilan_date:        bilanDate,
    })
    .select()
    .single()

  if (insertError || !submission) {
    console.error('POST /api/assessments/submissions:', insertError)
    return NextResponse.json({ error: insertError?.message || 'Erreur création' }, { status: 500 })
  }

  // Notif coach + notif client (target_user_id)
  await insertClientNotification(db, {
    coachId:      user.id,
    clientId:     body.client_id,
    submissionId: submission.id,
    type:         'assessment_sent',
    message:      `Ton coach t'a envoyé un bilan : "${template.name}".`,
  })

  const bilanUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/bilan/${token}`
  const coachFirstName = (user.user_metadata?.first_name as string | undefined) ?? null
  const coachLastName  = (user.user_metadata?.last_name  as string | undefined) ?? null
  const coachName = coachFirstName
    ? `${coachFirstName}${coachLastName ? ' ' + coachLastName : ''}`
    : null

  if (body.send_email && client.email) {
    try {
      await sendBilanEmail({
        to: client.email,
        clientFirstName: client.first_name,
        coachName,
        templateName: template.name,
        bilanUrl,
        expiresAt: new Date(tokenExpiresAt),
      })
    } catch (emailError) {
      console.error('Email send failed (non-blocking):', emailError)
    }
  }

  return NextResponse.json({
    submission,
    bilan_url: bilanUrl,
  }, { status: 201 })
}
