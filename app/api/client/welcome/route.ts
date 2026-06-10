import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { sendWelcomeEmail } from '@/lib/email/mailer'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const db = service()

  // Récupérer les infos client (user_id = l'utilisateur connecté)
  const { data: clientRow } = await db
    .from('coach_clients')
    .select('first_name, email, coach_id, id')
    .eq('user_id', user.id)
    .single()

  if (!clientRow?.email) return NextResponse.json({ ok: true }) // silencieux

  // Mark password as successfully set (prevents magiclink on resend)
  await db
    .from('coach_clients')
    .update({ password_set: true })
    .eq('id', clientRow.id)

  // Récupérer le nom du coach via ses user_metadata Supabase
  let coachName: string | null = null
  if (clientRow.coach_id) {
    const { data: coachUser } = await db.auth.admin.getUserById(clientRow.coach_id)
    const meta = coachUser?.user?.user_metadata
    const firstName = (meta?.first_name as string | undefined) ?? null
    const lastName  = (meta?.last_name  as string | undefined) ?? null
    coachName = firstName ? `${firstName}${lastName ? ' ' + lastName : ''}` : null
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '')

  try {
    await sendWelcomeEmail({
      to: clientRow.email,
      clientFirstName: clientRow.first_name ?? 'vous',
      coachName,
      loginUrl: `${siteUrl}/client/login`,
    })
  } catch (e) {
    console.error('Welcome email failed (non-blocking):', e)
  }

  return NextResponse.json({ ok: true })
}
