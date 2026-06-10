import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { sendBilanEmail } from '@/lib/email/mailer'
import { inngest } from '@/lib/inngest/client'

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET /api/assessments/submissions/[submissionId]
export async function GET(
  _req: NextRequest,
  { params }: { params: { submissionId: string } }
) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { data, error } = await serviceClient()
    .from('assessment_submissions')
    .select(`
      *,
      client:coach_clients(id, first_name, last_name, email),
      template:assessment_templates(id, name),
      responses:assessment_responses(*)
    `)
    .eq('id', params.submissionId)
    .eq('coach_id', user.id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Soumission introuvable' }, { status: 404 })
  }

  return NextResponse.json({ submission: data })
}

// DELETE /api/assessments/submissions/[submissionId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { submissionId: string } }
) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const db = serviceClient()

  const { data: existing } = await db
    .from('assessment_submissions')
    .select('id')
    .eq('id', params.submissionId)
    .eq('coach_id', user.id)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Soumission introuvable' }, { status: 404 })
  }

  await db.from('assessment_responses').delete().eq('submission_id', params.submissionId)

  const { error } = await db
    .from('assessment_submissions')
    .delete()
    .eq('id', params.submissionId)
    .eq('coach_id', user.id)

  if (error) {
    console.error('DELETE /api/assessments/submissions/[id]:', error)
    return NextResponse.json({ error: 'Suppression impossible' }, { status: 500 })
  }

  return NextResponse.json({ deleted: true })
}

// PATCH /api/assessments/submissions/[submissionId]
export async function PATCH(
  req: NextRequest,
  { params }: { params: { submissionId: string } }
) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const body = await req.json()
  const db = serviceClient()

  const updateData: Record<string, unknown> = {}
  if (body.status) updateData.status = body.status
  if (body.status === 'completed') updateData.submitted_at = new Date().toISOString()
  if (body.bilan_date) updateData.bilan_date = body.bilan_date
  // Régénérer le token (renvoyer un bilan expiré)
  if (body.renew_token) {
    updateData.token = crypto.randomBytes(32).toString('hex')
    updateData.token_expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    updateData.status = 'pending'
  }

  const { data, error } = await db
    .from('assessment_submissions')
    .update(updateData)
    .eq('id', params.submissionId)
    .eq('coach_id', user.id)
    .select()
    .single()

  if (error || !data) {
    console.error('PATCH /api/assessments/submissions/[id]:', error)
    return NextResponse.json({ error: 'Mise à jour impossible' }, { status: 500 })
  }

  // Notification si completed
  if (body.status === 'completed') {
    await db.from('client_notifications').insert({
      coach_id:      user.id,
      client_id:     data.client_id,
      submission_id: data.id,
      type:          'assessment_completed',
      message:       "Bilan complété par le coach.",
    })

    const bilanDateStr = data.bilan_date ? new Date(data.bilan_date).toLocaleDateString('fr-FR') : "récent"
    const contentText = "Ton coach a signé ton bilan du " + bilanDateStr + ". Clique pour le consulter."
    const urlText = data.token ? "/bilan/" + data.token : null

    await db.from('chat_messages').insert({
      client_id: data.client_id,
      role: 'assistant',
      content: contentText,
      message_type: 'bilan_signed',
      metadata: {
        submission_id: data.id,
        bilan_url: urlText,
        automated: true
      }
    })

    // Award bilan points once per submission
    const { data: existingBilanPoints } = await db
      .from('client_points')
      .select('id')
      .eq('client_id', data.client_id)
      .eq('action_type', 'bilan')
      .eq('reference_id', data.id)
      .maybeSingle()

    if (!existingBilanPoints) {
      await db.from('client_points').insert({
        client_id: data.client_id,
        action_type: 'bilan',
        points: 20,
        reference_id: data.id,
      })

      await inngest.send({
        name: 'points/level.update',
        data: { client_id: data.client_id },
      })
    }
  }

  const bilanUrl = data.token
    ? `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/bilan/${data.token}`
    : undefined

  // Send email if requested
  if (body.send_email && bilanUrl) {
    const { data: clientData } = await db
      .from('coach_clients')
      .select('first_name, last_name, email')
      .eq('id', data.client_id)
      .single()
    if (clientData?.email) {
      const { data: { user: coachUser } } = await supabase.auth.getUser()
      const coachName = coachUser?.user_metadata?.full_name ?? coachUser?.email ?? 'Votre coach'
      // Fetch template name from submission
      const { data: subWithTemplate } = await db
        .from('assessment_submissions')
        .select('template:assessment_templates(name)')
        .eq('id', params.submissionId)
        .single()
      const templateName = (subWithTemplate?.template as { name?: string } | null)?.name ?? 'Bilan'
      sendBilanEmail({
        to: clientData.email,
        clientFirstName: clientData.first_name,
        bilanUrl,
        expiresAt: data.token_expires_at ? new Date(data.token_expires_at) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        coachName,
        templateName,
      }).catch((e: unknown) => console.error('[send_email] mailer error:', e))
    }
  }

  return NextResponse.json({ submission: data, bilan_url: bilanUrl })
}
